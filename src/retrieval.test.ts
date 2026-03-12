import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeRetrieval } from './retrieval.js';
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

describe('KnowledgeRetrieval', () => {
  let retrieval: KnowledgeRetrieval;
  let db: InMemoryDatabase;

  beforeEach(() => {
    db = new InMemoryDatabase();
    retrieval = new KnowledgeRetrieval(db as any);
  });

  describe('queryByType', () => {
    it('returns knowledge objects filtered by type', () => {
      const arch1 = createTestKnowledge({ id: 'arch1', type: 'architecture', title: 'Architecture 1' });
      const arch2 = createTestKnowledge({ id: 'arch2', type: 'architecture', title: 'Architecture 2' });
      const dec1 = createTestKnowledge({ id: 'dec1', type: 'decision', title: 'Decision 1' });

      db.createKnowledge(arch1);
      db.createKnowledge(arch2);
      db.createKnowledge(dec1);

      const results = retrieval.queryByType('architecture', 10);

      expect(results.length).toBe(2);
      expect(results.map(r => r.type)).toEqual(['architecture', 'architecture']);
      expect(results.map(r => r.id)).toEqual(['arch1', 'arch2']);
    });

    it('respects limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        db.createKnowledge(createTestKnowledge({ id: `arch-${i}`, type: 'architecture' }));
      }

      const results = retrieval.queryByType('architecture', 3);

      expect(results.length).toBe(3);
    });

    it('returns empty array when no matching type', () => {
      db.createKnowledge(createTestKnowledge({ type: 'decision' }));

      const results = retrieval.queryByType('architecture', 10);

      expect(results).toEqual([]);
    });

    it('returns empty array when database is empty', () => {
      const results = retrieval.queryByType('architecture', 10);

      expect(results).toEqual([]);
    });
  });

  describe('queryByImportance', () => {
    it('returns knowledge objects with importance >= minScore', () => {
      const high = createTestKnowledge({ id: 'high', importance: 0.9 });
      const med = createTestKnowledge({ id: 'med', importance: 0.6 });
      const low = createTestKnowledge({ id: 'low', importance: 0.3 });

      db.createKnowledge(high);
      db.createKnowledge(med);
      db.createKnowledge(low);

      const results = retrieval.queryByImportance(0.5, 10);

      expect(results.length).toBe(2);
      expect(results.map(r => r.id)).toEqual(['high', 'med']);
    });

    it('respects limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        db.createKnowledge(createTestKnowledge({ id: `high-${i}`, importance: 0.8 }));
      }

      const results = retrieval.queryByImportance(0.5, 3);

      expect(results.length).toBe(3);
    });

    it('returns empty array when no items meet threshold', () => {
      db.createKnowledge(createTestKnowledge({ importance: 0.3 }));

      const results = retrieval.queryByImportance(0.5, 10);

      expect(results).toEqual([]);
    });

    it('returns empty array when database is empty', () => {
      const results = retrieval.queryByImportance(0.5, 10);

      expect(results).toEqual([]);
    });
  });

  describe('queryByRecency', () => {
    it('returns knowledge objects extracted within last N days', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      db.createKnowledge(createTestKnowledge({ id: 'recent', extractedAt: twoDaysAgo.toISOString() }));
      db.createKnowledge(createTestKnowledge({ id: 'older', extractedAt: fiveDaysAgo.toISOString() }));
      db.createKnowledge(createTestKnowledge({ id: 'oldest', extractedAt: tenDaysAgo.toISOString() }));

      const results = retrieval.queryByRecency(3, 10);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('recent');
    });

    it('respects limit parameter', () => {
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        db.createKnowledge(createTestKnowledge({ id: `recent-${i}`, extractedAt: date.toISOString() }));
      }

      const results = retrieval.queryByRecency(7, 3);

      expect(results.length).toBe(3);
    });

    it('returns empty array when no recent items', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      db.createKnowledge(createTestKnowledge({ extractedAt: tenDaysAgo.toISOString() }));

      const results = retrieval.queryByRecency(3, 10);

      expect(results).toEqual([]);
    });

    it('returns empty array when database is empty', () => {
      const results = retrieval.queryByRecency(7, 10);

      expect(results).toEqual([]);
    });
  });

  describe('search', () => {
    it('ranks results by Jaccard similarity', () => {
      const exact = createTestKnowledge({
        id: 'exact',
        content: { description: 'microservices architecture for scalability' },
        tags: ['microservices', 'architecture', 'scalability'],
      });

      const partial = createTestKnowledge({
        id: 'partial',
        content: { description: 'microservices for scaling' },
        tags: ['microservices', 'scaling'],
      });

      const unrelated = createTestKnowledge({
        id: 'unrelated',
        content: { description: 'database migration to postgres' },
        tags: ['database', 'postgresql'],
      });

      db.createKnowledge(exact);
      db.createKnowledge(partial);
      db.createKnowledge(unrelated);

      const results = retrieval.search('microservices architecture', 10);

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('exact');
      expect(results[1].id).toBe('partial');
    });

    it('respects limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        db.createKnowledge(createTestKnowledge({
          id: `item-${i}`,
          content: { description: 'microservices architecture' },
          tags: ['microservices'],
        }));
      }

      const results = retrieval.search('microservices', 3);

      expect(results.length).toBe(3);
    });

    it('returns empty array when query matches nothing', () => {
      db.createKnowledge(createTestKnowledge({
        content: { description: 'database migration' },
        tags: ['database'],
      }));

      const results = retrieval.search('microservices', 10);

      expect(results).toEqual([]);
    });

    it('returns empty array when database is empty', () => {
      const results = retrieval.search('microservices', 10);

      expect(results).toEqual([]);
    });
  });

  describe('getActiveKnowledge', () => {
    it('returns only active knowledge objects', () => {
      const active1 = createTestKnowledge({ id: 'active1', status: 'active' });
      const active2 = createTestKnowledge({ id: 'active2', status: 'active' });
      const superseded = createTestKnowledge({ id: 'superseded', status: 'superseded' });

      db.createKnowledge(active1);
      db.createKnowledge(active2);
      db.createKnowledge(superseded);

      const results = retrieval.getActiveKnowledge();

      expect(results.length).toBe(2);
      expect(results.map(r => r.status)).toEqual(['active', 'active']);
    });

    it('excludes superseded knowledge', () => {
      const superseded = createTestKnowledge({ id: 'superseded', status: 'superseded' });

      db.createKnowledge(superseded);

      const results = retrieval.getActiveKnowledge();

      expect(results.length).toBe(0);
    });

    it('returns empty array when database is empty', () => {
      const results = retrieval.getActiveKnowledge();

      expect(results).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns single knowledge object by id', () => {
      const k = createTestKnowledge({ id: 'specific-id', title: 'Specific Knowledge' });

      db.createKnowledge(k);

      const result = retrieval.getById('specific-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('specific-id');
      expect(result?.title).toBe('Specific Knowledge');
    });

    it('returns null when id not found', () => {
      const result = retrieval.getById('non-existent');

      expect(result).toBeNull();
    });
  });
});
