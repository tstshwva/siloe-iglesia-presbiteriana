import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { calendarEvent } from '../lib/portal.js';
import { day } from '../lib/domain.js';

test('Calendario portable: caracteres escapados, cancelación y plegado UTF-8', () => {
  const ics = calendarEvent({ id: 1, date: '2030-01-01', time: '10:30', title: 'Reunión ' + 'á'.repeat(100) + '\nATTENDEE:otro', place: 'Templo; principal', address: 'Calle 1, México', description: 'Primera\nSegunda', status: 'Cancelado' }, 'Siloé');
  assert.ok(ics.includes('STATUS:CANCELLED')); assert.ok(ics.includes('TZID:America/Mexico_City')); assert.ok(!ics.includes('\r\nATTENDEE:'));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('Comunidad: registro, verificación, aprobación, privacidad, vinculación y confirmaciones', { timeout: 45000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'siloe-portal-'));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DB_PATH: path.join(dir, 'test.sqlite'), NODE_ENV: 'test', SETUP_TOKEN: '', SMTP_HOST: '', MAIL_FROM: '', RESET_WEBHOOK: '' } });
  let out = '', errors = ''; child.stdout.on('data', c => out += c); child.stderr.on('data', c => errors += c);
  try {
    const base = await new Promise((resolve, reject) => { child.stdout.on('data', c => { const m = /http:\/\/127\.0\.0\.1:\d+/.exec(c.toString()); if (m) resolve(m[0]); }); child.once('error', reject); child.once('exit', () => reject(Error(errors))); });
    let admin = '';
    const request = async (route, method = 'GET', body, cookie = admin) => {
      const r = await fetch(base + '/api/' + route, { method, signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: r.headers.get('Content-Type').includes('application/json') ? await r.json() : await r.text(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
    };
    const verificationToken = async email => {
      const pattern = new RegExp('Verificación local para ' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': ([a-f0-9]{64})');
      for (let i = 0; i < 50; i++) { const m = pattern.exec(out); if (m) return m[1]; await new Promise(r => setTimeout(r, 20)); }
      throw Error('No se generó el correo de verificación local.');
    };
    assert.equal((await fetch(base + '/comunidad')).status, 200);
    assert.match(await (await fetch(base + '/')).text(), /src="\/portal.js"/);
    assert.match(await (await fetch(base + '/admin')).text(), /src="\/app.js"/);
    assert.equal((await fetch(base + '/portal.js')).status, 200);
    assert.equal((await request('register', 'POST', { name: 'Prueba', email: 'nueva@example.test', password: 'Password12345!' })).status, 503);
    assert.equal((await request('setup', 'POST', { name: 'Administrador', email: 'admin@example.test', password: 'Password12345!' })).status, 201);
    admin = (await request('login', 'POST', { email: 'admin@example.test', password: 'Password12345!' })).cookie;
    const existing = (await request('members', 'POST', { name: 'Hermano existente', email: 'hermano@example.test' })).body.id;
    const unrelated = (await request('members', 'POST', { name: 'Otra persona', email: 'otra@example.test' })).body.id;
    const ministry = (await request('ministries', 'POST', { name: 'Jóvenes', coordinator: 'Nombre privado', members: [existing], visibility: 'publico', description: 'Encuentros juveniles' })).body.id;
    const eventInput = { title: 'Encuentro público', date: '2099-01-01', time: '10:30', place: 'Templo', address: 'Calle Prueba 1, México', responsible: 'Responsable privado', description: 'Actividad de prueba', ministryId: ministry, status: 'Programado' };
    const publicId = (await request('events', 'POST', { ...eventInput, visibility: 'publico' })).body.id;
    const memberId = (await request('events', 'POST', { ...eventInput, title: 'Encuentro de miembros', visibility: 'miembros' })).body.id;
    const privateId = (await request('events', 'POST', { ...eventInput, title: 'Reunión administrativa' })).body.id;
    await request('announcements', 'POST', { title: 'Aviso público', date: day(), description: 'Aviso de prueba', visibility: 'publico' });
    await request('announcements', 'POST', { title: 'Aviso futuro', date: '2099-01-01', description: 'Todavía no', visibility: 'publico' });
    const guest = (await request('portal', 'GET', undefined, '')).body;
    assert.deepEqual(guest.events.map(e => e.id), [publicId]); assert.equal(guest.announcements.length, 1);
    assert.ok(!('responsible' in guest.events[0])); assert.ok(!('members' in guest.ministries[0])); assert.ok(!('coordinator' in guest.ministries[0]));
    assert.equal((await request('portal/events/' + memberId + '/calendar', 'GET', undefined, '')).status, 404);
    assert.equal((await request('portal/events/' + privateId + '/calendar', 'GET', undefined, '')).status, 404);
    const registration = await request('register', 'POST', { name: 'Solicitud hermano', email: 'hermano@example.test', phone: '+52 555 123 4567', password: 'Password12345!', role: 'administrador' }, '');
    assert.equal(registration.status, 201); const brother = registration.cookie;
    let me = (await request('me', 'GET', undefined, brother)).body;
    assert.equal(me.role, 'miembro'); assert.equal(me.membershipStatus, 'pendiente'); assert.equal(me.emailVerified, 0);
    for (const route of ['members', 'events', 'ministries', 'attendance', 'donations', 'reports/members', 'reports/donations', 'settings', 'users', 'registrations', 'system']) assert.equal((await request(route, 'GET', undefined, brother)).status, 403, route);
    assert.equal((await request('portal/events/' + publicId + '/rsvp', 'POST', {}, brother)).status, 403);
    assert.equal((await request('members')).body.length, 2);
    const pending = (await request('registrations')).body[0]; assert.equal(pending.emailVerified, 0); assert.equal(pending.candidates[0].id, existing);
    assert.equal((await request('registrations/' + pending.id + '/decision', 'POST', { action: 'aprobar' })).status, 400);
    const token = await verificationToken('hermano@example.test');
    assert.equal((await request('verify-email', 'POST', { token }, '')).status, 200);
    assert.equal((await request('verify-email', 'POST', { token }, '')).status, 400);
    assert.equal((await request('portal', 'GET', undefined, brother)).body.user.approved, false);
    assert.equal((await request('registrations/' + pending.id + '/decision', 'POST', { action: 'aprobar', memberId: unrelated })).status, 400);
    const approval = await request('registrations/' + pending.id + '/decision', 'POST', { action: 'aprobar', memberId: existing }); assert.equal(approval.status, 200); assert.equal(approval.body.memberId, existing);
    assert.equal((await request('members')).body.length, 2);
    const approved = (await request('portal', 'GET', undefined, brother)).body; assert.equal(approved.user.approved, true); assert.ok(approved.events.some(e => e.id === memberId)); assert.ok(!approved.events.some(e => e.id === privateId));
    assert.equal((await request('users/' + pending.id, 'PUT', { ...me, role: 'administrador' }, brother)).status, 403);
    for (let i = 0; i < 2; i++) assert.equal((await request('portal/events/' + publicId + '/rsvp', 'POST', {}, brother)).status, 200);
    assert.equal((await request('event-rsvps')).body.find(r => r.eventId === publicId).count, 1);
    const calendar = await request('portal/events/' + publicId + '/calendar', 'GET', undefined, ''); assert.equal(calendar.status, 200); assert.ok(calendar.body.includes('BEGIN:VCALENDAR')); assert.ok(calendar.body.includes('Calle Prueba 1\\, México'));
    await request('events/' + publicId, 'PUT', { ...eventInput, visibility: 'publico', status: 'Cancelado' });
    assert.equal((await request('portal/events/' + publicId + '/rsvp', 'POST', {}, brother)).status, 400);
    assert.ok((await request('portal/events/' + publicId + '/calendar', 'GET', undefined, '')).body.includes('STATUS:CANCELLED'));
    assert.equal((await request('portal/events/' + publicId + '/rsvp', 'DELETE', undefined, brother)).status, 200);
    const newcomer = await request('register', 'POST', { name: 'Nuevo hermano', email: 'nuevo@example.test', password: 'Password12345!' }, ''); assert.equal(newcomer.status, 201);
    const newToken = await verificationToken('nuevo@example.test'); await request('verify-email', 'POST', { token: newToken }, '');
    const newRequest = (await request('registrations')).body.find(r => r.email === 'nuevo@example.test'); await request('registrations/' + newRequest.id + '/decision', 'POST', { action: 'aprobar' });
    assert.equal((await request('members')).body.length, 3); assert.equal((await request('portal', 'GET', undefined, newcomer.cookie)).body.user.approved, true);
    const existingProfile = (await request('members')).body.find(m => m.id === existing); await request('members/' + existing, 'PUT', { ...existingProfile, active: 'Inactivo' });
    const inactive = (await request('portal', 'GET', undefined, brother)).body; assert.equal(inactive.user.approved, false); assert.ok(!inactive.events.some(e => e.id === memberId));
  } finally {
    if (child.exitCode === null) { const exited = new Promise(r => child.once('exit', r)); child.kill(); await exited; }
    rmSync(dir, { recursive: true, force: true });
  }
});
