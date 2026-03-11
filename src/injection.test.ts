import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeInjection } from '../src/injection';
import { KnowledgeObject } from '../src/types';

interface TestDatabaseAdapter {
  createKnowledge(k: KnowledgeObject): void;
  getAllKnowledge(): KnowledgeObject[];
  getByType(type: string): KnowledgeObject[];
  getByStatus(status: string): KnowledgeObject[];
  getByImportance(minImportance: number): KnowledgeObject[];
  getKnowledge(id: string): KnowledgeObject | undefined;
  close(): void;
}

class TestInMemoryDatabase implements TestDatabaseAdapter {
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
  const base: KnowledgeObject = {
    id: `test-${Math.random().toString(36).substr(2, 9)}`,
    type: 'decision',
    title: 'Test Knowledge',
    content: { description: 'Test content' },
    sourceSessionId: 'session-123',
    sourceSpan: { messageStart: 0, messageEnd: 10 },
    extractedAt: new Date().toISOString(),
    confidence: 0.8,
    importance: 0.5,
    tags: [],
    status: 'active',
  };
  return { ...base, ...overrides };
};

describe('KnowledgeInjection', () => {
  let db: TestInMemoryDatabase;
  let injection: KnowledgeInjection;

  beforeEach(() => {
    db = new TestInMemoryDatabase();
    injection = new KnowledgeInjection(db as any);
  });

  describe('generateXML', () => {
    it('should generate valid XML with knowledge objects', () => {
      const k1: KnowledgeObject = {
        id: 'arch-1',
        type: 'architecture',
        title: 'System Architecture',
        content: { framework: 'Next.js', database: 'SQLite' },
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 10, messageEnd: 20 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.85,
        tags: ['backend', 'architecture'],
        status: 'active',
      };

      const k2: KnowledgeObject = {
        id: 'dec-1',
        type: 'decision',
        title: 'Database Choice',
        content: { decision: 'Use SQLite for simplicity' },
        sourceSessionId: 'session-2',
        sourceSpan: { messageStart: 5, messageEnd: 15 },
        extractedAt: new Date().toISOString(),
        confidence: 0.88,
        importance: 0.80,
        tags: ['database', 'decision'],
        status: 'active',
      };

      db.createKnowledge(k1);
      db.createKnowledge(k2);

      const all = db.getAllKnowledge();
      expect(all.length).toBe(2);

      const xml = injection.generateXML(2);

      expect(xml).toContain('<knowledge');
      expect(xml).toContain('id="arch-1"');
      expect(xml).toContain('id="dec-1"');
    });

    it('should escape XML special characters in content', () => {
      const k: KnowledgeObject = {
        id: 'xml-test',
        type: 'architecture',
        title: 'Test with <special> & "characters"',
        content: { description: 'Use <Component> & handle "quotes"' },
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.8,
        tags: ['test', 'xml'],
        status: 'active',
      };

      db.createKnowledge(k);

      const xml = injection.generateXML(1);

      expect(xml).toContain('&lt;special&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;');
      expect(xml).not.toContain('<special>');
      expect(xml).not.toContain('"characters"');
    });

    it('should return empty XML when no knowledge exists', () => {
      const xml = injection.generateXML(5);

      expect(xml).toBe('<openknowledge worktree="" count="0" />\n');
    });

    it('should include worktree attribute', () => {
      const worktree = '/home/mark/.local/share/opencode/storage';
      const injectionWithWorktree = new KnowledgeInjection(db as any, worktree);

      const k: KnowledgeObject = {
        id: 'test-1',
        type: 'architecture',
        title: 'Test',
        content: {},
        sourceSessionId: 'session-1',
        sourceSpan: { messageStart: 0, messageEnd: 5 },
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        importance: 0.8,
        tags: [],
        status: 'active',
      };

      db.createKnowledge(k);

      const xml = injectionWithWorktree.generateXML(1);

      expect(xml).toContain('worktree="/home/mark/.local/share/opencode/storage"');
    });

    it('should respect maxMemories parameter', () => {
      for (let i = 0; i < 5; i++) {
        db.createKnowledge({
          id: `test-${i}`,
          type: 'architecture',
          title: `Test ${i}`,
          content: { index: i },
          sourceSessionId: 'session-1',
          sourceSpan: { messageStart: 0, messageEnd: 5 },
          extractedAt: new Date().toISOString(),
          confidence: 0.9,
          importance: 0.9 - i * 0.1,
          tags: ['test'],
          status: 'active',
        });
      }

      const xml = injection.generateXML(3);
      const matches = xml.match(/<knowledge /g);
      expect(matches?.length).toBe(3);
    });
  });

  describe('quota allocation', () => {
    it('should allocate minimum 30% architecture', () => {
      for (let i = 0; i < 3; i++) {
        db.createKnowledge({
          id: `arch-${i}`,
          type: 'architecture',
          title: `Architecture ${i}`,
          content: {},
          sourceSessionId: 'session-1',
          sourceSpan: { messageStart: 0, messageEnd: 5 },
          extractedAt: new Date().toISOString(),
          confidence: 0.9,
          importance: 0.9,
          tags: [],
          status: 'active',
        });
      }

      for (let i = 0; i < 7; i++) {
        db.createKnowledge({
          id: `other-${i}`,
          type: 'decision',
          title: `Decision ${i}`,
          content: {},
          sourceSessionId: 'session-1',
          sourceSpan: { messageStart: 0, messageEnd: 5 },
          extractedAt: new Date().toISOString(),
          confidence: 0.9,
          importance: 0.95,
          tags: [],
          status: 'active',
        });
      }

      const xml = injection.generateXML(10, 'session-test');
      const archCount = (xml.match(/type="architecture"/g) || []).length;
      expect(archCount).toBeGreaterThanOrEqual(3);
    });

    it('should allocate minimum 30% decisions', () => {
      for (let i = 0; i < 3; i++) {
        db.createKnowledge({
          id: `dec-${i}`,
          type: 'decision',
          title: `Decision ${i}`,
          content: {},
          sourceSessionId: 'session-1',
          sourceSpan: { messageStart: 0, messageEnd: 5 },
          extractedAt: new Date().toISOString(),
          confidence: 0.9,
          importance: 0.9,
          tags: [],
          status: 'active',
        });
      }

      for (let i = 0; i < 7; i++) {
        db.createKnowledge({
          id: `other-${i}`,
          type: 'architecture',
          title: `Architecture ${i}`,
          content: {},
          sourceSessionId: 'session-1',
          sourceSpan: { messageStart: 0, messageEnd: 5 },
          extractedAt: new Date().toISOString(),
          confidence: 0.9,
          importance: 0.95,
          tags: [],
          status: 'active',
        });
      }

      const xml = injection.generateXML(10, 'session-test');
      const decCount = (xml.match(/type="decision"/g) || []).length;
      expect(decCount).toBeGreaterThanOrEqual(3);
    });
  });
});
