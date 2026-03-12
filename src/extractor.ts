import { KnowledgeObject, KnowledgeType } from './types.js';
import { classifyKnowledge } from './classifier.js';

const IMPACT_KEYWORDS = [
  'critical', 'production', 'high-availability', '99.9%', 'sla',
  'all customers', 'infrastructure', 'cost', 'significant', 'impacts',
];

const PATTERN_NAMES: Record<KnowledgeType, RegExp> = {
  architecture: /architecture|framework|stack|pattern|design|structure|microservices/,
  decision: /decided|chose|switched|migrated|adopted|selected/,
  timeline: /milestone|release|deadline|shipped|launched|delivered|scheduled/,
  workflow: /workflow|process|pipeline|ci\/|automation|script/,
};

function calculateImportance(text: string): number {
  const lowerText = text.toLowerCase();
  const matches = IMPACT_KEYWORDS.filter((k) => lowerText.includes(k)).length;
  if (matches === 0) return 0.3;
  return Math.min(1.0, 0.4 + matches * 0.15);
}

function extractStructuredContent(text: string, type: KnowledgeType): Record<string, any> {
  const trimmed = text.trim();
  switch (type) {
    case 'decision': {
      const reasoningMatch = text.match(/(due to|because|after evaluating|since)\s+([^.\n]+)/i);
      const reasoning = reasoningMatch ? reasoningMatch[2].trim() : 'Not specified';
      return { description: trimmed, reasoning };
    }
    default:
      return { description: trimmed };
  }
}

function generateId(type: KnowledgeType, title: string, sessionId: string): string {
  const hash = title.slice(0, 8) + sessionId.slice(-4);
  return `${type}-${hash}`;
}

export function extractKnowledge(
  summary: string,
  sessionId: string,
  sourceSpan: { messageStart: number; messageEnd: number }
): KnowledgeObject[] {
  if (!summary || !summary.trim()) {
    return [];
  }

  const results: KnowledgeObject[] = [];
  
  const protectedSummary = summary.replace(/Node\.js/gi, '[NODEJS]');
  const rawSentences = protectedSummary.split(/[.!\n]+/);
  const sentences = rawSentences
    .map((s) => s.replace(/\[NODEJS\]/gi, 'Node.js'))
    .filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    const types = determinePatternTypes(sentence);
    
    for (const patternType of types) {
      const classification = classifyKnowledge(sentence, patternType);
      
      if (classification.classification && classification.confidence > 0.5) {
        const title = extractTitle(sentence, classification.classification);
        const content = extractStructuredContent(sentence, classification.classification);
        const importance = calculateImportance(sentence);

        const now = new Date().toISOString();
        const knowledgeObject: KnowledgeObject = {
          id: generateId(classification.classification, title, sessionId),
          type: classification.classification,
          title,
          content,
          sourceSessionId: sessionId,
          sourceSpan,
          extractedAt: now,
          confidence: classification.confidence,
          importance,
          tags: extractTags(sentence),
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        results.push(knowledgeObject);
        break;
      }
    }
  }

  return results;
}

function determinePatternTypes(sentence: string): KnowledgeType[] {
  const lower = sentence.toLowerCase();
  const types: KnowledgeType[] = [];
  
  if (PATTERN_NAMES.decision.test(lower)) types.push('decision');
  if (PATTERN_NAMES.architecture.test(lower)) types.push('architecture');
  if (PATTERN_NAMES.timeline.test(lower)) types.push('timeline');
  if (PATTERN_NAMES.workflow.test(lower)) types.push('workflow');
  
  return types;
}

function extractTitle(sentence: string, type: KnowledgeType): string {
  const lower = sentence.toLowerCase();
  const words = sentence.trim().split(/\s+/);

  if (type === 'architecture') {
    const microIdx = lower.indexOf('microservices');
    if (microIdx !== -1) {
      const startWord = Math.floor(microIdx / 5);
      const titleWords = words.slice(startWord, startWord + 8).join(' ');
      return titleWords.length > 60 ? titleWords.substring(0, 60) + '...' : titleWords;
    }
  }

  const titleWords = words.slice(0, 8).join(' ');
  return titleWords.length > 60 ? titleWords.substring(0, 60) + '...' : titleWords;
}

function extractTags(sentence: string): string[] {
  const tags: string[] = [];
  const lower = sentence.toLowerCase();

  if (/\b(node\.js|node)\b/.test(lower)) tags.push('nodejs');
  if (/\b(express)\b/.test(lower)) tags.push('express');
  if (/\b(docker)\b/.test(lower)) tags.push('docker');
  if (/\b(postgresql|postgres)\b/.test(lower)) tags.push('postgresql');
  if (/\b(mysql)\b/.test(lower)) tags.push('mysql');
  if (/\b(microservices)\b/.test(lower)) tags.push('microservices');

  return tags;
}
