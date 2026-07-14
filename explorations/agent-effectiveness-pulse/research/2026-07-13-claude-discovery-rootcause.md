# Claude-Source Zero-Candidate Root Cause — stale run, not a bug

> Provenance: pre-exploration codex lane (GPT-5.6 Sol, medium effort,
> read-only diagnosis with one live `sources discover` reproduction),
> 2026-07-13.

## Verdict

**Stale-run / source-not-yet-present, not a discovery bug.**

`forwarder-1780971864297` began 2026-06-08 21:24:24 CDT. Filesystem
birth-time evidence:

- Claude project directory created 2026-06-11 00:34:27 CDT.
- Earliest recursive Claude JSONL created 2026-06-14 00:58:02 CDT.
- JSONLs with birth time or mtime before the recorded run: **0**.
- The status artifact was materialized June 10 with a preserved June 8 mtime
  — historical, not current.

Zero Claude candidates was therefore *correct for that run*. The directory
now has 50 top-level sessions but **1,157 recursive JSONLs** including
subagents/workflows.

## Discovery behavior (verified against source)

- Claude root derivation is correct:
  `packages/tooling/library/ai-metrics/src/internal/transcript-utils.ts:72`,
  `packages/tooling/library/ai-metrics/src/source-discovery.ts:627`.
- Collection recursively visits directories, accepts paths ending `.jsonl`:
  `packages/tooling/library/ai-metrics/src/internal/jsonl-discovery.ts:31`.
- The since-window uses **filesystem mtime**, not transcript content
  timestamps: `source-discovery.ts:334`.
- Time and size filters run **before** `candidateFileCount` is computed —
  "candidate" means "eligible after mtime and size filtering":
  `source-discovery.ts:452`, `source-discovery.ts:472`.
- Eligible files sort newest-first, then cap at `maxFiles`:
  `source-discovery.ts:472,484`.
- `maxFiles` budgets are **per source** — codex cannot starve claude:
  `packages/tooling/library/ai-metrics/src/forwarder.ts:719,756`.
- No codex-specific metadata requirement affects claude eligibility
  (`source-discovery.ts:316`).
- Node `stat` follows symlinks; the walker has no cycle guard; current
  Claude tree contains zero symlinks (not a contributor, worth knowing).

## Defaults and timer root

- Without `--since` or `--all`, discovery defaults to the preceding seven
  days (`packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:389`);
  `--all` removes the cutoff (`Programs.ts:1197`).
- Normal runs default to 200 files per source; **timer rendering defaults to
  5 files and 8 MiB per file**
  (`packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts:144,154`).
- Omitted `--repo-root` resolves from `process.cwd()` (`Programs.ts:210`);
  the timer pins that root as systemd `WorkingDirectory`
  (`Programs.ts:1742`, `forwarder.ts:532`). No wrong-root theory needed.

## Live reproduction

```sh
bun run beep ai-metrics sources discover \
  --target local \
  --repo-root /home/elpresidank/YeeBois/projects/beep-effect \
  --home-dir /home/elpresidank \
  --all \
  --max-files 5 \
  --max-file-bytes 8388608 \
  --json
```

Observed live: claude `candidateFileCount=1155`, `includedFileCount=5`,
`limitedByMaxFiles=true`, `sizeExcludedFileCount=2`, `status=available`.

## Disposition

**No code fix required.** Optional diagnostics polish (candidate for a later
goal, not the exploration): distinguish raw-found / time-excluded /
missing-root counts in status output — today `candidateFileCount: 0` cannot
disambiguate an empty or missing root from every file falling outside the
mtime window.
