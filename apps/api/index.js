const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: 'postgres',
  database: process.env.POSTGRES_DB || 'postgres', // Usar postgres como fallback seguro
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: 5432,
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/api/items', async (req, res) => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT)');
    const result = await pool.query('SELECT * FROM items');
    res.json(result.rows);
  } catch (err) {
    console.error("DB Error on GET:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, name TEXT)');
    const result = await pool.query('INSERT INTO items (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("DB Error on POST:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('API running on port 3000');
});