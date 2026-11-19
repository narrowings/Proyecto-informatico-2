import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { cp } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const container = `red-e2e-${process.pid}`;
const services: ChildProcess[] = [];
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error('Ejecuta la suite mediante pnpm test:e2e.');
let databaseStarted = false;

async function command(binary: string, args: string[], env = process.env) {
  const child = spawn(binary, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  services.push(child);
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Falló ${binary} ${args.join(' ')} (${code}).`);
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo asignar el puerto.');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function startService(args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  services.push(child);
  return child;
}

async function ready(url: string, child: ChildProcess) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode)
      throw new Error(`El servicio terminó antes de responder en ${url}.`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).ok) return;
    } catch {
      /* El servicio aún está arrancando. */
    }
    await setTimeout(250);
  }
  throw new Error(`El servicio no respondió en ${url}.`);
}

function cleanup() {
  for (const child of services.reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* Ya terminó. */
      }
    }
  }
  if (databaseStarted) {
    spawnSync('docker', ['stop', container], { stdio: 'inherit', windowsHide: true });
    databaseStarted = false;
  }
}

process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

try {
  await command('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_USER=red',
    '--env',
    'POSTGRES_PASSWORD=red',
    '--env',
    'POSTGRES_DB=red_e2e',
    '--health-cmd',
    'pg_isready -U red -d red_e2e',
    '--health-interval',
    '1s',
    '--health-timeout',
    '3s',
    '--health-retries',
    '30',
    'postgres:17-alpine',
  ]);
  databaseStarted = true;
  const inspect = spawnSync('docker', ['port', container, '5432/tcp'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (inspect.status !== 0) throw new Error(inspect.stderr);
  const databasePort = inspect.stdout.trim().split(':').at(-1);
  const databaseDeadline = Date.now() + 30_000;
  let healthy = false;
  while (Date.now() < databaseDeadline) {
    const check = spawnSync(
      'docker',
      ['inspect', '--format', '{{.State.Health.Status}}', container],
      { encoding: 'utf8', windowsHide: true },
    );
    if (check.stdout.trim() === 'healthy') {
      healthy = true;
      break;
    }
    await setTimeout(500);
  }
  if (!healthy) throw new Error('PostgreSQL de pruebas no arrancó.');

  const apiPort = await freePort();
  const webPort = await freePort();
  const apiURL = `http://localhost:${apiPort}`;
  const webURL = `http://localhost:${webPort}`;
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://red:red@127.0.0.1:${databasePort}/red_e2e`,
    NODE_ENV: 'development',
    JWT_SECRET: randomBytes(32).toString('hex'),
    PORT: String(apiPort),
    WEB_URL: webURL,
    NEXT_PUBLIC_API_URL: apiURL,
    E2E_API_URL: apiURL,
    E2E_BASE_URL: webURL,
    // Cada contexto representa un cliente distinto detrás del proxy local de pruebas.
    TRUSTED_PROXY_HOPS: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  await command(process.execPath, [pnpm, '--filter', '@red/api', 'prisma:deploy'], env);
  await command(process.execPath, [pnpm, '--filter', '@red/api', 'prisma:seed'], env);
  await command(process.execPath, [pnpm, '--filter', '@red/api', 'build'], env);
  const webEnv = { ...env, NODE_ENV: 'production' };
  await command(process.execPath, [pnpm, '--filter', '@red/web', 'build'], webEnv);
  // El standalone requiere los estáticos junto al servidor, como en apps/web/Dockerfile.
  await cp(
    path.join(root, 'apps/web/.next/static'),
    path.join(root, 'apps/web/.next/standalone/apps/web/.next/static'),
    { recursive: true },
  );
  const api = startService(['apps/api/dist/main.js'], env);
  await ready(`${apiURL}/v1/health`, api);
  const web = startService([path.join(root, 'apps/web/.next/standalone/apps/web/server.js')], {
    ...webEnv,
    PORT: String(webPort),
    HOSTNAME: 'localhost',
  });
  await ready(`${webURL}/iniciar-sesion`, web);
  await command(
    process.execPath,
    [pnpm, '--filter', '@red/e2e', 'exec', 'playwright', 'test', ...process.argv.slice(2)],
    env,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  cleanup();
}
