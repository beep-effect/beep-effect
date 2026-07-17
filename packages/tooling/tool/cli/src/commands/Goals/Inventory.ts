/**
 * Goal-packet inventory: filesystem scan and README/manifest text helpers.
 *
 * Shared by `beep goals index`, `beep goals doctor`, and
 * `beep goals set-status`: one pass over `goals/<slug>/` collecting manifest,
 * README, and launcher surfaces, plus the pure text helpers that read and
 * rewrite the README `Lifecycle:` status line and extract index metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import { Effect, FileSystem, Order, Path } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import type { ParseError } from "jsonc-parser";
import type { GoalManifest, GoalPhase } from "./Goals.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/Inventory");

/**
 * Repo-relative goals directory scanned by every goals command.
 *
 * @example
 * ```ts
 * import { GOALS_DIR } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * console.log(GOALS_DIR) // "goals"
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const GOALS_DIR = "goals";

/**
 * Scaffold directory excluded from every packet scan.
 *
 * @example
 * ```ts
 * import { TEMPLATE_SLUG } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * console.log(TEMPLATE_SLUG) // "_template"
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const TEMPLATE_SLUG = "_template";

/**
 * One scanned goal-packet directory with its raw surface texts.
 *
 * `manifestText` and `readmeText` are absent when the file does not exist;
 * `goalMdChars` is absent when the packet has no `GOAL.md` launcher.
 *
 * @example
 * ```ts
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * const record = GoalPacketRecord.make({
 *   slug: "goals-doctor",
 *   packetPath: "goals/goals-doctor",
 *   manifestPath: "goals/goals-doctor/ops/manifest.json",
 *   readmePath: "goals/goals-doctor/README.md",
 * })
 * console.log(record.slug)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalPacketRecord extends S.Class<GoalPacketRecord>($I`GoalPacketRecord`)(
  {
    slug: S.String,
    packetPath: S.String,
    manifestPath: S.String,
    readmePath: S.String,
    manifestText: S.optionalKey(S.String),
    readmeText: S.optionalKey(S.String),
    goalMdChars: S.optionalKey(S.Finite),
  },
  $I.annote("GoalPacketRecord", {
    description: "One scanned goal-packet directory with raw manifest/README/launcher surfaces.",
  })
) {}

const recordBySlug = Order.mapInput(Order.String, (record: GoalPacketRecord) => record.slug);

const readOptionalFile = Effect.fn("Goals.readOptionalFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));
});

/**
 * Scan `goals/` and collect every packet directory (excluding `_template`
 * and hidden editor/tooling directories) with its manifest, README, and
 * `GOAL.md` surfaces, sorted by slug.
 *
 * @example
 * ```ts
 * import { listGoalPackets } from "@beep/repo-cli/commands/Goals/Inventory"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(listGoalPackets()))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const listGoalPackets = Effect.fn("Goals.listGoalPackets")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(GOALS_DIR).pipe(Effect.orElseSucceed(A.empty<string>));

  let records = A.empty<GoalPacketRecord>();
  for (const slug of entries) {
    if (slug === TEMPLATE_SLUG || Str.startsWith(".")(slug)) {
      continue;
    }
    const packetPath = path.join(GOALS_DIR, slug);
    const stat = yield* fs.stat(packetPath).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none));
    if (O.isNone(stat) || stat.value.type !== "Directory") {
      continue;
    }
    const manifestPath = path.join(packetPath, "ops", "manifest.json");
    const readmePath = path.join(packetPath, "README.md");
    const manifestText = yield* readOptionalFile(manifestPath);
    const readmeText = yield* readOptionalFile(readmePath);
    const goalMdText = yield* readOptionalFile(path.join(packetPath, "GOAL.md"));

    records = A.append(
      records,
      GoalPacketRecord.make({
        slug,
        packetPath,
        manifestPath,
        readmePath,
        ...optionalProp("manifestText", manifestText),
        ...optionalProp("readmeText", readmeText),
        ...optionalProp("goalMdChars", O.map(goalMdText, Str.length)),
      })
    );
  }

  return A.sort(records, recordBySlug);
});

/**
 * Guard for a plain JSON object (a record that is not an array).
 *
 * @param value - Candidate value.
 * @returns Whether the value is a non-array record.
 * @example
 * ```ts
 * import { isJsonRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * console.log(isJsonRecord({ a: 1 })) // true
 * console.log(isJsonRecord([1])) // false
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isJsonRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value);

/**
 * Parse a goal-manifest JSON text, returning `None` on any parse error.
 *
 * @param text - Raw `ops/manifest.json` content.
 * @returns The parsed JSON object or `None` when the text is not a valid JSON
 * object.
 * @example
 * ```ts
 * import { parseGoalManifestText } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parseGoalManifestText('{ "a": 1 }'))) // true
 * console.log(O.isNone(parseGoalManifestText("nope"))) // true
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const parseGoalManifestText = (text: string): O.Option<unknown> => {
  const errors: Array<ParseError> = [];
  const value: unknown = parse(text, errors);
  return errors.length === 0 && isJsonRecord(value) ? O.some(value) : O.none();
};

const LIFECYCLE_LINE_PATTERN = /^(Lifecycle:[ \t]*`?)([A-Za-z0-9_-]+)(`?.*)$/m;
const README_TITLE_PATTERN = /^#[ \t]+(.+)$/m;
const MISSION_HEADING_PATTERN = /^##[ \t]+Mission[ \t]*$/;
const HEADING_PATTERN = /^#/;
const MISSION_MAX_CHARS = 300;

/**
 * Extract the status token from a README `Lifecycle:` line.
 *
 * @param readme - Raw README text.
 * @returns The first `Lifecycle:` token, or `None` when no recognizable line
 * exists (the `set-status` refusal condition).
 * @example
 * ```ts
 * import { readmeLifecycleToken } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(readmeLifecycleToken("Lifecycle: `active`"))) // "active"
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const readmeLifecycleToken = (readme: string): O.Option<string> => {
  const match = LIFECYCLE_LINE_PATTERN.exec(readme);
  return match !== null && P.isString(match[2]) ? O.some(match[2]) : O.none();
};

/**
 * Rewrite the README `Lifecycle:` line to a new status token, preserving the
 * line's original backtick style and any trailing text.
 *
 * @param readme - Raw README text.
 * @param token - Replacement status token.
 * @returns The rewritten README, or `None` when no recognizable line exists.
 * @example
 * ```ts
 * import { rewriteReadmeLifecycleToken } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * const next = rewriteReadmeLifecycleToken("Lifecycle: `active`", "paused")
 * console.log(O.getOrNull(next)) // "Lifecycle: `paused`"
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const rewriteReadmeLifecycleToken = (readme: string, token: string): O.Option<string> => {
  const match = LIFECYCLE_LINE_PATTERN.exec(readme);
  if (match === null || !P.isString(match[1]) || !P.isString(match[3])) {
    return O.none();
  }
  const start = match.index;
  const end = start + Str.length(match[0]);
  return O.some(
    `${pipe(readme, Str.slice(0, start))}${match[1]}${token}${match[3]}${pipe(readme, Str.slice(end, Str.length(readme)))}`
  );
};

/**
 * Extract the H1 title from a packet README.
 *
 * @param readme - Raw README text.
 * @returns The first `# ` heading text, trimmed.
 * @example
 * ```ts
 * import { readmeTitle } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(readmeTitle("# Goals Doctor\n"))) // "Goals Doctor"
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const readmeTitle = (readme: string): O.Option<string> => {
  const match = README_TITLE_PATTERN.exec(readme);
  return match !== null && P.isString(match[1]) ? O.some(Str.trim(match[1])) : O.none();
};

/**
 * Extract a one-line mission from a README `## Mission` section.
 *
 * Joins the section's first paragraph into one line; returns `None` when the
 * section is missing or the joined paragraph exceeds 300 characters (the
 * "cleanly extractable" bound used by the manifest migration).
 *
 * @param readme - Raw README text.
 * @returns The one-line mission, or `None` when not cleanly extractable.
 * @example
 * ```ts
 * import { readmeMissionLine } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * const readme = "# Title\n\n## Mission\n\nShip the thing.\n\n## Next\n"
 * console.log(O.getOrNull(readmeMissionLine(readme))) // "Ship the thing."
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const readmeMissionLine = (readme: string): O.Option<string> => {
  const lines = pipe(readme, Str.replace(/\r\n/g, "\n"), Str.split("\n"));
  let inMission = false;
  let collected = A.empty<string>();
  for (const line of lines) {
    if (!inMission) {
      if (MISSION_HEADING_PATTERN.test(line)) {
        inMission = true;
      }
      continue;
    }
    const trimmed = Str.trim(line);
    if (HEADING_PATTERN.test(trimmed)) {
      break;
    }
    if (trimmed === "") {
      if (A.isReadonlyArrayNonEmpty(collected)) {
        break;
      }
      continue;
    }
    collected = A.append(collected, trimmed);
  }
  const mission = Str.trim(A.join(collected, " "));
  return mission !== "" && Str.length(mission) <= MISSION_MAX_CHARS ? O.some(mission) : O.none();
};

const isPhaseArray = (
  phases: ReadonlyArray<GoalPhase> | Readonly<Record<string, GoalPhase>>
): phases is ReadonlyArray<GoalPhase> => A.isArray(phases);

/**
 * Flatten a manifest's phases into entries regardless of wire shape
 * (array-shaped or record-shaped `phases`).
 *
 * @param manifest - A decoded goal manifest.
 * @returns The phase entries, empty when the manifest declares none.
 * @example
 * ```ts
 * import { goalManifestPhases } from "@beep/repo-cli/commands/Goals/Inventory"
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "demo", status: "active" },
 *   completionGate: {
 *     operator: "yeet",
 *     requiresPullRequest: true,
 *     requiresMergeable: true,
 *     statement: "Ship via yeet.",
 *     grandfathered: false,
 *   },
 *   phases: [{ status: "pending" }],
 * })
 * console.log(goalManifestPhases(manifest).length) // 1
 * ```
 * @category getters
 * @since 0.0.0
 */
export const goalManifestPhases = (manifest: GoalManifest): ReadonlyArray<GoalPhase> => {
  const phases = manifest.phases;
  if (phases === undefined) {
    return A.empty<GoalPhase>();
  }
  return isPhaseArray(phases) ? phases : R.values(phases);
};
