# openknowledge

A project knowledge memory plugin for OpenCode that extracts, stores, and retrieves structured knowledge from chat history.

## Features

- **Knowledge Extraction**: Automatically extracts architecture decisions, timelines, workflows, and key decisions from conversation summaries
- **Four-Layer Defense**: Filters noise using question detection, negative patterns, multi-keyword scoring, and confidence thresholds
- **SQLite Storage**: Persistent knowledge store with importance scoring and status tracking
- **Nightly Consolidation**: Deduplicates, supersedes outdated knowledge, and merges complementary entries
- **Smart Retrieval**: Jaccard similarity search with quota-based XML injection
- **Custom Tools**: `knowledge-list` and `knowledge-search` commands

## Installation

### From local files

Place the plugin in your OpenCode plugins directory:

```bash
mkdir -p ~/.config/opencode/plugins
cp -r openknowledge ~/.config/opencode/plugins/
```

### From npm (after publishing)

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["openknowledge"]
}
```

## Usage

### Custom Tools

Once installed, two tools become available:

**List knowledge:**
```
Use the knowledge-list tool to view stored knowledge objects.
```

**Search knowledge:**
```
Use the knowledge-search tool with query="event architecture" to find related knowledge.
```

### CLI Commands

```bash
# Initialize database
openknowledge init

# List all knowledge
openknowledge list

# Search by text
openknowledge search "event architecture"

# Export as JSON
openknowledge export

# Run nightly consolidation
openknowledge consolidate

# Generate XML for injection
openknowledge inject --max 5
```

## Knowledge Types

| Type | Description | Scope |
|------|-------------|-------|
| **architecture** | Tech stack, patterns, infrastructure | Global |
| **decision** | Key decisions with reasoning | Project |
| **timeline** | Milestones, sprint progress | Project |
| **workflow** | Established processes, CI/CD | Project |

## Database Schema

Knowledge objects store:
- `id`: UUID
- `type`: Knowledge type
- `title`: Short description
- `content`: Structured data
- `sourceSpan`: Message range reference
- `confidence`: Extraction accuracy (0-1)
- `importance`: Business value (0-1)
- `status`: active | superseded

## Architecture

```
Session Summary
     │
     ▼
Pattern Detection (fast filter)
     │
     ▼
Knowledge Classifier (4-layer defense)
     │
     ▼
LLM Extraction (structured output)
     │
     ▼
SQLite Storage
     │
     ▼
Nightly Consolidation (dedup, supersede, merge)
```

## Prior Art

Inspired by [true-mem](https://github.com/rizal72/true-mem) - a persistent memory plugin for OpenCode with cognitive psychology-based memory management.

openknowledge complements true-mem:
- **true-mem**: Atomic conversational memories (preferences, constraints, episodic)
- **openknowledge**: Structured project knowledge (architecture, decisions, timelines, workflows)

Both can be installed together without conflict.

## License

MIT
