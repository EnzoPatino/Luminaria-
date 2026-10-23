const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-only-jwt-secret-0123456789abcdef0123456789abcdef';
process.env.CHIRPSTACK_WEBHOOK_TOKEN = 'test-only-chirpstack-token-0123456789abcdef';
process.env.CORS_ORIGIN = 'https://trusted.example';
process.env.TRUST_PROXY = '1';
process.env.LOG_LEVEL = 'error';

const app = require('../src/app');
const { pool } = require('../src/config/database');
const config = require('../src/config');
const { signJwt, verifyJwt } = require('../src/services/authService');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});

function makeToken(payload, header = { alg: 'HS256', typ: 'JWT' }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

test('JWT validation rejects tampering, missing expiry, unsupported algorithms, and expired tokens', () => {
  const goodToken = signJwt({ sub: 42, rol: 'admin', email: 'admin@example.test', nombre: 'Admin' });
  assert.equal(verifyJwt(goodToken).sub, 42);
  assert.equal(verifyJwt(`${goodToken.slice(0, -1)}x`), null);
  assert.equal(verifyJwt(makeToken({ sub: 42, rol: 'admin' })), null);
  assert.equal(verifyJwt(makeToken({ sub: 42, rol: 'admin', exp: Date.now() / 1000 + 60 }, { alg: 'none', typ: 'JWT' })), null);
  assert.equal(verifyJwt(makeToken({ sub: 42, rol: 'admin', exp: Math.floor(Date.now() / 1000) - 1 })), null);
});

test('sensitive ingestion endpoints reject missing or invalid credentials', async () => {
  const eventResponse = await fetch(`${baseUrl}/api/eventos`, { method: 'POST', body: '{}' });
  assert.equal(eventResponse.status, 401);

  const noTokenResponse = await fetch(`${baseUrl}/api/uplink`, { method: 'POST', body: '{}' });
  assert.equal(noTokenResponse.status, 401);

  const badTokenResponse = await fetch(`${baseUrl}/api/uplink`, {
    method: 'POST',
    headers: { 'X-ChirpStack-Token': 'incorrect' },
    body: '{}',
  });
  assert.equal(badTokenResponse.status, 401);
});

test('valid service and user credentials pass their route guards', async () => {
  const webhookResponse = await fetch(`${baseUrl}/api/uplink`, {
    method: 'POST',
    headers: { 'X-ChirpStack-Token': process.env.CHIRPSTACK_WEBHOOK_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'join', deviceInfo: { deviceName: 'test-device', devEui: '1234' } }),
  });
  assert.equal(webhookResponse.status, 200);

  const token = signJwt({ sub: 42, rol: 'admin', email: 'admin@example.test', nombre: 'Admin' });
  const meResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).data.id_usuario, 42);

  const lastWithoutAuth = await fetch(`${baseUrl}/api/uplink/last`);
  assert.equal(lastWithoutAuth.status, 401);
  const lastWithAuth = await fetch(`${baseUrl}/api/uplink/last`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(lastWithAuth.status, 200);
});

test('production CORS allows only the configured origin and security headers are set', async () => {
  const allowed = await fetch(`${baseUrl}/`, { headers: { Origin: 'https://trusted.example' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://trusted.example');
  assert.equal(allowed.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(allowed.headers.get('content-security-policy')?.includes("default-src 'self'"), true);

  const denied = await fetch(`${baseUrl}/`, { headers: { Origin: 'https://attacker.example' } });
  assert.equal(denied.status, 403);
});

test('login endpoint limits repeated attempts before they reach authentication storage', async () => {
  const statuses = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    statuses.push(response.status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(400));
  assert.equal(statuses[10], 429);
});

test('broker configuration denies anonymous clients and gives the dashboard read-only ACLs', () => {
  const root = path.resolve(__dirname, '../..');
  const broker = fs.readFileSync(path.join(root, 'deploy/mosquitto/mosquitto.conf'), 'utf8');
  const acl = fs.readFileSync(path.join(root, 'deploy/mosquitto/aclfile'), 'utf8');
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  assert.match(broker, /^allow_anonymous false$/m);
  assert.match(broker, /password_file \/mosquitto\/passwords\/passwords/);
  assert.match(acl, /user web_dashboard\ntopic read neuquen\/iluminacion\/#\ntopic read api\/evento\ntopic read sensores\/#/);
  assert.doesNotMatch(compose, /"(?:1883|9001):\d+/);
  assert.doesNotMatch(compose, /- \.\/:\/usr\/share\/nginx\/html/);
  assert.equal(config.trustProxy, 1);
});

test('production frontend uses the institutional HTTPS proxy and integrity-checked scripts', () => {
  const root = path.resolve(__dirname, '../..');
  const caddy = fs.readFileSync(path.join(root, 'deploy/Caddyfile'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(caddy, /http:\/\/\{\$DOMAIN\}/);
  assert.match(caddy, /frame-ancestors 'none'/);
  assert.match(caddy, /Strict-Transport-Security/);
  assert.match(html, /paho-mqtt\/1\.0\.1\/mqttws31\.min\.js" integrity="sha384-/);
  assert.match(html, /chart\.js@4\.5\.1\/dist\/chart\.umd\.min\.js" integrity="sha384-/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i);
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  assert.doesNotMatch(compose, /"443:443(?:\/udp)?"/);
  assert.equal(fs.existsSync(path.join(root, 'deploy/mosquitto/passwords')), false);
});

test('MQTT credential generation safely replaces an existing password file', () => {
  const root = path.resolve(__dirname, '../..');
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  assert.match(compose, /passwords\.tmp/);
  assert.match(compose, /mv -f "\$\$temporary_file" "\$\$password_file"/);
});

test('MQTT browser credentials are removed from persistent storage', () => {
  const root = path.resolve(__dirname, '../..');
  const source = fs.readFileSync(path.join(root, 'js/mqtt-client.js'), 'utf8');
  const values = new Map([['luminaria_mqtt_config', JSON.stringify({ username: 'web_dashboard', password: 'old-secret' })]]);
  const localStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const window = { location: { hostname: 'localhost', protocol: 'https:', port: '' } };
  vm.runInNewContext(source, { window, localStorage, console, Math, setTimeout, clearTimeout });

  const client = window.luminariaMQTT;
  assert.equal(client.config.password, '');
  client.saveConfig({ username: 'web_dashboard', password: 'new-secret' });
  assert.equal(client.config.password, 'new-secret');
  assert.equal(values.get('luminaria_mqtt_config').includes('new-secret'), false);
  client.disconnect();
  assert.equal(client.config.password, '');
});
