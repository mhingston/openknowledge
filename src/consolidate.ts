import { DatabaseAdapter } from './database';
import { KnowledgeObject, KnowledgeStatus } from './types';

interface DuplicatePair {
  pair: [string, string];
  similarity: number;
  ids: [string, string];
}

interface ConsolidationReport {
  summary: string;
  duplicatesDetected: number;
  supersededCount: number;
  mergedCount: number;
  importanceUpdated: number;
  fragmentedCleaned: number;
}

interface SupersedeResult {
  superseded: number;
}

interface MergeResult {
  merged: number;
}

interface ImportanceResult {
  updated: number;
}

interface CleanupResult {
  cleaned: number;
}

interface AccessFrequency {
  knowledgeId: string;
  accessCount: number;
}

interface KnowledgePair {
  k1: KnowledgeObject;
  k2: KnowledgeObject;
}

export class KnowledgeConsolidator {
  private db: DatabaseAdapter;
  private readonly SIMILARITY_THRESHOLD = 0.85;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  detectDuplicates(): DuplicatePair[] {
    const allKnowledge = this.db.getAllKnowledge();
    
    if (allKnowledge.length === 0) {
      return [];
    }

    const duplicates: DuplicatePair[] = [];
    const processed = new Set<string>();
    const pairs = this.getComparablePairs(allKnowledge);

    for (const { k1, k2 } of pairs) {
      const similarity = this.computeJaccardSimilarity(k1, k2);

      if (similarity > this.SIMILARITY_THRESHOLD) {
        const older = this.isOlder(k1, k2) ? k1 : k2;
        const newer = older.id === k1.id ? k2 : k1;
        
        const pairKey = `${newer.id}-${older.id}`;
        if (!processed.has(pairKey)) {
          duplicates.push({
            pair: [newer.id, older.id],
            similarity,
            ids: [newer.id, older.id],
          });
          processed.add(pairKey);
        }
      }
    }

    return duplicates;
  }

  supersedeOutdated(): SupersedeResult {
    const duplicates = this.detectDuplicates();
    let supersededCount = 0;

    for (const duplicate of duplicates) {
      const olderId = duplicate.pair[1];
      const olderKnowledge = this.db.getKnowledge(olderId);

      if (olderKnowledge && olderKnowledge.status === 'active') {
        this.db.updateKnowledge(olderId, { status: 'superseded' });
        supersededCount++;
      }
    }

    return { superseded: supersededCount };
  }

  mergeComplementary(): MergeResult {
    const allKnowledge = this.db.getAllKnowledge();
    
    if (allKnowledge.length === 0) {
      return { merged: 0 };
    }

    let mergedCount = 0;
    const pairs = this.getComparablePairs(allKnowledge);

    for (const { k1, k2 } of pairs) {
      const similarity = this.computeJaccardSimilarity(k1, k2);
      
      if (similarity < this.SIMILARITY_THRESHOLD && similarity > 0.3) {
        this.linkRelatedKnowledge(k1.id, k2.id);
        this.linkRelatedKnowledge(k2.id, k1.id);
        mergedCount++;
      }
    }

    return { merged: mergedCount };
  }

  private linkRelatedKnowledge(kId: string, relatedId: string): void {
    const knowledge = this.db.getKnowledge(kId);
    if (!knowledge) return;

    const relatedKey = 'relatedKnowledge';
    const existingRelated = knowledge.content[relatedKey] || [];

    if (!existingRelated.includes(relatedId)) {
      this.db.updateKnowledge(kId, {
        content: {
          ...knowledge.content,
          [relatedKey]: [...existingRelated, relatedId],
        },
      });
    }
  }

  private getComparablePairs(allKnowledge: KnowledgeObject[]): KnowledgePair[] {
    const pairs: KnowledgePair[] = [];
    
    for (let i = 0; i < allKnowledge.length; i++) {
      for (let j = i + 1; j < allKnowledge.length; j++) {
        const k1 = allKnowledge[i];
        const k2 = allKnowledge[j];

        if (k1.type !== k2.type) continue;
        if (k1.status === 'superseded' || k2.status === 'superseded') continue;

        pairs.push({ k1, k2 });
      }
    }

    return pairs;
  }

  updateImportanceScores(accessData: AccessFrequency[]): ImportanceResult {
    if (accessData.length === 0) {
      return { updated: 0 };
    }

    let updatedCount = 0;

    for (const access of accessData) {
      const knowledge = this.db.getKnowledge(access.knowledgeId);
      
      if (!knowledge) {
        continue;
      }

      const boost = Math.min(access.accessCount * 0.05, 0.5);
      const newImportance = Math.min(knowledge.importance + boost, 1.0);

      this.db.updateKnowledge(access.knowledgeId, { importance: newImportance });
      updatedCount++;
    }

    return { updated: updatedCount };
  }

  cleanupFragmented(): CleanupResult {
    const allKnowledge = this.db.getAllKnowledge();
    
    if (allKnowledge.length === 0) {
      return { cleaned: 0 };
    }

    let cleanedCount = 0;

    for (const knowledge of allKnowledge) {
      if (this.isFragmented(knowledge)) {
        this.db.deleteKnowledge(knowledge.id);
        cleanedCount++;
      }
    }

    return { cleaned: cleanedCount };
  }

  runConsolidation(): ConsolidationReport {
    const duplicates = this.detectDuplicates();
    const supersedeResult = this.supersedeOutdated();
    const mergeResult = this.mergeComplementary();
    const importanceResult = this.updateImportanceScores([]);
    const cleanupResult = this.cleanupFragmented();

    return {
      summary: `Consolidation complete: ${duplicates.length} duplicates found, ${supersedeResult.superseded} superseded, ${mergeResult.merged} merged, ${importanceResult.updated} importance updated, ${cleanupResult.cleaned} cleaned`,
      duplicatesDetected: duplicates.length,
      supersededCount: supersedeResult.superseded,
      mergedCount: mergeResult.merged,
      importanceUpdated: importanceResult.updated,
      fragmentedCleaned: cleanupResult.cleaned,
    };
  }

  private computeJaccardSimilarity(k1: KnowledgeObject, k2: KnowledgeObject): number {
    const set1 = this.extractTokens(k1);
    const set2 = this.extractTokens(k2);

    const intersection = this.intersection(set1, set2);
    const union = this.union(set1, set2);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  private extractTokens(knowledge: KnowledgeObject): Set<string> {
    const tokens = new Set<string>();

    const textSources: string[] = [];
    
    if (knowledge.content?.description) {
      textSources.push(knowledge.content.description);
    }
    
    textSources.push(...knowledge.tags);

    for (const text of textSources) {
      const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 1);
      words.forEach(w => tokens.add(w));
    }

    return tokens;
  }

  private intersection(set1: Set<string>, set2: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const item of set1) {
      if (set2.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  private union(set1: Set<string>, set2: Set<string>): Set<string> {
    const result = new Set(set1);
    for (const item of set2) {
      result.add(item);
    }
    return result;
  }

  private isOlder(k1: KnowledgeObject, k2: KnowledgeObject): boolean {
    return new Date(k1.extractedAt) < new Date(k2.extractedAt);
  }

  private isFragmented(knowledge: KnowledgeObject): boolean {
    const hasDescription = knowledge.content?.description && knowledge.content.description.length > 20;
    const hasConfidence = knowledge.confidence >= 0.5;
    const hasTags = knowledge.tags && knowledge.tags.length > 0;

    return !hasDescription || !hasConfidence || !hasTags;
  }
}
