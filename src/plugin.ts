import type { Plugin } from '@opencode-ai/plugin';
import { DatabaseAdapter } from './database';
import { KnowledgeInjection } from './injection';
import { KnowledgePipeline } from './pipeline';
import { KnowledgeRetrieval } from './retrieval';
import { detectPatterns } from './patterns';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = join(homedir(), '.config', 'opencode', 'storage', 'project_knowledge.db');

export const OpenKnowledgePlugin: Plugin = async ({ client, directory, worktree }) => {
  const db = new DatabaseAdapter(DEFAULT_DB_PATH);
  const injector = new KnowledgeInjection(db, worktree || directory);
  const pipeline = new KnowledgePipeline(db);
  const retrieval = new KnowledgeRetrieval(db);

  return {
    'session.created': async ({ session }) => {
      const xml = injector.generateXML(10);
      if (xml.trim() !== '<openknowledge count="0" />') {
        await client.app.log({
          body: {
            service: 'openknowledge',
            level: 'info',
            message: 'Injecting knowledge context',
            xml,
          },
        });
      }
    },

    'session.idle': async ({ event }) => {
      // Extract session ID from event (true-mem pattern)
      const sessionId = event.properties?.info?.id ?? event.properties?.sessionID ?? event.properties?.id;
      
      if (!sessionId) {
        return;
      }

      // Fetch messages from session API
      const response = await client.session.messages({ path: { id: sessionId } });
      const messages = response.data ?? [];

      // Extract text from message parts
      const messageText = messages
        .flatMap(m => m.parts ?? [])
        .filter(part => part.type === 'text' && 'text' in part)
        .map(part => part.text)
        .join(' ');

      const patternResult = detectPatterns(messageText);

      if (!patternResult.type) {
        return;
      }

      const result = pipeline.processSession(messageText, sessionId, {
        messageStart: 0,
        messageEnd: messages.length,
      });

      if (result.stored) {
        await client.app.log({
          body: {
            service: 'openknowledge',
            level: 'info',
            message: `Extracted ${result.extracted.length} knowledge objects`,
            sessionId,
          },
        });
      }
    },

    tool: {
      'knowledge-list': {
        description: 'List project knowledge objects',
        args: {
          limit: (x: any) => x.number().optional().default(20),
          type: (x: any) => x.string().optional(),
        },
        async execute(args: { limit?: number; type?: string }) {
          let knowledge;
          if (args.type) {
            knowledge = db.getByType(args.type).slice(0, args.limit || 20);
          } else {
            knowledge = db.getAllKnowledge().slice(0, args.limit || 20);
          }

          if (knowledge.length === 0) {
            return 'No knowledge objects found.';
          }

          return knowledge.map(k =>
            `[${k.type}] ${k.title} (importance: ${k.importance}, id: ${k.id})`
          ).join('\n');
        },
      },

      'knowledge-search': {
        description: 'Search project knowledge by text',
        args: {
          query: (x: any) => x.string(),
          limit: (x: any) => x.number().optional().default(10),
        },
        async execute(args: { query: string; limit?: number }) {
          const results = retrieval.search(args.query, args.limit || 10);

          if (results.length === 0) {
            return `No results found for query: ${args.query}`;
          }

          return results.map(k =>
            `[${k.type}] ${k.title} (importance: ${k.importance}, id: ${k.id})`
          ).join('\n');
        },
      },
    },
  };
};
