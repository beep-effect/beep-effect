# Provisional: r28-cli-internal-root-tmpfs-stub-observations

Native P2 data-only design, pending parent admission and independent review.
Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`; main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Complete evidence, source hashes,
exact proposed row and private execution receipt are in
`data/design-refresh-2026-09-09-r28-tmpfs-observation-owner.md`.
Coordinate one Tier1E internal implementation batch with
`provisional-r28-tmpfs-discovered-candidate-full-owner.md`. Neither draft
authorizes implementation or changes a current design.

## Current shape

`packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts:373-397` declares
five real sibling values inside `discoverDanglingWorktreeStub`: `gitDir`379
and `parentRepo`380 are Option<string>; `gitDirMissing`384 and
`parentRepoMissing`385 are Option<boolean>; `contentsAreExact`387 is Boolean.
The complete supported producer is this function, used by initial discovery462
and immediate pre-removal rediscovery985. The values do not escape separately.
The required `shape` object386 is another owner and contributes no dotted
member. Required root/path/timestamp payloads and helper parameters are not
invented binary axes.

The return annotations at165-175,199-230,248-268 establish these domains without
an inference assumption. A stat success is Some(false), NotFound is Some(true),
and every other error is None. An absent path also yields None without a stat.
A known path with an unknown stat result remains a distinct state from no path.
Parent resolution177-186 may fail for a successfully parsed Git target, so a
target with no recognized repository parent is another supported state.

## Cardinality gap

The complete cluster represents `2 * 2 * 3 * 3 * 2 = 72` finite states and
supports14. Option<boolean> has None, Some(false) and Some(true); no pair of
those values is collapsed. Full path strings remain payloads.

| Path case | Allowed stat/contents states | Count |
| --- | --- | --- |
| No Git target | No parent, both observations None, contents false |1|
| Git target, unrecognized parent | Any of three Git observations, parent observation None, contents false |3|
| Git target and recognized parent | All nine ordered Git/parent observation pairs; contents false except missing/missing additionally permits true |10|

The full14-row table is in the bound audit. Parent presence requires Git target
presence because resolution flatMaps that Option. Missing path requires None
observation, but a None observation never proves a missing path. Exact contents
requires both observations Some(true), since source239 and387 gate that call.
These are E4 implication laws on actual Boolean-valued observations and Option
payloads; None is not an exact duplicate of path absence.

All nine known-path pairs are legal observations. Git stat precedes parent stat
at384-385; no lock/snapshot couples them. A target that existed before a parent
was concurrently removed produces Some(false)/Some(true). PermissionDenied or
another error may leave either observation unknown. Excluding these tuples
would turn sequential observations into an unsupported simultaneous claim.

## Target schema

Introduce one private schema-derived transient view with three path cases:

- `NoGitDir {}`: no target path, parent path or stat payload.
- `ParentUnrecognized { gitDir, observation }`: required full target string and
  a private `StatObservation` LiteralKit with `Unknown`, `Exists`, `Missing`.
- `ParentRecognized { gitDir, parentRepo, observation }`: both full strings and
  a private ten-case literal domain for the ordered observation result.

The ten recognized-parent literals are UnknownUnknown, UnknownExists,
UnknownMissing, ExistsUnknown, ExistsExists, ExistsMissing, MissingUnknown,
MissingExists, BothMissingInexact and BothMissingExact. These names identify
observations at their separate call times; they do not assert current existence.
The last two retain the exact Boolean result of the subsequent contents probe.
This gives1+3+10=14 with no independent Boolean/Option coordination fields.
Use named schema cases, `LiteralKit`, and the local Effect v4 `S.TaggedUnion`
cases/guards/match contract at `.repos/effect/packages/effect/src/Schema.ts:
6200-6250`; derive the private runtime type from the schema. Do not add a
persisted codec, public export, error payload, numeric bound or path refinement.

Construct the path case first. No target performs neither stat; an unrecognized
parent performs only the target stat. A recognized parent always performs target
stat and then parent stat, even when the first result is Unknown or Exists.
Only the Missing/Missing result evaluates `danglingStubContentsAreExact`.
Translate stat failure reasons exactly as the current function does: NotFound
to Missing, all other errors to Unknown. Preserve parser/normalizer behavior,
marker size limit and symlink rejection before selecting any path case.

The companion candidate design supplies the pure projection from these14 cases
to the seven supported dangling candidate states. This local schema retains
more information than that output and cannot be replaced by its skip reason.
For example, Unknown/Missing and Unknown/Exists both report wrong-shape while
remaining different legitimate observations here.

## Migration inventory

- `TmpfsReap.ts:165-175`: adapt the observation helper to the private three-case
  result for a required known path. Preserve all error mappings; do not add
  retries or fail the whole effect for a previously swallowed stat error.
- `177-224`: reuse full Git path parsing and parent normalization. Preserve
  relative/absolute marker handling, prefix search, regular-file size check,
  read errors and symlink behavior. No new path rules are introduced.
- `226-230`, `379-385`: replace optional-path stat dispatch and separate path/
  result locals with the owning path cases above. The two stat calls retain
  order and both still run when both paths are known.
- `248-268`, `387`: preserve every directory/readLink/stat operation inside the
  exact-contents check; its Boolean result selects the two both-missing cases.
  No contents probe runs for any other observation pair.
- `373-397`: produce the transient view, then call the companion's pure
  candidate projection. Preserve root, candidatePath, idleSinceMillis and full
  parent payload. The candidate owns final classification/reason construction.
- `462`, `978-988`: initial and pre-removal discovery continue to use the same
  procedure. Preserve statMtime fallthrough, rediscovered liveness/age/skip
  checks, and every warning/failed rediscovery behavior.
- `844-917`: the later exact-contents recheck, nonrecursive marker removal,
  guarded rmdir and parent-container cleanup remain separate safety operations.
  A prior BothMissingExact observation never replaces a fresh safety check.

No other writer accepts these private locals. Internal barrel exports at
`internal/repo-run/index.ts:27-28` and the RepoRun test kit expose public run/
schema surfaces, not this owner. Quality and Yeet consume the projected report.
The audit's consumer map and hashes cover those boundaries and existing fixtures.

## Guard-deletion accounting

This design alone removes `optionalStatIsMissing`'s Option-path dispatch226-230
and the resulting repeated path/observation coordination at379-385: a known-path
case owns a required string. Replace the `shape.classified ? contentsProbe :
false` temporary at387 with construction of the two both-missing cases. This
removes the independent false initializer and subsequent temporal coherence
obligation; the actual lazy safety decision remains as an exhaustive match.

The candidate companion alone owns `danglingStubShape`239-245, its firstSome
reason precedence and classified/None normalization, final pair writes393-394,
classificationSkipReason739-745, and candidate parent Option reconstructions.
Do not count those again here. A helper's temporary classified/Some(wrong-shape)
tuple is valid before normalization and is not another copy of this14-state
owner. Single returns, function parameters and the D1 nine-pair stat subset add
no extra census rows or guard credit. The withdrawn dotted-field4/3 row stays
withdrawn.

## Encoded-side impact

None: the new view is transient and private. `TmpfsReapCandidate` schemas147-162
and report188-203 keep all six reap classes, twelve skip reasons, full payloads,
defaults and `tmpfs-reap/v1`. Report projection1016-1033 retains optional
parentRepo/skipReason/bytes omission, rather than null, false or an empty string.
No historical JSON decoder is restricted to these internal14 tuples. Public
Quality encoding/text rendering and Yeet summary values remain identical.

## Test impact

The authorized private source-extraction proof has already executed all14 legal
local tuples, enumerated all72 and checked equality with the source implications.
It checks eleven non-NotFound error variants, full paths/timestamps, ordered stat
calls and the lazy contents gate. It uses installed Effect with an in-memory
FileSystem; it is supporting native P2 evidence, not a product test or P3 review.
The bound audit records its exact command, exit0, source/proof hashes and limits.

For implementation, use these14 cases as meaningful constructor/behavior tests,
including target-existed/parent-later-missing, known-path permission errors,
unrecognized parent and both contents results. Compare public candidates and
warnings before/after, not only schema tags. Retain all marker/relative-path/
symlink/oversize/extra-contents fixtures in `test/tmpfs-reap.test.ts`, especially
successive-call races527-616 and772-808, codec/default tests1139-1184/1572-1583,
and `test/quality-tmpfs-render.test.ts`. Run focused suites and package verification
only in a separately authorized implementation; none ran for this design.

## Risk

Tier1E private state with filesystem-deletion consequences. The material risks
are conflating None with false, treating a race as impossible, eagerly checking
contents, omitting the second stat after an error, or reusing an old observation
instead of the existing later probes. The14-case model preserves all of these
distinctions. Keep this and the candidate projection in one internal batch with
non-overlapping guard credit. Full source eligibility is established here;
admission and independent review remain parent-controlled.
