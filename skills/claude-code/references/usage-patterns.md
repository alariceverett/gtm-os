# Usage Patterns

## Code Review

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "Review this file for bugs, issues, and improvements: $(cat path/to/file.jsx)"
```

## Build Component

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "Build a React component that does X. Write it to path/to/file.jsx"
```

## Refactor

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "Refactor path/to/file.ts: extract the validation logic into a separate function, add error handling"
```

## QA Scan

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "Scan this file for anti-patterns (no-any, missing error handling, hardcoded values): $(cat path/to/file.ts)"
```

## Multi-File

Pass multiple files in one prompt:

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "Review these files for consistency: $(cat src/api.ts) --- $(cat src/types.ts)"
```

## Structured Output

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions --output-format json -p "List all exported functions in $(cat src/utils.ts)"
```
