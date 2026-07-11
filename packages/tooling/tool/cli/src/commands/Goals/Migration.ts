/**
 * Mechanical goal-manifest status migration (D1/D2 legacy-token mapping).
 *
 * Pure planning engine behind `beep goals set-status --migrate`: maps every
 * legacy status token observed in the 2026-07-11 census
 * (`goals/goals-doctor/research/status-token-census.md`) onto the canonical
 * 5-state domain, normalizes phase statuses, keeps `lifecycle` equal to the
 * canonical status, rewrites README `Lifecycle:` lines, and backfills the five
 * manifest-less packets. Edits are surgical (`jsonc-parser` modifications) so
 * untouched manifest bytes stay untouched, and the whole plan is idempotent:
 * a second run over migrated packets produces zero edits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { applyJsoncModification } from "../../internal/cli/Jsonc.js";
import { optionalProp } from "../../internal/cli/OptionRecord.js";
import { GoalStatus, isGoalPhaseStatus, isGoalStatus } from "./Goals.schemas.js";
import {
  isJsonRecord,
  parseGoalManifestText,
  readmeLifecycleToken,
  readmeMissionLine,
  readmeTitle,
  rewriteReadmeLifecycleToken,
} from "./Inventory.js";
import type { GoalPhaseStatus } from "./Goals.schemas.js";
import type { GoalPacketRecord } from "./Inventory.js";

const $I = $RepoCliId.create("commands/Goals/Migration");

/**
 * Legacy `initiative.status` (and bare top-level `status`) tokens mapped onto
 * the canonical domain, exactly as locked by the P0 census.
 *
 * Canonical tokens are intentionally absent: they map to themselves and never
 * record a `statusNote`.
 *
 * @example
 * ```ts
 * import { GOAL_STATUS_MIGRATIONS } from "@beep/repo-cli/commands/Goals/Migration"
 *
 * console.log(GOAL_STATUS_MIGRATIONS.complete) // "completed-retained"
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_STATUS_MIGRATIONS: Readonly<Record<string, GoalStatus>> = {
  complete: "completed-retained",
  completed: "completed-retained",
  done: "completed-retained",
  DONE: "completed-retained",
  "v1-closed": "completed-retained",
  "phase1-complete": "completed-retained",
  "p0-p6-implemented-runpod-10-packet-evidence-complete": "completed-retained",
  "local-proof-complete": "completed-retained",
  "superseded-reference": "superseded",
  pending: "paused",
  PENDING: "paused",
  "pending-implementation": "paused",
  "bootstrapped-phase-1-pending": "paused",
  implementation_complete_review_pending: "paused",
  local_hardening_and_oip_s3_rename_applied_provider_dns_gates_remaining: "paused",
  "deferred/blocked": "paused",
  "v2-active": "active",
  "active-p3-ready": "active",
  "active-p1d-with-open-p1-windows-proof-debt": "active",
};

/**
 * Legacy phase-status tokens mapped onto the canonical
 * `pending | in-progress | complete` domain (D2).
 *
 * @example
 * ```ts
 * import { GOAL_PHASE_STATUS_MIGRATIONS } from "@beep/repo-cli/commands/Goals/Migration"
 *
 * console.log(GOAL_PHASE_STATUS_MIGRATIONS.seeded) // "pending"
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_PHASE_STATUS_MIGRATIONS: Readonly<Record<string, GoalPhaseStatus>> = {
  completed: "complete",
  done: "complete",
  DONE: "complete",
  PENDING: "pending",
  planned: "pending",
  seeded: "pending",
  gated: "pending",
  in_progress: "in-progress",
  active: "in-progress",
  selected: "in-progress",
};

/**
 * Map a goal status token (legacy or canonical) onto the canonical domain.
 *
 * @param token - Observed status token.
 * @returns The canonical status, or `None` for a token outside every mapping (the
 * park-with-recorded-question condition).
 * @example
 * ```ts
 * import { migrateGoalStatusToken } from "@beep/repo-cli/commands/Goals/Migration"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(migrateGoalStatusToken("complete"))) // "completed-retained"
 * console.log(O.getOrNull(migrateGoalStatusToken("active"))) // "active"
 * console.log(O.isNone(migrateGoalStatusToken("wat"))) // true
 * ```
 * @category mapping
 * @since 0.0.0
 */
export const migrateGoalStatusToken = (token: string): O.Option<GoalStatus> =>
  isGoalStatus(token) ? O.some(token) : R.get(GOAL_STATUS_MIGRATIONS, token);

/**
 * Map a phase status token (legacy or canonical) onto the canonical domain.
 *
 * @param token - Observed phase status token.
 * @returns The canonical phase status, or `None` for a token outside every mapping.
 * @example
 * ```ts
 * import { migrateGoalPhaseStatusToken } from "@beep/repo-cli/commands/Goals/Migration"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(migrateGoalPhaseStatusToken("done"))) // "complete"
 * console.log(O.isNone(migrateGoalPhaseStatusToken("wat"))) // true
 * ```
 * @category mapping
 * @since 0.0.0
 */
export const migrateGoalPhaseStatusToken = (token: string): O.Option<GoalPhaseStatus> =>
  isGoalPhaseStatus(token) ? O.some(token) : R.get(GOAL_PHASE_STATUS_MIGRATIONS, token);

/**
 * The standard completion-gate statement written into backfilled manifests.
 *
 * @example
 * ```ts
 * import { COMPLETION_GATE_STATEMENT } from "@beep/repo-cli/commands/Goals/Migration"
 *
 * console.log(COMPLETION_GATE_STATEMENT.includes("yeet")) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const COMPLETION_GATE_STATEMENT =
  "Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (bun run beep yeet: repair -> verify -> publish --pr -> monitor).";

/**
 * One recorded backfill decision for a manifest-less packet.
 *
 * @example
 * ```ts
 * import { GoalManifestBackfill } from "@beep/repo-cli/commands/Goals/Migration"
 *
 * const backfill = GoalManifestBackfill.make({
 *   slug: "trustgraph-port",
 *   status: "paused",
 *   packetAnchorDocument: "SPEC.md",
 *   grandfathered: false,
 * })
 * console.log(backfill.slug)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalManifestBackfill extends S.Class<GoalManifestBackfill>($I`GoalManifestBackfill`)(
  {
    slug: S.String,
    status: GoalStatus,
    packetAnchorDocument: S.String,
    statusNote: S.optionalKey(S.String),
    grandfathered: S.Boolean,
    grandfatheredNote: S.optionalKey(S.String),
  },
  $I.annote("GoalManifestBackfill", {
    description: "Recorded backfill decision for a manifest-less goal packet (status from README evidence).",
  })
) {}

/**
 * The five backfill decisions locked by the P0 census (status from each
 * packet's README evidence).
 *
 * @example
 * ```ts
 * import { GOAL_MANIFEST_BACKFILLS } from "@beep/repo-cli/commands/Goals/Migration"
 *
 * console.log(GOAL_MANIFEST_BACKFILLS.length) // 5
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_MANIFEST_BACKFILLS: ReadonlyArray<GoalManifestBackfill> = [
  GoalManifestBackfill.make({
    slug: "agentic-cad-patent-tooling",
    status: "reference",
    packetAnchorDocument: "README.md",
    statusNote: "backfilled from README evidence: research complete 2026-05-29 (repo-agnostic buyer's guide)",
    grandfathered: false,
  }),
  GoalManifestBackfill.make({
    slug: "dedup-clone-engine",
    status: "completed-retained",
    packetAnchorDocument: "SPEC.md",
    statusNote: "backfilled from README evidence: V1 complete",
    grandfathered: true,
    grandfatheredNote: "V1 shipped via PRs #180/#183/#187 before the 2026-06-30 completion gate.",
  }),
  GoalManifestBackfill.make({
    slug: "knowledge-workspace",
    status: "active",
    packetAnchorDocument: "SPEC.md",
    statusNote: "backfilled from README evidence: Active",
    grandfathered: false,
  }),
  GoalManifestBackfill.make({
    slug: "repo-codegraph-jsdoc",
    status: "reference",
    packetAnchorDocument: "SPEC.md",
    statusNote: "legacy status: exploratory (backfilled from README evidence)",
    grandfathered: false,
  }),
  GoalManifestBackfill.make({
    slug: "trustgraph-port",
    status: "paused",
    packetAnchorDocument: "SPEC.md",
    statusNote: "legacy status: pending (backfilled from README evidence)",
    grandfathered: false,
  }),
];

const backfillFor = (slug: string): O.Option<GoalManifestBackfill> =>
  A.findFirst(GOAL_MANIFEST_BACKFILLS, (backfill) => backfill.slug === slug);

/**
 * Build the JSON text of a backfilled v2 manifest for a manifest-less packet.
 *
 * @param backfill - The recorded backfill decision.
 * @param readmeText - The packet README, used for title and mission extraction.
 * @returns The manifest JSON text (2-space indent, trailing newline).
 * @example
 * ```ts
 * import { buildBackfillManifestText, GoalManifestBackfill } from "@beep/repo-cli/commands/Goals/Migration"
 * import * as O from "effect/Option"
 *
 * const backfill = GoalManifestBackfill.make({
 *   slug: "trustgraph-port",
 *   status: "paused",
 *   packetAnchorDocument: "SPEC.md",
 *   grandfathered: false,
 * })
 * const text = buildBackfillManifestText(backfill, O.none())
 * console.log(text.includes('"initiative-manifest/v2"')) // true
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const buildBackfillManifestText = (backfill: GoalManifestBackfill, readmeText: O.Option<string>): string => {
  const title = pipe(
    readmeText,
    O.flatMap(readmeTitle),
    O.getOrElse(() => backfill.slug)
  );
  const mission = O.flatMap(readmeText, readmeMissionLine);
  const manifest = {
    schemaVersion: "initiative-manifest/v2",
    initiative: {
      id: backfill.slug,
      title,
      status: backfill.status,
      packetAnchorDocument: backfill.packetAnchorDocument,
    },
    packetPath: `goals/${backfill.slug}`,
    lifecycle: backfill.status,
    executionCapable: false,
    reflectionRequired: false,
    ...optionalProp("statusNote", O.fromUndefinedOr(backfill.statusNote)),
    ...optionalProp("mission", mission),
    completionGate: {
      operator: "yeet",
      requiresPullRequest: true,
      requiresMergeable: true,
      statement: COMPLETION_GATE_STATEMENT,
      grandfathered: backfill.grandfathered,
      ...optionalProp("grandfatheredNote", O.fromUndefinedOr(backfill.grandfatheredNote)),
    },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

/**
 * Planned migration outcome for one goal packet.
 *
 * `manifestText`/`readmeText` are present only when the surface changes;
 * `parked` records the question that blocks a mechanical migration.
 *
 * @example
 * ```ts
 * import { GoalPacketMigration } from "@beep/repo-cli/commands/Goals/Migration"
 *
 * const plan = GoalPacketMigration.make({ slug: "demo", edits: [] })
 * console.log(plan.edits.length) // 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalPacketMigration extends S.Class<GoalPacketMigration>($I`GoalPacketMigration`)(
  {
    slug: S.String,
    edits: S.Array(S.String),
    manifestText: S.optionalKey(S.String),
    readmeText: S.optionalKey(S.String),
    isBackfill: S.optionalKey(S.Boolean),
    parked: S.optionalKey(S.String),
  },
  $I.annote("GoalPacketMigration", {
    description: "Planned mechanical migration outcome for one goal packet.",
  })
) {}

const stringField = (record: Readonly<Record<string, unknown>>, key: string): O.Option<string> =>
  pipe(R.get(record, key), O.filter(P.isString));

const recordField = (
  record: Readonly<Record<string, unknown>>,
  key: string
): O.Option<Readonly<Record<string, unknown>>> => pipe(R.get(record, key), O.filter(isJsonRecord));

const parkedPlan = (slug: string, question: string): GoalPacketMigration =>
  GoalPacketMigration.make({ slug, edits: A.empty<string>(), parked: question });

const slugFromPacketPath = (packetPath: string): string =>
  pipe(
    packetPath,
    Str.split("/"),
    A.last,
    O.getOrElse(() => packetPath)
  );

type ManifestEdit = (path: ReadonlyArray<string | number>, value: unknown, description: string) => void;

const planBackfill = (record: GoalPacketRecord, readmeText: O.Option<string>): GoalPacketMigration =>
  pipe(
    backfillFor(record.slug),
    O.match({
      onNone: () => parkedPlan(record.slug, "manifest missing and no recorded backfill decision in the P0 census"),
      onSome: (backfill) =>
        GoalPacketMigration.make({
          slug: record.slug,
          edits: [`backfill v2 manifest (status ${backfill.status})`],
          manifestText: buildBackfillManifestText(backfill, readmeText),
          isBackfill: true,
        }),
    })
  );

const planInitiativeStatusEdit = (input: {
  readonly record: GoalPacketRecord;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly readmeText: O.Option<string>;
  readonly canonical: GoalStatus;
  readonly edit: ManifestEdit;
}): void => {
  const initiative = recordField(input.manifest, "initiative");
  const initiativeStatus = O.flatMap(initiative, (block) => stringField(block, "status"));
  const bareStatus = stringField(input.manifest, "status");

  if (O.isNone(initiative)) {
    const title = pipe(
      stringField(input.manifest, "title"),
      O.orElse(() => stringField(input.manifest, "name")),
      O.orElse(() => O.flatMap(input.readmeText, readmeTitle)),
      O.getOrElse(() => input.record.slug)
    );
    input.edit(
      ["initiative"],
      { id: input.record.slug, title, status: input.canonical },
      `create initiative block (status ${input.canonical})`
    );
  } else if (O.isNone(initiativeStatus)) {
    input.edit(["initiative", "status"], input.canonical, `set initiative.status ${input.canonical}`);
  } else if (initiativeStatus.value !== input.canonical) {
    input.edit(
      ["initiative", "status"],
      input.canonical,
      `initiative.status ${initiativeStatus.value} -> ${input.canonical}`
    );
  }

  const movedFromBareStatus = O.isNone(initiative) || O.isNone(initiativeStatus);
  if (movedFromBareStatus && O.isSome(bareStatus)) {
    input.edit(["status"], undefined, "remove bare top-level status");
  }
};

const planStatusEdits = (input: {
  readonly record: GoalPacketRecord;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly readmeText: O.Option<string>;
  readonly rawStatus: string;
  readonly canonical: GoalStatus;
  readonly edit: ManifestEdit;
}): void => {
  planInitiativeStatusEdit(input);

  if (input.rawStatus !== input.canonical && O.isNone(stringField(input.manifest, "statusNote"))) {
    input.edit(["statusNote"], `legacy status: ${input.rawStatus}`, "record legacy token in statusNote");
  }

  const lifecycle = stringField(input.manifest, "lifecycle");
  if (O.isSome(lifecycle) && lifecycle.value !== input.canonical) {
    input.edit(["lifecycle"], input.canonical, `lifecycle ${lifecycle.value} -> ${input.canonical}`);
  }
};

const planSupersededByEdits = (manifest: Readonly<Record<string, unknown>>, edit: ManifestEdit): void => {
  const supersededBy = recordField(manifest, "supersededBy");
  if (O.isNone(supersededBy)) {
    return;
  }
  const packetSlug = pipe(
    stringField(supersededBy.value, "packet"),
    O.map(slugFromPacketPath),
    O.getOrElse(() => JSON.stringify(supersededBy.value))
  );
  edit(["supersededBy"], packetSlug, `normalize object supersededBy -> "${packetSlug}"`);
  if (O.isSome(stringField(manifest, "supersededNote"))) {
    return;
  }
  const scope = stringField(supersededBy.value, "scope");
  const date = stringField(supersededBy.value, "date");
  const note = O.map(scope, (scopeText) =>
    pipe(
      date,
      O.match({
        onNone: () => scopeText,
        onSome: (dateText) => `${scopeText} (${dateText})`,
      })
    )
  );
  if (O.isSome(note)) {
    edit(["supersededNote"], note.value, "record supersededBy scope in supersededNote");
  }
};

const planPhaseEntryEdit = (
  entry: Readonly<Record<string, unknown>>,
  path: ReadonlyArray<string | number>,
  label: string,
  edit: ManifestEdit
): void => {
  const status = stringField(entry, "status");
  const mapped = O.flatMap(status, migrateGoalPhaseStatusToken);
  if (O.isSome(status) && O.isSome(mapped) && mapped.value !== status.value) {
    edit(path, mapped.value, `${label}.status ${status.value} -> ${mapped.value}`);
  }
};

const planPhaseEdits = (manifest: Readonly<Record<string, unknown>>, edit: ManifestEdit): void => {
  const phases = R.get(manifest, "phases");
  if (O.isSome(phases) && A.isArray(phases.value)) {
    phases.value.forEach((entry: unknown, index: number) => {
      if (isJsonRecord(entry)) {
        planPhaseEntryEdit(entry, ["phases", index, "status"], `phases[${index}]`, edit);
      }
    });
    return;
  }
  if (O.isSome(phases) && isJsonRecord(phases.value)) {
    for (const key of R.keys(phases.value)) {
      const entry = recordField(phases.value, key);
      if (O.isSome(entry)) {
        planPhaseEntryEdit(entry.value, ["phases", key, "status"], `phases.${key}`, edit);
      }
    }
  }
};

/**
 * Plan the mechanical migration for one scanned packet.
 *
 * Pure: consumes the packet's raw surface texts and returns the edited texts
 * without touching the filesystem. Idempotent: planning an already-migrated
 * packet yields zero edits.
 *
 * @param record - The scanned packet record (manifest/README texts included).
 * @returns The planned migration outcome.
 * @example
 * ```ts
 * import { planGoalPacketMigration } from "@beep/repo-cli/commands/Goals/Migration"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * const plan = planGoalPacketMigration(
 *   GoalPacketRecord.make({
 *     slug: "demo",
 *     packetPath: "goals/demo",
 *     manifestPath: "goals/demo/ops/manifest.json",
 *     readmePath: "goals/demo/README.md",
 *     manifestText: '{ "initiative": { "id": "demo", "status": "complete" } }',
 *   })
 * )
 * console.log(plan.edits.length > 0) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const planGoalPacketMigration = (record: GoalPacketRecord): GoalPacketMigration => {
  const readmeText = O.fromUndefinedOr(record.readmeText);

  if (record.manifestText === undefined) {
    return planBackfill(record, readmeText);
  }

  const originalText = record.manifestText;
  const parsed = parseGoalManifestText(originalText);
  if (O.isNone(parsed)) {
    return parkedPlan(record.slug, "manifest does not parse as JSON");
  }
  const manifest = parsed.value as Readonly<Record<string, unknown>>;
  const rawStatus = pipe(
    recordField(manifest, "initiative"),
    O.flatMap((block) => stringField(block, "status")),
    O.orElse(() => stringField(manifest, "status"))
  );
  if (O.isNone(rawStatus)) {
    return parkedPlan(record.slug, "no status token found on initiative.status or top-level status");
  }
  const canonical = migrateGoalStatusToken(rawStatus.value);
  if (O.isNone(canonical)) {
    return parkedPlan(record.slug, `unmapped status token "${rawStatus.value}" needs a human status decision`);
  }

  let text = originalText;
  let edits = A.empty<string>();
  const edit: ManifestEdit = (path, value, description) => {
    text = applyJsoncModification({ content: text, path, value });
    edits = A.append(edits, description);
  };

  planStatusEdits({ record, manifest, readmeText, rawStatus: rawStatus.value, canonical: canonical.value, edit });
  planSupersededByEdits(manifest, edit);
  planPhaseEdits(manifest, edit);

  if (O.isNone(R.get(manifest, "mission"))) {
    const mission = O.flatMap(readmeText, readmeMissionLine);
    if (O.isSome(mission)) {
      edit(["mission"], mission.value, "backfill one-line mission from README");
    }
  }

  let nextReadme = O.none<string>();
  if (O.isSome(readmeText)) {
    const readmeToken = readmeLifecycleToken(readmeText.value);
    if (O.isSome(readmeToken) && readmeToken.value !== canonical.value) {
      nextReadme = rewriteReadmeLifecycleToken(readmeText.value, canonical.value);
      if (O.isSome(nextReadme)) {
        edits = A.append(edits, `README Lifecycle line ${readmeToken.value} -> ${canonical.value}`);
      }
    }
  }

  return GoalPacketMigration.make({
    slug: record.slug,
    edits,
    ...optionalProp("manifestText", text === originalText ? O.none<string>() : O.some(text)),
    ...optionalProp("readmeText", nextReadme),
  });
};
