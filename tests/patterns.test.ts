import { describe, it, expect } from 'vitest';
import { detectPatterns } from '../src/patterns';

describe('Pattern detection', () => {
  it('should detect decision patterns', () => {
    const text = 'We decided to switch to Next.js for the frontend';
    const result = detectPatterns(text);

    expect(result.type).toBe('decision');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.matchedPatterns).toContain('decided');
  });

  it('should detect architecture patterns', () => {
    const text = 'The architecture uses a microservices pattern with REST APIs';
    const result = detectPatterns(text);

    expect(result.type).toBe('architecture');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.matchedPatterns).toContain('architecture');
    expect(result.matchedPatterns).toContain('pattern');
  });

  it('should detect timeline patterns', () => {
    const text = 'We shipped the milestone release last week';
    const result = detectPatterns(text);

    expect(result.type).toBe('timeline');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.matchedPatterns).toContain('shipped');
    expect(result.matchedPatterns).toContain('milestone');
  });

  it('should detect workflow patterns', () => {
    const text = 'The CI/CD pipeline runs tests on every commit';
    const result = detectPatterns(text);

    expect(result.type).toBe('workflow');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.matchedPatterns).toContain('pipeline');
    expect(result.matchedPatterns).toContain('ci');
  });

  it('should return null when no patterns match', () => {
    const text = 'This is just a random conversation';
    const result = detectPatterns(text);

    expect(result.type).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.matchedPatterns).toHaveLength(0);
  });

  it('should increase confidence with more matches', () => {
    const text1 = 'We decided';
    const text2 = 'We decided to switch and migrated the entire stack';

    const result1 = detectPatterns(text1);
    const result2 = detectPatterns(text2);

    expect(result2.confidence).toBeGreaterThan(result1.confidence);
  });

  it('should detect multiple pattern types', () => {
    const text = 'We decided on a microservices architecture';
    const result = detectPatterns(text);

    expect(result.type).toBeDefined();
    expect(result.matchedPatterns.length).toBeGreaterThan(0);
  });
});
