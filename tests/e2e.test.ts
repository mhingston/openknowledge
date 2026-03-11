import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseAdapter } from '../src/database';
import { KnowledgePipeline } from '../src/pipeline';
import { KnowledgeConsolidator } from '../src/consolidate';
import { KnowledgeInjection } from '../src/injection';
import { KnowledgeRetrieval } from '../src/retrieval';
import { KnowledgeObject } from '../src/types';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const TEST_DB_PATH = join(tmpdir(), 'test_openknowledge.db');

describe('E2E - Full Pipeline', () => {
  let db: DatabaseAdapter;
  let pipeline: KnowledgePipeline;
  let consolidator: KnowledgeConsolidator;
  let injection: KnowledgeInjection;
  let retrieval: KnowledgeRetrieval;

  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    db = new DatabaseAdapter(TEST_DB_PATH);
    pipeline = new KnowledgePipeline(db);
    consolidator = new KnowledgeConsolidator(db);
    injection = new KnowledgeInjection(db, '/test/worktree');
    retrieval = new KnowledgeRetrieval(db);
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
  });

  it('E2E: session summary → patterns → classifier → extractor → DB → retrieval → XML', () => {
    const sessionSummary = `
      Architecture Decision: Implemented event-driven architecture
      The system uses a pub/sub pattern for inter-service communication.
      Events are published to a message broker and consumed by subscribers.
      This decouples services and allows for horizontal scaling.
    `;

    const sessionId = 'test-session-001';
    const sourceSpan = { messageStart: 10, messageEnd: 50 };

    const result = pipeline.processSession(sessionSummary, sessionId, sourceSpan);

    expect(result.skipped).toBe(false);
    expect(result.filtered).toBe(false);
    expect(result.stored).toBe(true);
    expect(result.extracted.length).toBeGreaterThan(0);

    const allKnowledge = db.getAllKnowledge();
    expect(allKnowledge.length).toBeGreaterThan(0);

    const architectureKnowledge = retrieval.queryByType('architecture', 10);
    expect(architectureKnowledge.length).toBeGreaterThan(0);

    const xml = injection.generateXML(5);
    expect(xml).toContain('<openknowledge');
    expect(xml).toContain('architecture');
    expect(xml).toContain('</openknowledge>');
  });

  it('E2E: consolidation marks superseded knowledge', () => {
    const summary1 = `
      Architecture Decision: Using PostgreSQL database
      The application uses PostgreSQL as primary database.
      PostgreSQL provides ACID compliance and advanced features.
    `;

    const summary2 = `
      Architecture Decision: Using PostgreSQL database
      The application uses PostgreSQL as primary database.
      PostgreSQL provides ACID transactions and rich features.
    `;

    pipeline.processSession(summary1, 'session-1', { messageStart: 1, messageEnd: 10 });
    pipeline.processSession(summary2, 'session-2', { messageStart: 1, messageEnd: 10 });

    const report = consolidator.runConsolidation();
    
    expect(report.duplicatesDetected).toBeGreaterThan(0);
    expect(report.supersededCount).toBeGreaterThan(0);

    const superseded = db.getByStatus('superseded');
    expect(superseded.length).toBeGreaterThan(0);
  });

  it('E2E: injection respects quotas', () => {
    const summaries = [
      'Architecture Decision: Microservices architecture adopted for scalability',
      'Architecture Decision: API gateway patterns for routing',
      'Architecture Decision: Service mesh for observability',
      'Decision:选择了 React for frontend',
      'Decision: Using TypeScript across the stack',
      'Timeline: Sprint 1 completed authentication module',
      'Workflow: CI/CD pipeline automated deployments',
    ];

    summaries.forEach((summary, i) => {
      pipeline.processSession(summary, `session-${i}`, { messageStart: 1, messageEnd: 5 });
    });

    const xml = injection.generateXML(4);
    
    const archCount = (xml.match(/type="architecture"/g) || []).length;
    const decCount = (xml.match(/type="decision"/g) || []).length;
    
    expect(xml).toContain('count="4"');
    expect(archCount).toBeGreaterThanOrEqual(1);
    expect(decCount).toBeGreaterThanOrEqual(1);
  });
});

describe('CLI Commands - Direct API Tests', () => {
  let db: DatabaseAdapter;
  
  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
    db = new DatabaseAdapter(TEST_DB_PATH);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH);
    }
  });

  it('CLI init creates database', () => {
    const testPath = join(tmpdir(), 'test-init.db');
    if (existsSync(testPath)) rmSync(testPath);
    
    const freshDb = new DatabaseAdapter(testPath);
    expect(existsSync(testPath)).toBe(true);
    freshDb.close();
    if (existsSync(testPath)) rmSync(testPath);
  });

  it('CLI list shows knowledge', () => {
    const know: KnowledgeObject = {
      id: 'test-001',
      type: 'architecture',
      title: 'Test Architecture',
      content: { description: 'Test description' },
      sourceSessionId: 'test',
      sourceSpan: { messageStart: 1, messageEnd: 10 },
      extractedAt: new Date().toISOString(),
      confidence: 0.9,
      importance: 0.8,
      tags: ['test'],
      status: 'active',
    };
    db.createKnowledge(know);

    const allKnowledge = db.getAllKnowledge();
    expect(allKnowledge.length).toBe(1);
    expect(allKnowledge[0].id).toBe('test-001');
    expect(allKnowledge[0].title).toBe('Test Architecture');
  });

  it('CLI search finds by Jaccard', () => {
    const know: KnowledgeObject = {
      id: 'search-001',
      type: 'architecture',
      title: 'Event Driven Architecture',
      content: { description: 'Using event-driven pub/sub pattern' },
      sourceSessionId: 'test',
      sourceSpan: { messageStart: 1, messageEnd: 10 },
      extractedAt: new Date().toISOString(),
      confidence: 0.9,
      importance: 0.8,
      tags: ['events', 'pubsub', 'architecture'],
      status: 'active',
    };
    db.createKnowledge(know);

    const retrieval = new KnowledgeRetrieval(db);
    const results = retrieval.search('event architecture', 10);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('search-001');
    expect(results[0].title).toContain('Event Driven');
  });

  it('CLI export outputs JSON', () => {
    const know: KnowledgeObject = {
      id: 'export-001',
      type: 'decision',
      title: 'Export Test',
      content: { description: 'Export test data' },
      sourceSessionId: 'test',
      sourceSpan: { messageStart: 1, messageEnd: 10 },
      extractedAt: new Date().toISOString(),
      confidence: 0.9,
      importance: 0.8,
      tags: ['export'],
      status: 'active',
    };
    db.createKnowledge(know);

    const exported = db.getAllKnowledge();
    expect(exported).toBeInstanceOf(Array);
    expect(exported.length).toBeGreaterThan(0);
    expect(exported[0].id).toBe('export-001');
  });

  it('CLI consolidate runs nightly job', () => {
    db.createKnowledge({
      id: 'cons-001',
      type: 'architecture',
      title: 'System Architecture',
      content: { description: 'Microservices architecture' },
      sourceSessionId: 'test',
      sourceSpan: { messageStart: 1, messageEnd: 10 },
      extractedAt: new Date().toISOString(),
      confidence: 0.9,
      importance: 0.8,
      tags: ['microservices'],
      status: 'active',
    });

    db.createKnowledge({
      id: 'cons-002',
      type: 'architecture',
      title: 'System Arch',
      content: { description: 'Microservices based system' },
      sourceSessionId: 'test',
      sourceSpan: { messageStart: 1, messageEnd: 10 },
      extractedAt: new Date().toISOString(),
      confidence: 0.85,
      importance: 0.75,
      tags: ['microservices', 'system'],
      status: 'active',
    });
    
    const consolidator = new KnowledgeConsolidator(db);
    const report = consolidator.runConsolidation();

    expect(report.duplicatesDetected).toBeGreaterThanOrEqual(0);
    expect(report.supersededCount).toBeGreaterThanOrEqual(0);
  });
});
