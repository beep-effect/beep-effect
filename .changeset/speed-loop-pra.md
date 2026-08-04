---
"@beep/db-admin": patch
"@beep/architecture-lab-server": patch
"@beep/documents-server": patch
"@beep/acp": patch
"@beep/box": patch
"@beep/drizzle": patch
"@beep/exiftool": patch
"@beep/ffmpeg": patch
"@beep/firecrawl": patch
"@beep/libpff": patch
"@beep/m365": patch
"@beep/nlp-mcp": patch
"@beep/obs": patch
"@beep/openclaw": patch
"@beep/pglite": patch
"@beep/postgres": patch
"@beep/runpod": patch
"@beep/tika": patch
"@beep/venice-ai": patch
"@beep/epistemic-server": patch
"@beep/pandoc-ast": patch
"@beep/workspace-server": patch
---

Split integration testing into parallel and serial turbo tasks
(speed-loop cycle 2, PR-A): packages with self-contained integration
suites run bounded-parallel; only the shared-SQL suites serialize.
Package-local `test:integration` remains the stable public command.
