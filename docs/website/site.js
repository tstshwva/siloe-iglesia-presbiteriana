const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const fallback = 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1400&q=85';
let state, page = 'inicio', query = '', ministry = '', period = 'proximos', calendar = false, month = new Date(today() + 'T12:00:00');
const empty = text => `<div class="empty">${esc(text)}</div>`;
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; setTimeout(() => $('#toast').hidden = true, 6000); }
function brand() { return `<span class="identity">${state.church.logo ? `<img src="${esc(state.church.logo)}" alt="Logotipo de la iglesia">` : '<span class="cross" aria-hidden="true">✝</span>'}<span>${esc(state.church.name)}</span></span>`; }
function readable(date) { return new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function mapLinks(place) {
  if (!place) return '';
  return `<a class="button secondary" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}">Google Maps ↗</a><a class="button secondary" target="_blank" rel="noopener noreferrer" href="https://maps.apple.com/?daddr=${encodeURIComponent(place)}">Apple Maps ↗</a>`;
}
function render() {
  $('#portal-app').innerHTML = `<header class="site-header"><a class="brand-link" href="./">${brand()}</a><nav aria-label="Comunidad">${[['inicio','Inicio'],['eventos','Eventos'],['avisos','Avisos'],['ministerios','Ministerios'],['iglesia','Nuestra iglesia']].map(([id,label]) => `<button data-page="${id}" class="nav-link ${page === id ? 'active' : ''}" ${page === id ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav><div class="account-actions"><button class="secondary" data-page="iglesia">Horarios y contacto ↗</button></div></header><main id="main"><section id="view"></section></main><footer class="site-footer">${brand()}<p>Una comunidad para crecer en fe y servir con amor.</p><p>${esc(state.church.address)}</p><button class="link" data-page="iglesia">Horarios y contacto</button><p>Esta página es informativa. El registro de miembros y el acceso administrativo en línea estarán disponibles próximamente.</p><small>Última publicación: ${esc(readable(state.updatedAt.slice(0,10)))}</small></footer>`;
  document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => { page = button.dataset.page; query = ''; ministry = ''; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  if (page === 'inicio') home(); else if (page === 'eventos') events(); else if (page === 'avisos') announcements(); else if (page === 'ministerios') ministries(); else about();
}
function modal(title, contents) {
  document.querySelector('dialog')?.remove(); const d = document.createElement('dialog');
  d.setAttribute('aria-label', title); d.innerHTML = `<div class="modal-heading"><h2>${esc(title)}</h2><button class="close secondary" aria-label="Cerrar">✕</button></div>${contents}`;
  document.body.append(d); d.querySelector('.close').onclick = () => d.close(); d.showModal(); return d;
}
function eventDetail(id) {
  const event = state.events.find(row => row.id === id); if (!event) return notify('Este evento no está publicado.');
  const d = modal(event.title, `${event.photo ? `<img class="detail-photo" src="${esc(event.photo)}" alt="${esc(event.title)}">` : ''}<div class="tags"><span class="tag ${event.status === 'Cancelado' ? 'cancelled' : ''}">${esc(event.status || 'Programado')}</span></div><p><strong>${esc(readable(event.date))} · ${esc(event.time)} h</strong><br><small>Hora de Ciudad de México</small></p><h3>${esc(event.place)}</h3><p>${esc(event.address || 'Consulta la dirección exacta con la iglesia antes de salir.')}</p><div class="actions">${mapLinks(event.address || event.place)}</div><p class="multiline detail-description">${esc(event.description)}</p><button class="secondary" id="share-event">Copiar enlace del evento</button>`);
  d.querySelector('#share-event').onclick = async () => { const link = new URL(location.href); link.hash = 'evento=' + id; try { await navigator.clipboard.writeText(link.href); notify('Enlace copiado.'); } catch { modal('Enlace del evento', `<label>Copia este enlace<input readonly value="${esc(link.href)}"></label>`); } };
}
function deepLink() {
  if (!state) return;
  const match = /^#evento=(\d+)$/.exec(location.hash);
  if (match) eventDetail(Number(match[1]));
}
async function boot() {
  try {
    const response = await fetch('./website/content.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('No se pudo cargar la información de la iglesia.');
    state = await response.json(); state.going = [];
    state.announcements = state.announcements.filter(row => row.date <= today());
    document.title = state.church.name; render(); deepLink();
  } catch (error) { $('#portal-app').innerHTML = `<main id="main" class="section"><h1>Siloé - Iglesia Presbiteriana</h1><p>${esc(error.message)}</p><a href="./">Volver a intentar</a></main>`; }
}
window.addEventListener('hashchange', deepLink);
boot();
