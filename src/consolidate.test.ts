import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeConsolidator } from './consolidate.js';
import { KnowledgeObject } from './types.js';

class InMemoryDatabase {
  private store = new Map<string, KnowledgeObject>();

  createKnowledge(k: KnowledgeObject) {
    this.store.set(k.id, { ...k });
  }

  getKnowledge(id: string): KnowledgeObject | undefined {
    return this.store.get(id);
  }

  updateKnowledge(id: string, updates: Partial<KnowledgeObject>) {
    const existing = this.store.get(id);
    if (existing) {
      this.store.set(id, { ...existing, ...updates });
    }
  }

  deleteKnowledge(id: string) {
    this.store.delete(id);
  }

  getAllKnowledge(): KnowledgeObject[] {
    return Array.from(this.store.values());
  }

  getByType(type: string): KnowledgeObject[] {
    return Array.from(this.store.values()).filter(k => k.type === type);
  }

  getByStatus(status: string): KnowledgeObject[] {
    return Array.from(this.store.values()).filter(k => k.status === status);
  }

  getByImportance(minImportance: number): KnowledgeObject[] {
    return Array.from(this.store.values()).filter(k => k.importance >= minImportance);
  }

  close() {}
}

const createTestKnowledge = (
  overrides: Partial<KnowledgeObject> = {}
): KnowledgeObject => {
  const now = new Date().toISOString();
  const base: KnowledgeObject = {
    id: `test-${Math.random().toString(36).substr(2, 9)}`,
    type: 'decision',
    title: 'Test Knowledge',
    content: { description: 'Test content' },
    sourceSessionId: 'session-123',
    sourceSpan: { messageStart: 0, messageEnd: 10 },
    extractedAt: now,
    confidence: 0.8,
    importance: 0.5,
    tags: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, ...overrides };
};

describe('KnowledgeConsolidator', () => {
  let consolidator: KnowledgeConsolidator;
  let db: InMemoryDatabase;

  beforeEach(() => {
    db = new InMemoryDatabase();
    consolidator = new KnowledgeConsolidator(db as any);
  });

  describe('detectDuplicates', () => {
    it('detects duplicate knowledge with Jaccard similarity > 0.85', () => {
      const k1 = createTestKnowledge({
        id: 'k1',
        content: { description: 'We chose microservices for scalability and performance' },
        tags: ['microservices', 'scalability', 'performance'],
        extractedAt: '2025-01-01T00:00:00Z',
      });

      const k2 = createTestKnowledge({
        id: 'k2',
        content: { description: 'We chose microservices for scalability and performance' },
        tags: ['microservices', 'scalability', 'performance'],
        extractedAt: '2025-01-02T00:00:00Z',
      });

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const duplicates = consolidator.detectDuplicates();

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].pair).toEqual(['k2', 'k1']);
    });

    it('does not flag knowledge with similarity <= 0.85', () => {
      const k1 = createTestKnowledge({
        id: 'k1',
        content: { description: 'Microservices architecture for scalability' },
        tags: ['microservices', 'architecture'],
      });

      const k2 = createTestKnowledge({
        id: 'k2',
        content: { description: 'Database migration to PostgreSQL' },
        tags: ['database', 'postgresql'],
      });

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const duplicates = consolidator.detectDuplicates();

      expect(duplicates.length).toBe(0);
    });

    it('handles empty database gracefully', () => {
      const duplicates = consolidator.detectDuplicates();
      expect(duplicates).toEqual([]);
    });
  });

  describe('supersedeOutdated', () => {
    it('marks older knowledge as superseded when newer conflicts', () => {
      const older = createTestKnowledge({
        id: 'older',
        content: { description: 'Using Express for REST API' },
        tags: ['express', 'rest', 'api'],
        extractedAt: '2025-01-01T00:00:00Z',
      });

      const newer = createTestKnowledge({
        id: 'newer',
        content: { description: 'Using Express for REST API' },
        tags: ['express', 'rest', 'api'],
        extractedAt: '2025-01-15T00:00:00Z',
      });

      db.createKnowledge(older);
      db.createKnowledge(newer);

      const result = consolidator.supersedeOutdated();

      expect(result.superseded).toBe(1);

      const updatedOlder = db.getKnowledge('older');
      expect(updatedOlder?.status).toBe('superseded');
    });

    it('keeps newer knowledge as active', () => {
      const newer = createTestKnowledge({
        id: 'newer',
        extractedAt: '2025-01-15T00:00:00Z',
      });

      db.createKnowledge(newer);

      consolidator.supersedeOutdated();

      const updatedNewer = db.getKnowledge('newer');
      expect(updatedNewer?.status).toBe('active');
    });

    it('handles empty database gracefully', () => {
      const result = consolidator.supersedeOutdated();
      expect(result.superseded).toBe(0);
    });
  });

  describe('mergeComplementary', () => {
    it('links complementary knowledge of same type', () => {
      const k1 = createTestKnowledge({
        id: 'k1',
        type: 'architecture',
        content: { description: 'Microservices architecture with api gateway', components: ['api', 'db'] },
        tags: ['microservices', 'architecture'],
      });

      const k2 = createTestKnowledge({
        id: 'k2',
        type: 'architecture',
        content: { description: 'Microservices architecture with event messaging', components: ['queue', 'worker'] },
        tags: ['microservices', 'event-driven'],
      });

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const result = consolidator.mergeComplementary();

      expect(result.merged).toBe(1);

      const updatedK1 = db.getKnowledge('k1');
      expect(updatedK1?.content.relatedKnowledge).toContain('k2');
    });

    it('does not merge different types', () => {
      const k1 = createTestKnowledge({
        id: 'k1',
        type: 'architecture',
      });

      const k2 = createTestKnowledge({
        id: 'k2',
        type: 'decision',
      });

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const result = consolidator.mergeComplementary();

      expect(result.merged).toBe(0);
    });

    it('handles empty database gracefully', () => {
      const result = consolidator.mergeComplementary();
      expect(result.merged).toBe(0);
    });
  });

  describe('updateImportanceScores', () => {
    it('increases importance based on access frequency', () => {
      const k = createTestKnowledge({
        id: 'k1',
        importance: 0.5,
      });

      db.createKnowledge(k);

      const result = consolidator.updateImportanceScores([{ knowledgeId: 'k1', accessCount: 5 }]);

      expect(result.updated).toBe(1);

      const updated = db.getKnowledge('k1');
      expect(updated?.importance).toBeGreaterThan(0.5);
    });

    it('handles empty database gracefully', () => {
      const result = consolidator.updateImportanceScores([]);
      expect(result.updated).toBe(0);
    });
  });

  describe('cleanupFragmented', () => {
    it('removes fragmented knowledge with incomplete content', () => {
      const complete = createTestKnowledge({
        id: 'complete',
        content: { description: 'Complete architecture decision', rationale: 'performance' },
        confidence: 0.8,
        tags: ['architecture', 'complete'],
      });

      const fragmented = createTestKnowledge({
        id: 'fragmented',
        content: { description: 'Partial' },
        confidence: 0.3,
        tags: [],
      });

      db.createKnowledge(complete);
      db.createKnowledge(fragmented);

      const result = consolidator.cleanupFragmented();

      expect(result.cleaned).toBe(1);
      expect(db.getKnowledge('fragmented')).toBeUndefined();
      expect(db.getKnowledge('complete')).toBeDefined();
    });

    it('handles empty database gracefully', () => {
      const result = consolidator.cleanupFragmented();
      expect(result.cleaned).toBe(0);
    });
  });

  describe('runConsolidation', () => {
    it('runs idempotently - safe to call multiple times', () => {
      const k1 = createTestKnowledge({
        id: 'k1',
        content: { description: 'Microservices for scalability' },
        tags: ['microservices'],
      });

      const k2 = createTestKnowledge({
        id: 'k2',
        content: { description: 'Microservices for scaling' },
        tags: ['scaling'],
      });

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const result1 = consolidator.runConsolidation();
      const result2 = consolidator.runConsolidation();

      expect(result1.duplicatesDetected).toBe(result2.duplicatesDetected);
      expect(result1.supersededCount).toBe(result2.supersededCount);
    });

    it('returns consolidated report', () => {
      const result = consolidator.runConsolidation();

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('duplicatesDetected');
      expect(result).toHaveProperty('supersededCount');
      expect(result).toHaveProperty('mergedCount');
      expect(result).toHaveProperty('importanceUpdated');
      expect(result).toHaveProperty('fragmentedCleaned');
    });

    it('handles empty database gracefully', () => {
      const result = consolidator.runConsolidation();

      expect(result.duplicatesDetected).toBe(0);
      expect(result.supersededCount).toBe(0);
      expect(result.mergedCount).toBe(0);
      expect(result.importanceUpdated).toBe(0);
      expect(result.fragmentedCleaned).toBe(0);
    });
  });
});
