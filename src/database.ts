import Database from 'better-sqlite3';
import { join, dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { KnowledgeObject, KnowledgeType, KnowledgeStatus } from './types';

export interface KnowledgeObject {
  id: string;
  type: KnowledgeType;
  title: string;
  content: Record<string, any>;
  sourceSessionId: string;
  sourceSpan: { messageStart: number; messageEnd: number };
  sourceSpanStart?: number;
  sourceSpanEnd?: number;
  extractedAt: string;
  confidence: number;
  importance: number;
  tags: string[];
  status: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}

export class DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPath?: string) {
    if (!dbPath) {
      const configDir = join(homedir(), '.config', 'opencode', 'storage');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      dbPath = join(configDir, 'project_knowledge.db');
    }

    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_objects (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_session_id TEXT NOT NULL,
        source_span_start INTEGER NOT NULL,
        source_span_end INTEGER NOT NULL,
        extracted_at TEXT NOT NULL,
        confidence REAL NOT NULL,
        importance REAL NOT NULL,
        tags TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_objects(type);
      CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_objects(status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_importance ON knowledge_objects(importance);
      CREATE INDEX IF NOT EXISTS idx_knowledge_session ON knowledge_objects(source_session_id);
    `);
  }

  createKnowledge(knowledge: KnowledgeObject): void {
    const now = knowledge.createdAt || new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO knowledge_objects (
        id, type, title, content, source_session_id,
        source_span_start, source_span_end, extracted_at,
        confidence, importance, tags, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      knowledge.id,
      knowledge.type,
      knowledge.title,
      JSON.stringify(knowledge.content),
      knowledge.sourceSessionId,
      knowledge.sourceSpan.messageStart,
      knowledge.sourceSpan.messageEnd,
      knowledge.extractedAt,
      knowledge.confidence,
      knowledge.importance,
      JSON.stringify(knowledge.tags),
      knowledge.status,
      now,
      now
    );
  }

  getKnowledge(id: string): KnowledgeObject | undefined {
    const stmt = this.db.prepare('SELECT * FROM knowledge_objects WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return undefined;

    return this.mapRowToObject(row);
  }

  updateKnowledge(id: string, updates: Partial<KnowledgeObject>): void {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map((f, i) => `${this.toSnakeCase(f)} = ?`).join(', ');
    const values = fields.map(f => {
      const key = f as keyof KnowledgeObject;
      if (['content', 'tags'].includes(key)) {
        return JSON.stringify(updates[key]);
      }
      return updates[key];
    });

    const stmt = this.db.prepare(`
      UPDATE knowledge_objects
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `);

    const params = [...values, new Date().toISOString(), id];
    stmt.run(...params);
  }

  deleteKnowledge(id: string): void {
    const stmt = this.db.prepare('DELETE FROM knowledge_objects WHERE id = ?');
    stmt.run(id);
  }

  getAllKnowledge(): KnowledgeObject[] {
    const stmt = this.db.prepare('SELECT * FROM knowledge_objects ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToObject(row));
  }

  getByType(type: KnowledgeType): KnowledgeObject[] {
    const stmt = this.db.prepare('SELECT * FROM knowledge_objects WHERE type = ? ORDER BY created_at DESC');
    const rows = stmt.all(type) as any[];
    return rows.map(row => this.mapRowToObject(row));
  }

  getByStatus(status: KnowledgeStatus): KnowledgeObject[] {
    const stmt = this.db.prepare('SELECT * FROM knowledge_objects WHERE status = ? ORDER BY created_at DESC');
    const rows = stmt.all(status) as any[];
    return rows.map(row => this.mapRowToObject(row));
  }

  getByImportance(minImportance: number): KnowledgeObject[] {
    const stmt = this.db.prepare('SELECT * FROM knowledge_objects WHERE importance >= ? ORDER BY importance DESC');
    const rows = stmt.all(minImportance) as any[];
    return rows.map(row => this.mapRowToObject(row));
  }

  close(): void {
    this.db.close();
  }

  private mapRowToObject(row: any): KnowledgeObject {
    return {
      id: row.id,
      type: row.type as KnowledgeType,
      title: row.title,
      content: JSON.parse(row.content),
      sourceSessionId: row.source_session_id,
      sourceSpan: {
        messageStart: row.source_span_start,
        messageEnd: row.source_span_end,
      },
      extractedAt: row.extracted_at,
      confidence: row.confidence,
      importance: row.importance,
      tags: JSON.parse(row.tags),
      status: row.status as KnowledgeStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export { DatabaseAdapter as Database };
