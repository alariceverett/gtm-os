---
name: claude-code
description: Spawn Claude Code CLI for builds, code reviews, refactoring, and QA. Use when any agent needs to write, edit, or review code.
---
# Claude Code CLI

Spawn Claude Code for builds, reviews, refactoring, and QA inside the sandboxed container.

## Invocation

```bash
ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY" npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "your prompt here"
```

## Rules

- **Always** set `ANTHROPIC_API_KEY="$CLAUDE_AI_SESSION_KEY"` before invocation
- **Always** pass `--dangerously-skip-permissions` (sandboxed container)
- Use `-p "prompt"` for single-shot tasks (no interactive mode)
- Use `--output-format json` when you need structured/parseable results
- Keep prompts focused on specific files/tasks — don't dump entire codebases
- For file edits: give the file path and specific instructions
- For code review: pass the file content and ask for bugs, issues, improvements

## Notes

- Runs Sonnet 4.6 via subscription — no API billing
- See `references/usage-patterns.md` for common patterns
- See `references/limitations.md` for constraints
