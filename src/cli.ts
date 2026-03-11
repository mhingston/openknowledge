#!/usr/bin/env node

import { Command } from 'commander';
import { DatabaseAdapter } from './database.js';
import { KnowledgeConsolidator } from './consolidate.js';
import { KnowledgeInjection } from './injection.js';
import { KnowledgeRetrieval } from './retrieval.js';
import { homedir } from 'os';
import { join } from 'path';

const program = new Command();

const getDefaultDbPath = () => {
  return join(homedir(), '.config', 'opencode', 'storage', 'project_knowledge.db');
};

const getDb = (dbPath?: string): DatabaseAdapter => {
  const path = dbPath || getDefaultDbPath();
  return new DatabaseAdapter(path);
};

program
  .name('openknowledge')
  .description('CLI for managing openknowledge')
  .version('0.0.1');

program
  .command('init')
  .description('Initialize the knowledge database')
  .option('--db <path>', 'Database path')
  .action((options) => {
    const dbPath = options.db || getDefaultDbPath();
    const db = getDb(dbPath);
    console.log(`Database initialized at: ${dbPath}`);
    db.close();
  });

program
  .command('list')
  .description('List all knowledge objects')
  .option('--db <path>', 'Database path')
  .option('--type <type>', 'Filter by type')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const db = getDb(options.db);
    let knowledge;
    
    if (options.type) {
      knowledge = db.getByType(options.type);
    } else {
      knowledge = db.getAllKnowledge();
    }
    
    if (options.json) {
      console.log(JSON.stringify(knowledge, null, 2));
    } else {
      console.log(`Found ${knowledge.length} knowledge objects:`);
      knowledge.forEach(k => {
        console.log(`  - [${k.id}] ${k.title} (${k.type}, importance: ${k.importance})`);
      });
    }
    db.close();
  });

program
  .command('search')
  .description('Search knowledge by text')
  .argument('<query>', 'Search query')
  .option('--db <path>', 'Database path')
  .option('--limit <n>', 'Limit results', parseInt)
  .option('--json', 'Output as JSON')
  .action((query, options) => {
    const db = getDb(options.db);
    const retrieval = new KnowledgeRetrieval(db);
    const limit = options.limit || 10;
    const results = retrieval.search(query, limit);
    
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(`Found ${results.length} results for "${query}":`);
      results.forEach(k => {
        console.log(`  - [${k.id}] ${k.title} (${k.type}, similarity: ${k.importance})`);
      });
    }
    db.close();
  });

program
  .command('export')
  .description('Export all knowledge as JSON')
  .option('--db <path>', 'Database path')
  .option('--type <type>', 'Filter by type')
  .action((options) => {
    const db = getDb(options.db);
    let knowledge;
    
    if (options.type) {
      knowledge = db.getByType(options.type);
    } else {
      knowledge = db.getAllKnowledge();
    }
    
    console.log(JSON.stringify(knowledge, null, 2));
    db.close();
  });

program
  .command('consolidate')
  .description('Run consolidation to merge duplicates and update scores')
  .option('--db <path>', 'Database path')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const db = getDb(options.db);
    const consolidator = new KnowledgeConsolidator(db);
    const report = consolidator.runConsolidation();
    
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('Consolidation Report:');
      console.log(`  Duplicates detected: ${report.duplicatesDetected}`);
      console.log(`  Superseded: ${report.supersededCount}`);
      console.log(`  Merged: ${report.mergedCount}`);
      console.log(`  Importance updated: ${report.importanceUpdated}`);
      console.log(`  Fragmented cleaned: ${report.fragmentedCleaned}`);
      console.log(report.summary);
    }
    db.close();
  });

program
  .command('inject')
  .description('Generate XML for context injection')
  .option('--db <path>', 'Database path')
  .option('--max <n>', 'Maximum memories', parseInt)
  .option('--worktree <path>', 'Worktree path')
  .action((options) => {
    const db = getDb(options.db);
    const injection = new KnowledgeInjection(db, options.worktree || '');
    const max = options.max || 5;
    const xml = injection.generateXML(max);
    console.log(xml);
    db.close();
  });

program.parse();
