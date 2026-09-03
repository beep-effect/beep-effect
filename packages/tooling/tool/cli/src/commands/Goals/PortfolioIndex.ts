/**
 * Local generated goals portfolio index (`goals/INDEX.md`).
 *
 * `beep goals index --write` renders one deterministic Markdown index from
 * `goals/<slug>/ops/manifest.json` — grouped by canonical status, one row per
 * packet (slug, title, phases x/y, updated, one-line mission) — and
 * `--check` proves generation and rejects drift when a local copy exists.
 * The ignored file is never hand-edited, staged, or linked as tracked GitHub
 * truth; packet manifests remain authoritative.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Order } from "effect";
import { dual, flow } from "effect/Function";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import { decodeGoalManifest, GoalPhaseStatus, GoalStatus } from "./Goals.schemas.ts";
import { goalManifestPhases, listGoalPackets, parseGoalManifestText, readmeMissionLine } from "./Inventory.ts";

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
export class PortfolioIndexRow extends S.Class<PortfolioIndexRow>($I`PortfolioIndexRow`)(
  {
    slug: S.String,
    title: S.String,
    status: GoalStatus,
    phasesComplete: S.Finite,
    phasesTotal: S.Finite,
    updated: S.optionalKey(S.String),
    mission: S.optionalKey(S.String),
  },
  $I.annote("PortfolioIndexRow", {
    description: "One rendered goals-index row (slug, title, status, phase progress, updated, mission).",
  })
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
  const counts = GoalStatus.Options.map(
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

  for (const status of GoalStatus.Options) {
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
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(buildPortfolioIndexContent())) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const buildPortfolioIndexContent = Effect.fn("Goals.buildPortfolioIndexContent")(function* (repoRoot = ".") {
  const records = yield* listGoalPackets(repoRoot);
  let rows = A.empty<PortfolioIndexRow>();
  let invalid = A.empty<string>();

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
        status: manifest.value.initiative.status,
        phasesComplete: A.length(A.filter(phases, (phase) => GoalPhaseStatus.is.complete(phase.status))),
        phasesTotal: A.length(phases),
        ...optionalProp("updated", O.fromUndefinedOr(manifest.value.initiative.updated)),
        ...optionalProp("mission", mission),
      })
    );
  }

  return renderPortfolioIndex(A.sort(rows, rowBySlug), A.sort(invalid, Order.String));
});

/**
 * Writes the ignored local `goals/INDEX.md` from current manifests.
 *
 * **Example** (Regenerate the local index)
 *
 * ```ts
 * import { writePortfolioIndex } from "@beep/repo-cli/commands/Goals/PortfolioIndex"
 * import { Effect } from "effect"
 *
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

const writeFlag = Flag.boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Write goals/INDEX.md from the current manifests")
);
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Prove generation and fail when a local goals/INDEX.md copy drifts")
);

const checkPortfolioIndex = Effect.fn("Goals.checkPortfolioIndex")(function* (content: string) {
  const fs = yield* FileSystem.FileSystem;
  const existing = yield* fs
    .readFileString(PORTFOLIO_INDEX_PATH)
    .pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  if (O.isSome(existing) && existing.value !== content) {
    yield* Console.error(
      `[goals:index] local ${PORTFOLIO_INDEX_PATH} drifts from goals/*/ops/manifest.json; run \`bun run beep goals index --write\`.`
    );
    return yield* failWithReportedExit("goals index: INDEX.md drift detected.");
  }
  yield* Console.log(
    `[goals:index] OK: projection generated successfully${O.isSome(existing) ? " and the local copy matches" : ""}.`
  );
});

const runGoalsIndex = Effect.fn("Goals.runGoalsIndex")(function* (options: {
  readonly write: boolean;
  readonly check: boolean;
}) {
  if (options.write && options.check) {
    yield* Console.error("[goals:index] --write and --check are mutually exclusive.");
    return yield* failWithReportedExit("goals index: --write and --check are mutually exclusive.");
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
 * proves generation and compares an existing local copy, while accepting the
 * file's absence because the projection is ignored.
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
  { write: writeFlag, check: checkFlag },
  Effect.fn(function* ({ check, write }) {
    yield* runGoalsIndex({ write, check });
  })
).pipe(Command.withDescription("Generate the local goals/INDEX.md from packet manifests or verify a local copy"));
