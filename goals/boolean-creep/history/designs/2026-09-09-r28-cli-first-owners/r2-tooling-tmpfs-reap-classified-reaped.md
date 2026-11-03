# Instance

- id: `r2-tooling-tmpfs-reap-classified-reaped`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts:61`
- symbol: `DiscoveredCandidate` / `ApplyOutcome`
- members: `classified`, `reaped`
- evidence classes:
  - E4 at `TmpfsReap.ts:739-754` — unclassified candidates always receive a
    shape reason or the synthesized `unclassified` reason and therefore cannot
    reach removal.
  - E1 at `TmpfsReap.ts:992-1013,1255-1260` — plan mode emits only kept
    outcomes; apply reaches reaped only after classification and every safety
    check, including the new dangling-stub eligibility revalidation.

# Current shape

Discovery stores `classified: boolean` beside an optional shape skip reason. Measurement carries that candidate forward. Application later returns `reaped: boolean` plus warnings; the report zips measured candidates with outcomes to count and sum removals.

# Cardinality gap

Across one candidate lifecycle, four bit combinations exist. Three are legal: unclassified/kept, classified/kept, and classified/reaped. Unclassified/reaped is blocked by the safety pipeline.

# Target schema

Model discovery as a tagged `CandidateClassification` union
(`unclassified({ reason }) | classified`) instead of a boolean plus coherence
payload. Normalize the current missing shape reason to the existing
`unclassified` reason at construction, so the unclassified case always owns an
exact `TmpfsReapSkipReason`. Model application as an `ApplyDisposition`
`LiteralKit(["kept", "reaped"])` instead of `reaped: boolean`; `ApplyOutcome`
carries that disposition and warnings. Exhaustive matches combine the two
finite states where reporting needs the lifecycle outcome. Do not add a
redundant aggregate phase alongside either source.

# Migration inventory

- `TmpfsReap.ts:61-106` — replace `classified`, `shapeSkipReason`, and `reaped`
  fields with the two named states.
- `TmpfsReap.ts:235-246` — migrate `danglingStubShape`, which constructs the
  classified/shape-reason pair for dangling-worktree-stub candidates before
  the discovery functions below.
- All discovery writers at `TmpfsReap.ts:270-535` — construct one
  classification member and carry an exact reason only on unclassified.
- Classification readers at `TmpfsReap.ts:739-788` — replace boolean/Option
  coherence guards with tagged matching.
- Apply writers at `TmpfsReap.ts:816-1013` — return `kept` or `reaped`
  disposition with warnings.
- `TmpfsReap.ts:977-1013` — preserve the second dangling-stub discovery,
  process-reference scan, liveness/age check, and fail-closed warning before
  any removal.
- `TmpfsReap.ts:844-921` — preserve exact `.git`-only revalidation and guarded
  non-recursive `rmdir`; no state refactor may weaken the raced-content safety
  behavior.
- Aggregation at `TmpfsReap.ts:1255-1265` — filter and count by
  `ApplyDisposition`, preserving candidate ordering and reclaimed-byte sums.
- `test/tmpfs-reap.test.ts` and `test/quality-tmpfs-render.test.ts` — preserve skip reasons, removals, counts, bytes, and render output.

# Guard-deletion accounting

Delete every `classified ? ... : ...` coherence branch tied to `shapeSkipReason`, every `reaped: true/false` write, and every `outcome.reaped` guard. Tagged payload ownership and literal matching replace those checks; filesystem safety and liveness guards remain intact.

# Encoded-side impact

None. `DiscoveredCandidate` and `ApplyOutcome` are internal. The public `TmpfsReapReport` JSON/model retains `applied`, candidate skip reasons, `reapedCount`, `reclaimedBytes`, roots, timestamps, and warnings exactly.

# Test impact

Retain the full temp-root/worktree safety matrix. Add focused internal-behavior
assertions through report output for unclassified-kept, classified-kept, and
classified-reaped; prove no unclassified fixture contributes to reaped count
or reclaimed bytes. Retain the new tests for symlink substitution, eligibility
changes, failed `.git` removal, raced contents, guarded `rmdir`, and
parent-container cleanup.

# Risk & sequencing

Tier 1E. The change crosses discovery, measurement, apply, and reporting in one
file; land it atomically and preserve every existing path-containment,
liveness, age, dirty-worktree, Vitest, and lease guard. The moving-main
hardening added a second eligibility gate and non-recursive removal protocol;
those are required invariants, not guards targeted for deletion. Run full
`@beep/repo-cli` package verification.
