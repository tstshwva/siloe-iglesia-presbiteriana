import { DatabaseSync } from 'node:sqlite';

export async function openDatabase(file, env = process.env) {
  const remote = Boolean(env.TURSO_DATABASE_URL);
  if (Boolean(env.TURSO_AUTH_TOKEN) !== remote) throw Error('Configura juntos TURSO_DATABASE_URL y TURSO_AUTH_TOKEN. No se usará una base temporal como sustituto.');
  if (remote) {
    let url;
    try { url = new URL(env.TURSO_DATABASE_URL); } catch { throw Error('La dirección de Turso no es válida.'); }
    if (!['libsql:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Usa la dirección segura de la base de Turso, sin credenciales en la URL.');
  }
  if (!remote && env.VERCEL) throw Error('Configura la base remota antes de iniciar en Vercel. No se guardarán datos en almacenamiento temporal.');
  if (!remote && env.RENDER && env.NODE_ENV === 'production' && env.DB_REQUIRE_REMOTE === 'true') throw Error('Este alojamiento gratuito necesita una base remota. Configura Turso antes de iniciar.');
  if (remote || env.DB_DRIVER === 'libsql') {
    const { default: Database } = await import('libsql');
    try { return { db: new Database(remote ? env.TURSO_DATABASE_URL : file, remote ? { authToken: env.TURSO_AUTH_TOKEN } : {}), remote }; }
    catch { throw Error('No se pudo abrir la base libSQL. Comprueba su disponibilidad y la configuración privada.'); }
  }
  return { db: new DatabaseSync(file), remote: false };
}
