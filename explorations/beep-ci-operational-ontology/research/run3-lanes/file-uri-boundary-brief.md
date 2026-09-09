# Run-3 lane brief — close the file-URI boundary gap (Greptile P1 on PR #1040)

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and publishes. Steward: Benjamin.
Finding (Greptile, PR #1040, `etl_run3_fleet_corpus.py:63`, HELD): the left-boundary
lookbehind that stops `packages/workspace/…` from matching a `/workspace` fleet root also
excludes a preceding `/`, so a local URI such as `file:///home/alice/x` or
`file:///proc/123/status` passes both `redact_string` and `scan_output_bytes` unchanged. The
Stage B generator has the same boundary. No pinned payload currently contains `file://`
(verified: zero files across all five pins), so this is a generator-and-test fix.

Work ONLY in `~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes` (branch
`ontology-run3-stage-b-fixes`, PR #1040). Commit (stage by path; never `git add -A`); never
push, never touch the PR, never edit DECISIONS.md, `run2-fleet/`, `run3-checkout-identity/`,
or their generators.

## Required

1. In BOTH `etl_run3_fleet_corpus.py` and `etl_run3b_fleet_corpus.py`, make the host-root
   boundary accept a root preceded by a URI authority separator (`//`, i.e. the `/` before the
   root is itself preceded by `/` or `:`) while still rejecting a root that continues a relative
   path (`packages/workspace/…`, `packages/home/…`). Apply the same rule in redaction and in the
   residue scan (including the literal `/home/`, `/tmp/`, `/proc/`, `/dev/shm/` entries). A
   redacted URI keeps its scheme: `file:///home/alice/x` → `file://<home>/x`,
   `file:///proc/123/status` → `file://<proc>/<process>/status`.
2. Tests in both suites: the two URI positives above (redaction output AND scan failure when
   left raw), the relative-path negatives, and a `file://` URI with a fleet root.
3. Manifests self-pin the generator sha, so the three refreshed pins must be brought back to
   PASS using the repair/replay mechanics PR #1032 added (`--source-ref` provenance) if they
   support a generator update without recapture; if they do not, `--refresh` each pin and
   state that in the report. Whichever path: all five verifiers PASS, residue scans empty,
   `failedStepId` counts unchanged, detached-worktree verify at the committed HEAD.
4. Append a `## File-URI boundary (Greptile P1, 2026-09-09)` section to
   `research/run3-lanes/reconcile-1032-report.md` (what changed, digests, the pin path taken).

Commit message: `fix(explorations): bound host-root redaction at URI authority separators`,
body lines under 100 characters.
