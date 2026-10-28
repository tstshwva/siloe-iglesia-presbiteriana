import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { publicSnapshot } from '../lib/pages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', 'website');
mkdirSync(output, { recursive: true });
const database = process.env.DB_PATH || path.join(root, 'data', 'church.sqlite');
let church = { name: 'Siloé - Iglesia Presbiteriana' }, rows = [];
if (existsSync(database)) {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const setting = db.prepare('SELECT body FROM settings WHERE id=1').get();
    if (setting) church = JSON.parse(setting.body);
    rows = db.prepare("SELECT id,kind,body FROM records WHERE kind IN ('events','announcements','ministries') AND json_extract(body,'$.visibility')='publico'").all().map(row => ({ ...JSON.parse(row.body), id: row.id, kind: row.kind }));
  } finally { db.close(); }
}
const data = publicSnapshot(church, rows);
writeFileSync(path.join(output, 'content.json'), JSON.stringify(data, null, 2) + '\n');
copyFileSync(path.join(root, 'public', 'portal.css'), path.join(output, 'style.css'));
const source = readFileSync(path.join(root, 'public', 'portal.js'), 'utf8');
const section = (from, to) => { const start = source.indexOf(from), end = source.indexOf(to, start); if (start < 0 || end < 0) throw Error('Revisa el generador de Pages: cambió la estructura del portal.'); return source.slice(start, end); };
// Reuse presentation only. No account handlers or API requests are shipped.
let views = section('function eventCard(', 'function modal(');
views = views.replace(/\$\{!state.user \? '<section class="join-block">.*? : ''\}/g, '');
views = views.replace("if ($('#join')) $('#join').onclick = () => accountDialog('register');", '');
writeFileSync(path.join(output, 'views.js'), views);
console.log(`Página pública preparada: ${data.events.length} eventos, ${data.announcements.length} avisos y ${data.ministries.length} ministerios. No se exportan cuentas ni miembros.`);
