import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../lib/database.js';

test('La configuración remota incompleta nunca crea una base local de sustitución', async () => {
  await assert.rejects(openDatabase(':memory:', { TURSO_DATABASE_URL: 'libsql://example.turso.io' }), /juntos/);
  await assert.rejects(openDatabase(':memory:', { TURSO_AUTH_TOKEN: 'private-test-token' }), /juntos/);
  await assert.rejects(openDatabase(':memory:', { RENDER: 'true', NODE_ENV: 'production', DB_REQUIRE_REMOTE: 'true' }), /necesita una base remota/);
  await assert.rejects(openDatabase(':memory:', { TURSO_DATABASE_URL: 'http://example.test', TURSO_AUTH_TOKEN: 'private-test-token' }), /segura/);
});

test('El controlador libSQL conserva transacciones, migraciones y restricciones SQLite', async () => {
  const { db } = await openDatabase(':memory:', { DB_DRIVER: 'libsql' });
  try {
    db.exec('PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY,name TEXT); CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id));');
    db.exec('BEGIN IMMEDIATE');
    const inserted = db.prepare('INSERT INTO parent(name) VALUES(?)').run('Prueba');
    db.prepare('INSERT INTO child(parent_id) VALUES(?)').run(Number(inserted.lastInsertRowid));
    db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM parent').get().n, 0);
    assert.throws(() => db.prepare('INSERT INTO child(parent_id) VALUES(?)').run(999));
    db.exec('ALTER TABLE parent ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
    assert.ok(db.prepare('PRAGMA table_info(parent)').all().some(c => c.name === 'active'));
    db.exec('BEGIN IMMEDIATE'); db.prepare('INSERT INTO parent(name) VALUES(?)').run('Confirmado'); db.exec('COMMIT');
    assert.equal(db.prepare('SELECT name FROM parent').get().name, 'Confirmado');
  } finally { db.close(); }
});
