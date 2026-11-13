# Canonical Digest Owner Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

P1 Implement and P3 Yeet run once per slice; a slice is a pull request. The
exploration's `MAP.md` calls these P0 to P3.

| Slice | Status | First step | Done when |
| --- | --- | --- | --- |
| A, census and proof | done | The first vertical slice: property test of the epistemics encoder against the owner, plus the execution-record seal replay. | Census table tracked; property test covers every candidate; PacketCore and seal replays pass or name their legacy rows. No production code changed. |
| B, owner surface | done | Schema for the prefixed digest in `@beep/schema`, then the `undefined`-member pre-pass in `@beep/jsonc`. | Grammar exported; `ContentDigest` and `SourceTextDigest` derive from it with encoded forms unchanged; refusal table fixed by test. |
| C, swaps | done | Epistemics first (most seal consumers), then PacketCore, then semantica, one commit each. | Each body delegates to the owner; exports unchanged; slice A's tests still green; PartyKey v1 has a parity proof or a pinned row. |
| D, guard | pending | Write the rule against the tree as it stands after C. | Rule active in the lint pass with no exceptions beyond census rows. |

P0 Research settled, before slice A: how many stored PacketCore events the
archive repository holds and whether the replay must cover them; and before
slice C: whether the `@beep/epistemics` to `@beep/jsonc` edge is allowed as
drawn, and whether any caller relies on a coerced value. The answers are the
three decision files dated 2026-11-12.

### Slice A evidence

Done 2026-11-12. No production code changed.

- Census: [`research/encoder-census.md`](./research/encoder-census.md), 157
  rows in three partition files. Four replace-class encoders (the three known
  and the `@beep/md` frontmatter encoder), no legacy row.
- Differential and off-domain tests:
  `packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts`
  and `apps/labs/semantica/test/CanonicalDifferential.test.ts`.
- Replay: `packages/tooling/tool/cli/test/canonical-digest-owner-replay.test.ts`
  (76 of 76 stored packet events) and the new block in
  `packages/execution-authority/domain/test/ExecutionAuthority.test.ts` (four
  golden seals and a property). Zero mismatches.
- Method and counts: [`research/slice-a-evidence.md`](./research/slice-a-evidence.md).

Carried into later slices, from the census:

- Slice B must land the `undefined`-member pre-pass before slice C swaps
  PacketCore: `Goals/Completion.ts` relies on dropped members.
- Slice C adds `@beep/md` frontmatter to its swap list (a `@beep/md` to
  `@beep/jsonc` edge, modeling to modeling) and lists two behaviour changes:
  an unpaired surrogate in a digested string, and nesting past 256 levels,
  both become typed refusals.
- Slice C refreshes the packet event snapshot first if the tree or the
  archive has gained an event.

### Slice B evidence

Done 2026-11-12. No encoder was swapped and no stored value changed.

- Grammar: `Sha256PrefixedDigest` and the codec `Sha256PrefixedDigestFromHex`
  in `packages/foundation/modeling/schema/src/Sha256.ts`. `ContentDigest` and
  `SourceTextDigest` are that schema with their own brand added; a test in
  each package holds the encoded string unchanged.
- Relaxation: `JsoncCanonicalizeOptions` with `omitUndefinedMembers`, default
  off, in `packages/foundation/modeling/jsonc/src/JsoncFingerprint.ts`. It is
  an option of the owner's walk, not a second pass, and all four value entry
  points take it. Reasons are in the decision file dated 2026-11-12.
- Refusal table: the `refusal table` block in
  `packages/foundation/modeling/jsonc/test/JsoncFingerprint.test.ts` fixes
  seventeen input classes with their code and JSON pointer under all three
  option states, plus the nesting cap. A property in `Properties.test.ts`
  holds the option equal to deleting the `undefined` members.

Carried into slice C, from this slice:

- Each swap that must keep the legacy bytes for present-but-unset members
  passes `omitUndefinedMembers`. PacketCore needs it, for
  `packages/tooling/tool/cli/src/commands/Goals/Completion.ts`.
- Two more spellings of the `sha256:` grammar, both regular expressions in
  `@beep/repo-cli`:
  `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.github.ts` and
  `packages/tooling/tool/cli/src/commands/Files/internal/Media.schemas.ts`.
  Derive them from `Sha256PrefixedDigest`
  in the PacketCore commit or its neighbour.
- `@beep/sbom` exports a `Sha256Digest` for the bare 64-character form. It is
  a separate contract ported with that package; record it in the census as
  pinned and leave it.

### Slice C evidence

Done 2026-11-13. Each encoder's body is now the owner, one commit per encoder
so each reverts alone. No stored digest, event file name, seal or parent
chain changed: all 76 stored packet events and the 13 fixture events still
recompute and render back byte for byte, the four golden execution seals and
the W1 `corpusHash` still recompute, after every commit.

| Encoder | `omitUndefinedMembers` | Why |
| --- | --- | --- |
| E1 epistemics `canonicalJson` (`canonicalDetectionJson`, two domain aliases) | no | Inputs are schema wire forms with exact optional keys; nothing relies on a dropped member. |
| E2 PacketCore `canonicalJsonText` | yes | `Goals/Completion.ts` leaves `packetId` and `proposedCloseout` undefined when absent. |
| E3 semantica `canonicalJson` | no | No lab schema encodes a member as undefined. |
| E4 `@beep/md` JSON frontmatter | no | Its input is `S.JsonObject`; the legacy encoder already threw on an undefined member. |

The indented renderer `canonicalJsonTextPretty` stays; its compact branch,
reachable only from the old `canonicalJsonText`, was removed. The two
`sha256:` regular expressions, the GitHub artifact digest in
`packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.github.ts` and
`FileSha256Hash` in
`packages/tooling/tool/cli/src/commands/Files/internal/Media.schemas.ts`,
accepted exactly what `Sha256PrefixedDigest` accepts and are now that schema,
in a commit of their own; a rejected value reports the template-literal
message instead of the pattern message.

PartyKey v1 is not swapped. A test-only commit adds a parity proof to
`packages/party/domain/test/PartyKey.test.ts`: on 200 seeded bases and on
hand-written cases for every escape it writes, its bytes equal the owner's
for the encoded basis, and the owner reproduces the pinned email bytes. The
census row stays pinned.

Dependency edges added: `@beep/epistemics`, `@beep/md` and the semantica lab
depend on `@beep/jsonc` (the lab's moved from devDependency);
`@beep/party-domain` has it as a devDependency. The `@beep/md` import boundary
test exempts `@beep/jsonc/JsoncFingerprint` by name.

#### Behaviour changes (refusal direction only)

Every swapped export now throws the owner's `JsoncCanonicalizeError` (code
and JSON pointer) where the legacy encoder coerced: an unpaired surrogate in a
string or key, nesting past 256 levels, an `undefined` member (except through
PacketCore's option), an `undefined` element or root, `NaN` or an infinity, a
bigint, and a non-plain object such as a `Date`. The exports are synchronous,
so the digest helpers above them keep their `Result` and `Effect` signatures:
the throw escapes `Result.map`, and inside an Effect generator it is a defect.

Where an unpaired surrogate is reachable from a free-text schema field, it
surfaces as follows. No stored value holds one.

| Call site | Free text | Surfaces as |
| --- | --- | --- |
| Contradiction proposal fact, and detection beliefs through the same check (`isBoundedProposalFact`) | the `S.Json` fact | Typed: the bound check now treats a refusal as out of bounds, so decode, `make` and `S.is` fail with the schema's `SchemaError`. |
| `contradictionProposalDigest`, `contradictionCandidateDigest` (detection layer, triage repo, `hasValidSeals`, the tables converter) | proposal `rationale`; ids in bindings that use free strings | Thrown from a `Result`-returning function; a defect in the detection and triage Effects. |
| `detectionProposalId` | the fact, when called without decoding it | Thrown; a defect in the detection layer. |
| `evidenceVerificationManifestationKey`, `manifestationKeyFor`, `hasValidManifestationKey`, the tables converters | anchor `quote`, source refs, `normalizationVersion`, extractor name and version | Thrown from `Result`-returning functions to their callers. |
| `freezeGrantSet`, `verifyFrozenGrantSetDigest` (and `evaluateExecutionRequest`, which calls it) | grant destination, operation, purpose, resource | Thrown; a defect in the tier gate's run freeze and in the egress layer's construction. Values come from gate and egress options. |
| `sealExecutionDecision`, `sealExecutionOutcome` | none: digests, literals and a semantic version | Not reachable. |
| `retentionPayloadBytes` | the edge fact (a record of unknown) | Thrown; a defect in the retention service. Read from a jsonb column, which refuses unpaired-surrogate escapes. |
| retention calibration script | operator JSON | Thrown; the script fails. |
| `packetEventDigest` (writer and `PacketEventStore` read path) | event `actor`, body reasons | A defect, where a digest mismatch would have been a chain issue. Command-line input cannot carry one; a hand-edited event file could. |
| PacketCore plan digests (bootstrap, materialize, graduate, archive, harvest, skills relock and patch, adopt, completion) | plan payload text | A defect in the command's Effect. |
| Lab content ids, digest checks and `manifestHashMatchesRows` | document and model text | A defect, or a throw out of `S.is` and `*Result` decoders: the lab's schema checks call the sync digests, whose `Result` arms do not see the throw. |
| `@beep/md` `render`, `renderHtml` entry points; `renderUnsafe` | frontmatter strings and keys | Typed: `RenderError` with the owner's error as `cause`; `renderUnsafe` throws it. |
| `@beep/skill-contract` `renderSkillMarkdown`, `verifySkillArtifact` | every contract string | Typed: `RenderError` in the render `Result`; verification denies with `rerender-mismatch`. |

Decisions: the seven files dated 2026-11-13.

Carried into slice D:

- The guard rule runs against this tree: no sorted-key JSON encoder remains
  outside `@beep/jsonc` except the census rows classed pinned (PartyKey v1,
  the eyecite parity encoders, the in-source pins), renderer (including
  `canonicalJsonTextPretty`) and outside.
- Open for the orchestrator, not done here: whether free-text fields that
  feed a digest get a well-formedness check at their boundary, or whether the
  digest helpers carry `JsoncCanonicalizeError` in their channels instead of
  throwing. The table above lists every reachable site. The lab's schema checks
  are the ones where a guard can now throw.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add canonical-digest-owner --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/canonical-digest-owner/GOAL.md)" -le 4000
jq . goals/canonical-digest-owner/ops/manifest.json
rg -n "canonical-digest-owner|GOAL.md|agentLaunchers|packetAnchorDocument" goals/canonical-digest-owner
git diff --check -- goals/canonical-digest-owner
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug canonical-digest-owner`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
