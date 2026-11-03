# R28 Tmpfs neighboring observation owner audit

Native P2 follow-up closing the one local Tmpfs limit in the immutable
`design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md`.
Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`; main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. No source, current design,
canonical inventory, prior audit, report, archive or ref changes. No Grok,
product package command, real janitor execution or independent P3 claim.

## Closed disposition

1. Add one actual five-local owner, proposed ID
   `r28-cli-internal-root-tmpfs-stub-observations`, **72/14**, at
   TmpfsReap.ts379–387. It is not the withdrawn dotted-field4/3 pair.
2. Expand the already-current stable DiscoveredCandidate row from its valid
   selected-pair projection26/6 to the full connected owner **312/13**:
   reapClass, classified, shapeSkipReason, parentRepo. The complete writers
   correlate both the six-valued literal and the real Option payload. Preserve
   the prior raw/correction receipts as historical pair-projection evidence.
3. Treat the classifier's implementation locals and Pick return as covered
   constructor work under that same candidate family, with exact guard
   allocation below. Do not add duplicate helper-copy census rows.
4. Keep the withdrawal of `tmpfs-dangling-stub-disposition`: shape.classified
   is nested in a separate required object. Neither its old name nor its4/3
   count is revived. The new local owner uses only actual declared locals.

Two complete eight-section data provisionals accompany this audit. Parent
owns admission, replacement current designs and later independent review.
Their coordinated implementation landing is Tier1E; inventory tier remains1.
The neighboring local question is resolved; no broader Tmpfs/source rescan is
requested or claimed.

## Actual local declarations, inferred domains and error contract

Source path abbreviations here refer to
`packages/tooling/tool/cli/src/internal/repo-run/` unless otherwise named.
`discoverDanglingWorktreeStub`373–397 has these exact sibling values:

| Local | Actual domain | Declaration/source proof |
| --- | --- | --- |
| gitDir | Option<string>,2 presence cases |379 calls gitDirForCandidate199–224, whose Effect.fn.Return explicitly names Option<string> |
| parentRepo | Option<string>,2 presence cases |380–383 uses O.flatMap over gitDir and parentRepoFromGitDir177–186's explicit Option<string> return |
| gitDirMissing | Option<boolean>,3 cases |384 calls optionalStatIsMissing226–230; absent path returns O.none<boolean>, present path calls statIsMissing165–175 with explicit Option<boolean> return |
| parentRepoMissing | Option<boolean>,3 cases |385 uses the same helper on the second actual path |
| contentsAreExact | boolean,2 cases |387 calls danglingStubContentsAreExact248–268's explicit Boolean return or writes false |

These are values, not predicate function symbols or anonymous parameter names.
`shape`386 is a required object; no nested shape member is counted. Root,
candidatePath and idleSinceMillis are function parameters/full payloads, not
admitted axes. Full path strings remain payloads; only their genuine Options
contribute presence. Both observations are explicitly Option<boolean>, not
Option<true>, so None/Some(false)/Some(true) are three distinct declared values.

statIsMissing165–175 maps successful fs.stat to Some(false), NotFound to
Some(true), and every other PlatformError reason to None. The local Effect v4
FileSystem.ts304–306 declares a fallible stat call; PlatformError.ts67–86 names
NotFound, PermissionDenied and other error categories. BadArgument also flows
to None because its tag is not NotFound. Unknown is **not evidence of absence**.
optionalStatIsMissing also returns None without a stat call for an absent path.
Those two None causes must stay distinguishable by the accompanying path
presence, rather than inventing a new error payload the source did not retain.

The source Option facade at packages/foundation/modeling/utils/src/Option.ts130
reexports effect/Option unchanged for every function used here. The private
proof uses that installed implementation directly. No generic callback-literal
inference assumption is necessary: both stat and exact-contents functions
have explicit return annotations in current source.

## Complete local cardinality and supported temporal observations

The full product is **2 ×2 ×3 ×3 ×2 =72**. Let G/P mean actual gitDir/parentRepo
presence, U be None, E be Some(false) (existed when observed), M be Some(true)
(NotFound when observed), and C be contentsAreExact. The full legal table is:

| G | P | Git observation | Parent observation | C | Why supported |
| --- | --- | --- | --- | --- | --- |
| absent | absent | U | U | false | No usable marker; neither path stat is called |
| present | absent | U | U | false | Parsed target has no recognized parent; its stat fails other than NotFound |
| present | absent | E | U | false | Unrecognized-parent target exists |
| present | absent | M | U | false | Unrecognized-parent target is missing |
| present | present | U | U | false | Both calls return non-NotFound errors |
| present | present | U | E | false | Target status unknown; parent later exists |
| present | present | U | M | false | Target status unknown; parent later missing |
| present | present | E | U | false | Target existed; later parent status unknown |
| present | present | E | E | false | Both existed when individually observed |
| present | present | E | M | false | Target existed; parent removed before the later stat |
| present | present | M | U | false | Target missing; parent status unknown |
| present | present | M | E | false | Target missing inside an existing parent |
| present | present | M | M | false | Both missing; subsequent contents check rejects/errors |
| present | present | M | M | true | Both missing; subsequent contents check succeeds |

This is14, not a static-filesystem table that incorrectly excludes E/M.
The controlling source laws are exact and sufficient:

- P implies G because parentRepo is flatMapped from gitDir.
- Absent G implies gitDirMissing=None; absent P implies parentRepoMissing=None.
  The converses are false on real stat errors.
- C implies both observations are Some(true), since danglingStubShape239
  requires those two exact values and the contents call is behind that result387.
- If both paths are present, **all nine sequential observation pairs** are
  supported by the stat interface and source call order. A successful target
  stat says nothing about the later parent snapshot after concurrent removal.
  No lock, transaction, filesystem snapshot or retry couples the calls. Their
  distinct statuses are observations, not a simultaneous parent/child theorem.

Permission errors are possible on a known path and may affect only a nested
Git path, only the later parent probe, or both. Other errors such as TimedOut/
Unknown also map to U. E/M has a concrete valid timeline: target exists for
its stat, an external actor removes/renames the containing repository, then
parent stat returns NotFound. Changing permissions/removing the parent between
calls similarly witnesses E/U and U/M. M/E is ordinary missing child/existing
parent. No physical filesystem experiment or deletion is necessary to preserve
these allowed observations. Existing race fixtures at tmpfs-reap.test.ts527–
548,554–580,586–616 and772–808 explicitly vary services across successive calls;
the pure source contract does not promise a quiescent filesystem.

All72 tuples can be mechanically enumerated. Applying only the four source
implications above leaves exactly14. A private probe runs copies of the actual
source functions on a fallible in-memory FileSystem and produces every one of
those14. It is supporting source-behavior proof, not a new public acceptance
rule invented from a permissive mock. The sequential filesystem API, source
order and temporal witnesses establish why its response schedules are valid.

## Private execution proof and its limits

Private directory: `~/.cache/beep/boolean-creep/r28-tmpfs-observation-owner/`.
Files: probe.ts, extraction.json, results.json. The executable source spans are
TmpfsReap.ts61–69,142–148,165–268,373–397. Source SHA-256 is asserted before
extraction. Only an observations.push before the final return is injected to
record the five local values; no original branch or call is changed. Two
irrelevant type aliases are erased to string in the runtime-only harness;
actual Option/Boolean return annotations and function bodies remain copied.

The installed-runtime command was:

```sh
~/.local/share/mise/installs/bun/1.4.2/bin/bun ~/.cache/beep/boolean-creep/r28-tmpfs-observation-owner/probe.ts
```

It exited0. The final output was:

```text
private source-extraction proof OK: 72/14; 14 unique actual local tuples; stat call order and lazy contents gate preserved; 11 non-NotFound error variants return None; 7 dangling projections / 13 full candidate states / 6 old pair projections
```

Assertions check full resolved path payloads, root/path/idle timestamp, exact
Git-stat-before-parent-stat order, omitted stat calls for absent paths, and no
contents call unless both observations are Some(true). Eleven non-NotFound
PlatformError variants, including BadArgument, preserve None. File.Info is a
private fixture with the only fields the captured code reads (type/size); the
probe makes no claim to type-check arbitrary File.Info models. No package
suite, real filesystem service, process runner, Git operation or live janitor
is imported/executed. Only the private proof files are written.

The14-case proof was first run for local cardinality, then extended and rerun
to assert preserved full payloads and candidate projection arithmetic. Both
runs exited0; the final file hashes below bind the extended run. Candidate
constructor cases outside the14 captured dangling executions are obtained from
the inspected exact static writers, not claimed to have executed in the probe.

## Downstream DiscoveredCandidate: why26/6 is a projection

The named actual type61–69 also owns reapClass (the six literals declared in
TmpfsReap.schemas.ts34–41) and parentRepo:Option<string>. Both correlate with
the pair already admitted as26/6. Complete same-file writers are the ones in
the current design: Git worktrees286–295, Vitest367–369, dangling373–397,
escaped root/path419–427/452–460, and head-install/fallow/scoped512–536.
There is no alternate constructor taking arbitrary classified/reason/parent
values; only public runTmpfsReap/resolveBeepCacheRoot are exported from this file.

The full finite product is **6 ×2 ×(1+12) ×2 =312**. Its13 supported rows are:

| reapClass | classified | shapeSkipReason | parentRepo |
| --- | --- | --- | --- |
| git-worktree | true | None | Some(path) |
| git-worktree | false | None | None |
| head-install | true | None | None |
| fallow-cache | true | None | None |
| scoped-temp | true | None | None |
| vitest-forks-tmp | true | None | None |
| dangling-worktree-stub | true | None | Some(path) |
| dangling-worktree-stub | false | gitdir-target-exists | None |
| dangling-worktree-stub | false | gitdir-target-exists | Some(path) |
| dangling-worktree-stub | false | parent-repo-present | Some(path) |
| dangling-worktree-stub | false | wrong-shape | None |
| dangling-worktree-stub | false | wrong-shape | Some(path) |
| dangling-worktree-stub | false | contents-present | Some(path) |

Git worktree classified is literally O.isSome(parentRepo)293, so its false/None
pair cannot carry a parent. Four non-Git cache/temp families always omit parent.
Dangling parent-repo-present and contents-present require known parent; unknown
status on known parent can still produce wrong-shape with a retained full path.
Git target existence can be observed with an unrecognized parent prefix, so
both parent-presence states of that reason are legal. Escaped-path producers
add wrong-shape/None already in the table. These thirteen rows project to
exactly the six classification/reason states the independent correction proved.
No old raw/correction arithmetic is rewritten; its selected-pair finding remains
historical truth. Its omitted connected fields require this full-owner repair.

Required root/path/idle timestamp are payloads, not extra axes. The three
other public skip families/liveness counts/application outcomes are separate
owners. The twelve public skip reasons remain unchanged; no private literal
restriction is imposed on historical public reports.

## Complete consumers and non-overlapping migration credit

The local five values have no external writers or consumers. Source helpers
177–230 form the path/observation boundary; both callers462 and985 receive
only DiscoveredCandidate. Initial discovery and immediate pre-removal
rediscovery both execute the same function. Existing second contents check850,
nonrecursive .git removal855, guarded rmdir, parent-container check and warnings
remain independent safety operations.

DiscoveredCandidate is private; MeasuredCandidate94 nests it. Complete live
consumer groups are path identity108, lock/liveness665–689, dirty worktree692–
725, threshold/classification/state739–788, nested head-install release817–841,
directory/dangling/Git removal844–958, containment961–974, rediscovery978–988,
apply991–1014, report projection1016–1033 and discovery aggregation1214–1278.
All original consumer/source maps from the current candidate design are reused.
The public RepoRun test kit and internal barrel expose the run function and
public report schemas, not the private type/locals. Quality and Yeet readers
consume unchanged reports; they do not construct these internal states.

| Actual old site | Sole design owning its replacement/deletion |
| --- | --- |
| optionalStatIsMissing226–230 and local path/stat Option coordination379–385 | New72/14 local observation design |
| gated contents temporary/ternary387 | New72/14 local observation design; retain laziness and every safety probe |
| danglingStubShape239–245 classified/firstSome/normalization and final pair writes393–394 | Full candidate312/13 design; pure projection from new local observation cases |
| classificationSkipReason739–745 pair precedence | Candidate312/13 |
| candidate parent Option reconstructions696,836,932 and wire projection1030 | Candidate312/13; preserve appropriate unclassified branches and all later filesystem probes |
| final ApplyOutcome/reaped/warning aggregation | Neither; separate existing behavior |

The narrow stat-observation pair alone has all9 combinations and would be D1,
but a separate D1 subset row is redundant inside this full72/14 local cluster.
statIsMissing/optionalStatIsMissing parameters are out of net and single
Option returns are not new Boolean-pair owners. The two input parameters of
danglingStubShape are excluded function inputs. Its local classified and
shapeSkipReason values and returned Pick are covered constructor mechanics of
the canonical candidate family: the temporary local reason is always Some
(before the returned classified arm replaces it with None). In particular,
true/Some(wrong-shape) is the legal temporary tuple for M/M; it is not a malformed
candidate or an additional output state. Do not borrow the output's tuple table
for that temporary pair or create a duplicate helper-copy record. The candidate
design removes that entire construction once; the local design receives no
extra credit for it. This is the explicit covered disposition requested by
the bounded follow-up.

## Proposed exact rows

These two rows are native P2 proposals, not writes to canonical inventory or
new independent P3 findings. The new ID has no prior row; the candidate stable
ID retains its lineage with expanded members/count and a complete provisional.
Keep the old dotted-field withdrawal. No D1 subset/helper-copy row is added.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-tmpfs-stub-observations","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":379,"symbol":"discoverDanglingWorktreeStub","kind":"sibling-state","members":["gitDir","parentRepo","gitDirMissing","parentRepoMissing","contentsAreExact"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":226},"note":"Each actual Option path owns a matching Option<boolean> observation: absent path forces None; present path can yield None on non-NotFound errors, Some(false) on success or Some(true) on NotFound. The converse absence inference is invalid."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":380},"note":"parentRepo is flatMapped from gitDir, so present parent implies present Git target path. Both path/status calls remain ordered at384-385."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":387},"note":"Contents are probed only after both actual stat observations are Some(true), through classifier239. Full five-local product is72/14, including all nine independent sequential known-path stat pairs and both contents outcomes only for missing/missing."}],"cardinality":{"representable":72,"legal":14},"storage":"derived","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"New actual local owner; no dotted shape field or required-payload axis. Preserve full normalized paths, unknown stat versus absent path, call order, lazy contents inspection, initial/rediscovery behavior and all error/safety contracts. Private source-extraction proof executes all14 legal local tuples and eleven non-NotFound error categories; it is not P3. Coordinate atomically with the full DiscoveredCandidate312/13 design; count helper/final classification guard deletion only there. Audit: data/design-refresh-2026-09-09-r28-tmpfs-observation-owner.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-cli-internal-root-tmpfs-discovered-classified-skip","file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":65,"symbol":"DiscoveredCandidate","kind":"type-literal","members":["reapClass","classified","shapeSkipReason","parentRepo"],"status":"designed","evidence":[{"class":"E3","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":293},"note":"Git-worktree constructor makes classified exactly parentRepo presence, always with no shape reason; recognized/unrecognized parent are separate supported states."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts","line":373},"note":"Complete dangling producer emits seven class/reason/parent-presence states: classified with parent, existing Git target with/without recognized parent, parent-present with parent, wrong-shape with/without parent, and contents-present with parent. Stat errors preserve unknown observations and retained known parent paths."}],"cardinality":{"representable":312,"legal":13},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Expand the existing selected-pair26/6 row to its complete connected class/Boolean/reason/parent owner312/13. Preserve prior correction and current design history; this is native P2 full-owner repair, not another independent correction. All13 exact source tuples preserve root/path/idle payloads and public report omission. New local72/14 observation owner is separate; helpers239-245/final pair393-394/classification739-745 are candidate-only guard credit. No changes to public six classes, twelve reasons, JSON, liveness, revalidation or destructive safety behavior. Audit: data/design-refresh-2026-09-09-r28-tmpfs-observation-owner.md."}
```

## Exact row and immutable handoff hashes

| Record/artifact | SHA-256 |
| --- | --- |
| Current candidate row (exact UTF-8 line excluding LF) | `b5d402e22d5e0fab6e9c910cdecf03145ecc160e5f7a349c7fe103b2e0dcf977` |
| Withdrawn dotted-field row captured in prior audit | `73a3a7b82f7cebfcd19531ba19622c190b2a09a9f5757c9a87190bdf892c86f8` |
| packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts | `2a0253141d3ebdadfbe6b8d715012b83cb75c36876ec50969e330e2f03a5da01` |
| packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.schemas.ts | `bad39e4279d1f1b9c0f6773a7645bd5b3fb31654209e312a4116066b7ea15b08` |
| packages/tooling/tool/cli/src/internal/repo-run/index.ts | `8700650d67f60eeebdbc9830b1f47c415fcd80d26b2d51e0c6d0b4314079934a` |
| packages/tooling/tool/cli/src/test/RepoRun.test-kit.ts | `88affd301f15a26a60bc1aa7d9fc6bb6a43dab0fcfb35a437ab6d28a6e5f5f8f` |
| packages/tooling/tool/cli/test/tmpfs-reap.test.ts | `ab3db06585ab6baab7d17e42b3f5a705edb089d7a555111304eb17910ddbaece` |
| packages/tooling/tool/cli/test/quality-tmpfs-render.test.ts | `670c08e3ea32a7b17651e72422a4bf6c8eed1b77dab64e3588e58a6a29b19219` |
| packages/foundation/modeling/utils/src/Option.ts | `9058fcd6349a90f2ae7949250d5e6a1a324c2b140ada7d0f0cfe78e6b1d549c1` |
| .repos/effect/packages/effect/src/FileSystem.ts | `b9e289a8a0d18d04879d0fb507c2ad342aaaf8b9b01cff0cd0acae9cd23fba17` |
| .repos/effect/packages/effect/src/PlatformError.ts | `d0864c39319b0da62dec6445e5eb85ebceb8570b2f93c9bd3a68f011e1d31f45` |
| .repos/effect/packages/effect/src/Schema.ts | `0f0daf6b6ec3b6c827083d8b76278a4f52fe48a636dfff031ddf18e6c93f82ad` |
| node_modules/effect/src/FileSystem.ts | `ace43cfd791f76d2362542cee2dbb6b6ee41de1b2375859a0dfbf8eed2dee933` |
| node_modules/effect/src/Option.ts | `db5876bc08e213e95575ab0d1a71f6a2db0a5fe0e00f90f8fa6f828a039b71eb` |
| goals/boolean-creep/designs/r28-cli-internal-root-tmpfs-discovered-classified-skip.md | `c1ddb1622ff1ff463991776f626cf7db0ace88b0b5595372f583a68f6c161003` |
| goals/boolean-creep/data/provisional-r28-cli-internal-root-tmpfs-discovered-classified-skip.md | `0903cb070e291370efc2f5533dc33fd60f3c4c439b79d670136782ce366c9071` |
| goals/boolean-creep/data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md | `f0a8e217edde77b97effcb6c03444d77c55ab23944eb009a5c428f497f2c898e` |
| goals/boolean-creep/data/r28-cli-first-owners-integration.json | `0cba2cf0c46b2662f3d3a1463bd654c615391acaf4d340aec6325bc18f43f869` |
| goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-cli-internal-contract-correction1.jsonl | `b20deb9984bd19e9b424c40e3b052d9ef46c74cf314b33fefdd5bfcffa7db75d` |
| goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-cli-internal-contract-correction1.execution.json | `da96d560e91a02e3cbfc135b5dd6ef81f8ecbe505a17804db709c1d5401fd6ed` |

## Private proof artifact hashes

| Private cache path | SHA-256 |
| --- | --- |
| ~/.cache/beep/boolean-creep/r28-tmpfs-observation-owner/probe.ts | `3489c53a5092548c846224dd0b206ded03803522327a3db857ad9591a0aa682f` |
| ~/.cache/beep/boolean-creep/r28-tmpfs-observation-owner/extraction.json | `59e82d32e706a4ead5decd1c54658b7fc77b69f7e1b6805a35564ffe97dc63c5` |
| ~/.cache/beep/boolean-creep/r28-tmpfs-observation-owner/results.json | `3a1f782d2032ddfed4eeea02917a8144b0af56f46ad7d1666032029f94e62fa7` |

## Validation boundary

Source, tests and Effect contract files were read only. The only execution was
the authorized private installed-runtime proof and documentation validation.
No real filesystem model was mutated by the proof. Parent must independently
review and integrate the two full designs before any application. Graft was
used first and saved approximately12,080 tokens in this bounded follow-up.

## Final documentation validation and freeze manifest

The private documentation validation completed with exit0. It checked all eight
exact required section names once in each provisional, parsed both proposed
JSONL rows, checked evidence classes/citation bounds and member uniqueness,
verified all21 listed source/reference/prior-artifact/private-proof hashes, and
compared all seven listed repository source/test files byte-for-byte with frozen
HEAD through read-only `git show`. The private results still assert72/14,
312/13 and the old six-state pair projection. No source or current artifact was
modified by those checks.

The canonical row read at validation still has the exact candidate hash above;
the new local ID is absent. The parent has now removed the old dotted-field row.
The only other three current TmpfsReap.ts rows are separate disqualified
FileSystem removal-option objects (marker, directory and fallow extras). None
duplicates these owners. No redundant helper/stat-subset row is proposed.
The prior36-ID audit and original independent correction hashes also match.

Both drafts explicitly require a coordinated Tier1E landing. The candidate
outer union names the local `S.toTaggedUnion("reapClass")` API at Effect
Schema.ts6105-6175; nested private subfamilies use `S.TaggedUnion` and `_tag`.
The evidence labels use actual E3/E4 laws; fixed constructor assignments are
support for the complete table, not an unsupported E1 exclusive-write claim.

| Final data artifact | Lines | SHA-256 |
| --- | --- | --- |
| data/provisional-r28-tmpfs-stub-observations.md |173| `585b81cdaed784f14400cca828cadd79195f3e5ba3987e08bd6ed70b5e826a3a` |
| data/provisional-r28-tmpfs-discovered-candidate-full-owner.md |209| `5d61ab7da52d0e462196bc9687e854be980ace2b508a8b9219092f4f0d4e00a2` |

Exact proposed-row hashes are SHA-256 of each JSONL line's UTF-8 bytes excluding
the linefeed, before parent status advancement or other canonical integration:

| Proposed ID | SHA-256 |
| --- | --- |
| r28-cli-internal-root-tmpfs-stub-observations | `681063165966582354ea033408293dc6a74dbb1e8bb47a9185b1614e9b1250f5` |
| r28-cli-internal-root-tmpfs-discovered-classified-skip | `cc5186e0bb0f4adc4c8dc557592ba85a43494afea3f9a0efbe0c09c515327f00` |

Private validation receipt:
`~/.cache/beep/boolean-creep/r28-tmpfs-observation-owner/documentation-validation.json`,
SHA-256 `e300c24807801fcd9143b75852080053b75d06e8356e6331607f75513819f459`.
This closes the bounded source follow-up. No further rescan, implementation or
independent correction was performed or requested by this handoff.
