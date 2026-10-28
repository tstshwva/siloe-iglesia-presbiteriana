import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSnapshot } from '../lib/pages.js';

test('Pages exporta solo publicaciones públicas y campos institucionales permitidos', () => {
  const result = publicSnapshot({ name: 'Siloé', email: 'contacto@example.test', smtpPassword: 'secreto', logo: 'javascript:alert(1)' }, [
    { id: 1, kind: 'events', title: 'Abierto', visibility: 'publico', responsible: 'Persona privada', ministryId: 7 },
    { id: 2, kind: 'events', title: 'Privado', visibility: 'privado' },
    { id: 3, kind: 'events', title: 'Miembros', visibility: 'miembros' },
    { id: 4, kind: 'events', title: 'Anterior sin clasificación' },
    { id: 5, kind: 'members', name: 'No publicar', visibility: 'publico', email: 'privado@example.test' },
    { id: 6, kind: 'announcements', title: 'Futuro', date: '2099-01-01', visibility: 'publico' },
    { id: 7, kind: 'ministries', name: 'Público', visibility: 'publico', coordinator: 'Privado', members: [5] },
    { id: 8, kind: 'announcements', title: 'Aviso', date: '2026-01-01', visibility: 'publico' },
  ], '2026-10-28T12:00:00.000Z');
  assert.deepEqual(result.events.map(e => e.title), ['Abierto']);
  assert.equal(result.events[0].ministryName, 'Público');
  assert.equal(result.announcements.length, 1);
  assert.equal(result.church.logo, '');
  const serialized = JSON.stringify(result);
  for (const privateText of ['secreto', 'Persona privada', 'No publicar', 'privado@example.test', 'coordinator', 'responsible', 'Futuro']) assert.ok(!serialized.includes(privateText));
});
