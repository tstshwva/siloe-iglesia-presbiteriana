// Explicit allowlist: never serialize database rows or settings wholesale.
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, String(row[key] ?? '')]));
const picture = value => typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
export function publicSnapshot(church, rows, date = new Date().toISOString()) {
  const publicRows = rows.filter(row => row.visibility === 'publico');
  const ministries = publicRows.filter(row => row.kind === 'ministries').map(row => ({ id: row.id, ...pick(row, ['name', 'description']) }));
  return {
    updatedAt: date,
    church: { ...pick(church, ['name', 'address', 'phone', 'email', 'schedule']), logo: picture(church.logo), cover: picture(church.cover) },
    events: publicRows.filter(row => row.kind === 'events').map(row => ({ id: row.id, ...pick(row, ['title', 'date', 'time', 'place', 'address', 'description', 'status']), photo: picture(row.photo), ministryName: ministries.find(m => m.id === Number(row.ministryId))?.name || '' })),
    announcements: publicRows.filter(row => row.kind === 'announcements' && row.date <= date.slice(0, 10)).map(row => ({ id: row.id, ...pick(row, ['title', 'date', 'description']) })),
    ministries,
  };
}
