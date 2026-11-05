const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const client = require('prom-client');

const SCHEMA_SQL = 'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT NOT NULL)';
const MAX_NAME_LENGTH = 200;

// APP-01: CRUD completo sobre "items", /health y /metrics (Prometheus).
function createApp(pool) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- Metricas (OBS-01 / OBS-04) -------------------------------------------
  // Registro propio (no el global) para poder crear la app varias veces en las pruebas.
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total de peticiones HTTP atendidas por la API',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });
  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duracion de las peticiones HTTP de la API en segundos',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  });

  app.use((req, res, next) => {
    // Las sondas de Kubernetes y el scrape de Prometheus no cuentan como trafico de usuarios.
    if (req.path === '/health' || req.path === '/metrics') return next();
    const stopTimer = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      const labels = { method: req.method, route, status_code: res.statusCode };
      httpRequests.inc(labels);
      stopTimer(labels);
    });
    next();
  });

  // --- Esquema (APP-07) -------------------------------------------------------
  let schemaReady = null;
  const ensureSchema = () => {
    if (!schemaReady) {
      schemaReady = pool.query(SCHEMA_SQL).catch((err) => {
        schemaReady = null; // reintentar en la siguiente peticion
        throw err;
      });
    }
    return schemaReady;
  };

  const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  };
  const cleanName = (value) => (typeof value === 'string' ? value.trim() : '');
  const invalidName = (name) => !name || name.length > MAX_NAME_LENGTH;

  const dbError = (res, method, err) => {
    console.error(`DB Error on ${method}:`, err.message);
    res.status(500).json({ error: 'Error de base de datos' });
  };

  // --- Endpoints --------------------------------------------------------------
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Listar
  app.get('/api/items', async (req, res) => {
    try {
      await ensureSchema();
      const result = await pool.query('SELECT * FROM items ORDER BY id');
      res.json(result.rows);
    } catch (err) {
      dbError(res, 'GET', err);
    }
  });

  // Crear
  app.post('/api/items', async (req, res) => {
    const name = cleanName(req.body && req.body.name);
    if (invalidName(name)) {
      return res.status(400).json({ error: `El nombre es obligatorio (maximo ${MAX_NAME_LENGTH} caracteres)` });
    }
    try {
      await ensureSchema();
      const result = await pool.query('INSERT INTO items (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      dbError(res, 'POST', err);
    }
  });

  // Actualizar
  app.put('/api/items/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const name = cleanName(req.body && req.body.name);
    if (!id) return res.status(400).json({ error: 'Id invalido' });
    if (invalidName(name)) {
      return res.status(400).json({ error: `El nombre es obligatorio (maximo ${MAX_NAME_LENGTH} caracteres)` });
    }
    try {
      await ensureSchema();
      const result = await pool.query('UPDATE items SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });
      res.json(result.rows[0]);
    } catch (err) {
      dbError(res, 'PUT', err);
    }
  });

  // Eliminar
  app.delete('/api/items/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id invalido' });
    try {
      await ensureSchema();
      const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Registro no encontrado' });
      res.status(204).end();
    } catch (err) {
      dbError(res, 'DELETE', err);
    }
  });

  // JSON mal formado en el cuerpo -> 400 en lugar de una pagina HTML de error.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalido' });
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  });

  return { app, ensureSchema };
}

async function main() {
  const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'postgres',
    database: process.env.POSTGRES_DB || 'kubelab',
    password: process.env.POSTGRES_PASSWORD || 'supersecreto',
    port: 5432,
  });
  // Un error en un cliente inactivo del pool no debe tumbar el proceso.
  pool.on('error', (err) => console.error('PG pool error:', err.message));

  const { app, ensureSchema } = createApp(pool);
  app.listen(3000, () => console.log('API running on port 3000'));

  // Crea la tabla al arrancar; si la base aun no esta lista, reintenta sin bloquear la API.
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await ensureSchema();
      console.log('DB schema ready');
      return;
    } catch (err) {
      console.error(`DB schema init failed (attempt ${attempt}/30):`, err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { createApp };
