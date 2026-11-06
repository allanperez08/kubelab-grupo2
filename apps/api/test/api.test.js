const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../index');

// Pool falso en memoria: responde a las 5 sentencias SQL que usa la API.
// Asi las pruebas del pipeline (CD-01) no necesitan una base de datos real.
function fakePool() {
  let rows = [];
  let seq = 0;
  return {
    async query(sql, params = []) {
      if (/^CREATE TABLE/i.test(sql)) return { rows: [] };
      if (/^SELECT \* FROM items/i.test(sql)) return { rows: [...rows].sort((a, b) => a.id - b.id) };
      if (/^INSERT INTO items/i.test(sql)) {
        const row = { id: ++seq, name: params[0] };
        rows.push(row);
        return { rows: [row] };
      }
      if (/^UPDATE items/i.test(sql)) {
        const row = rows.find((r) => r.id === params[1]);
        if (row) row.name = params[0];
        return { rows: row ? [row] : [] };
      }
      if (/^DELETE FROM items/i.test(sql)) {
        const found = rows.filter((r) => r.id === params[0]);
        rows = rows.filter((r) => r.id !== params[0]);
        return { rows: found.map((r) => ({ id: r.id })) };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
}

async function withServer(pool, fn) {
  const { app } = createApp(pool);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('/health responde saludable', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'saludable' });
  });
});

test('CRUD completo: crear, listar, editar y eliminar', async () => {
  await withServer(fakePool(), async (base) => {
    let res = await fetch(`${base}/api/items`, json('POST', { name: '  Laptop  ' }));
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, 'Laptop'); // se recorta el espacio sobrante

    res = await fetch(`${base}/api/items`);
    assert.deepEqual(await res.json(), [created]);

    res = await fetch(`${base}/api/items/${created.id}`, json('PUT', { name: 'Monitor' }));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).name, 'Monitor');

    res = await fetch(`${base}/api/items/${created.id}`, { method: 'DELETE' });
    assert.equal(res.status, 204);

    res = await fetch(`${base}/api/items`);
    assert.deepEqual(await res.json(), []);
  });
});

test('PUT y DELETE sobre un id inexistente devuelven 404', async () => {
  await withServer(fakePool(), async (base) => {
    let res = await fetch(`${base}/api/items/99`, json('PUT', { name: 'X' }));
    assert.equal(res.status, 404);
    res = await fetch(`${base}/api/items/99`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });
});

test('validaciones: nombre vacio, id invalido y JSON mal formado devuelven 400', async () => {
  await withServer(fakePool(), async (base) => {
    let res = await fetch(`${base}/api/items`, json('POST', { name: '   ' }));
    assert.equal(res.status, 400);
    res = await fetch(`${base}/api/items/abc`, json('PUT', { name: 'X' }));
    assert.equal(res.status, 400);
    res = await fetch(`${base}/api/items/abc`, { method: 'DELETE' });
    assert.equal(res.status, 400);
    res = await fetch(`${base}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{no es json',
    });
    assert.equal(res.status, 400);
  });
});

test('si la base de datos falla responde 500 sin filtrar detalles internos', async () => {
  const brokenPool = { query: async () => { throw new Error('connect ECONNREFUSED 10.43.0.1:5432'); } };
  await withServer(brokenPool, async (base) => {
    const res = await fetch(`${base}/api/items`);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, 'Error de base de datos');
    assert.ok(!JSON.stringify(body).includes('ECONNREFUSED'));
  });
});

test('/metrics expone http_requests_total y no cuenta /health ni /metrics', async () => {
  await withServer(fakePool(), async (base) => {
    await fetch(`${base}/health`);
    await fetch(`${base}/api/items`);
    await fetch(`${base}/api/items/abc`, { method: 'DELETE' });

    const res = await fetch(`${base}/metrics`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /http_requests_total\{method="GET",route="\/api\/items",status_code="200"\} 1/);
    assert.match(text, /http_requests_total\{method="DELETE",route="\/api\/items\/:id",status_code="400"\} 1/);
    assert.match(text, /http_request_duration_seconds_bucket/);
    assert.doesNotMatch(text, /route="\/health"/);
    assert.doesNotMatch(text, /route="\/metrics"/);
  });
});
