import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import path from 'node:path';
import net from 'node:net';
const root = path.dirname(fileURLToPath(import.meta.url)); process.chdir(root);
if (Number(process.versions.node.split('.')[0]) < 24) { console.error('Necesitas Node.js 24 o posterior. Descárgalo en https://nodejs.org'); process.exit(1); }
if (existsSync('.env')) loadEnvFile('.env');
const require = createRequire(import.meta.url);
const missing = ['nodemailer', 'pdfkit', 'read-excel-file/node', 'sharp', ...(process.env.TURSO_DATABASE_URL ? ['libsql'] : [])].some(name => { try { require.resolve(name); return false; } catch { return true; } });
if (missing) {
  console.log('Preparando dependencias de la aplicación. La primera vez necesitas internet…');
  const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-fund', '--no-audit'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (install.status !== 0) { console.error('No se pudieron preparar las dependencias. Si aparece EPERM, cierra las instancias anteriores de esta aplicación y vuelve a iniciar.'); process.exit(1); }
}
const requested = Number(process.env.PORT) || 3000;
async function available(port) {
  return new Promise(resolve => { const probe = net.createServer(); probe.once('error', () => resolve(false)); probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true))); });
}
let port = requested;
while (port <= Math.min(requested + 20, 65535) && !await available(port)) port++;
if (port > Math.min(requested + 20, 65535)) { console.error('No hay un puerto local libre. Cierra la instancia anterior y vuelve a intentar.'); process.exit(1); }
if (port !== requested) console.log(`El puerto ${requested} está ocupado por otra instancia. Se utilizará ${port} para abrir la versión actualizada.`);
const url = `http://127.0.0.1:${port}`;
const localOrigin = !process.env.APP_URL || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.APP_URL);
const child = spawn(process.execPath, ['server.js'], { cwd: root, stdio: ['inherit', 'pipe', 'inherit'], env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), ...(localOrigin ? { APP_URL: url } : {}) } });
let opened = false;
child.stdout.on('data', async chunk => {
  process.stdout.write(chunk);
  if (opened || !chunk.toString().includes('Aplicación disponible')) return;
  opened = true;
  try {
    const response = await fetch(url + '/health', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw Error('No responde el servidor.');
    console.log(`\nAbre ${url}\nAdministración: ${url}/admin\nComunidad: ${url}/comunidad\nMantén esta ventana abierta. Para salir pulsa Ctrl+C.\n`);
    if (process.argv.includes('--no-open')) return;
    if (process.platform === 'win32') spawn('explorer.exe', [url], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' }).on('error', () => {});
  } catch { console.error(`El servidor arrancó, pero no se pudo comprobar. Prueba abrir ${url} en tu navegador.`); }
});
child.on('exit', code => { process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
