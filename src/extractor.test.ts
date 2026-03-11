import { describe, it, expect } from 'vitest';
import { KnowledgeObject } from './types.js';
import { extractKnowledge } from './extractor.js';

describe('extractKnowledge', () => {
  it('extracts architecture knowledge from summary', () => {
    const summary = `
      The system uses a microservices architecture with Node.js and Express framework.
      Three services: auth, api, and worker.
      Each service runs in Docker containers.
    `;

    const results = extractKnowledge(summary, 'session-123', { messageStart: 0, messageEnd: 5 });

    expect(results.length).toBeGreaterThan(0);
    const archKnowledge = results.find(k => k.type === 'architecture');
    expect(archKnowledge).toBeDefined();
    expect(archKnowledge?.title).toContain('microservices');
    expect(archKnowledge?.confidence).toBeGreaterThan(0.5);
    expect(archKnowledge?.importance).toBeGreaterThan(0);
  });

  it('extracts decision knowledge with reasoning', () => {
    const summary = `
      Team decided to switch from PostgreSQL to MySQL due to better community support.
      The decision was made after evaluating performance benchmarks.
      Migration scheduled for next sprint.
    `;

    const results = extractKnowledge(summary, 'session-124', { messageStart: 0, messageEnd: 3 });

    const decisionKnowledge = results.find(k => k.type === 'decision');
    expect(decisionKnowledge).toBeDefined();
    expect(decisionKnowledge?.content.reasoning).toBeDefined();
    expect(decisionKnowledge?.confidence).toBeGreaterThan(0.5);
  });

  it('handles ambiguous text with low confidence', () => {
    const summary = 'Maybe we should consider some kind of framework at some point.';

    const results = extractKnowledge(summary, 'session-125', { messageStart: 0, messageEnd: 1 });

    expect(results.length).toBe(0);
  });

  it('handles empty input', () => {
    const results = extractKnowledge('', 'session-126', { messageStart: 0, messageEnd: 0 });
    expect(results).toEqual([]);
  });

  it('handles invalid input', () => {
    const results = extractKnowledge(undefined as any, 'session-127', { messageStart: 0, messageEnd: 0 });
    expect(results).toEqual([]);
  });

  it('scores importance based on impact keywords', () => {
    const summary = `
      Critical production deployment requires high-availability architecture.
      This impacts all customer-facing services and requires 99.9% uptime SLA.
      Infrastructure cost will increase significantly.
    `;

    const results = extractKnowledge(summary, 'session-128', { messageStart: 0, messageEnd: 3 });

    expect(results.length).toBeGreaterThan(0);
    const highestImportance = Math.max(...results.map(r => r.importance));
    expect(highestImportance).toBeGreaterThan(0.6);
  });
});
