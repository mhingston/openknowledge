import { KnowledgeObject, KnowledgeType } from './types';

interface DatabaseAdapter {
  getAllKnowledge(): KnowledgeObject[];
  getByType(type: string): KnowledgeObject[];
  getByImportance(minImportance: number): KnowledgeObject[];
  getKnowledge(id: string): KnowledgeObject | undefined;
  getByStatus(status: string): KnowledgeObject[];
}

export class KnowledgeRetrieval {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  queryByType(type: KnowledgeType, limit: number): KnowledgeObject[] {
    const results = this.db.getByType(type);
    return results.slice(0, limit);
  }

  queryByImportance(minScore: number, limit: number): KnowledgeObject[] {
    const results = this.db.getByImportance(minScore);
    return results.slice(0, limit);
  }

  queryByRecency(days: number, limit: number): KnowledgeObject[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const allKnowledge = this.db.getAllKnowledge();
    const recent = allKnowledge.filter(k => new Date(k.extractedAt) >= cutoff);
    return recent.slice(0, limit);
  }

  search(queryText: string, limit: number): KnowledgeObject[] {
    const allKnowledge = this.db.getAllKnowledge();
    const queryTokens = this.extractTokens(queryText);

    const scored = allKnowledge
      .map(k => ({
        knowledge: k,
        similarity: this.computeJaccardSimilarity(queryTokens, k),
      }))
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit).map(item => item.knowledge);
  }

  getActiveKnowledge(): KnowledgeObject[] {
    return this.db.getByStatus('active');
  }

  getById(id: string): KnowledgeObject | null {
    const result = this.db.getKnowledge(id);
    return result ?? null;
  }

  private computeJaccardSimilarity(queryTokens: Set<string>, k: KnowledgeObject): number {
    const docTokens = this.extractTokensFromKnowledge(k);

    const intersection = this.intersection(queryTokens, docTokens);
    const union = this.union(queryTokens, docTokens);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  private extractTokens(text: string): Set<string> {
    const tokens = new Set<string>();
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 1);
    words.forEach(w => tokens.add(w));
    return tokens;
  }

  private extractTokensFromKnowledge(knowledge: KnowledgeObject): Set<string> {
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
}
