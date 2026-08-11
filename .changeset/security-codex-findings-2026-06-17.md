---
"@beep/agents-client": patch
"@beep/agents-server": patch
"@beep/box": patch
"@beep/editor": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/identity": patch
"@beep/langextract": patch
"@beep/lexical-schema": patch
"@beep/md": patch
"@beep/nlp": patch
"@beep/nlp-mcp": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/professional-desktop": patch
"@beep/rdf": patch
"@beep/repo-ai-metrics": patch
"@beep/schema": patch
"@beep/test-utils": patch
"@beep/ui": patch
"@beep/uspto": patch
---

security: remediate 55 Codex Cloud security findings (scan f4128216, 2026-06-17).

Hardens the monorepo against the legitimate findings from the Codex security
scan, introducing four shared foundation helpers and routing affected sites
through them:

- `@beep/file-processing/PathSafety` — fail-closed path-traversal guard
  (resolve-within-root, symlink/`..` escape rejection) for local file reads and
  writes across nlp-mcp, corpus, yeet, image, ai-metrics, ffmpeg.
- `@beep/schema` `SafeRemoteHost` — SSRF allowlist (blocks loopback, link-local,
  RFC1918/ULA, and the cloud metadata endpoint) used by the USPTO and Box drivers.
- `@beep/observability` `CauseRedaction` — bounded, secret-stripping redaction of
  error causes before they reach logs, telemetry, or client channels.
- `@beep/repo-utils` `ProcessArgs` — CLI option-injection guard (`--`
  end-of-options separator and literal-arg guards) for spawned child processes.

Also scopes CI secrets to trusted events, bounds content-derived React keys and
several DoS-prone loops, scrubs leaked local workstation paths from committed
docs/config, and applies assorted per-finding fixes. All changes pass the full
typecheck, lint, repo-law, docgen, and security-scan proof.
