# P1 design — `MaterializationPlan` and the pure `--plan` reports

Status: design only; no implementation is authorized by this document.

## Scope and binding doctrine

This is Workstream E, phase 0: implement **only** the pure plan surfaces, then
report `beep goals bootstrap --plan --json` for a representative input and
`beep goals adopt knowledge-surface-automation --plan --json` for this packet.
The report covers proposed paths, ownership classification, preservation
decisions, and validation requirements without writing anything
(`goals/knowledge-surface-automation/SPEC.md:249-257`). Every materializer,
publish path, graduation, rematerialization, and capsule stays blocked until
Benjamin reviews this report — PLAN P4 states the rule explicitly: "E, only
after Benjamin reviews P1's pure-plan report"
(`goals/knowledge-surface-automation/PLAN.md:61-63`).

SPEC ratified the shape: schema-compiled and template-free, a pure
`compileMaterializationPlan` with no filesystem access, golden-tested before any
writes exist, phases as stable-ID child entities, fully generated files beside
fully authored files rather than mixed-ownership regions, and `--plan --json` as
the shared dry-run contract for bootstrap, graduation, adoption, and future
editor tooling (`SPEC.md:219-247`). The load-bearing risk is ownership
misclassification overwriting authored knowledge; the preservation model below
exists to make that risk mechanically visible before a writer exists.

Ground truth: no bootstrap or scaffold command exists today — only
`create-package` for packages and the `/explore` skill for explorations. The
canonical manifest schema, decoder, and legacy compatibility live in
`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts` (now with the
ratified `provides`/`requires` arrays); the packet scan in `Goals/Inventory.ts`;
index generation in `Goals/PortfolioIndex.ts`; and byte-preserving JSONC editing
already ships as `packages/tooling/tool/cli/src/internal/cli/Jsonc.ts`.

## Decided contract

1. `--plan` is not a flag on a mutating command. It is the **only** mode either
   command has in this slice: no `--write`, no `--apply`, no `--force`. A dry-run
   flag on a writing code path is the pattern that historically leaks; a command
   with no writer cannot.
2. `compileMaterializationPlan` is a pure total function from a decoded
   `BootstrapInput` to a `MaterializationPlan` value. It is not an `Effect`, it
   takes no `FileSystem`, and it appears in no requirements channel.
3. Adoption is split in two: an effectful `readPacketSnapshot` that only ever
   calls read members of `FileSystem`, and a pure `compileAdoptionPlan` over the
   resulting `PacketSnapshot` value. The compiler's requirements channel is
   `never` in both modes.
4. The plan is the complete deterministic description of the intended change,
   payload bytes included. That is what makes it golden-testable and what lets a
   later executor replay a reviewed artifact, matching Workstream A's
   `rename --plan` doctrine (`SPEC.md:84-87`).
5. The plan is content-addressed. `planId` is the SHA-256 of the canonical
   encoding of every field except `planId` itself, so an adoption patch is
   hash-pinned and a later executor refuses to apply a plan whose tree moved.
6. **Adopt never re-encodes an existing manifest through the schema codec.** The
   canonical decoder accepts unknown top-level keys and strips them from decoded
   output; encoding a decoded manifest would silently delete them. The pilot
   packet's own manifest carries five such keys. Adoption plans a byte-preserving
   JSONC edit and enumerates every unmodeled key it must preserve, with a digest
   of the pre-image.
7. Adoption plans `create` entries only for artifacts derivable from machine
   inputs. An absent authored artifact is a `report` entry a human resolves —
   diagnosis never mutates, and it never invents prose.
8. Phase 0 changes no existing command. `set-status`'s unknown-slug bypass funnel,
   any new `goals doctor` finding class, and `ops/materialization.json` all wait
   for the executor. A read-only report that adds a doctor finding is a gate.

## Schema sketch (illustrative, not implementation)

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit, Sha256Hex } from "@beep/schema"
import * as S from "effect/Schema"
import { CapabilitySlug, GoalStatus } from "./Goals.schemas.ts"
const $I = $RepoCliId.create("commands/Goals/Bootstrap.schemas")
export const PlanMode = LiteralKit(["bootstrap", "adopt"]).pipe(
  $I.annoteSchema("PlanMode", { description: "Which compiler produced this plan." })
)
export const PlanOwnership = LiteralKit(["generated", "generated-seed", "authored", "preserved"]).pipe(
  $I.annoteSchema("PlanOwnership", { description: "Who owns a path's bytes after materialization." })
)
export const PlanAction = LiteralKit(["create", "retain", "preserve", "report"]).pipe(
  $I.annoteSchema("PlanAction", { description: "What the executor would do to one path." })
)
export const ValidationRequirement = LiteralKit([
  "manifest-decodes", "doctor-clean", "index-regenerates", "links-resolve",
  "reflection-frontmatter-valid", "goal-md-within-budget", "readme-lifecycle-line",
]).pipe($I.annoteSchema("ValidationRequirement", {
  description: "A check the executor must pass against the prospective overlay before publish.",
}))
export const MaterializationPlanId = S.TemplateLiteral(["goal-plan/v1:", Sha256Hex]).pipe(
  $I.annoteSchema("MaterializationPlanId", { description: "Content address of one compiled plan." })
)
export class PlanEntry extends S.Class<PlanEntry>($I`PlanEntry`)({
  path: S.String, action: PlanAction, ownership: PlanOwnership, reason: S.String,
  payload: S.optionalKey(S.String), payloadDigest: S.optionalKey(Sha256Hex),
  existingDigest: S.optionalKey(Sha256Hex),
}, $I.annote("PlanEntry", { description: "One path the plan would create, retain, preserve, or report." })) {}
export class PlanPreservation extends S.Class<PlanPreservation>($I`PlanPreservation`)({
  path: S.String, unmodeledKeys: S.Array(S.String), preImageDigest: Sha256Hex, reason: S.String,
}, $I.annote("PlanPreservation", { description: "Bytes and unmodeled keys adoption must not lose." })) {}
export class MaterializationPlan extends S.Class<MaterializationPlan>($I`MaterializationPlan`)({
  schemaVersion: S.tag("goal-materialization-plan/v1"),
  compilerVersion: S.tag("goal-materialization-compiler/v1"),
  planId: MaterializationPlanId, mode: PlanMode, slug: GoalSlug, packetPath: S.String,
  entries: S.Array(PlanEntry), preservations: S.Array(PlanPreservation),
  validations: S.Array(ValidationRequirement), conflicts: S.Array(PlanConflict),
}, $I.annote("MaterializationPlan", { description: "Deterministic, content-addressed materialization intent." })) {}
```

`GoalSlug` is a constrained `S.String` reusing the lowercase-segment grammar
ratified for `CapabilitySlug` segments (D1), so a slug cannot contain path
separators, traversal, uppercase, or whitespace — traversal is rejected at
decode, not by a downstream guard. `PlanConflict` is a small class carrying a
`LiteralKit` reason (`slug-exists`, `packet-not-found`, `template-slug`,
`manifest-unparseable`, `standard-artifact-absent`) plus a message.

`BootstrapInput` is the decoded command input, and it is where SPEC's
"prompts/defaults come from InitiativeManifest schema annotations" lands: each
field carries its own `title`/`description` annotation, and the flag surface is
derived from those annotations rather than duplicating help text.

```ts
import { Effect } from "effect"
export class BootstrapInput extends S.Class<BootstrapInput>($I`BootstrapInput`)({
  slug: GoalSlug, title: S.String, mission: S.String,
  status: GoalStatus.pipe(S.withConstructorDefault(Effect.succeed("active" as const))),
  archetype: PhaseArchetype, executionCapable: S.Boolean, reflectionRequired: S.Boolean,
  provides: S.Array(CapabilitySlug), requires: S.Array(CapabilitySlug),
  provenanceExploration: S.optionalKey(S.String), today: S.String,
}, $I.annote("BootstrapInput", { description: "Everything the pure compiler needs; no ambient state." })) {}
```

`today` is an explicit input, not a clock read. A compiler that reads the clock
is not a pure function and its golden fixtures rot daily.

`PhaseArchetype` is a `LiteralKit` of `standard-delivery` (the five `_template`
phases: Research, Implement, Verify, Yeet, Close) and `report-first` (the
phase-0-report shape this packet itself uses). Each archetype is a constructor
from archetype to an ordered array of `GoalPhase` values with stable ids
`P0..Pn`, satisfying SPEC's "phases are stable-ID child entities". Explicit
phase lists remain expressible; the archetypes are defaults, not a closed set.

## How `--plan` guarantees zero writes

Four independent arguments, in decreasing strength:

**1. There is no writer to disable.** No function in this slice calls
`fs.writeFileString`, `fs.makeDirectory`, `fs.rename`, or any other mutating
`FileSystem` member. `publishMaterializationPlan` does not exist. The guarantee
is not "the flag is off"; it is "the code is absent".

**2. The compiler has no capability to write.** `compileMaterializationPlan`
returns a plain `MaterializationPlan`, not an `Effect`. `compileAdoptionPlan`
returns `Effect<MaterializationPlan, GoalPlanError, never>` — requirements
`never`. Effect's requirements channel is the type-level statement of what a
computation may do; a compiler that cannot obtain `FileSystem` cannot write,
and that is checked by the compiler on every build rather than asserted in prose.
The only `FileSystem`-requiring code in the slice is `readPacketSnapshot`, whose
entire surface is `readFileString`, `readDirectory`, `exists`, and `stat`.

**3. Reads are separated from compilation by a value boundary.** `PacketSnapshot`
is a decoded schema value — slug, packet path, and the raw text plus digest of
every tracked packet file. Once it exists, adoption is a pure function of a
value, which is what makes the adoption plan golden-testable at all. This is the
shape Workstream C used to make golden fixtures and real archives
indistinguishable to the scanner.

**4. Empirical proof in the suite.** Every plan test asserts
`git status --porcelain` is empty afterwards, and the adoption test compares the
packet's per-file digest set before and after compilation.

The failure mode this stack guards against is a future contributor adding
`--write` to the same handler and reusing the compiler as the write path. The
mitigation is structural: the compiler emits a value carrying payloads and
digests, so the eventual executor is a separate function consuming a reviewed,
hash-pinned artifact, never a branch inside the reporting command.

## `bootstrap --plan` semantics

```text
bun run beep goals bootstrap --slug <slug> --title <t> --mission <m> \
  [--archetype standard-delivery|report-first] [--provides <cap>...] \
  [--requires <cap>...] [--from-exploration <slug>] --plan --json
```

The compiler maps a decoded `BootstrapInput` through archetype constructors to
the full packet, with whole-file ownership everywhere:

| Path | Action | Ownership |
| --- | --- | --- |
| `goals/<slug>/ops/manifest.json` | `create` | `generated` |
| `goals/<slug>/README.md` | `create` | `generated-seed` |
| `goals/<slug>/GOAL.md` | `create` | `generated-seed` |
| `goals/<slug>/SPEC.md` | `create` | `generated-seed` |
| `goals/<slug>/PLAN.md` | `create` | `generated-seed` |
| `goals/<slug>/research/SOURCES.md` | `create` | `generated-seed` |
| `goals/<slug>/research/.gitkeep`, `history/.gitkeep`, `history/reflections/.gitkeep` | `create` | `generated` |
| `goals/INDEX.md` | `report` | `generated` |

`ops/manifest.json` is `generated` because every byte derives from the input and
the archetype; the prose files are `generated-seed` — written once, owned by
humans immediately after, never rematerialized without a three-way merge.
`goals/INDEX.md` is a `report` entry naming `producer://goals/index` and
`bun run beep goals index --write`, because indexes are disposable projections
regenerated after publish, not files the plan owns.

Compilation fails closed with a `PlanConflict` for an existing slug, the reserved
`_template` slug, or a slug that fails the grammar. No partial plan is emitted.

`validations` for a bootstrap plan is the full set: the manifest must decode
through the production `decodeGoalManifest`; `goals doctor` must be clean for the
new packet; the index must regenerate byte-identically from the prospective
overlay; the README must carry a parseable `Lifecycle:` line; and `GOAL.md` must
sit within the 4,000-character budget the doctor already enforces.

## `adopt --plan` semantics and the self-hosting pilot

```text
bun run beep goals adopt <slug> --plan --json
```

The pilot target is this packet — `goals/knowledge-surface-automation` — which
SPEC designates as the first adoption test case precisely because it was
hand-rolled before any bootstrap existed.

`readPacketSnapshot` reads the packet directory through the existing inventory
walk, then `compileAdoptionPlan` classifies every path:

- Every tracked packet file present and conforming → `retain` / `authored`.
- `ops/manifest.json` → `preserve`, with a `PlanPreservation` enumerating the
  unmodeled top-level keys. On the pilot those are `currentSourceOfTruth`,
  `researchReports`, `agentLaunchers`, `verificationCommands`, and
  `stopConditions`; the `_template` also carries `provenance`. These decode-and-
  vanish keys are the concrete evidence for decided contract item 6.
- A standard artifact the packet lacks → `report` / `authored`, never `create`.
  The pilot's `history/reflections/` holds only a `.gitkeep` where `_template`
  also ships `_TEMPLATE.md`; adoption reports that and stops.
- A machine-derivable artifact the packet lacks → `create` / `generated`, which
  in practice means directory markers and, for a manifest-less hand-rolled
  packet, a generated manifest seeded from README-extractable fields.

The expected pilot plan therefore contains **zero authored-file creations**. If
the report shows one, the ownership rules are wrong and the eyeball has done its
job before a writer existed.

The plan's `preservations` array is what a later hash-pinned adoption patch
carries: pre-image digests bind the patch to the exact bytes reviewed, so a
stale patch refuses rather than clobbering.

## Interaction with `beep goals doctor`

Doctor stays the diagnostic; adoption is the remediation *plan*. The relationship
is a mapping, not a merge:

- Every blocking `GoalDoctorFindingKind` maps to at least one
  `ValidationRequirement` the executor must satisfy against the prospective
  overlay: `manifest-missing`/`manifest-invalid` → `manifest-decodes`;
  `lifecycle-mismatch`/`readme-status-line` → `readme-lifecycle-line` and
  `doctor-clean`; `goal-md-oversize` → `goal-md-within-budget`;
  `phases-terminal-but-active` → `doctor-clean`;
  `reflection-frontmatter-invalid` → `reflection-frontmatter-valid`.
- Doctor's committed baseline ratchet is untouched. Adoption neither reads nor
  writes `goals/goals-doctor.baseline.jsonc`; a plan that could shrink a baseline
  would be a mutation with extra steps.
- Doctor gains no `packet-unadopted` finding in phase 0. Adding one would convert
  the read-only report into a gate and would fire on 100+ hand-rolled packets on
  the first run.
- The `set-status` bypass funnel — an unknown slug returning a typed error that
  names the exact bootstrap command — is designed but not wired here, because the
  command it would name cannot yet create anything.

## Test plan

Use the production `GoalManifest`, `decodeGoalManifest`, `listGoalPackets`,
`buildPortfolioIndexContent`, and `applyJsoncModification`; define no weaker test
schemas.

1. **Golden bootstrap plans.** Minimal input, full input with capabilities and
   exploration provenance, and one plan per phase archetype. Byte-compare the
   canonical JSON encoding against committed goldens.
2. **Determinism.** Permuting input field order and recompiling yields an
   identical `planId`. Two compilations in one process yield identical bytes.
3. **Zero-write.** After every plan test, `git status --porcelain` is empty and
   the packet's per-file digest set is unchanged.
4. **Input rejection.** Uppercase slugs, slugs containing `/` or `..`,
   whitespace, the reserved `_template` slug, and an already-existing slug each
   produce a typed error or a `PlanConflict` and no plan entries.
5. **Evergreen pilot adoption.** Discover `goals/knowledge-surface-automation`
   live (the D census pattern, not a hand-copied fixture) and assert: every
   tracked packet file appears exactly once as `retain`; the manifest appears as
   `preserve` with all five unmodeled keys enumerated; zero `create` entries carry
   `authored` ownership.
6. **Preservation counterfactual.** Round-trip the pilot manifest through
   `decodeGoalManifest` then `S.encodeUnknownEffect(GoalManifest)` and assert the
   five unmodeled keys are **lost**. This test exists to prove the naive path
   destroys data, which is the whole justification for the byte-preserving JSONC
   route. A vacuous preservation test that never demonstrates the loss proves
   nothing.
7. **Manifest-less packet.** A synthetic hand-rolled packet with README and SPEC
   but no `ops/manifest.json` plans exactly one generated manifest plus `report`
   rows, and never plans to write the README.
8. **Idempotence and fixed point.** Compiling the pilot plan twice yields the same
   `planId`; compiling against a simulated overlay of that plan yields a plan with
   zero `create` entries. A materialization compiler that is not a fixed point
   will overwrite something on the second run.
9. **Validation exhaustiveness.** Table-driven over `GoalDoctorFindingKind.Options`:
   every blocking member maps to at least one `ValidationRequirement`. New doctor
   findings then fail this test until they are mapped.
10. **Index parity.** For a `retain`-only adoption plan, regenerating
    `goals/INDEX.md` from the prospective overlay produces bytes identical to the
    tracked index — proof that adoption of a conforming packet is inert.
11. **Doctor parity.** Doctor findings before and after plan compilation are
    identical, mirroring the capability slice's parity test.

## Evidence report

`research/p1-report-bootstrap-adopt-plan.md` is the committed FP-eyeball artifact
required by E4. It carries: the exact two commands run and their date; a headline
table for the bootstrap plan (entry counts by action and ownership, validation
set, `planId`); a headline table for the pilot adoption plan (files retained,
manifest keys preserved, artifacts reported, creations — expected zero);
truncated `--json` excerpts of both plans; and annotated false positives.

A false positive here has a precise meaning the report states outright: a
`create` entry that would overwrite authored prose, a `preserve` entry missing an
unmodeled key, or a `report` entry for an artifact the standard does not actually
require. Each annotated sample is labelled with which of the three it would be.

All plan paths are repo-relative by construction, so the report needs no
host-path redaction; any incidental host path quoted from an environment note is
redacted to `<HOME>` placeholders, and the packet's manifest verification grep
remains the standing proof. The eyeball ask is explicit: confirm the ownership
rule table, confirm the pilot's preservation set is complete, and confirm nothing
else blocks the P4 unlock for Workstream E.

## Scope guard

This slice ships two read-only commands and one report. It does **not** ship
`publishMaterializationPlan`, staged same-filesystem publish, no-replace atomic
rename, `beep explore graduate`, the journaled content-addressed transaction, the
maternal-provisioning artifact, `ops/materialization.json`, rematerialization or
capsules, PacketId beacons, `scout --bootstrap`, the `set-status` bypass funnel,
any new doctor finding class, or the lifecycle SKILL.md. Workstream E's mutation
work stays blocked until Benjamin reviews this report — PLAN P4, and E5's
per-workstream unlock rule means this gate is E's alone and blocks nothing else.

## Open questions for the mini-grill

These do not reopen pure compilation, whole-file ownership, the byte-preserving
manifest rule, the content-addressed plan, or the self-hosting pilot target.

1. Annotation-derived flags: does v1 read `BootstrapInput` field annotations off
   the schema to build `Flag` descriptions and defaults, or hand-author the flags
   and treat annotation reflection as a later helper? SPEC ratified the direction;
   the v4 mechanism is what is open.
2. Is there an interactive TTY prompt mode in v1, or is bootstrap flags-only with
   prompting deferred until the executor exists?
3. Does `adopt --plan` also plan the `explorations/` provenance back-link for a
   graduated packet (the inventory found seven asymmetric directed pairs), or does
   that edge belong to Workstream A's reference bus?
4. PacketId beacons: SPEC requires immutable beacons that indexes discover rather
   than a mutated registry. Does the beacon live as a manifest key, a sidecar, or
   the `beep:ref` identity C6 already resolves — and does bootstrap plan one in v1?
5. Is `GOAL.md` `generated-seed` from mission and scope inputs, or fully authored
   from the start given its 4,000-character budget and launcher role?
6. Should a committed adoption patch carry full payload bytes (CI-replayable, large
   diffs) or digests only (small diffs, replay needs recompilation)?
7. `_template` itself drifts. Does `adopt` need `--toward <archetype>` to name
   which standard it is adopting against, so an old packet is not measured against
   a template that changed after it was written?
