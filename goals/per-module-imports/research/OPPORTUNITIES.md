# Per-Module Imports Opportunities

## 2026-09-03 — Preserve executable shebangs during import insertion

- Work: run the P1 candidate codemod over the complete in-scope executable corpus.
- Evidence: `bun run beep laws effect-imports --mode code --candidate --json --include-prefix apps,packages,infra` failed on `apps/practice-kg-mcp/src/bin.ts` because an emitted import was inserted before `#!/usr/bin/env bun`, producing TS18026 and TS1005.
- Prevention: include an executable shebang fixture in the codemod suite and detach then restore the exact shebang prefix around ts-morph declaration edits.

## 2026-09-03 — Use the complete JSON command sink

- Work: pipe the full Markdown advisory summary into `jq` for structured evidence.
- Evidence: the scan itself exited successfully, but `Console.log` truncated the single JSON entry at Bun's 64 KiB console limit and `jq` reported an unfinished string.
- Prevention: route machine JSON through the existing `printCommandJson` helper, whose direct stdout sink exists specifically to preserve oversized command payloads.

## 2026-09-03 — Bound direct stdout writes under nested Bun wrappers

- Work: stream the authored-Markdown candidate summary through `jq` for the P1 census proof.
- Evidence: `bun run beep laws effect-imports --mode markdown --check --json | jq ...` twice ended at byte 16,384 with an unfinished JSON string even though the command used `printCommandJson`.
- Prevention: emit machine JSON as bounded UTF-8 stdout chunks below the nested wrapper's per-write boundary and keep a process-boundary regression that rejects oversized writes.

## 2026-09-03 — Require a real publish map during leaf routing

- Work: prove every P1 foundation leaf against both package export maps.
- Evidence: `@beep/ui` was the only foundation package without `publishConfig`; the initial mapper's private-package fallback silently substituted its workspace exports even though the packet requires both maps.
- Prevention: audit workspace/publish key parity for every touched manifest, give `@beep/ui` a complete 17-entry publish mirror, and route a package with no publish map to structured manual review regardless of its `private` flag.

## 2026-09-03 — Align package-verify help with its single-package contract

- Work: plan the required default package verification for every P1-touched workspace.
- Evidence: `bun run beep quality package-verify --help` renders a variadic `[<package...>]` argument, but `runPackageVerifyCli` rejects more than one package argument.
- Prevention: either accept and sequentially verify every supplied package or expose a singular CLI argument so callers do not plan an invocation the command refuses.
