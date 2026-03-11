import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgePipeline } from './pipeline';
import { DatabaseAdapter } from './database';
import { KnowledgeObject } from './types';

vi.mock('./database', () => {
  return {
    DatabaseAdapter: class MockDatabaseAdapter {
      createCalls: KnowledgeObject[] = [];
      constructor() {
        this.createCalls = [];
      }
      createKnowledge = vi.fn((k: KnowledgeObject) => {
        this.createCalls.push({ ...k });
      });
      getKnowledge = vi.fn();
      updateKnowledge = vi.fn();
      deleteKnowledge = vi.fn();
      getAllKnowledge = vi.fn(() => [...this.createCalls]);
      getByType = vi.fn();
      getByStatus = vi.fn();
      getByImportance = vi.fn();
      close = vi.fn();
    }
  };
});

describe('KnowledgePipeline', () => {
  let pipeline: KnowledgePipeline;
  let db: DatabaseAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new DatabaseAdapter(':memory:');
    pipeline = new KnowledgePipeline(db);
  });

  describe('processSession', () => {
    it('extracts knowledge when patterns trigger', () => {
      const summary = 'We decided to use microservices architecture for the new project. This will improve scalability.';
      const sessionId = 'test-session-123';
      const sourceSpan = { messageStart: 0, messageEnd: 10 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.extracted.length).toBeGreaterThan(0);
      expect(result.extracted[0].type).toBe('decision');
      expect(result.extracted[0].sourceSessionId).toBe(sessionId);
      expect(result.extracted[0].sourceSpan).toEqual(sourceSpan);
    });

    it('skips content without pattern matches', () => {
      const summary = 'This is just a casual conversation about nothing important.';
      const sessionId = 'test-session-456';
      const sourceSpan = { messageStart: 0, messageEnd: 5 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.extracted.length).toBe(0);
      expect(result.skipped).toBe(true);
    });

    it('classifier filters questions', () => {
      const summary = 'Should we use microservices architecture? What framework should we chose?';
      const sessionId = 'test-session-789';
      const sourceSpan = { messageStart: 0, messageEnd: 3 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.extracted.length).toBe(0);
      expect(result.filtered).toBe(true);
    });

    it('classifier filters negative patterns', () => {
      const summary = 'I decided to use architecture maybe. I think we might use Docker.';
      const sessionId = 'test-session-abc';
      const sourceSpan = { messageStart: 0, messageEnd: 2 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.extracted.length).toBe(0);
      expect(result.filtered).toBe(true);
    });

    it('LLM extractor produces valid KnowledgeObject', () => {
      const summary = 'After evaluating options, we migrated to PostgreSQL due to better JSON support and performance.';
      const sessionId = 'test-session-xyz';
      const sourceSpan = { messageStart: 5, messageEnd: 15 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.extracted.length).toBe(1);
      const knowledge = result.extracted[0] as KnowledgeObject;
      
      expect(knowledge.id).toBeDefined();
      expect(knowledge.type).toBe('decision');
      expect(knowledge.title).toBeDefined();
      expect(knowledge.content).toBeDefined();
      expect(knowledge.content.description).toBeDefined();
      expect(knowledge.sourceSessionId).toBe(sessionId);
      expect(knowledge.sourceSpan).toEqual(sourceSpan);
      expect(knowledge.extractedAt).toBeDefined();
      expect(typeof knowledge.confidence).toBe('number');
      expect(typeof knowledge.importance).toBe('number');
      expect(Array.isArray(knowledge.tags)).toBe(true);
      expect(knowledge.status).toBe('active');
    });

    it('database stores with correct sourceSpan', () => {
      const summary = 'We chose Express framework for our REST API.';
      const sessionId = 'test-session-db';
      const sourceSpan = { messageStart: 100, messageEnd: 200 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.stored).toBe(true);
      
      const stored = db.getAllKnowledge();
      expect(stored.length).toBe(1);
      expect(stored[0].sourceSpan.messageStart).toBe(100);
      expect(stored[0].sourceSpan.messageEnd).toBe(200);
    });

    it('importance/confidence scores propagated correctly', () => {
      const summary = 'Critical production infrastructure decision: migrated to microservices for high-availability SLA.';
      const sessionId = 'test-session-scores';
      const sourceSpan = { messageStart: 0, messageEnd: 10 };

      const result = pipeline.processSession(summary, sessionId, sourceSpan);

      expect(result.extracted.length).toBeGreaterThan(0);
      
      const knowledge = result.extracted[0];
      expect(knowledge.confidence).toBeGreaterThan(0.5);
      expect(knowledge.importance).toBeGreaterThan(0.5);
      
      // Verify stored scores match
      const stored = db.getAllKnowledge();
      expect(stored[0].confidence).toBe(knowledge.confidence);
      expect(stored[0].importance).toBe(knowledge.importance);
    });
  });
});
