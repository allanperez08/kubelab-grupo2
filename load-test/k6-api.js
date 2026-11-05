// HA-05: prueba de carga para demostrar el escalado automatico (HPA) de la API.
//
// Uso (desde un equipo con k6 y acceso a la red del cluster):
//   k6 run load-test/k6-api.js
//   k6 run -e BASE_URL=http://api.grupo2.lab -e MAX_VUS=40 load-test/k6-api.js
//
// Mientras corre, en el control-plane:
//   kubectl get hpa -n default -w
//   kubectl get pods -n default -w
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://api.grupo2.lab';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '40', 10);

export const options = {
  stages: [
    { duration: '1m', target: Math.ceil(MAX_VUS / 4) }, // calentamiento
    { duration: '4m', target: MAX_VUS },                // carga sostenida: dispara el HPA
    { duration: '1m', target: 0 },                      // bajada
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    // Corte de seguridad: el cluster tiene un solo worker; si empieza a fallar, la prueba se detiene.
    http_req_failed: [{ threshold: 'rate<0.2', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  const list = http.get(`${BASE_URL}/api/items`);
  check(list, { 'GET /api/items -> 200': (r) => r.status === 200 });

  // 1 de cada 5 iteraciones ejercita el CRUD completo y no deja datos de prueba en la base.
  if (Math.random() < 0.2) {
    const created = http.post(`${BASE_URL}/api/items`, JSON.stringify({ name: `k6-${__VU}-${__ITER}` }), JSON_HEADERS);
    if (check(created, { 'POST -> 201': (r) => r.status === 201 })) {
      const id = created.json('id');
      const updated = http.put(`${BASE_URL}/api/items/${id}`, JSON.stringify({ name: `k6-editado-${id}` }), JSON_HEADERS);
      check(updated, { 'PUT -> 200': (r) => r.status === 200 });
      const deleted = http.del(`${BASE_URL}/api/items/${id}`);
      check(deleted, { 'DELETE -> 204': (r) => r.status === 204 });
    }
  }

  sleep(0.2);
}
