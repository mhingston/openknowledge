import { KnowledgeType } from './types';

interface PatternResult {
  type: KnowledgeType | null;
  confidence: number;
  matchedPatterns: string[];
}

const PATTERNS: Record<KnowledgeType, string[]> = {
  decision: ['decided', 'chose', 'switched', 'migrated', 'we should use'],
  architecture: ['architecture', 'framework', 'stack', 'pattern'],
  timeline: ['milestone', 'release', 'deadline', 'shipped'],
  workflow: ['workflow', 'process', 'pipeline', 'ci', 'cd'],
};

function calculateConfidence(matches: number, totalPatterns: number): number {
  if (matches === 0) return 0;
  return Math.min(1, 0.3 + (matches / totalPatterns) * 0.7);
}

export function detectPatterns(text: string): PatternResult {
  const lowerText = text.toLowerCase();
  let bestType: KnowledgeType | null = null;
  let bestConfidence = 0;
  let bestMatches: string[] = [];

  for (const [type, patterns] of Object.entries(PATTERNS)) {
    const matched = patterns.filter(pattern => 
      pattern.split(/\s+/).length > 1 
        ? lowerText.includes(pattern)
        : new RegExp(`\\b${pattern}\\b`, 'i').test(lowerText)
    );

    if (matched.length > 0) {
      const confidence = calculateConfidence(matched.length, patterns.length);
      if (confidence > bestConfidence || (confidence === bestConfidence && matched.length > bestMatches.length)) {
        bestType = type as KnowledgeType;
        bestConfidence = confidence;
        bestMatches = matched;
      }
    }
  }

  return {
    type: bestType,
    confidence: bestConfidence,
    matchedPatterns: bestMatches,
  };
}
