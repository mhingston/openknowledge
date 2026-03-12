import { KnowledgeObject } from './types.js';
import { DatabaseAdapter } from './database.js';
import { detectPatterns } from './patterns.js';
import { classifyKnowledge } from './classifier.js';
import { extractKnowledge } from './extractor.js';

interface PipelineResult {
  extracted: KnowledgeObject[];
  stored: boolean;
  skipped: boolean;
  filtered: boolean;
}

export class KnowledgePipeline {
  constructor(private db: DatabaseAdapter) {}

  processSession(
    summary: string,
    sessionId: string,
    sourceSpan: { messageStart: number; messageEnd: number }
  ): PipelineResult {
    const result: PipelineResult = {
      extracted: [],
      stored: false,
      skipped: false,
      filtered: false,
    };

    // Step 1: Pattern detection (cheap, fast filter)
    const patternResult = detectPatterns(summary);
    
    if (!patternResult.type) {
      result.skipped = true;
      return result;
    }

    // Step 2: Knowledge classifier (4-layer defense)
    const classification = classifyKnowledge(summary, patternResult.type);
    
    if (!classification.classification) {
      result.filtered = true;
      return result;
    }

    // Step 3: LLM extractor (structured output)
    const extractedObjects = extractKnowledge(summary, sessionId, sourceSpan);
    
    if (extractedObjects.length === 0) {
      result.skipped = true;
      return result;
    }

    result.extracted = extractedObjects;

    // Step 4: Database storage
    for (const knowledge of extractedObjects) {
      this.db.createKnowledge(knowledge);
    }
    
    result.stored = true;

    return result;
  }
}
