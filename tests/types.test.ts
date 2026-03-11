import { describe, it, expect } from 'vitest';
import { KnowledgeObject, KnowledgeType, KnowledgeStatus } from '../src/types';

describe('KnowledgeObject types', () => {
  it('should create a valid KnowledgeObject with all required fields', () => {
    const testObject: KnowledgeObject = {
      id: 'test-123',
      type: 'architecture' as KnowledgeType,
      title: 'Test Knowledge Object',
      content: { key: 'value' },
      sourceSessionId: 'session-456',
      sourceSpan: { messageStart: 10, messageEnd: 20 },
      extractedAt: new Date().toISOString(),
      confidence: 0.95,
      importance: 0.8,
      tags: ['test', 'knowledge'],
      status: 'active' as KnowledgeStatus,
    };

    expect(testObject.id).toBe('test-123');
    expect(testObject.type).toBe('architecture');
    expect(testObject.title).toBe('Test Knowledge Object');
    expect(testObject.content).toEqual({ key: 'value' });
    expect(testObject.sourceSessionId).toBe('session-456');
    expect(testObject.sourceSpan.messageStart).toBe(10);
    expect(testObject.sourceSpan.messageEnd).toBe(20);
    expect(typeof testObject.extractedAt).toBe('string');
    expect(testObject.confidence).toBe(0.95);
    expect(testObject.importance).toBe(0.8);
    expect(testObject.tags).toEqual(['test', 'knowledge']);
    expect(testObject.status).toBe('active');
  });

  it('should support all KnowledgeType values', () => {
    const types: KnowledgeType[] = ['architecture', 'decision', 'timeline', 'workflow'];
    expect(types.length).toBe(4);
  });

  it('should support all KnowledgeStatus values', () => {
    const statuses: KnowledgeStatus[] = ['active', 'superseded'];
    expect(statuses.length).toBe(2);
  });
});
