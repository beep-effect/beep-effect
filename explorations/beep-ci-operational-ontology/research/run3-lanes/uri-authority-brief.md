# Run-3 lane brief — URI authorities before host roots (Greptile round 2 on PR #1040)

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and pushes. Work ONLY in
`~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes` (branch
`ontology-run3-stage-b-fixes`, PR #1040) on top of the round-2 commit. Commit (stage by path;
never `git add -A`); never push, never touch the PR, never edit DECISIONS.md, `run2-fleet/`,
`run3-checkout-identity/`, or their generators.

Finding (Greptile, `etl_run3_fleet_corpus.py:68`, HELD): `file://localhost/home/alice/x` puts
`t/` before `/home`, so neither branch of `PATH_LEFT_BOUNDARY` (non-path char, or `//`/`:/`)
matches; redaction and the residue scan both accept it. Same in the Stage B generator.

## Required

1. In BOTH generators, treat a host root as bounded when it is preceded by a URI prefix
   `scheme://authority` (`[a-z][a-z0-9+.-]*://` followed by zero or more non-`/`, non-space,
   non-quote characters). Python `re` lookbehinds are fixed-width, so implement it as a
   forward pre-pass (match `(scheme://authority)(/root/)` and rewrite/flag the root inside
   the second group) shared by `redact_string` and `scan_output_bytes`, keeping the existing
   boundary for every other position. `file://localhost/home/a/x` → `file://localhost<home>/x`
   (or `file://localhost/<home>/x`; pick one, document it); `sftp://host/tmp/x`,
   `file:///proc/123/s`, and `file:///home/x` all redacted; raw forms fail the scan;
   `packages/home/x` and `https://example.com/homepage/x` untouched.
2. Tests in both suites for the cases above.
3. Generators are self-pinned, so re-capture the three refreshed pins under the final
   generators once, then the full verification set (five verifiers, corruption/restore,
   residue scans incl. URI forms, `failedStepId` counts, detached-worktree verify, packet
   validator, CQ suite, `knowledge refs --check`).
4. Append `## URI authorities (Greptile round 2)` to `reconcile-1037-report.md`.

Commit: `fix(explorations): bound host roots after URI authorities`, body lines under 100 chars.

## Additional finding (Greptile round 3, `etl_run3_fleet_corpus.py:70`) — HELD

**Escaped quotes break the serialized-value redaction.** The round-2 quoted-value branch
treats the first `"` as the closing delimiter, so `{"ownerPid":"a\"secret"}` becomes
`{"ownerPid": ""secret"}`: invalid JSON and part of the identity value survives. Same in the
Stage B generator. Fix in BOTH generators: match a JSON string value as
`"(?:[^"\\]|\\.)*"` (escaped characters consumed as pairs), apply the same to the key
side, and cover serialized depths the way PR #1032's tests do (once-escaped `\"ownerPid\"`
and twice-escaped forms). Tests: the example above redacts to well-formed JSON with the
whole value replaced; a value containing `\\` before the closing quote; a message whose
quoted value is itself serialized JSON. The residue scan must reject the raw forms.

If the stopped lane left uncommitted edits in the tree, review them first and build on them.
Do ONE re-capture of the three refreshed pins after both fixes, then the full verification set.
