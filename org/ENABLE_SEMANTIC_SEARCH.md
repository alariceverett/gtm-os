# Enable Semantic Search in OpenClaw

## Current State
- Memory search configured with `provider: "local"`
- Returns `disabled: true` — indicates embedding backend unavailable

## Issue
Local semantic search requires an embeddings API. Common providers:
1. **OpenAI** (`text-embedding-3-small`)
2. **Anthropic** (Claude embeddings)  
3. **Ollama** (local embeddings like `nomic-embed-text`)

## Fix Options

### Option 1: Ollama (Local - Free)
Best for privacy, no API costs.

```bash
# 1. Install Ollama if not present
brew install ollama

# 2. Pull embedding model
ollama pull nomic-embed-text

# 3. Ensure Ollama is running
ollama serve

# 4. Test embeddings
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "test"
}'
```

### Option 2: OpenAI (Cloud - Pay per use)
Best for reliability, no local compute.

```bash
# Set API key
export OPENAI_API_KEY="sk-..."

# Or add to OpenClaw config
openclaw configure --section openai --key apiKey --value "sk-..."
```

### Option 3: Change Provider in Config
Edit `~/.openclaw/openclaw.json`:

```json
"memorySearch": {
  "sources": ["memory", "sessions"],
  "provider": "ollama",
  "ollama": {
    "baseUrl": "http://127.0.0.1:11434",
    "model": "nomic-embed-text"
  }
}
```

## Verification

After fix, test semantic search:

```bash
# In a new session, try:
curl -X POST http://localhost:18789/api/memory/search \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{"query": "outreach system"}'
```

Or simply ask me to recall something — I should now find relevant memory snippets.

## Quick Checklist

1. ☐ Ollama installed (`which ollama`)
2. ☐ Embedding model pulled (`ollama list`)
3. ☐ Ollama running (`curl http://localhost:11434/api/tags`)
4. ☐ Config updated (`cat ~/.openclaw/openclaw.json | grep -A5 memorySearch`)
5. ☐ Gateway restarted (`openclaw gateway restart`)

## Fallback (No Semantic Search)

If setup is complex, I maintain context via:
- `MEMORY.md` (curated long-term)
- `memory/YYYY-MM-DD.md` (daily logs)
- Direct file reads

This works fine for most use cases.
