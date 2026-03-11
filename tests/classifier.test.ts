import { describe, it, expect } from 'vitest';
import { classifyKnowledge } from '../src/classifier';

describe('Knowledge classifier', () => {
  it('should classify decision content with high confidence', () => {
    const text = 'We decided to migrate from Jest to Vitest because of better performance and DX';
    const result = classifyKnowledge(text, 'decision');

    expect(result.classification).toBe('decision');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.content).toBeDefined();
  });

  it('should classify architecture content', () => {
    const text = 'The system uses a microservices architecture with event-driven patterns';
    const result = classifyKnowledge(text, 'architecture');

    expect(result.classification).toBe('architecture');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should classify timeline content', () => {
    const text = 'We shipped the v2.0 milestone release on March 1st';
    const result = classifyKnowledge(text, 'timeline');

    expect(result.classification).toBe('timeline');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should classify workflow content', () => {
    const text = 'Our CI/CD pipeline runs automated tests and deploys to staging on merge';
    const result = classifyKnowledge(text, 'workflow');

    expect(result.classification).toBe('workflow');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should return null for questions', () => {
    const text = 'Should we use Next.js or React?';
    const result = classifyKnowledge(text, null);

    expect(result.classification).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should return null for first-person recall', () => {
    const text = 'I remember we talked about this yesterday';
    const result = classifyKnowledge(text, null);

    expect(result.classification).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should return null for AI meta-talk', () => {
    const text = 'Let me explain how this works';
    const result = classifyKnowledge(text, null);

    expect(result.classification).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should increase confidence with keyword density', () => {
    const text1 = 'We decided on a framework';
    const text2 = 'We decided to migrate and switched the entire stack to a new framework';

    const result1 = classifyKnowledge(text1, 'decision');
    const result2 = classifyKnowledge(text2, 'decision');

    expect(result2.confidence).toBeGreaterThan(result1.confidence);
  });

  it('should extract clean content without meta-talk', () => {
    const text = 'I think we should decide to use Next.js';
    const result = classifyKnowledge(text, 'decision');

    expect(result.content).not.toContain('I think');
  });
});
