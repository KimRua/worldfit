import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../server/index.js';

app.post('/__tests/session-cookie', (req, res) => {
  req.session.adminUser = { id: 1, username: 'admin' };
  req.session.save((error) => {
    if (error) {
      res.status(500).json({ message: error.message });
      return;
    }

    res.json({ ok: true });
  });
});

test('session save sends Set-Cookie in direct HTTP requests', async (t) => {
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

  const response = await fetch(`http://127.0.0.1:${address.port}/__tests/session-cookie`, {
    method: 'POST',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /verifit\.sid=/);
  assert.doesNotMatch(setCookie, /;\s*Secure/i);
  assert.match(setCookie, /;\s*SameSite=Lax/i);
});

test('session cookie becomes secure behind trusted HTTPS proxy', async (t) => {
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

  const response = await fetch(`http://127.0.0.1:${address.port}/__tests/session-cookie`, {
    method: 'POST',
    headers: {
      'X-Forwarded-Proto': 'https',
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /verifit\.sid=/);
  assert.match(setCookie, /;\s*Secure/i);
  assert.match(setCookie, /;\s*SameSite=Lax/i);
});
