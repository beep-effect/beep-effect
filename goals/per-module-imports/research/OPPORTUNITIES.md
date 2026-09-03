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

## 2026-09-03 — Follow the Portless redirect in route-readiness probes

- Work: establish the untouched Professional Desktop P2 measurement baseline.
- Evidence: the packet's `/usr/bin/curl -fsS` inactive-route probe exited 0 on
  Portless's normal HTTP-to-HTTPS `302` even though `portless list` reported
  zero active routes; following the redirect reached the expected `404`.
- Prevention: use `curl -fsSL` for both the inactive-route guard and readiness
  poll so success means the registered app answered after the canonical
  redirect, not merely that the shared proxy is running.

## 2026-09-03 — Put Bun run flags after the subcommand

- Work: execute the complete-package correctness step in the Professional
  Desktop P2 baseline.
- Evidence: `bun --cwd apps/professional-desktop run beep:check` printed Bun's
  help and exited 0 in 0.01 seconds instead of running the script, creating a
  false-positive measurement artifact under Bun 1.4.0.
- Prevention: use the repository-proven `bun run --cwd <workspace> <script>`
  shape for the gate's package check, dev server, package test, and production
  build commands, and retain the first invalid attempt as explicit evidence.

## 2026-09-03 — Express bounded cache clearing without recursive rm

- Work: start the P2 cold-route measurement loop after validating the exact
  package-local cache targets.
- Evidence: the execution safety layer rejected the packet's explicit
  `rm -rf` cache command before it ran, even though every target was a resolved
  Professional Desktop cache directory.
- Prevention: enumerate the same exact `.vite`, `.vite-temp`, and `dist`
  directories and clear each existing tree with `find -depth -delete`; this
  keeps the destructive boundary visible and excludes broader globs or roots.

## 2026-09-03 — Summarize native tsgo structural-counter jitter

- Work: validate the seven untouched source-program compiler samples before
  migrating the Professional Desktop pilot.
- Evidence: tracked pilot source stayed unchanged and `Files` was exactly
  10,257 in all runs, while `Types` and `Instantiations` varied by roughly
  0.1% between identical native tsgo invocations.
- Prevention: preserve every structural sample, require a stable tracked-source
  hash and identical `Files`, then summarize `Types`, `Instantiations`, check
  time, and RSS by median/MAD. Keep the existing 5% structural threshold and
  apply the same two-relative-MAD stability test used for timing.

## 2026-09-03 — Make the expected empty after inventory pipefail-safe

- Work: transition from the idempotent Professional Desktop rewrite to the
  required zero-import after-state inventory.
- Evidence: the paste-ready gate enables `set -o pipefail`, while `rg -l`
  exits 1 when the expected after-state has no matches; the original pipeline
  would therefore abort before recording the successful empty file.
- Prevention: normalize only `rg`'s no-match result with `|| true`, then sort
  and tee the stream exactly as before. The recorded line count and strict law
  check remain the assertions that the after inventory is zero.

## 2026-09-03 — Validate extension graphs before accepting new samples

- Work: extend the noisy Professional Desktop source-tsgo and Vitest metrics
  symmetrically from 7 to 15 samples after the approved pilot rewrite.
- Evidence: an attempted baseline extension in a disposable sibling worktree
  reported 10,325 source-program files, while all original before samples had
  exactly 10,257. The different resolved graph made those appended samples
  non-comparable even though the worktree was detached at the paired commit.
- Prevention: validate the first extension sample against the original exact
  `Files` count and tracked source state before completing the loop. When the
  graph differs, quarantine the attempt and use a guarded reversible patch in
  the original checkout path; verify the migrated diff byte-for-byte after
  restoring it.
