/**
 * Pure bootstrap plan compiler and the `beep goals bootstrap --plan` command.
 *
 * **Details**
 *
 * Workstream E phase 0: `--plan` is not a flag on a mutating command — it is
 * the only mode this command has. No function in this module calls a mutating
 * `FileSystem` member; the compiler is a pure total function from a decoded
 * `BootstrapInput` and the observed slug set to a content-addressed
 * `MaterializationPlan`, golden-tested before any writer exists.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, DateTime, Effect } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import {
  BootstrapInput,
  GoalSlug,
  MaterializationPlan,
  PhaseArchetype,
  PlanConflict,
  PlanEntry,
  PlanPreservation,
} from "./Bootstrap.schemas.ts";
import { GoalPlanInputError } from "./Goals.errors.ts";
import { isCapabilitySlug } from "./Goals.schemas.ts";
import { listGoalPackets } from "./Inventory.ts";
import { canonicalJsonText, canonicalJsonTextPretty, sha256Hex } from "./PacketCore/PacketDigest.ts";
import type { PlanMode, PlanOwnership, ValidationRequirement } from "./Bootstrap.schemas.ts";
import type { CapabilitySlug } from "./Goals.schemas.ts";

const COMPLETION_GATE_STATEMENT =
  "Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (bun run beep yeet: repair -> verify -> publish --pr -> monitor).";

const STOP_CONDITIONS: ReadonlyArray<string> = [
  "Required source files are missing or materially contradictory.",
  "The implementation would exceed named scope.",
  "Verification requires unnamed credentials, cost, destructive side effects, or policy approval.",
  "The same blocker repeats after reasonable investigation.",
];

type ArchetypePhase = {
  readonly id: string;
  readonly name: string;
  readonly planGoal: string;
  readonly planExit: string;
};

const YEET_PHASE: Omit<ArchetypePhase, "id"> = {
  name: "Yeet: PR to mergeable",
  planGoal:
    "Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved.",
  planExit: "`mergeStateStatus` is `CLEAN`; zero unresolved review threads.",
};

const CLOSE_PHASE: Omit<ArchetypePhase, "id"> = {
  name: "Close",
  planGoal: "Write the closeout reflection and flip packet state.",
  planExit: "Packet status and evidence are updated; a closeout reflection exists.",
};

const STANDARD_DELIVERY_PHASES: ReadonlyArray<ArchetypePhase> = [
  {
    id: "P0",
    name: "Research",
    planGoal: "Inspect source hierarchy and confirm scope.",
    planExit: "Required facts and blockers are recorded.",
  },
  {
    id: "P1",
    name: "Implement",
    planGoal: "Make the smallest changes that satisfy `SPEC.md`.",
    planExit: "Acceptance criteria are met.",
  },
  {
    id: "P2",
    name: "Verify",
    planGoal: "Run required checks and capture evidence.",
    planExit: "Verification is green or blockers are documented.",
  },
  { id: "P3", ...YEET_PHASE },
  { id: "P4", ...CLOSE_PHASE },
];

const REPORT_FIRST_PHASES: ReadonlyArray<ArchetypePhase> = [
  {
    id: "P0",
    name: "Read-only report",
    planGoal: "Ship the phase-0 read-only report command.",
    planExit: "The report and a false-positive sample land for eyeball review.",
  },
  {
    id: "P1",
    name: "FP eyeball",
    planGoal: "Review the report's false-positive rate before any writer exists.",
    planExit: "The eyeball verdict is recorded and the mutation gate is decided.",
  },
  {
    id: "P2",
    name: "Gated mutation",
    planGoal: "Implement the mutation pass behind the reviewed gate.",
    planExit: "Acceptance criteria are met.",
  },
  { id: "P3", ...YEET_PHASE },
  { id: "P4", ...CLOSE_PHASE },
];

/**
 * Expands one phase archetype into its ordered stable-ID phases.
 *
 * **Example** (Expand the standard archetype)
 *
 * ```ts
 * import { archetypePhases } from "@beep/repo-cli/commands/Goals/Bootstrap"
 *
 * console.log(archetypePhases("standard-delivery").length) // 5
 * ```
 *
 * @param archetype - The archetype to expand.
 * @returns Ordered phase descriptors with stable `P0..Pn` ids.
 * @category mapping
 * @since 0.0.0
 */
export const archetypePhases = (archetype: PhaseArchetype): ReadonlyArray<ArchetypePhase> =>
  PhaseArchetype.is["standard-delivery"](archetype) ? STANDARD_DELIVERY_PHASES : REPORT_FIRST_PHASES;

const manifestPayload = (input: BootstrapInput): string => {
  const packetPath = `goals/${input.slug}`;
  const phases = A.map(archetypePhases(input.archetype), (phase) => ({
    id: phase.id,
    name: phase.name,
    status: "pending",
  }));
  const document = {
    schemaVersion: "initiative-manifest/v2",
    initiative: {
      id: input.slug,
      packetId: `goal-packet/v1:${sha256Hex(`${input.slug}\n${input.today}`)}`,
      title: input.title,
      status: input.status,
      created: input.today,
      updated: input.today,
      packetAnchorDocument: "SPEC.md",
    },
    packetPath,
    lifecycle: input.status,
    mission: input.mission,
    executionCapable: input.executionCapable,
    reflectionRequired: input.reflectionRequired,
    ...(input.provenanceExploration === undefined
      ? {}
      : {
          provenance: {
            exploration: `explorations/${input.provenanceExploration}`,
            graduated: input.today,
          },
        }),
    completionGate: {
      operator: "yeet",
      requiresPullRequest: true,
      requiresMergeable: true,
      statement: COMPLETION_GATE_STATEMENT,
      grandfathered: false,
    },
    currentSourceOfTruth: [
      "AGENTS.md",
      "CLAUDE.md",
      `${packetPath}/README.md`,
      `${packetPath}/SPEC.md`,
      `${packetPath}/PLAN.md`,
      `${packetPath}/GOAL.md`,
      `${packetPath}/research/SOURCES.md`,
    ],
    researchReports: ["research/SOURCES.md"],
    agentLaunchers: [
      {
        kind: "codex-goal",
        path: "GOAL.md",
        targetChars: 3500,
        maxChars: 4000,
        command: `/goal follow the instructions in ${packetPath}/GOAL.md`,
      },
    ],
    provides: input.provides,
    requires: input.requires,
    phases,
    verificationCommands: [
      `test "$(wc -m < ${packetPath}/GOAL.md)" -le 4000`,
      `jq . ${packetPath}/ops/manifest.json`,
      `rg -n "${input.slug}|GOAL.md|agentLaunchers|packetAnchorDocument" ${packetPath}`,
      `git diff --check -- ${packetPath}`,
      "bun run beep lint reflection-artifacts",
    ],
    stopConditions: STOP_CONDITIONS,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
};

const readmePayload = (input: BootstrapInput): string => {
  const firstPhase = A.head(archetypePhases(input.archetype));
  const currentPhase = O.match(firstPhase, {
    onNone: () => "Not started.",
    onSome: (phase) => `${phase.id} ${phase.name} — not started.`,
  });
  return `# ${input.title}

## Status

Lifecycle: \`${input.status}\`

Source: [\`ops/manifest.json\`](./ops/manifest.json)

## Mission

${input.mission}

## Launch

Use this command for execution-capable sessions:

\`\`\`text
/goal follow the instructions in goals/${input.slug}/GOAL.md
\`\`\`

\`GOAL.md\` is the compact launcher. \`SPEC.md\` remains the normative contract.

## Read This First

1. [\`GOAL.md\`](./GOAL.md) - compact \`/goal\` launcher.
2. [\`SPEC.md\`](./SPEC.md) - normative source of truth.
3. [\`PLAN.md\`](./PLAN.md) - active execution plan.
4. [\`ops/manifest.json\`](./ops/manifest.json) - machine-readable routing.
5. [\`research/\`](./research/) - supporting research, if present.
6. [\`history/\`](./history/) - evidence and closeouts, if present.

## Current Phase

${currentPhase}

## Latest Evidence

Not started.

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
`;
};

const goalMdPayload = (input: BootstrapInput): string => `# GOAL: ${input.title}

Repo root: the current working directory — the \`beep-effect\` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: ${input.mission}

This is a compact \`/goal\` launcher. Treat the packet files as the detailed
contract:

- \`goals/${input.slug}/README.md\`
- \`goals/${input.slug}/SPEC.md\`
- \`goals/${input.slug}/PLAN.md\`
- \`goals/${input.slug}/ops/manifest.json\`

Read those first, then read \`AGENTS.md\`, \`CLAUDE.md\`, and any governing
standards named by \`SPEC.md\`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: <paths, packages, docs, workflows, or artifacts this goal may change>.
- Out: <non-goals and areas not to touch>.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies \`SPEC.md\`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   \`history/reflections/<YYYY-MM-DD>-<agent>.md\` via the \`/reflect\` skill;
   \`bun run beep lint reflection-artifacts\` must pass.

Acceptance:

- [ ] \`SPEC.md\` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

\`\`\`sh
test "$(wc -m < goals/${input.slug}/GOAL.md)" -le 4000
jq . goals/${input.slug}/ops/manifest.json
git diff --check -- goals/${input.slug}
\`\`\`

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless \`SPEC.md\` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
`;

const specPayload = (input: BootstrapInput): string => `# ${input.title} Spec

## Objective

${input.mission}

## Non-Goals

- <Out-of-scope behavior, package, workflow, migration, or policy.>

## Source Hierarchy

1. User objective or issue that created this packet.
2. \`AGENTS.md\`, \`CLAUDE.md\`, and required skills.
3. Governing architecture/package standards.
4. This \`SPEC.md\`.
5. \`PLAN.md\`.
6. \`GOAL.md\`.
7. Supporting \`research/\`, \`ops/\`, and \`history/\` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- <Package, app, docs, workflow, or artifact this goal may change.>

## Constraints

- <Hard requirement, boundary rule, compatibility concern, or quality bar.>

## Acceptance Criteria

- [ ] <Observable result that proves the goal is complete.>
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | \`test "$(wc -m < goals/${input.slug}/GOAL.md)" -le 4000\` | Passes |
| Manifest JSON | \`jq . goals/${input.slug}/ops/manifest.json\` | Passes |
| Whitespace | \`git diff --check -- goals/${input.slug}\` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
`;

const planPayload = (input: BootstrapInput): string => {
  const rows = A.map(
    archetypePhases(input.archetype),
    (phase) => `| ${phase.id} ${phase.name} | pending | ${phase.planGoal} | ${phase.planExit} |`
  );
  return `# ${input.title} Plan

## Status

Status: \`pending\`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
${A.join(rows, "\n")}

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the \`/reflect\` skill to
   \`history/reflections/<YYYY-MM-DD>-<agent>.md\`. Its YAML frontmatter must
   validate against \`ReflectionFrontmatter\`.
2. Run \`bun run beep lint reflection-artifacts\`.
3. Update \`README.md\` (status, latest evidence) and \`ops/manifest.json\` phase
   statuses + \`initiative.status\`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep \`SPEC.md\` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under \`history/\`.

## Verification Commands

\`\`\`sh
test "$(wc -m < goals/${input.slug}/GOAL.md)" -le 4000
jq . goals/${input.slug}/ops/manifest.json
rg -n "${input.slug}|GOAL.md|agentLaunchers|packetAnchorDocument" goals/${input.slug}
git diff --check -- goals/${input.slug}
\`\`\`
`;
};

const sourcesPayload = (input: BootstrapInput): string => {
  const provenanceLines =
    input.provenanceExploration === undefined
      ? `- **Source exploration:** none — this goal was authored directly; build the
  corpus during the first research phase.`
      : `- **Source exploration:** \`explorations/${input.provenanceExploration}\` — primary ledger:
  \`explorations/${input.provenanceExploration}/research/SOURCES.md\`.`;
  return `# ${input.title} — Sources & Provenance

${provenanceLines}

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (\`file:line\`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

## 4. In-repo capability references

## 5. Cross-links & provenance
`;
};

/**
 * One plain plan row assembled before schema-class wrapping.
 *
 * **Details**
 *
 * The compilers hash the plain-value projection of a plan (the encoded row
 * shape) before wrapping rows in schema classes, so the content address never
 * depends on class construction details. The alias is derived from
 * {@link PlanEntry}'s encoded side, so it cannot drift from the schema.
 *
 * @category models
 * @since 0.0.0
 */
export type PlanRow = typeof PlanEntry.Encoded;

const createRow = (path: string, ownership: PlanOwnership, reason: string, payload: string): PlanRow => ({
  path,
  action: "create",
  ownership,
  reason,
  payload,
  payloadDigest: sha256Hex(payload),
});

const BOOTSTRAP_VALIDATIONS: ReadonlyArray<ValidationRequirement> = [
  "manifest-decodes",
  "doctor-clean",
  "index-regenerates",
  "readme-lifecycle-line",
  "goal-md-within-budget",
];

/**
 * Plain preservation row assembled before schema-class wrapping.
 *
 * **Details**
 *
 * Derived from {@link PlanPreservation}'s encoded side, so it cannot drift
 * from the schema.
 *
 * @category models
 * @since 0.0.0
 */
export type PreservationRow = typeof PlanPreservation.Encoded;

/**
 * Plain conflict row assembled before schema-class wrapping.
 *
 * **Details**
 *
 * Derived from {@link PlanConflict}'s encoded side, so it cannot drift from
 * the schema.
 *
 * @category models
 * @since 0.0.0
 */
export type ConflictRow = typeof PlanConflict.Encoded;

/**
 * Seals plain plan fields into a content-addressed {@link MaterializationPlan}.
 *
 * **Details**
 *
 * The plan id is the SHA-256 of the compact canonical JSON of every field
 * except the id itself, computed over the plain-value projection the compilers
 * assemble before wrapping rows in schema classes. Both compilers share this
 * one sealing path so bootstrap and adoption plans are addressed identically.
 *
 * **Example** (Seal an empty conflicted plan)
 *
 * ```ts
 * import { sealMaterializationPlan } from "@beep/repo-cli/commands/Goals/Bootstrap"
 *
 * const plan = sealMaterializationPlan({
 *   mode: "bootstrap",
 *   slug: "x-goal",
 *   packetPath: "goals/x-goal",
 *   entries: [],
 *   preservations: [],
 *   validations: [],
 *   conflicts: [{ reason: "slug-exists", message: "exists" }],
 * })
 * console.log(plan.planId.startsWith("goal-plan/v1:")) // true
 * ```
 *
 * @param fields - The plain plan fields, without a plan id.
 * @returns The sealed plan carrying its content address.
 * @category use-cases
 * @since 0.0.0
 */
export const sealMaterializationPlan = (fields: {
  readonly mode: PlanMode;
  readonly slug: string;
  readonly packetPath: string;
  readonly entries: ReadonlyArray<PlanRow>;
  readonly preservations: ReadonlyArray<PreservationRow>;
  readonly validations: ReadonlyArray<ValidationRequirement>;
  readonly conflicts: ReadonlyArray<ConflictRow>;
  readonly towardArchetype?: PhaseArchetype;
  readonly templateSnapshotHash?: string;
}): MaterializationPlan => {
  const preimage = canonicalJsonText({
    schemaVersion: "goal-materialization-plan/v1",
    compilerVersion: "goal-materialization-compiler/v1",
    ...fields,
  });
  return MaterializationPlan.make({
    planId: `goal-plan/v1:${sha256Hex(preimage)}`,
    mode: fields.mode,
    slug: fields.slug,
    packetPath: fields.packetPath,
    entries: A.map(fields.entries, (row) => PlanEntry.make(row)),
    preservations: A.map(fields.preservations, (row) => PlanPreservation.make(row)),
    validations: fields.validations,
    conflicts: A.map(fields.conflicts, (row) => PlanConflict.make(row)),
    ...(fields.towardArchetype === undefined ? {} : { towardArchetype: fields.towardArchetype }),
    ...(fields.templateSnapshotHash === undefined ? {} : { templateSnapshotHash: fields.templateSnapshotHash }),
  });
};

/**
 * Compiles a bootstrap input into a content-addressed materialization plan.
 *
 * **Details**
 *
 * A pure total function: no `Effect`, no `FileSystem`, no requirements
 * channel. The observed slug set is an explicit argument the command handler
 * reads, so a `slug-exists` conflict is data the compiler emits — a conflicted
 * plan carries no entries. Every `create` entry carries its complete payload
 * bytes and digest, matching the ratified contract that the plan is the
 * complete deterministic description of the intended change.
 *
 * **Example** (Compile a minimal plan)
 *
 * ```ts
 * import { compileMaterializationPlan } from "@beep/repo-cli/commands/Goals/Bootstrap"
 * import { BootstrapInput } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const plan = compileMaterializationPlan(
 *   BootstrapInput.make({
 *     slug: "example-goal",
 *     title: "Example Goal",
 *     mission: "Prove the plan compiler.",
 *     today: "2026-08-17",
 *   }),
 *   []
 * )
 * console.log(plan.conflicts.length) // 0
 * ```
 *
 * @param input - The decoded bootstrap input; `today` is explicit, never a clock read.
 * @param existingSlugs - Every packet slug currently under `goals/`.
 * @returns The sealed plan; conflicted plans carry no entries.
 * @category use-cases
 * @since 0.0.0
 */
export const compileMaterializationPlan: {
  (input: BootstrapInput, existingSlugs: ReadonlyArray<string>): MaterializationPlan;
  (existingSlugs: ReadonlyArray<string>): (input: BootstrapInput) => MaterializationPlan;
} = dual(2, (input: BootstrapInput, existingSlugs: ReadonlyArray<string>): MaterializationPlan => {
  const packetPath = `goals/${input.slug}`;
  if (A.contains(existingSlugs, input.slug)) {
    return sealMaterializationPlan({
      mode: "bootstrap",
      slug: input.slug,
      packetPath,
      entries: [],
      preservations: [],
      validations: [],
      conflicts: [
        {
          reason: "slug-exists",
          message: `Packet "${packetPath}" already exists; adopt it instead of bootstrapping over it.`,
        },
      ],
    });
  }

  const entries: ReadonlyArray<PlanRow> = [
    createRow(
      `${packetPath}/ops/manifest.json`,
      "generated",
      "Every byte derives from the input and the archetype.",
      manifestPayload(input)
    ),
    createRow(
      `${packetPath}/README.md`,
      "generated-seed",
      "Written once from input; human-owned immediately after.",
      readmePayload(input)
    ),
    createRow(
      `${packetPath}/GOAL.md`,
      "generated-seed",
      "Written once from mission and scope inputs; human-owned immediately after.",
      goalMdPayload(input)
    ),
    createRow(
      `${packetPath}/SPEC.md`,
      "generated-seed",
      "Written once from input; human-owned immediately after.",
      specPayload(input)
    ),
    createRow(
      `${packetPath}/PLAN.md`,
      "generated-seed",
      "Written once from the archetype phase table; human-owned immediately after.",
      planPayload(input)
    ),
    createRow(
      `${packetPath}/research/SOURCES.md`,
      "generated-seed",
      "Written once from provenance inputs; human-owned immediately after.",
      sourcesPayload(input)
    ),
    createRow(`${packetPath}/research/.gitkeep`, "generated", "Directory marker.", "\n"),
    createRow(`${packetPath}/history/.gitkeep`, "generated", "Directory marker.", "\n"),
    createRow(`${packetPath}/history/reflections/.gitkeep`, "generated", "Directory marker.", ""),
    {
      path: "goals/INDEX.md",
      action: "report",
      ownership: "generated",
      reason:
        "Disposable projection owned by producer://goals/index; regenerate with `bun run beep goals index --write` after publish.",
    },
  ];

  return sealMaterializationPlan({
    mode: "bootstrap",
    slug: input.slug,
    packetPath,
    entries,
    preservations: [],
    validations: BOOTSTRAP_VALIDATIONS,
    conflicts: [],
  });
});

/**
 * Renders a materialization plan as canonical pretty JSON.
 *
 * **Example** (Render a compiled plan)
 *
 * ```ts
 * import { compileMaterializationPlan, renderMaterializationPlanJson } from "@beep/repo-cli/commands/Goals/Bootstrap"
 * import { BootstrapInput } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 * import { Effect } from "effect"
 *
 * const plan = compileMaterializationPlan(
 *   BootstrapInput.make({ slug: "x-goal", title: "X", mission: "Y.", today: "2026-08-17" }),
 *   []
 * )
 * console.log(Effect.isEffect(renderMaterializationPlanJson(plan))) // true
 * ```
 *
 * @param plan - The sealed plan to render.
 * @returns The canonical pretty JSON text with a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderMaterializationPlanJson: (plan: MaterializationPlan) => Effect.Effect<string, S.SchemaError> =
  Effect.fnUntraced(function* (plan: MaterializationPlan) {
    const encoded = yield* S.encodeUnknownEffect(MaterializationPlan)(plan);
    return canonicalJsonTextPretty(encoded);
  });

/**
 * Renders a materialization plan for local human inspection.
 *
 * **Example** (Render headline counts)
 *
 * ```ts
 * import { compileMaterializationPlan, renderMaterializationPlanHuman } from "@beep/repo-cli/commands/Goals/Bootstrap"
 * import { BootstrapInput } from "@beep/repo-cli/commands/Goals/Bootstrap.schemas"
 *
 * const plan = compileMaterializationPlan(
 *   BootstrapInput.make({ slug: "x-goal", title: "X", mission: "Y.", today: "2026-08-17" }),
 *   []
 * )
 * console.log(renderMaterializationPlanHuman(plan).includes("plan-id:")) // true
 * ```
 *
 * @param plan - The sealed plan to render.
 * @returns One line per entry plus headline counts, conflicts, and validations.
 * @category formatting
 * @since 0.0.0
 */
export const renderMaterializationPlanHuman = (plan: MaterializationPlan): string => {
  const entryLines = A.map(
    plan.entries,
    (entry) => `  ${entry.action} [${entry.ownership}] ${entry.path}: ${entry.reason}`
  );
  const preservationLines = A.map(
    plan.preservations,
    (preservation) =>
      `  preserve-keys ${preservation.path}: ${A.join(preservation.unmodeledKeys, ", ")} (pre-image ${preservation.preImageDigest})`
  );
  const conflictLines = A.map(plan.conflicts, (conflict) => `  ${conflict.reason}: ${conflict.message}`);
  return A.join(
    [
      `plan-id: ${plan.planId}`,
      `mode: ${plan.mode} slug: ${plan.slug} packet: ${plan.packetPath}`,
      `entries (${A.length(plan.entries)})`,
      ...entryLines,
      `preservations (${A.length(plan.preservations)})`,
      ...preservationLines,
      `validations: ${A.join(plan.validations, ", ")}`,
      `conflicts (${A.length(plan.conflicts)})`,
      ...conflictLines,
    ],
    "\n"
  );
};

const slugFlag = Flag.string("slug").pipe(Flag.withDescription("New packet slug under goals/ (lowercase, hyphenated)"));
const titleFlag = Flag.string("title").pipe(Flag.withDescription("Human title for the packet"));
const missionFlag = Flag.string("mission").pipe(
  Flag.withDescription("One-line mission shown in the generated goals/INDEX.md")
);
const archetypeFlag = Flag.choice("archetype", PhaseArchetype.Options).pipe(
  Flag.withDefault(PhaseArchetype.Enum["standard-delivery"]),
  Flag.withDescription("Ordered phase shape: standard-delivery (template phases) or report-first")
);
const providesFlag = Flag.string("provides").pipe(
  Flag.optional,
  Flag.withDescription("Comma-separated capability slugs this packet provides (namespace/name)")
);
const requiresFlag = Flag.string("requires").pipe(
  Flag.optional,
  Flag.withDescription("Comma-separated capability slugs this packet requires (namespace/name)")
);
const fromExplorationFlag = Flag.string("from-exploration").pipe(
  Flag.optional,
  Flag.withDescription("Source exploration slug recorded as provenance")
);
const todayFlag = Flag.string("today").pipe(
  Flag.optional,
  Flag.withDescription("Explicit ISO date (YYYY-MM-DD) for deterministic plans; defaults to the current date")
);
const planFlag = Flag.boolean("plan").pipe(
  Flag.withDescription("Compile and print the materialization plan (the only mode this slice ships)")
);
const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Print the plan as canonical JSON"));

const parseCapabilityList = (label: string, raw: O.Option<string>) =>
  Effect.forEach(
    O.match(raw, {
      onNone: A.empty<string>,
      onSome: (text) => A.filter(A.map(Str.split(",")(text), Str.trim), Str.isNonEmpty),
    }),
    (candidate) =>
      isCapabilitySlug(candidate)
        ? Effect.succeed<CapabilitySlug>(candidate)
        : Effect.fail(
            GoalPlanInputError.new(`--${label} entry "${candidate}" is not a namespace/name capability slug.`)
          )
  );

const resolveToday = (raw: O.Option<string>) =>
  O.match(raw, {
    onNone: () => Effect.map(DateTime.now, DateTime.formatIsoDate),
    onSome: (text) =>
      /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? Effect.succeed(text)
        : Effect.fail(GoalPlanInputError.new(`--today "${text}" is not an ISO date (YYYY-MM-DD).`)),
  });

const decodeSlug = (raw: string) =>
  S.decodeEffect(GoalSlug)(raw).pipe(
    Effect.mapError((issue) => GoalPlanInputError.new(`--slug "${raw}" is invalid: ${issue.message}`))
  );

/**
 * Prints a compiled plan and fails closed when it carries conflicts.
 *
 * **Details**
 *
 * The plan is always printed before any failure is raised, so the operator
 * sees the conflicts alongside the non-zero exit — the same report-then-gate
 * shape the knowledge semantic-delta command uses.
 *
 * **Example** (Reference the reporter)
 *
 * ```ts
 * import { reportMaterializationPlan } from "@beep/repo-cli/commands/Goals/Bootstrap"
 *
 * console.log(typeof reportMaterializationPlan) // "function"
 * ```
 *
 * @param plan - The sealed plan to print.
 * @param json - Print canonical JSON instead of the human rendering.
 * @returns Void on a conflict-free plan; a reported non-zero exit otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const reportMaterializationPlan = Effect.fn("Goals.reportMaterializationPlan")(function* (
  plan: MaterializationPlan,
  json: boolean
) {
  if (json) {
    const rendered = yield* renderMaterializationPlanJson(plan).pipe(
      Effect.mapError((issue) => GoalPlanInputError.new(`Failed to encode the plan: ${issue.message}`))
    );
    yield* Console.log(rendered);
  } else {
    yield* Console.log(renderMaterializationPlanHuman(plan));
  }
  if (A.isReadonlyArrayNonEmpty(plan.conflicts)) {
    return yield* failWithReportedExit(`goals ${plan.mode}: ${A.length(plan.conflicts)} conflict(s).`);
  }
});

const runBootstrapPlan = Effect.fn("Goals.runBootstrapPlan")(function* (options: {
  readonly slug: string;
  readonly title: string;
  readonly mission: string;
  readonly archetype: PhaseArchetype;
  readonly provides: O.Option<string>;
  readonly requires: O.Option<string>;
  readonly fromExploration: O.Option<string>;
  readonly today: O.Option<string>;
  readonly plan: boolean;
  readonly json: boolean;
}) {
  if (!options.plan) {
    return yield* GoalPlanInputError.new(
      "Phase 0 ships plan-only commands; pass --plan (no writer exists to omit it for)."
    );
  }
  const slug = yield* decodeSlug(options.slug);
  const provides = yield* parseCapabilityList("provides", options.provides);
  const requires = yield* parseCapabilityList("requires", options.requires);
  // The GoalManifest schema rejects self-cycles; refusing here keeps the plan's
  // own manifest-decodes validation satisfiable by construction.
  const selfCycles = A.intersection(provides, requires);
  if (A.isReadonlyArrayNonEmpty(selfCycles)) {
    return yield* GoalPlanInputError.new(
      `--provides and --requires share ${A.join(selfCycles, ", ")}; a manifest cannot self-cycle a capability.`
    );
  }
  const today = yield* resolveToday(options.today);
  const input = BootstrapInput.make({
    slug,
    title: options.title,
    mission: options.mission,
    archetype: options.archetype,
    provides,
    requires,
    ...(O.isSome(options.fromExploration) ? { provenanceExploration: options.fromExploration.value } : {}),
    today,
  });
  const records = yield* listGoalPackets();
  const plan = compileMaterializationPlan(
    input,
    A.map(records, (record) => record.slug)
  );
  yield* reportMaterializationPlan(plan, options.json);
});

/**
 * `bun run beep goals bootstrap` — compile and print a packet materialization plan.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { goalsBootstrapCommand } from "@beep/repo-cli/commands/Goals/Bootstrap"
 *
 * console.log(goalsBootstrapCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsBootstrapCommand = Command.make(
  "bootstrap",
  {
    slug: slugFlag,
    title: titleFlag,
    mission: missionFlag,
    archetype: archetypeFlag,
    provides: providesFlag,
    requires: requiresFlag,
    fromExploration: fromExplorationFlag,
    today: todayFlag,
    plan: planFlag,
    json: jsonFlag,
  },
  Effect.fn(function* (options) {
    return yield* runBootstrapPlan(options).pipe(
      Effect.catchTag(
        "GoalPlanInputError",
        Effect.fn(function* (error) {
          yield* Console.error(`[goals:bootstrap] ${error.message}`);
          return yield* failWithReportedExit(`goals bootstrap: ${error.message}`);
        })
      )
    );
  })
).pipe(Command.withDescription("Compile the read-only packet materialization plan (--plan --json); no writer exists"));
