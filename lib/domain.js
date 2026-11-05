export const roles = ['administrador', 'pastor', 'secretario', 'tesorero', 'coordinador', 'miembro'];
export const permissions = {
  members: ['administrador', 'pastor', 'secretario'],
  events: ['administrador', 'pastor', 'secretario', 'coordinador'],
  attendance: ['administrador', 'pastor', 'secretario', 'coordinador'],
  ministries: ['administrador', 'pastor', 'secretario', 'coordinador'],
  donations: ['administrador', 'tesorero'],
  announcements: ['administrador', 'pastor', 'secretario'],
  settings: ['administrador'], users: ['administrador'],
};
export function fail(message, status = 400, details) {
  const error = new Error(message); error.status = status; error.details = details; throw error;
}
export const text = v => String(v ?? '').trim();
export const normalized = v => text(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ');
export const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
export const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 255;
export function date(value) {
  const s = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail('Usa una fecha válida (AAAA-MM-DD).');
  return s;
}
export function password(p) { if (typeof p !== 'string' || p.length < 12 || p.length > 256) fail('La contraseña debe tener entre 12 y 256 caracteres.'); return p; }
export function recovery(input, previous = {}) {
  const recoveryEmail = text(input.recoveryEmail ?? previous.recovery_email).toLowerCase();
  const recoveryPhone = text(input.recoveryPhone ?? previous.recovery_phone);
  if (recoveryEmail && !validEmail(recoveryEmail)) fail('El correo de recuperación no es válido.');
  if (recoveryPhone && (!/^\+?[\d\s().-]+$/.test(recoveryPhone) || recoveryPhone.length > 30 || recoveryPhone.replace(/\D/g, '').length < 7 || recoveryPhone.replace(/\D/g, '').length > 15)) fail('El teléfono debe tener de 7 a 15 dígitos; puedes incluir el prefijo del país.');
  return { recoveryEmail, recoveryPhone };
}
export function member(input) {
  const b = { name: text(input.name), phone: text(input.phone), email: text(input.email).toLowerCase(), joined: date(input.joined || day()), active: input.active || 'Activo', family: text(input.family) };
  if (!b.name || b.name.length > 160) fail('Escribe el nombre completo (máximo 160 caracteres).');
  if (b.phone.length > 40 || b.family.length > 160) fail('Revisa el teléfono o nombre de familia.');
  if (b.email && !validEmail(b.email)) fail('El correo no es válido.');
  if (!['Activo', 'Inactivo'].includes(b.active)) fail('Estado de miembro inválido.');
  return b;
}
export function duplicate(b, rows, exclude) {
  return rows.find(m => m.id !== exclude && ((b.email && normalized(m.email) === normalized(b.email)) || normalized(m.name) === normalized(b.name)));
}
export function record(kind, input, all) {
  if (kind === 'members') return member(input);
  const b = {};
  const fields = {
    events: ['title', 'date', 'time', 'place', 'address', 'responsible', 'ministryId', 'description', 'status', 'visibility', 'category', 'featured', 'endDate', 'ages', 'packing', 'registrationUrl'],
    ministries: ['name', 'coordinator', 'description', 'visibility'], donations: ['date', 'amount', 'concept', 'method', 'memberId'],
    announcements: ['title', 'date', 'description', 'visibility'], attendance: ['eventId', 'date'],
  }[kind];
  for (const k of fields) b[k] = text(input[k]);
  const required = { events: ['title', 'date', 'time', 'place', 'responsible'], ministries: ['name', 'coordinator'], donations: ['date', 'amount', 'concept', 'method'], announcements: ['title', 'date', 'description'], attendance: ['eventId', 'date'] }[kind];
  for (const k of required) if (!b[k]) fail('Completa los campos obligatorios. Falta: ' + k);
  if (Object.values(b).some(v => v.length > 5000)) fail('Un campo supera 5000 caracteres.');
  if ('date' in b) b.date = date(b.date);
  if (['events', 'announcements', 'ministries'].includes(kind)) { b.visibility ||= 'privado'; if (!['publico', 'miembros', 'privado', ...(kind === 'ministries' ? [] : ['borrador'])].includes(b.visibility)) fail('Visibilidad inválida.'); }
  if (kind === 'events') { b.category ||= 'general'; if (!['general', 'campamento'].includes(b.category)) fail('Tipo de actividad inválido.'); }
  if (kind === 'events' && b.address.length > 400) fail('La dirección del evento supera 400 caracteres.');
  const has = (kind, id) => all(kind).some(r => r.id === Number(id));
  if (kind === 'events') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)) fail('Hora inválida.');
    b.status ||= 'Programado';
    if (!['Programado', 'Cancelado'].includes(b.status)) fail('Estado del evento inválido.');
    b.featured = b.featured === 'on' && b.visibility === 'publico' ? 'on' : '';
    if (b.category !== 'campamento') {
      b.endDate = b.ages = b.packing = b.registrationUrl = '';
    }
    if (b.endDate && date(b.endDate) < b.date) fail('La fecha de fin debe ser igual o posterior al inicio.');
    if (b.registrationUrl) {
      let url;
      try { url = new URL(b.registrationUrl); } catch { fail('Usa un enlace HTTPS válido para la inscripción.'); }
      if (url.protocol !== 'https:' || url.username || url.password) fail('Usa un enlace HTTPS válido para la inscripción.');
      b.registrationUrl = url.href;
    }
    if (b.ministryId && !has('ministries', b.ministryId)) fail('Ministerio inexistente.');
  }
  if (kind === 'ministries') {
    b.members = input.members || [];
    if (!Array.isArray(b.members) || b.members.some(id => !Number.isInteger(id) || !has('members', id))) fail('Integrantes inválidos.');
    b.members = [...new Set(b.members)];
  }
  if (kind === 'donations') {
    b.amount = Number(b.amount);
    if (!Number.isFinite(b.amount) || b.amount <= 0 || b.amount > 1e10 || Math.abs(b.amount * 100 - Math.round(b.amount * 100)) > 0.0001) fail('El monto debe ser positivo y tener máximo dos decimales.');
    if (!['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].includes(b.method)) fail('Método de recepción inválido.');
    if (b.memberId && !has('members', b.memberId)) fail('Miembro inexistente.');
  }
  if (kind === 'attendance') {
    b.eventId = Number(b.eventId);
    if (!has('events', b.eventId)) fail('Evento inexistente.');
    for (const k of ['present', 'absent']) {
      if (!Array.isArray(input[k]) || input[k].some(id => !Number.isInteger(id) || !has('members', id))) fail('Miembros de asistencia inválidos.');
      b[k] = input[k];
    }
    const both = [...b.present, ...b.absent];
    if (new Set(both).size !== both.length) fail('Un miembro no puede aparecer dos veces en la asistencia.');
  }
  return b;
}
