// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import { applySchemaToDb } from './embedded-schema';
import { bindTestDatabase, resetTestDatabase } from './index';

export function createTestDatabase(options?: { runMigration?: boolean }): DatabaseSync {
  resetTestDatabase();
  const db = new DatabaseSync(':memory:');
  bindTestDatabase(db, options);
  return db;
}

/** 仅建表，不跑 v2 迁移（用于迁移幂等测试） */
export function createBareTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  applySchemaToDb(db);
  return db;
}
