export type KnowledgeType = 'architecture' | 'decision' | 'timeline' | 'workflow';

export type KnowledgeStatus = 'active' | 'superseded';

export interface KnowledgeObject {
  id: string;
  type: KnowledgeType;
  title: string;
  content: Record<string, any>;
  sourceSessionId: string;
  sourceSpan: { messageStart: number; messageEnd: number };
  extractedAt: string;
  confidence: number;
  importance: number;
  tags: string[];
  status: KnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}
