import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../server/index.js';

test('GET /api/health returns ok', async (t) => {
  const server = app.listen(0);

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address === 'object' && 'port' in address);

  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
