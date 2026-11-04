const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de métricas Prometheus (Requerimiento APP-01)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestTimer = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code']
});

// Conexión a la base de datos PostgreSQL usando variables de entorno de Doppler
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  host: 'postgres', // Nombre del Service de K8s de la base de datos
  database: process.env.POSTGRES_DB || 'kubelab',
  password: process.env.POSTGRES_PASSWORD || 'supersecreto',
  port: 5432,
});

// Endpoint de Salud (Requerimiento APP-01)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Endpoint de Métricas para Prometheus (Requerimiento APP-01 y OBS-01)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Endpoint CRUD: Listar registros (Ejemplo: Entidad 'items')
app.get('/api/items', async (req, res) => {
  const end = httpRequestTimer.startTimer();
  try {
    // Aseguramos que la tabla exista
    await pool.query('CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT)');
    const result = await pool.query('SELECT * FROM items');
    res.json(result.rows);
    end({ method: 'GET', route: '/api/items', code: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
    end({ method: 'GET', route: '/api/items', code: 500 });
  }
});

// Endpoint CRUD: Crear registro
app.post('/api/items', async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT)');
    const result = await pool.query('INSERT INTO items (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint CRUD: Actualizar registro (PUT)
app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await pool.query('UPDATE items SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint CRUD: Eliminar registro (DELETE)
app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
}); 

// segundo Trigger para la API