import { randomBytes, createHash } from 'node:crypto';
import { day, text, member, fail, permissions, password, recovery } from './domain.js';
import { deliverVerification } from './mail.js';

const escapeIcs = value => text(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function fold(line) { const lines = []; let current = ''; for (const char of line) { if (Buffer.byteLength(current + char) > (lines.length ? 74 : 75)) { lines.push(current); current = ''; } current += char; } lines.push(current); return lines.join('\r\n '); }
export function calendarEvent(event, churchName) {
  const uid = createHash('sha256').update(churchName).digest('hex').slice(0, 16);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Siloe//Comunidad//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VTIMEZONE', 'TZID:America/Mexico_City', 'BEGIN:STANDARD', 'DTSTART:20230101T000000', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE', 'BEGIN:VEVENT', `UID:${event.id}-${uid}@siloe`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`, `DTSTART;TZID=America/Mexico_City:${event.date.replace(/-/g, '')}T${event.time.replace(':', '')}00`, `SUMMARY:${escapeIcs(event.title)}`, `LOCATION:${escapeIcs([event.place, event.address].filter(Boolean).join(', '))}`, `DESCRIPTION:${escapeIcs(event.description)}`, `STATUS:${event.status === 'Cancelado' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function createPortal({ db, all, save, settings, hash, digest, newSession, throttle }) {
  const columns = { phone: "TEXT NOT NULL DEFAULT ''", membership_status: "TEXT NOT NULL DEFAULT 'aprobado'", email_verified: 'INTEGER NOT NULL DEFAULT 1', member_id: 'INTEGER REFERENCES records(id)' };
  for (const [name, type] of Object.entries(columns)) if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS user_member_link ON users(member_id) WHERE member_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS verifications(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
    CREATE TABLE IF NOT EXISTS rsvps(user_id INTEGER REFERENCES users(id),event_id INTEGER REFERENCES records(id),PRIMARY KEY(user_id,event_id));`);
  const staff = user => Boolean(user && user.role !== 'miembro');
  const approved = user => staff(user) || Boolean(user && user.membershipStatus === 'aprobado' && user.emailVerified && all('members').some(m => m.id === user.memberId && m.active !== 'Inactivo'));
  const visible = (row, user) => row.visibility === 'publico' || row.visibility === 'miembros' && approved(user);
  const allowed = (user, kind) => { if (!user || !permissions[kind]?.includes(user.role)) fail('Acceso restringido.', 403); };
  async function verification(user) {
    const token = randomBytes(32).toString('hex'); db.prepare('DELETE FROM verifications WHERE user_id=?').run(user.id);
    db.prepare('INSERT INTO verifications VALUES(?,?,?)').run(digest(token), user.id, Date.now() + 86400000);
    try { await deliverVerification(user, token, settings().name); } catch { console.error('No se pudo entregar un correo de verificación. Revisa SMTP.'); }
  }
  return { verification, async handle({ p, method, url, req, res, user, send, download, readBody }) {
    const reply = (code, data) => { send(code, data); return true; };
    if (p === '/api/register' && method === 'POST') {
      throttle('registro:' + req.socket.remoteAddress);
      if (!db.prepare("SELECT id FROM users WHERE role='administrador' AND active=1 LIMIT 1").get()) fail('La iglesia está configurando el sistema. Intenta más tarde.', 503);
      const input = await readBody(), profile = member({ name: input.name, email: input.email, phone: input.phone });
      if (profile.phone) recovery({ recoveryPhone: profile.phone });
      if (!profile.email) fail('El correo es obligatorio.'); password(input.password); const contact = recovery(input);
      if (db.prepare('SELECT id FROM users WHERE email=?').get(profile.email)) fail('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.', 409);
      const result = db.prepare("INSERT INTO users(name,email,password,role,active,phone,recovery_email,recovery_phone,membership_status,email_verified) VALUES(?,?,?,'miembro',1,?,?,?,'pendiente',0)").run(profile.name, profile.email, hash(input.password), profile.phone, contact.recoveryEmail, contact.recoveryPhone);
      const id = Number(result.lastInsertRowid); newSession(res, id); await verification({ id, name: profile.name, email: profile.email });
      return reply(201, { ok: true, message: 'Tu solicitud aparece en Miembros del administrador. Verifica tu correo; después se revisará tu registro.' });
    }
    if (p === '/api/verify-email' && method === 'POST') {
      throttle('verificar:' + req.socket.remoteAddress); const b = await readBody();
      const row = db.prepare('SELECT v.user_id FROM verifications v JOIN users u ON u.id=v.user_id WHERE v.token=? AND v.expires>? AND u.active=1').get(digest(text(b.token)), Date.now());
      if (!row) fail('El código de verificación no es válido o caducó.');
      db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(row.user_id); db.prepare('DELETE FROM verifications WHERE user_id=?').run(row.user_id);
      return reply(200, { ok: true, message: 'Correo verificado. Tu solicitud está lista para revisión administrativa.' });
    }
    if (p === '/api/portal/verification' && method === 'POST') {
      if (!user || user.role !== 'miembro') fail('Inicia sesión con tu cuenta de miembro.', 401);
      throttle('reenvio:' + user.id); if (!user.emailVerified) await verification(user);
      return reply(200, { ok: true, message: 'Si tu correo sigue pendiente, enviamos un nuevo enlace. Revisa también correo no deseado.' });
    }
    if (p === '/api/portal' && method === 'GET') {
      const s = settings(), ministries = all('ministries');
      const events = all('events').filter(e => visible(e, user)).map(e => ({ id: e.id, title: e.title, date: e.date, time: e.time, place: e.place, address: e.address || '', description: e.description, status: e.status || 'Programado', visibility: e.visibility, category: e.category || 'general', photo: e.photo || '', ministryName: ministries.find(m => m.id === Number(e.ministryId) && visible(m, user))?.name || '' }));
      return reply(200, { church: Object.fromEntries(['name', 'address', 'phone', 'email', 'schedule', 'logo', 'cover'].map(k => [k, s[k] || ''])), user: user ? { name: user.name, email: user.email, role: user.role, emailVerified: Boolean(user.emailVerified), membershipStatus: user.membershipStatus, approved: approved(user) } : null,
        events, announcements: all('announcements').filter(a => visible(a, user) && a.date <= day()).map(a => ({ id: a.id, title: a.title, description: a.description, date: a.date })),
        ministries: ministries.filter(m => visible(m, user)).map(m => ({ id: m.id, name: m.name, description: m.description })),
        going: user ? db.prepare('SELECT event_id FROM rsvps WHERE user_id=?').all(user.id).filter(r => events.some(e => e.id === r.event_id)).map(r => r.event_id) : [] });
    }
    const eventMatch = /^\/api\/portal\/events\/(\d+)\/(calendar|rsvp)$/.exec(p);
    if (eventMatch) {
      const event = all('events').find(e => e.id === Number(eventMatch[1])); if (!event || !visible(event, user)) fail('Evento no disponible.', 404);
      if (eventMatch[2] === 'calendar' && method === 'GET') { download(Buffer.from(calendarEvent(event, settings().name)), 'text/calendar; charset=utf-8', `evento-${event.id}.ics`); return true; }
      if (eventMatch[2] === 'rsvp' && ['POST', 'DELETE'].includes(method)) {
        if (!user) fail('Inicia sesión para confirmar.', 401); if (!approved(user)) fail('Tu cuenta necesita correo verificado y aprobación.', 403);
        if (method === 'POST') { if (event.status === 'Cancelado' || event.date < day()) fail('No puedes confirmar un evento cancelado o pasado.'); db.prepare('INSERT OR IGNORE INTO rsvps(user_id,event_id) VALUES(?,?)').run(user.id, event.id); }
        else db.prepare('DELETE FROM rsvps WHERE user_id=? AND event_id=?').run(user.id, event.id);
        return reply(200, { ok: true });
      }
      fail('Método no permitido.', 405);
    }
    if (p === '/api/registrations' && method === 'GET') {
      allowed(user, 'members');
      const rows = db.prepare("SELECT id,name,email,phone,email_verified AS emailVerified,membership_status AS membershipStatus FROM users WHERE role='miembro' AND membership_status<>'aprobado' ORDER BY id DESC").all();
      return reply(200, rows.map(r => ({ ...r, candidates: all('members').filter(m => text(m.email).toLowerCase() === r.email).map(m => ({ id: m.id, name: m.name, active: m.active || 'Activo' })) })));
    }
    const review = /^\/api\/registrations\/(\d+)\/decision$/.exec(p);
    if (review && method === 'POST') {
      allowed(user, 'members'); const b = await readBody(), account = db.prepare("SELECT * FROM users WHERE id=? AND role='miembro'").get(Number(review[1]));
      if (!account || account.membership_status === 'aprobado') fail('La solicitud ya fue atendida o no existe.');
      if (b.action === 'rechazar') { db.prepare("UPDATE users SET membership_status='rechazado' WHERE id=?").run(account.id); return reply(200, { ok: true }); }
      if (b.action !== 'aprobar') fail('Acción inválida.'); if (!account.email_verified) fail('Primero debe verificar su correo.');
      const candidates = all('members').filter(m => text(m.email).toLowerCase() === account.email);
      let target = b.memberId ? all('members').find(m => m.id === Number(b.memberId)) : candidates.length === 1 ? candidates[0] : undefined;
      if (target && text(target.email).toLowerCase() !== account.email) fail('El correo verificado debe coincidir con el del miembro que se vincula.');
      if (b.memberId && !target) fail('Miembro inexistente.'); if (!target && candidates.length) fail('Selecciona el miembro existente para evitar duplicados.');
      if (target && db.prepare('SELECT id FROM users WHERE member_id=? AND id<>?').get(target.id, account.id)) fail('Ese miembro ya tiene una cuenta vinculada.', 409);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!target) { const profile = member({ name: account.name, email: account.email, phone: account.phone }); const result = save('members', profile); target = { ...profile, id: Number(result.lastInsertRowid) }; }
        else save('members', { ...target, active: 'Activo' }, target.id);
        db.prepare("UPDATE users SET member_id=?,membership_status='aprobado',name=? WHERE id=?").run(target.id, target.name, account.id); db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return reply(200, { ok: true, memberId: target.id });
    }
    if (p === '/api/event-rsvps' && method === 'GET') {
      allowed(user, 'events'); return reply(200, db.prepare('SELECT event_id AS eventId,COUNT(*) AS count FROM rsvps GROUP BY event_id').all());
    }
    return false;
  } };
}
