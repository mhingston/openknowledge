import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, KnowledgeObject } from '../src/database';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';

const testDbPath = join(tmpdir(), 'test-knowledge.db');

describe('Database layer', () => {
  let db: Database;

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('CRUD operations', () => {
    it('should create a knowledge object', () => {
      const knowledge: KnowledgeObject = {
        id: 'test-1',
        type: 'architecture',
        title: 'Test Architecture',
        content: { framework: 'Next.js' },
        sourceSessionId: 'session-123',
        sourceSpan: { messageStart: 10, messageEnd: 20 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.8,
        tags: ['test'],
        status: 'active',
      };

      db.createKnowledge(knowledge);

      const result = db.getKnowledge('test-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('test-1');
      expect(result?.title).toBe('Test Architecture');
    });

    it('should get knowledge by id', () => {
      const knowledge: KnowledgeObject = {
        id: 'test-2',
        type: 'decision',
        title: 'Test Decision',
        content: { decision: 'Use SQLite' },
        sourceSessionId: 'session-456',
        sourceSpan: { messageStart: 5, messageEnd: 15 },
        extractedAt: new Date().toISOString(),
        confidence: 0.85,
        importance: 0.75,
        tags: ['database'],
        status: 'active',
      };

      db.createKnowledge(knowledge);

      const result = db.getKnowledge('test-2');
      expect(result).toBeDefined();
      expect(result?.type).toBe('decision');
    });

    it('should update knowledge', () => {
      const knowledge: KnowledgeObject = {
        id: 'test-3',
        type: 'workflow',
        title: 'Test Workflow',
        content: { steps: ['build', 'test'] },
        sourceSessionId: 'session-789',
        sourceSpan: { messageStart: 1, messageEnd: 10 },
        extractedAt: new Date().toISOString(),
        confidence: 0.8,
        importance: 0.7,
        tags: ['ci'],
        status: 'active',
      };

      db.createKnowledge(knowledge);
      db.updateKnowledge('test-3', { title: 'Updated Workflow', importance: 0.9 });

      const result = db.getKnowledge('test-3');
      expect(result?.title).toBe('Updated Workflow');
      expect(result?.importance).toBe(0.9);
    });

    it('should delete knowledge', () => {
      const knowledge: KnowledgeObject = {
        id: 'test-4',
        type: 'timeline',
        title: 'Test Timeline',
        content: { date: '2026-03-11' },
        sourceSessionId: 'session-000',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.95,
        importance: 0.6,
        tags: ['milestone'],
        status: 'active',
      };

      db.createKnowledge(knowledge);
      db.deleteKnowledge('test-4');

      const result = db.getKnowledge('test-4');
      expect(result).toBeUndefined();
    });

    it('should get all knowledge', () => {
      const k1: KnowledgeObject = {
        id: 'test-5a',
        type: 'architecture',
        title: 'Knowledge 1',
        content: {},
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.8,
        tags: [],
        status: 'active',
      };

      const k2: KnowledgeObject = {
        id: 'test-5b',
        type: 'decision',
        title: 'Knowledge 2',
        content: {},
        sourceSessionId: 'session-2',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.7,
        tags: [],
        status: 'active',
      };

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const all = db.getAllKnowledge();
      expect(all.length).toBe(2);
    });
  });

  describe('Search methods', () => {
    it('should get knowledge by type', () => {
      const k1: KnowledgeObject = {
        id: 'test-6a',
        type: 'architecture',
        title: 'Arch 1',
        content: {},
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.8,
        tags: [],
        status: 'active',
      };

      const k2: KnowledgeObject = {
        id: 'test-6b',
        type: 'decision',
        title: 'Decision 1',
        content: {},
        sourceSessionId: 'session-2',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.7,
        tags: [],
        status: 'active',
      };

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const architecture = db.getByType('architecture');
      expect(architecture.length).toBe(1);
      expect(architecture[0].id).toBe('test-6a');
    });

    it('should get knowledge by status', () => {
      const k1: KnowledgeObject = {
        id: 'test-7a',
        type: 'architecture',
        title: 'Active Knowledge',
        content: {},
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.8,
        tags: [],
        status: 'active',
      };

      const k2: KnowledgeObject = {
        id: 'test-7b',
        type: 'architecture',
        title: 'Superseded Knowledge',
        content: {},
        sourceSessionId: 'session-2',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.7,
        tags: [],
        status: 'superseded',
      };

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const active = db.getByStatus('active');
      expect(active.length).toBe(1);
      expect(active[0].status).toBe('active');
    });

    it('should get knowledge by minimum importance', () => {
      const k1: KnowledgeObject = {
        id: 'test-8a',
        type: 'architecture',
        title: 'High Importance',
        content: {},
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.9,
        tags: [],
        status: 'active',
      };

      const k2: KnowledgeObject = {
        id: 'test-8b',
        type: 'architecture',
        title: 'Low Importance',
        content: {},
        sourceSessionId: 'session-2',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.3,
        tags: [],
        status: 'active',
      };

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const highImportance = db.getByImportance(0.5);
      expect(highImportance.length).toBe(1);
      expect(highImportance[0].importance).toBe(0.9);
    });
  });
});
