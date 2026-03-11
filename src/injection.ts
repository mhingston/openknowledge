import { KnowledgeObject } from './types';

export interface IDatabaseAdapter {
  getAllKnowledge(): KnowledgeObject[];
  createKnowledge(k: KnowledgeObject): void;
  getByType(type: string): KnowledgeObject[];
  getByStatus(status: string): KnowledgeObject[];
  getByImportance(minImportance: number): KnowledgeObject[];
  getKnowledge(id: string): KnowledgeObject | undefined;
}

export class KnowledgeInjection {
  private db: IDatabaseAdapter;
  private worktreePath: string;

  constructor(db: IDatabaseAdapter, worktreePath?: string) {
    this.db = db;
    this.worktreePath = worktreePath || '';
  }

  generateXML(maxMemories: number, sessionId?: string): string {
    const allKnowledge = this.db.getAllKnowledge();
    
    if (allKnowledge.length === 0) {
      return `<openknowledge worktree="${this.escapeXML(this.worktreePath)}" count="0" />\n`;
    }

    const knowledge = this.selectWithQuota(allKnowledge, maxMemories, sessionId);
    const count = knowledge.length;

    let xml = `<openknowledge worktree="${this.escapeXML(this.worktreePath)}" count="${count}">\n`;
    
    for (const k of knowledge) {
      xml += `  <knowledge id="${this.escapeXML(k.id)}" type="${this.escapeXML(k.type)}" importance="${k.importance}">\n`;
      xml += `    <title>${this.escapeXML(k.title)}</title>\n`;
      xml += `    <content>${this.escapeXML(JSON.stringify(k.content))}</content>\n`;
      xml += `    <tags>${k.tags.map(t => this.escapeXML(t)).join(', ')}</tags>\n`;
      xml += `  </knowledge>\n`;
    }
    
    xml += '</openknowledge>\n';
    
    return xml;
  }

  private selectWithQuota(
    allKnowledge: KnowledgeObject[],
    maxMemories: number,
    sessionId?: string
  ): KnowledgeObject[] {
    const minQuota = 0.3;
    const architecture = allKnowledge.filter(k => k.type === 'architecture');
    const decisions = allKnowledge.filter(k => k.type === 'decision');
    const other = allKnowledge.filter(k => k.type !== 'architecture' && k.type !== 'decision');

    const minArchCount = Math.max(1, Math.floor(maxMemories * minQuota));
    const minDecCount = Math.max(1, Math.floor(maxMemories * minQuota));

    architecture.sort((a, b) => b.importance - a.importance);
    decisions.sort((a, b) => b.importance - a.importance);
    other.sort((a, b) => b.importance - a.importance);

    const selected: KnowledgeObject[] = [];

    for (let i = 0; i < minArchCount && i < architecture.length; i++) {
      selected.push(architecture[i]);
    }

    for (let i = 0; i < minDecCount && i < decisions.length; i++) {
      selected.push(decisions[i]);
    }

    const remaining = maxMemories - selected.length;
    
    const remainingPool = [...other, ...architecture.slice(selected.filter(k => k.type === 'architecture').length), ...decisions.slice(selected.filter(k => k.type === 'decision').length)];
    remainingPool.sort((a, b) => b.importance - a.importance);
    
    for (let i = 0; i < remaining && i < remainingPool.length; i++) {
      selected.push(remainingPool[i]);
    }

    return selected.slice(0, maxMemories);
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
