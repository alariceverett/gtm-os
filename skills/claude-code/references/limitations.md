# Limitations

- **Headless only** — no interactive/TUI mode, use `-p` flag for single-shot prompts
- **Token limits** apply per invocation; keep prompts focused on specific files/tasks
- **No browser access** from Claude Code itself
- **Auth** via `CLAUDE_AI_SESSION_KEY` env var (already available in the container)
- **No persistent state** between invocations — each call is independent
