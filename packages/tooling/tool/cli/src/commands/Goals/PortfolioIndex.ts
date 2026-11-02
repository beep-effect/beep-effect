/**
 * Local generated goals portfolio index (`goals/INDEX.md`).
 *
 * `beep goals index --write` renders one deterministic Markdown index from
 * `goals/<slug>/ops/manifest.json` — grouped by canonical status, one row per
 * packet (slug, title, phases x/y, updated, one-line mission) — and
 * `--check` proves generation and rejects drift when a local copy exists.
 * `--json` prints the same rows, with each packet's phases and status note,
 * as a canonical JSON report for dashboards and other tools.
 * The ignored file is never hand-edited, staged, or linked as tracked GitHub
 * truth; packet manifests remain authoritative.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import { readGoalLifecycle } from "./Completion.ts";
import { decodeGoalManifest, GoalPhase, GoalPhaseStatus, GoalStatus } from "./Goals.schemas.ts";
import { renderCapabilityMermaidSection } from "./Graph.mermaid.ts";
import { compileCapabilityProjection, evaluateCapabilityGraph } from "./Graph.projection.ts";
import { goalManifestPhases, listGoalPackets, parseGoalManifestText, readmeMissionLine } from "./Inventory.ts";
import { canonicalJsonTextPretty } from "./PacketCore/PacketDigest.ts";
import type { GoalManifest } from "./Goals.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/PortfolioIndex");

/**
 * Repo-relative path of the ignored local goals index.
 *
 * **Example** (Read the generated index path)
 *
 * ```ts
 * import { PORTFOLIO_INDEX_PATH } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 *
 * console.log(PORTFOLIO_INDEX_PATH) // "goals/INDEX.md"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PORTFOLIO_INDEX_PATH = "goals/INDEX.md";

const GROUP_TITLES: Readonly<Record<GoalStatus, string>> = {
  active: "Active",
  paused: "Paused",
  "completed-retained": "Completed (retained)",
  superseded: "Superseded",
  reference: "Reference",
};

/**
 * One rendered row of the goals index.
 *
 * **Example** (Build a row for an active packet)
 *
 * ```ts
 * import { PortfolioIndexRow } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 *
 * const row = PortfolioIndexRow.make({
 *   slug: "goals-doctor",
 *   title: "Goals Doctor & Index",
 *   status: "active",
 *   phasesComplete: 1,
 *   phasesTotal: 6,
 * })
 *
 * console.log(`${row.phasesComplete}/${row.phasesTotal}`) // "1/6"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PortfolioIndexRow extends S.Opaque<PortfolioIndexRow, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    title: S.String,
    status: GoalStatus,
    phasesComplete: S.Finite,
    phasesTotal: S.Finite,
    created: S.optionalKey(S.String),
    updated: S.optionalKey(S.String),
    mission: S.optionalKey(S.String),
    statusNote: S.optionalKey(S.String),
    phases: GoalPhase.pipe(S.Array, S.optionalKey),
  }).pipe(
    $I.annoteSchema("PortfolioIndexRow", {
      description:
        "One goals-index row (slug, title, status, phase progress, dates, mission, status note, phase entries).",
    })
  )
) {}

/**
 * Machine-readable goals portfolio, printed by `beep goals index --json`.
 *
 * **Details**
 *
 * Carries the same rows the Markdown index renders, plus each packet's phase entries and status
 * note, sorted by slug. Slugs whose manifest is missing or does not decode are listed in `invalid`
 * instead of being dropped.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { PortfolioIndexReport } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 *
 * const report = PortfolioIndexReport.make({ packets: [], invalid: [] })
 *
 * console.log(report.packets.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PortfolioIndexReport extends S.Opaque<PortfolioIndexReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("goals-portfolio-index/v1"),
    packets: S.Array(PortfolioIndexRow),
    invalid: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("PortfolioIndexReport", {
      description: "Every goal packet's index row plus the slugs whose manifest is missing or invalid.",
    })
  )
) {}

const rowBySlug = Order.mapInput(Order.String, (row: PortfolioIndexRow) => row.slug);

const MISSION_CELL_MAX = 120;

const sanitizeCell = flow(Str.replace(/\|/g, "\\|"), Str.replace(/\s+/g, " "), Str.trim);

const truncateCell = (text: string): string =>
  Str.length(text) <= MISSION_CELL_MAX ? text : `${pipe(text, Str.slice(0, MISSION_CELL_MAX - 1))}…`;

/**
 * Renders the goals index Markdown from prepared rows.
 *
 * **Details**
 *
 * Pure and deterministic: groups follow the canonical status order, rows sort by slug, and no
 * timestamps are embedded, so identical inputs render byte-identical output. That byte-stability is
 * what lets the drift check compare generated and committed content directly.
 *
 * **Example** (Render an index with no packets)
 *
 * ```ts
 * import { renderPortfolioIndex } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 *
 * const content = renderPortfolioIndex([], [])
 *
 * console.log(content.startsWith("# Goals Index")) // true
 * ```
 *
 * @param rows - Prepared index rows, one per decodable packet.
 * @param invalid - Slugs whose manifest is missing or does not decode.
 * @returns The full local `goals/INDEX.md` projection.
 * @category formatting
 * @since 0.0.0
 */
export const renderPortfolioIndex: {
  (invalid: ReadonlyArray<string>): (rows: ReadonlyArray<PortfolioIndexRow>) => string;
  (rows: ReadonlyArray<PortfolioIndexRow>, invalid: ReadonlyArray<string>): string;
} = dual(2, (rows: ReadonlyArray<PortfolioIndexRow>, invalid: ReadonlyArray<string>): string => {
  const sortedRows = A.sort(rows, rowBySlug);
  const counts = A.map(
    GoalStatus.literals,
    (status) => `${A.length(A.filter(sortedRows, (row) => row.status === status))} ${status}`
  );
  const lines: Array<string> = [
    "# Goals Index",
    "",
    "Generated locally by `bun run beep goals index --write` from `goals/*/ops/manifest.json`.",
    "This file is ignored and untracked; edit packet manifests, never this projection.",
    "",
    `${A.length(sortedRows) + A.length(invalid)} packets: ${A.join(counts, " · ")}.`,
  ];

  for (const status of GoalStatus.literals) {
    const groupRows = A.filter(sortedRows, (row) => row.status === status);
    if (!A.isReadonlyArrayNonEmpty(groupRows)) {
      continue;
    }
    lines.push("", `## ${GROUP_TITLES[status]} (${A.length(groupRows)})`, "");
    lines.push("| Packet | Title | Phases | Updated | Mission |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const row of groupRows) {
      const phases = row.phasesTotal > 0 ? `${row.phasesComplete}/${row.phasesTotal}` : "—";
      const updated = row.updated ?? "—";
      const mission = row.mission === undefined ? "—" : truncateCell(sanitizeCell(row.mission));
      lines.push(
        `| [${row.slug}](./${row.slug}/README.md) | ${sanitizeCell(row.title)} | ${phases} | ${updated} | ${mission} |`
      );
    }
  }

  if (A.isReadonlyArrayNonEmpty(invalid)) {
    lines.push("", `## Invalid or missing manifests (${A.length(invalid)})`, "");
    for (const slug of A.sort(invalid, Order.String)) {
      lines.push(
        `- \`${slug}\` — manifest missing or does not decode as GoalManifest; see \`bun run beep goals doctor\`.`
      );
    }
  }

  lines.push("");
  return A.join(lines, "\n");
});

// One lenient pass over every packet feeds both the Markdown index and the JSON report.
const collectPortfolioIndex = Effect.fn("Goals.collectPortfolioIndex")(function* (repoRoot: string) {
  const records = yield* listGoalPackets(repoRoot);
  let rows = A.empty<PortfolioIndexRow>();
  let invalid = A.empty<string>();
  let decoded = A.empty<readonly [string, GoalManifest]>();
  const operativeStatuses: Record<string, GoalStatus> = {};

  for (const record of records) {
    const parsed = record.manifestText === undefined ? O.none() : parseGoalManifestText(record.manifestText);
    if (O.isNone(parsed)) {
      invalid = A.append(invalid, record.slug);
      continue;
    }
    const manifest = yield* decodeGoalManifest(parsed.value).pipe(Effect.asSome, Effect.orElseSucceed(O.none));
    if (O.isNone(manifest)) {
      invalid = A.append(invalid, record.slug);
      continue;
    }
    decoded = A.append(decoded, [record.slug, manifest.value] as const);
    const status = yield* readGoalLifecycle(repoRoot, record.slug, manifest.value);
    operativeStatuses[record.slug] = status;
    const phases = goalManifestPhases(manifest.value);
    const mission = pipe(
      O.fromNullishOr(manifest.value.mission),
      O.orElse(() => pipe(O.fromUndefinedOr(record.readmeText), O.flatMap(readmeMissionLine)))
    );
    rows = A.append(
      rows,
      PortfolioIndexRow.make({
        slug: record.slug,
        title: manifest.value.initiative.title ?? record.slug,
        status,
        phasesComplete: A.length(A.filter(phases, (phase) => GoalPhaseStatus.is.complete(phase.status))),
        phasesTotal: A.length(phases),
        ...optionalProp("created", O.fromUndefinedOr(manifest.value.initiative.created)),
        ...optionalProp("updated", O.fromUndefinedOr(manifest.value.initiative.updated)),
        ...optionalProp("mission", mission),
        ...optionalProp("statusNote", O.fromUndefinedOr(manifest.value.statusNote)),
        phases,
      })
    );
  }

  return {
    rows: A.sort(rows, rowBySlug),
    invalid: A.sort(invalid, Order.String),
    decoded,
    operativeStatuses,
  } as const;
});

/**
 * Builds the machine-readable goals portfolio by reading every packet manifest under a repository root.
 *
 * **Details**
 *
 * Uses the same lenient read as the Markdown index: each row's `status` is the packet's operative
 * lifecycle (a verified proposed closeout counts), and undecodable manifests land in `invalid`.
 *
 * **Example** (Build the report for the current working tree)
 *
 * ```ts
 * import { buildPortfolioIndexReport } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(buildPortfolioIndexReport())) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const buildPortfolioIndexReport = Effect.fn("Goals.buildPortfolioIndexReport")(function* (repoRoot = ".") {
  const { rows, invalid } = yield* collectPortfolioIndex(repoRoot);
  return PortfolioIndexReport.make({ packets: rows, invalid });
});

/**
 * Builds the current goals index content by reading every packet manifest under a repository root.
 *
 * **Details**
 *
 * Packets whose manifest is missing or fails to decode are not dropped: they are collected as
 * invalid slugs and rendered in their own section, so a broken manifest is visible rather than
 * silently absent from the index.
 *
 * **Example** (Build the index for the current working tree)
 *
 * ```ts
 * import { buildPortfolioIndexContent } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(buildPortfolioIndexContent())) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const buildPortfolioIndexContent = Effect.fn("Goals.buildPortfolioIndexContent")(function* (repoRoot = ".") {
  const { rows, invalid, decoded, operativeStatuses } = yield* collectPortfolioIndex(repoRoot);

  // The capability graph uses only manifests whose id matches their directory, so
  // the lenient table and the fail-closed graph never disagree about identity.
  const projection = compileCapabilityProjection(
    pipe(
      decoded,
      A.filter(([slug, manifest]) => manifest.initiative.id === slug),
      A.map(([, manifest]) => manifest)
    ),
    operativeStatuses
  );
  const graph = renderCapabilityMermaidSection(projection, evaluateCapabilityGraph(projection));
  return `${renderPortfolioIndex(rows, invalid)}${graph}\n`;
});

/**
 * Writes the ignored local `goals/INDEX.md` from current manifests.
 *
 * **Example** (Regenerate the local index)
 *
 * ```ts
 * import { writePortfolioIndex } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(writePortfolioIndex())) // true
 * ```
 *
 * @effects Overwrites the ignored local projection at {@link PORTFOLIO_INDEX_PATH}.
 * @category use-cases
 * @since 0.0.0
 */
export const writePortfolioIndex = Effect.fn("Goals.writePortfolioIndex")(function* () {
  const content = yield* buildPortfolioIndexContent();
  yield* writeContainedFileString(".", PORTFOLIO_INDEX_PATH, content);
  return content;
});

const writeFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Write goals/INDEX.md from the current manifests")
);
const checkFlag = Flag.Boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Prove generation and refresh a stale git-ignored local goals/INDEX.md copy in place")
);

const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print every packet's row, phases and status note as canonical JSON")
);

const printPortfolioIndexJson = Effect.fn("Goals.printPortfolioIndexJson")(function* () {
  const report = yield* buildPortfolioIndexReport();
  // The report is built through `PortfolioIndexReport.make`, so encoding it cannot fail; a failure
  // here is a defect, not a reportable command outcome.
  const rendered = yield* S.encodeEffect(PortfolioIndexReport)(report).pipe(
    Effect.orDie,
    Effect.map(canonicalJsonTextPretty)
  );
  yield* Console.log(Str.trimEnd(rendered));
});

const checkPortfolioIndex = Effect.fn("Goals.checkPortfolioIndex")(function* (content: string) {
  const fs = yield* FileSystem.FileSystem;
  const existing = yield* fs
    .readFileString(PORTFOLIO_INDEX_PATH)
    .pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  // The projection is git-ignored workstation state that may carry no authored content: a
  // fast-forward that lands a manifest change leaves the local copy stale, and no hosted lane ever
  // carries the file. A stale copy is therefore rewritten from the projection instead of failing a
  // check that only local runs could ever hit (decision log 2026-09-12). Tracked files are never
  // written here.
  if (O.isSome(existing) && existing.value !== content) {
    yield* writeContainedFileString(".", PORTFOLIO_INDEX_PATH, content);
    yield* Console.log(
      `[goals:index] refreshed stale git-ignored ${PORTFOLIO_INDEX_PATH} from goals/*/ops/manifest.json.`
    );
    return;
  }
  yield* Console.log(
    `[goals:index] OK: projection generated successfully${O.isSome(existing) ? " and the local copy matches" : ""}.`
  );
});

const runGoalsIndex = Effect.fn("Goals.runGoalsIndex")(function* (options: {
  readonly write: boolean;
  readonly check: boolean;
  readonly json: boolean;
}) {
  if (A.length(A.filter([options.write, options.check, options.json], Boolean)) > 1) {
    yield* Console.error("[goals:index] --write, --check and --json are mutually exclusive.");
    return yield* failWithReportedExit("goals index: --write, --check and --json are mutually exclusive.");
  }

  if (options.json) {
    return yield* printPortfolioIndexJson();
  }

  if (options.write) {
    yield* writePortfolioIndex();
    yield* Console.log(`[goals:index] wrote ${PORTFOLIO_INDEX_PATH}.`);
    return;
  }

  const content = yield* buildPortfolioIndexContent();
  if (options.check) {
    return yield* checkPortfolioIndex(content);
  }

  yield* Console.log(content);
});

/**
 * The `beep goals index` subcommand, which generates or verifies the local `goals/INDEX.md`.
 *
 * **Details**
 *
 * Without `--write` the command prints the expected index. With `--check`, it
 * proves generation and compares an existing local copy: the file's absence is
 * accepted and a stale copy is rewritten from the projection, because the file
 * is git-ignored workstation state that no hosted lane carries and that may
 * never hold authored content. `--check` writes nothing tracked. `--json`
 * prints the {@link PortfolioIndexReport} instead and writes nothing.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { goalsIndexCommand } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 *
 * console.log(goalsIndexCommand.name) // "index"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsIndexCommand = Command.make(
  "index",
  { write: writeFlag, check: checkFlag, json: jsonFlag },
  Effect.fn(function* ({ check, json, write }) {
    yield* runGoalsIndex({ write, check, json });
  })
).pipe(
  Command.withDescription(
    "Generate the local goals/INDEX.md from packet manifests, verify a local copy, or print the portfolio as JSON"
  )
);
