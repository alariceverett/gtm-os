# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Device nicknames
- Anything environment-specific

### GitHub (non-interactive checks)

- Protocol standard: prefer SSH remotes (`git@github.com:<owner>/<repo>.git`)
- Validation command: `git ls-remote git@github.com:<owner>/<repo>.git HEAD`
- Avoid HTTPS for heartbeat/cron checks on headless hosts (can prompt for username)

---

Add whatever helps you do your job. This is your cheat sheet.
