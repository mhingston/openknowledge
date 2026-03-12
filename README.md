# openknowledge

A project knowledge memory system for OpenCode that automatically extracts, stores, and retrieves structured knowledge from your chat history.

**What it does:** While you code with OpenCode, openknowledge captures architecture decisions, tech stack choices, workflow patterns, and project milestones—turning conversations into searchable, persistent project documentation.

## Quick Start

### Install from npm

```bash
npm install @mhingston5/openknowledge
```

### Configure OpenCode

Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@mhingston5/openknowledge"]
}
```

### Restart OpenCode

```bash
opencode
```

**Done!** The plugin auto-loads and starts extracting knowledge from sessions.

---

## Features

### 1. Automatic Knowledge Extraction

Monitors `session.idle` events and extracts structured knowledge from conversation summaries:

- **Pattern Detection**: Fast keyword filtering triggers extraction
- **4-Layer Defense**: Questions, negative patterns, keyword scoring, confidence threshold (0.6)
- **LLM Extraction**: Structured output with confidence scores

### 2. Four Knowledge Types

| Type | Description | Examples |
|------|-------------|----------|
| **architecture** | Tech stack, infrastructure, patterns | "Using Next.js 14 with App Router" |
| **decision** | Key decisions with reasoning | "Migrated to Vitest for faster CI" |
| **timeline** | Milestones, sprint progress | "Sprint 3: Auth implementation" |
| **workflow** | Established processes, CI/CD | "PR requires 2 reviews" |

### 3. SQLite Knowledge Store

Persistent database at `~/.config/opencode/storage/project_knowledge.db`:

```typescript
interface KnowledgeObject {
  id: string;              // UUID
  type: KnowledgeType;     // 4 types
  title: string;           // Short description
  content: Record<string, any>;  // Structured data
  sourceSpan: {            // Reference to conversation
    messageStart: number;
    messageEnd: number;
  };
  confidence: number;      // Extraction accuracy (0-1)
  importance: number;      // Business value (0-1)
  status: 'active' | 'superseded';
  tags: string[];
}
```

### 4. Nightly Consolidation

Automatically deduplicates, supersedes outdated knowledge, and merges complementary entries:

- **Jaccard Similarity**: >0.85 = duplicate, >0.7 = conflict
- **Supersede Strategy**: Newer wins, preserves history
- **Merge Complementary**: Links related knowledge

### 5. Smart Retrieval

- **Jaccard Similarity Search**: Lexical matching on tokens
- **Importance Scoring**: Prioritizes high-value knowledge
- **Quota Injection**: Min 30% architecture, min 30% decisions in XML

### 6. Custom Tools

Two tools available in OpenCode:

```
knowledge-list [--limit N] [--type TYPE]
knowledge-search <query> [--limit N]
```

---

## Usage

### View Knowledge

**List all knowledge:**
```
Use the knowledge-list tool
```

**List by type:**
```
Use the knowledge-list tool with type="decision"
```

**Search by text:**
```
Use the knowledge-search tool with query="migrated to Vitest"
```

### Example Workflow

1. **Start conversation**: "Should we use PostgreSQL or SQLite?"
2. **Discussion**: Team decides on SQLite for simplicity
3. **Session ends**: `session.idle` triggers extraction
4. **Knowledge stored**: 
   - Type: `decision`
   - Title: "Database Choice: SQLite over PostgreSQL"
   - Content: { reason: "Simpler deployment, embedded", impact: ["db", "schema"] }
5. **Later search**: `knowledge-search "database"` returns this decision

---

## Architecture

```
┌─────────────────┐
│ OpenCode Chat   │
│ History         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pattern         │ ← Fast keyword filter
│ Detection       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4-Layer         │ ← Questions, negatives,
│ Classifier      │   scoring, confidence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LLM Extraction  │ ← Structured JSON
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SQLite Store    │ ← Persistent DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Nightly         │ ← Dedup, supersede,
│ Consolidation   │   merge
└─────────────────┘
```

### Integration Points

- **opencode**: Plugin SDK (`@opencode-ai/plugin`)
- **true-mem**: Complementary (doesn't conflict)
  - true-mem: Atomic conversational memories
  - openknowledge: Structured project knowledge

---

## API Reference

### Plugin Tools

| Tool | Args | Returns |
|------|------|---------|
| `knowledge-list` | `limit?: number`, `type?: string` | List of knowledge objects |
| `knowledge-search` | `query: string`, `limit?: number` | Jaccard-ranked results |

### Database Methods

```typescript
// CRUD
db.createKnowledge(obj: KnowledgeObject): void
db.getById(id: string): KnowledgeObject | null
db.update(id: string, data: Partial<KnowledgeObject>): void
db.supersede(id: string): void

// Queries
db.getAllKnowledge(limit?: number): KnowledgeObject[]
db.getByType(type: KnowledgeType, limit?: number): KnowledgeObject[]
db.getByImportance(minScore: number): KnowledgeObject[]
db.getByRecency(days: number): KnowledgeObject[]

// Search
retrieval.search(query: string, limit?: number): KnowledgeObject[]
```

### XML Injection Format

```xml
<openknowledge_context type="project" worktree="/path">
  <knowledge classification="architecture" importance="0.83">
    Using Next.js 14 with App Router
  </knowledge>
  <knowledge classification="decision" importance="0.75">
    Migrated to Vitest for faster CI
  </knowledge>
</openknowledge_context>
```

---

## Configuration

### Database Path

Default: `~/.config/opencode/storage/project_knowledge.db`

Override by setting `KNOWLEDGE_DB_PATH` environment variable.

### Injection Quotas

```typescript
const MIN_ARCHITECTURE = Math.floor(maxMemories * 0.3);
const MIN_DECISIONS = Math.floor(maxMemories * 0.3);
const MAX_FLEXIBLE = maxMemories - MIN_ARCHITECTURE - MIN_DECISIONS;
```

### Confidence Threshold

Default: `0.6` - Only store if classifier confidence ≥ 0.6

### Similarity Thresholds

```typescript
{
  DUPLICATE: 0.85,   // Increment frequency, skip store
  CONFLICT: 0.7,     // Supersede older
  COMPLEMENT: 0.5,   // Store both
}
```

---

## Examples

### Knowledge Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "decision",
  "title": "Test Runner: Jest → Vitest",
  "content": {
    "decision": "Migrate to Vitest",
    "reason": "Faster CI, better DX, native ESM",
    "impact": ["package.json", "vitest.config.ts", "ci.yml"]
  },
  "sourceSpan": {
    "sessionId": "abc123",
    "messageStart": 15,
    "messageEnd": 34
  },
  "confidence": 0.85,
  "importance": 0.75,
  "tags": ["testing", "ci", "migration"],
  "status": "active",
  "extractedAt": "2026-03-12T07:00:00Z"
}
```

### Search Results

```
$ knowledge-search "testing"

[decision] Test Runner: Jest → Vitest (importance: 0.75)
[workflow] PR requires test passing (importance: 0.60)
```

---

## Development

### Local Setup

```bash
# Clone repo
git clone https://github.com/mhingston/openknowledge
cd openknowledge

# Install deps
npm install

# Build
npm run build

# Test
npm test
```

### Run Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### Build Output

```
dist/
  index.js          # Main export
  plugin.js         # OpenCode plugin
  database.js       # SQLite layer
  pipeline.js       # Extraction pipeline
  classifier.js     # 4-layer defense
  extractor.js      # LLM extraction
  consolidate.js    # Nightly job
  injection.js      # XML injection
  retrieval.js      # Search API
  types.js          # TypeScript defs
```

---

## Prior Art

Inspired by [true-mem](https://github.com/rizal72/true-mem) - a cognitive psychology-based memory system for OpenCode.

**Complementary design:**
- **true-mem**: Conversational atomic memories (preferences, constraints, episodic)
- **openknowledge**: Structured project knowledge (architecture, decisions, timelines)

Both can coexist without conflict.

---

## Real-World Validation

**Tested extraction:**
- ✅ Architecture: "Using Next.js 14 with App Router"
- ✅ Decision: "Migrated to Vitest for faster CI"
- ✅ Confidence: 0.65 (4-layer defense passed)
- ✅ Importance: 0.30 (base + impact keywords)
- ✅ Status: active (not superseded)

**Database:** `~/.config/opencode/storage/project_knowledge.db` (created, queries working)

---

## License

MIT

---

## Support

GitHub: https://github.com/mhingston/openknowledge  
npm: https://www.npmjs.com/package/@mhingston5/openknowledge
