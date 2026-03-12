import { KnowledgeType } from './types.js';

interface ClassificationResult {
  classification: KnowledgeType | null;
  confidence: number;
  content: string;
}

const CLASSIFICATION_KEYWORDS: Record<KnowledgeType, string[]> = {
  decision: ['decided', 'chose', 'switched', 'migrated', 'adopted', 'selected'],
  architecture: ['architecture', 'framework', 'stack', 'pattern', 'design', 'structure'],
  timeline: ['milestone', 'release', 'deadline', 'shipped', 'launched', 'delivered'],
  workflow: ['workflow', 'process', 'pipeline', 'ci/cd', 'automation', 'script'],
};

const NEGATIVE_PATTERNS = [
  /^\s*(can|could|should|would|may|might)\s/i, // Questions
  /\bI\s+(remember|recall|think|believe)\b/i, // First-person recall
  /\b(let me|I'll|I will|I can|let us)\b/i, // AI meta-talk
  /\b(remind me|remember this)\b/i, // Reminder requests
  /\b(maybe|possibly|perhaps|sometime)\b/i, // Ambiguous language
];

function isQuestion(text: string): boolean {
  return text.trim().endsWith('?') || NEGATIVE_PATTERNS[0].test(text);
}

function matchesNegativePattern(text: string): boolean {
  return NEGATIVE_PATTERNS.some(pattern => pattern.test(text));
}

function extractCleanContent(text: string): string {
  // Remove first-person phrases
  let cleaned = text.replace(/\bI\s+(think|believe|remember|recall)\b[^,]*[,]?/i, '');
  cleaned = cleaned.replace(/\b(let me|I'll|I will|I can)\b[^,]*[,]?/i, '');
  cleaned = cleaned.trim();
  return cleaned;
}

function calculateKeywordScore(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 0);
  
  let sentenceScores = [];
  
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const matches = keywords.filter(k => 
      sentenceLower.includes(k) || 
      sentenceLower.includes(k.replace(/ed$/, '')) ||  // Match stem forms
      sentenceLower.includes(k.replace(/ed$/, 'e'))     // Match stem forms
    ).length;
    if (matches > 0) {
      const baseScore = 0.4 + (matches * 0.2);
      const boosterScore = keywords.length > 0 ? (matches / keywords.length) * 0.3 : 0;
      sentenceScores.push(Math.min(1, baseScore + boosterScore));
    }
  }
  
  if (sentenceScores.length === 0) return 0;
  return Math.max(...sentenceScores);
}

export function classifyKnowledge(text: string, patternType: KnowledgeType | null): ClassificationResult {
  // Layer 1: Filter questions
  if (isQuestion(text)) {
    return { classification: null, confidence: 0, content: '' };
  }

  // Layer 2: Filter negative patterns
  if (matchesNegativePattern(text)) {
    return { classification: null, confidence: 0, content: '' };
  }

  // Layer 3: Pattern-based classification
  if (!patternType) {
    return { classification: null, confidence: 0, content: '' };
  }

  const keywords = CLASSIFICATION_KEYWORDS[patternType];
  const keywordScore = calculateKeywordScore(text, keywords);

  // Layer 4: Confidence threshold (0.6 minimum)
  if (keywordScore < 0.6) {
    return { classification: null, confidence: 0, content: '' };
  }

  const cleanContent = extractCleanContent(text);

  return {
    classification: patternType,
    confidence: keywordScore,
    content: cleanContent,
  };
}
