import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FIGMA_MCP_URL = 'https://mcp.figma.com/mcp';
const OAUTH_METADATA_URL = 'https://mcp.figma.com/.well-known/oauth-authorization-server';
const CALLBACK_PORT = Number(process.env.FIGMA_OAUTH_PORT ?? '19876');
const CALLBACK_PATH = '/callback';
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;
const CACHE_DIR = join(homedir(), '.config', 'figma-mcp');
const TOKEN_PATH = process.env.FIGMA_TOKENS_PATH ?? join(CACHE_DIR, 'auth.json');
const CLIENT_NAME = process.env.FIGMA_OAUTH_CLIENT_NAME ?? 'Codex';
const PROTOCOL_VERSION = '2025-03-26';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

async function readTokenCache() {
  try {
    const raw = await readFile(TOKEN_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeTokenCache(payload) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(TOKEN_PATH, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function openBrowser(url) {
  await execFileAsync('open', [url]);
}

async function getOAuthMetadata() {
  const response = await fetch(OAUTH_METADATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load OAuth metadata: ${response.status}`);
  }

  return response.json();
}

async function registerClient(metadata) {
  const response = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'client_secret_post',
      scope: 'mcp:connect',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Client registration failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function waitForAuthorizationCode(expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? '/', REDIRECT_URI);

      if (requestUrl.pathname !== CALLBACK_PATH) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }

      const state = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        response.statusCode = 400;
        response.end(`Figma authorization failed: ${error}`);
        server.close();
        reject(new Error(`Authorization failed: ${error}`));
        return;
      }

      if (!code || state !== expectedState) {
        response.statusCode = 400;
        response.end('Invalid OAuth callback');
        server.close();
        reject(new Error('OAuth callback validation failed'));
        return;
      }

      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end('<h1>Figma authorization complete.</h1><p>You can return to VS Code.</p>');
      server.close();
      resolve(code);
    });

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      console.log(`Waiting for Figma OAuth callback on ${REDIRECT_URI}`);
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
}

async function exchangeAuthorizationCode(metadata, client, code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: client.client_id,
    client_secret: client.client_secret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function refreshAccessToken(metadata, cache) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cache.refresh_token,
    client_id: cache.client_id,
    client_secret: cache.client_secret,
  });

  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Refresh failed: ${response.status} ${text}`);
  }

  return response.json();
}

function tokenStillValid(cache) {
  if (!cache?.access_token || !cache?.expires_at) {
    return false;
  }

  return new Date(cache.expires_at).getTime() - Date.now() > 60_000;
}

async function ensureAccessToken() {
  const metadata = await getOAuthMetadata();
  const cache = await readTokenCache();

  if (tokenStillValid(cache)) {
    return cache.access_token;
  }

  if (cache?.refresh_token && cache?.client_id && cache?.client_secret) {
    try {
      const refreshed = await refreshAccessToken(metadata, cache);
      const nextCache = {
        ...cache,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? cache.refresh_token,
        expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
      };
      await writeTokenCache(nextCache);
      return nextCache.access_token;
    } catch (error) {
      console.warn(`Refresh failed, falling back to full OAuth flow: ${error.message}`);
    }
  }

  const client = await registerClient(metadata);
  const codeVerifier = base64url(randomBytes(32));
  const state = base64url(randomBytes(16));
  const authorizationUrl = new URL(metadata.authorization_endpoint);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', client.client_id);
  authorizationUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizationUrl.searchParams.set('scope', 'mcp:connect');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', base64url(sha256(codeVerifier)));
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  console.log(`Opening browser for Figma OAuth...`);
  await openBrowser(authorizationUrl.toString());

  const code = await waitForAuthorizationCode(state);
  const token = await exchangeAuthorizationCode(metadata, client, code, codeVerifier);
  const nextCache = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: REDIRECT_URI,
  };
  await writeTokenCache(nextCache);
  return nextCache.access_token;
}

async function postMcpMessage(message, accessToken, sessionId) {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };

  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  const response = await fetch(FIGMA_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  const nextSessionId = response.headers.get('mcp-session-id') ?? sessionId ?? undefined;
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MCP request failed: ${response.status} ${body}`);
  }

  if (response.status === 202) {
    return { sessionId: nextSessionId, body: null };
  }

  if (contentType.includes('application/json')) {
    return { sessionId: nextSessionId, body: await response.json() };
  }

  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    const events = text
      .split('\n\n')
      .map((chunk) => chunk
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join(''))
      .filter(Boolean)
      .map((payload) => JSON.parse(payload));

    return { sessionId: nextSessionId, body: events.at(-1) ?? null };
  }

  return { sessionId: nextSessionId, body: await response.text() };
}

async function initializeSession(accessToken) {
  const initializeResponse = await postMcpMessage(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: CLIENT_NAME,
          version: '1.0.0',
        },
      },
    },
    accessToken,
  );

  const sessionId = initializeResponse.sessionId;

  await postMcpMessage(
    {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    },
    accessToken,
    sessionId,
  );

  return sessionId;
}

async function listTools() {
  const accessToken = await ensureAccessToken();
  const sessionId = await initializeSession(accessToken);
  const response = await postMcpMessage(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
    accessToken,
    sessionId,
  );

  console.log(JSON.stringify(response.body, null, 2));
}

async function callTool(name, args) {
  const accessToken = await ensureAccessToken();
  const sessionId = await initializeSession(accessToken);
  const response = await postMcpMessage(
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    },
    accessToken,
    sessionId,
  );

  console.log(JSON.stringify(response.body, null, 2));
}

async function main() {
  const [command = 'auth', ...rest] = process.argv.slice(2);

  if (command === 'auth') {
    const accessToken = await ensureAccessToken();
    console.log(`Figma OAuth ready. Token cached at ${TOKEN_PATH}`);
    console.log(`Access token prefix: ${accessToken.slice(0, 12)}...`);
    return;
  }

  if (command === 'tools') {
    await listTools();
    return;
  }

  if (command === 'call') {
    const [toolName, rawArgs = '{}'] = rest;
    if (!toolName) {
      throw new Error('Usage: node scripts/figma-mcp.mjs call <toolName> <jsonArgs>');
    }

    await callTool(toolName, JSON.parse(rawArgs));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});