import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { roles, permissions, fail, text, validEmail, password, recovery, record, duplicate } from './lib/domain.js';
import { deliverReset, mailStatus } from './lib/mail.js';
import { previewImport } from './lib/import.js';
import { report, reportPdf } from './lib/reports.js';
import { createPortal } from './lib/portal.js';

const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, '.env'))) loadEnvFile(path.join(root, '.env'));
if (!process.env.APP_URL && process.env.RENDER_EXTERNAL_URL) process.env.APP_URL = process.env.RENDER_EXTERNAL_URL;
mkdirSync(path.join(root, 'data'), { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(root, 'data', 'church.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
 CREATE TABLE IF NOT EXISTS resets(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
 CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);`);
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'active')) db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
for (const column of ['recovery_email', 'recovery_phone']) if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
if (!db.prepare('SELECT id FROM settings').get()) db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({ name: 'Siloé - Iglesia Presbiteriana', address: '', phone: '', email: '', schedule: 'Domingos 10:00', logo: '', cover: '' }));

const settings = () => JSON.parse(db.prepare('SELECT body FROM settings WHERE id=1').get().body);
const digest = s => createHash('sha256').update(s).digest('hex');
const hash = p => { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(p, salt, 64).toString('hex'); };
const valid = (p, value) => { const [salt, key] = value.split(':'); return timingSafeEqual(scryptSync(String(p), salt, 64), Buffer.from(key, 'hex')); };
const all = kind => db.prepare('SELECT id,body FROM records WHERE kind=? ORDER BY id').all(kind).map(r => ({ ...JSON.parse(r.body), id: r.id }));
const save = (kind, b, id) => id ? db.prepare('UPDATE records SET body=? WHERE kind=? AND id=?').run(JSON.stringify(b), kind, id) : db.prepare('INSERT INTO records(kind,body) VALUES(?,?)').run(kind, JSON.stringify(b));
const attempts = new Map(), imports = new Map();
function throttle(ip) {
  const now = Date.now();
  for (const [key, value] of attempts) if (now - value.t > 900000) attempts.delete(key);
  const v = attempts.get(ip) || { n: 0, t: now }; v.n++; attempts.set(ip, v);
  if (v.n > 30) fail('Demasiados intentos. Espera 15 minutos.', 429);
}
async function body(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 5e6) fail('La solicitud supera 5 MB.', 413); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { fail('Solicitud JSON inválida.'); }
}
async function image(value, limit) {
  if (!value) return '';
  if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) fail('Usa una imagen PNG, JPG o WebP.');
  const bytes = Buffer.from(value.split(',')[1], 'base64');
  if (bytes.length > limit) fail(`La imagen supera ${limit / 1000} KB.`);
  try { const png = await sharp(bytes, { limitInputPixels: 25000000 }).rotate().resize({ width: limit > 500000 ? 1600 : 512, height: limit > 500000 ? 1000 : 512, fit: 'inside', withoutEnlargement: true }).png().toBuffer(); return 'data:image/png;base64,' + png.toString('base64'); }
  catch { fail('La imagen está dañada o tiene dimensiones excesivas.'); }
}
function newSession(res, id) {
  const t = randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(t), id, Date.now() + 28800000);
  res.setHeader('Set-Cookie', `session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
}
const portal = createPortal({ db, all, save, settings, hash, digest, newSession, throttle });
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https://images.unsplash.com; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const download = (bytes, type, name) => { res.writeHead(200, { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' }); res.end(bytes); };
  try {
    const url = new URL(req.url, 'http://localhost'), p = url.pathname, method = req.method;
    if (p === '/health' && method === 'GET') return send(200, { ok: true, app: 'siloe', version: '3.0.0' });
    if (!p.startsWith('/api/')) {
      const paths = { '/': 'index.html', '/admin': 'index.html', '/comunidad': 'portal.html', '/comunidad/': 'portal.html', '/portal.js': 'portal.js', '/portal.css': 'portal.css', '/app.js': 'app.js', '/export.js': 'export.js', '/style.css': 'style.css' };
      const f = paths[p]; if (!f || method !== 'GET') return send(404, { error: 'No encontrado' });
      res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript; charset=utf-8' : f.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache'); return res.end(readFileSync(path.join(root, 'public', f)));
    }
    if (method !== 'GET' && req.headers.origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`, process.env.APP_URL].filter(Boolean).includes(req.headers.origin)) fail('Origen rechazado.', 403);
    if (p === '/api/branding' && method === 'GET') { const s = settings(); return send(200, { name: s.name, logo: s.logo || '', cover: s.cover || '' }); }
    if (p === '/api/status' && method === 'GET') return send(200, { version: '3.0.0', setup: !db.prepare('SELECT id FROM users LIMIT 1').get(), setupTokenRequired: Boolean(process.env.SETUP_TOKEN) });
    if (p === '/api/setup' && method === 'POST') {
      if (db.prepare('SELECT id FROM users LIMIT 1').get()) fail('Configuración ya realizada.', 403);
      if (process.env.SETUP_TOKEN && req.headers['x-setup-token'] !== process.env.SETUP_TOKEN) fail('Token de instalación incorrecto.', 403);
      const b = await body(req); if (!text(b.name) || !validEmail(text(b.email))) fail('Nombre y correo válidos requeridos.');
      const contact = recovery(b);
      db.prepare('INSERT INTO users(name,email,password,role,recovery_email,recovery_phone) VALUES(?,?,?,?,?,?)').run(text(b.name), text(b.email).toLowerCase(), hash(password(b.password)), 'administrador', contact.recoveryEmail, contact.recoveryPhone); return send(201, { ok: true });
    }
    if (p === '/api/login' && method === 'POST') {
      throttle(req.socket.remoteAddress); const b = await body(req), u = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(text(b.email).toLowerCase());
      if (!u || !valid(b.password, u.password)) fail('Correo o contraseña incorrectos.', 401);
      db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); newSession(res, u.id); return send(200, { ok: true });
    }
    if (p === '/api/forgot' && method === 'POST') {
      throttle(req.socket.remoteAddress); const b = await body(req), u = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(text(b.email).toLowerCase());
      if (u) {
        const t = randomBytes(32).toString('hex'); db.prepare('DELETE FROM resets WHERE user_id=?').run(u.id); db.prepare('INSERT INTO resets VALUES(?,?,?)').run(digest(t), u.id, Date.now() + 1800000);
        try { await deliverReset(u, t, settings().name); } catch { db.prepare('DELETE FROM resets WHERE user_id=?').run(u.id); console.error('No se pudo entregar un correo de recuperación. Revisa la configuración del servidor.'); }
      }
      return send(200, { message: 'Si la cuenta está activa, recibirás instrucciones por el medio configurado. Si no llegan, consulta al administrador.' });
    }
    if (p === '/api/reset' && method === 'POST') {
      throttle(req.socket.remoteAddress); const b = await body(req), r = db.prepare('SELECT r.* FROM resets r JOIN users u ON u.id=r.user_id WHERE r.token=? AND r.expires>? AND u.active=1').get(digest(text(b.token)), Date.now());
      if (!r) fail('El código es inválido o ha caducado.');
      db.prepare('UPDATE users SET password=? WHERE id=?').run(hash(password(b.password)), r.user_id); db.prepare('DELETE FROM resets WHERE user_id=?').run(r.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id); return send(200, { ok: true });
    }
    const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1] || '';
    const u = db.prepare('SELECT u.id,u.name,u.email,u.role,u.active,u.recovery_email AS recoveryEmail,u.recovery_phone AS recoveryPhone,u.member_id AS memberId,u.email_verified AS emailVerified,u.membership_status AS membershipStatus FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1').get(digest(token), Date.now());
    if (await portal.handle({ p, method, url, req, res, user: u, send, download, readBody: () => body(req) })) return;
    if (!u) fail('Inicia sesión.', 401);
    const can = kind => { if (!permissions[kind]?.includes(u.role)) fail('Tu rol no permite esta operación.', 403); };
    if (p === '/api/me' && method === 'GET') return send(200, { ...u, permissions: Object.keys(permissions).filter(k => permissions[k].includes(u.role)) });
    if (p === '/api/logout' && method === 'POST') { db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token)); res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(200, { ok: true }); }
    if (p === '/api/account/password' && method === 'POST') {
      const b = await body(req), own = db.prepare('SELECT password FROM users WHERE id=?').get(u.id); if (!valid(b.current, own.password)) fail('La contraseña actual no es correcta.');
      db.prepare('UPDATE users SET password=? WHERE id=?').run(hash(password(b.password)), u.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id); return send(200, { ok: true });
    }
    if (p === '/api/account/recovery' && method === 'PUT') {
      const b = await body(req), own = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
      if (!valid(b.current, own.password)) fail('Confirma tu contraseña actual para actualizar la recuperación.', 403);
      const contact = recovery(b, own);
      db.prepare('UPDATE users SET recovery_email=?,recovery_phone=? WHERE id=?').run(contact.recoveryEmail, contact.recoveryPhone, u.id);
      db.prepare('DELETE FROM resets WHERE user_id=?').run(u.id);
      return send(200, { ok: true });
    }
    if (u.role === 'miembro') fail('Tu cuenta utiliza la página de la comunidad, no el panel administrativo.', 403);
    if (p === '/api/settings') {
      if (method === 'GET') return send(200, settings()); can('settings'); if (method !== 'PUT') fail('Método no permitido.', 405);
      const b = await body(req); if (!text(b.name) || text(b.name).length > 120) fail('El nombre debe tener entre 1 y 120 caracteres.');
      if (b.email && !validEmail(text(b.email))) fail('Correo de contacto inválido.');
      const next = Object.fromEntries(['name', 'address', 'phone', 'email', 'schedule'].map(k => [k, text(b[k])]));
      if (next.address.length > 300 || next.schedule.length > 1500 || next.phone.length > 40) fail('La dirección, teléfono u horarios son demasiado largos.');
      const previous = settings(); next.logo = b.logo === previous.logo ? previous.logo : await image(b.logo, 500000); next.cover = b.cover === previous.cover ? previous.cover : await image(b.cover, 2000000);
      db.prepare('UPDATE settings SET body=? WHERE id=1').run(JSON.stringify(next)); return send(200, { ok: true });
    }
    if (p === '/api/system' && method === 'GET') { can('settings'); return send(200, { mail: { ...mailStatus(), configured: mailStatus().configured || Boolean(process.env.RESET_WEBHOOK) }, production: process.env.NODE_ENV === 'production' }); }
    const usersMatch = /^\/api\/users(?:\/(\d+))?$/.exec(p);
    if (usersMatch) {
      can('users'); const id = Number(usersMatch[1]);
      if (method === 'GET' && !id) return send(200, db.prepare('SELECT id,name,email,role,active,recovery_email AS recoveryEmail,recovery_phone AS recoveryPhone FROM users ORDER BY id').all());
      if (!(method === 'POST' && !id || method === 'PUT' && id)) fail('Método no permitido.', 405);
      const b = await body(req); if (!text(b.name) || text(b.name).length > 160 || !validEmail(text(b.email)) || !roles.includes(b.role)) fail('Revisa nombre, correo y rol.');
      const active = b.active === false || b.active === 0 || b.active === 'Inactivo' ? 0 : 1;
      if (id) {
        const old = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!old) fail('Usuario inexistente.', 404);
        if (old.role === 'administrador' && old.active && (!active || b.role !== 'administrador') && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='administrador' AND active=1").get().n <= 1) fail('Debe quedar al menos un administrador activo.');
        const pass = b.password ? hash(password(b.password)) : old.password, contact = recovery(b, old);
        db.prepare('UPDATE users SET name=?,email=?,role=?,active=?,password=?,recovery_email=?,recovery_phone=? WHERE id=?').run(text(b.name), text(b.email).toLowerCase(), b.role, active, pass, contact.recoveryEmail, contact.recoveryPhone, id);
        if (b.role === 'miembro' && !old.member_id) db.prepare("UPDATE users SET membership_status='pendiente' WHERE id=?").run(id);
        if (b.role === 'miembro' && old.email !== text(b.email).toLowerCase()) { db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run(id); await portal.verification({ id, name: text(b.name), email: text(b.email).toLowerCase() }); }
        if (contact.recoveryEmail !== old.recovery_email || contact.recoveryPhone !== old.recovery_phone) db.prepare('DELETE FROM resets WHERE user_id=?').run(id);
        if (old.role !== b.role || !active || b.password) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); db.prepare('DELETE FROM resets WHERE user_id=?').run(id); }
      } else {
        const contact = recovery(b);
        const created = db.prepare('INSERT INTO users(name,email,password,role,active,recovery_email,recovery_phone) VALUES(?,?,?,?,?,?,?)').run(text(b.name), text(b.email).toLowerCase(), hash(password(b.password)), b.role, active, contact.recoveryEmail, contact.recoveryPhone);
        if (b.role === 'miembro') { const userId = Number(created.lastInsertRowid); db.prepare("UPDATE users SET membership_status='pendiente',email_verified=0 WHERE id=?").run(userId); await portal.verification({ id: userId, name: text(b.name), email: text(b.email).toLowerCase() }); }
      }
      return send(id ? 200 : 201, { ok: true });
    }
    if (p === '/api/members/import/preview' && method === 'POST') {
      can('members'); const preview = await previewImport(await body(req), all('members'));
      for (const [k, v] of imports) if (v.expires < Date.now() || v.userId === u.id) imports.delete(k);
      const t = randomBytes(24).toString('hex'); imports.set(t, { userId: u.id, rows: preview.rows.filter(r => r.status === 'listo').map(r => r.member), expires: Date.now() + 600000 }); return send(200, { ...preview, token: t });
    }
    if (p === '/api/members/import/commit' && method === 'POST') {
      can('members'); const b = await body(req), batch = imports.get(b.token);
      if (!batch || batch.expires < Date.now() || batch.userId !== u.id) fail('La vista previa caducó. Vuelve a cargar el archivo.');
      let imported = 0, skipped = 0; db.exec('BEGIN IMMEDIATE');
      try { for (const input of batch.rows) { const m = record('members', input, all); if (duplicate(m, all('members'))) { skipped++; continue; } save('members', m); imported++; } db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      imports.delete(b.token); return send(201, { ok: true, imported, skipped });
    }
    const reportMatch = /^\/api\/reports\/(members|attendance|ministries|donations)(\/pdf)?$/.exec(p);
    if (reportMatch && method === 'GET') {
      if (reportMatch[1] === 'donations') can('donations');
      const info = report(reportMatch[1], url.searchParams, all);
      if (reportMatch[2]) return download(await reportPdf(info, settings()), 'application/pdf', `reporte-${reportMatch[1]}.pdf`);
      return send(200, info);
    }
    const m = /^\/api\/(members|events|attendance|ministries|donations|announcements)(?:\/(\d+))?$/.exec(p);
    if (!m) fail('Ruta inexistente.', 404);
    const kind = m[1], id = Number(m[2]); if (kind === 'donations') can(kind);
    if (method === 'GET' && !id) return send(200, all(kind)); can(kind);
    if (id && !db.prepare('SELECT id FROM records WHERE id=? AND kind=?').get(id, kind)) fail('Registro inexistente.', 404);
    if (method === 'DELETE') { if (kind !== 'announcements' || !id) fail('Utiliza desactivar o cancelar para conservar el historial.'); db.prepare('DELETE FROM records WHERE id=? AND kind=?').run(id, kind); return send(200, { ok: true }); }
    if (!(method === 'POST' && !id || method === 'PUT' && id)) fail('Método no permitido.', 405);
    const input = await body(req), b = record(kind, input, all);
    if (kind === 'events') {
      const previous = id ? all(kind).find(e => e.id === id) : undefined;
      b.photo = input.photo === undefined ? previous?.photo || '' : input.photo === previous?.photo ? previous.photo : await image(input.photo, 2000000);
    }
    if (kind === 'members') { const match = duplicate(b, all(kind), id); if (match && input.confirmDuplicate !== true) fail(`Posible duplicado: ${match.name}. Revisa el registro existente.`, 409, { duplicateId: match.id }); }
    if (kind === 'attendance') {
      if (all(kind).some(a => a.id !== id && Number(a.eventId) === b.eventId && a.date === b.date)) fail('Ya existe asistencia para este evento y fecha.');
      const event = all('events').find(e => e.id === b.eventId); if (event.status === 'Cancelado' && !id) fail('No puedes registrar asistencia nueva en un evento cancelado.');
    }
    const result = save(kind, b, id); return send(id ? 200 : 201, { ok: true, id: id || Number(result.lastInsertRowid) });
  } catch (e) {
    if (res.headersSent) return res.destroy();
    send(e.status || 400, { error: e.message.includes('UNIQUE') ? 'El correo ya está registrado.' : e.message, ...(e.details ? { details: e.details } : {}) });
  }
});
server.requestTimeout = 30000;
server.listen(process.env.PORT === '0' ? 0 : Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1', () => console.log(`Aplicación disponible en http://127.0.0.1:${server.address().port}`));
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'El puerto está ocupado. Cierra la otra instancia o cambia PORT en .env.' : e.message); process.exitCode = 1; });
