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
import { dual } from "effect/Function";
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
 * **Example** (Read the scanned goals directory)
 *
 * ```ts
 * import { GOALS_DIR } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * console.log(GOALS_DIR) // "goals"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOALS_DIR = "goals";

/**
 * Scaffold directory excluded from every packet scan.
 *
 * **Example** (Read the excluded scaffold slug)
 *
 * ```ts
 * import { TEMPLATE_SLUG } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * console.log(TEMPLATE_SLUG) // "_template"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TEMPLATE_SLUG = "_template";

/**
 * One scanned goal-packet directory with its raw surface texts.
 *
 * **Details**
 *
 * `manifestText` and `readmeText` are absent when the file does not exist, and `goalMdChars` is
 * absent when the packet has no `GOAL.md` launcher — absence is how a scan reports a missing surface
 * without a second filesystem round trip.
 *
 * **Example** (Record a packet whose surfaces were not read)
 *
 * ```ts
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * const record = GoalPacketRecord.make({
 *   slug: "goals-doctor",
 *   packetPath: "goals/goals-doctor",
 *   manifestPath: "goals/goals-doctor/ops/manifest.json",
 *   readmePath: "goals/goals-doctor/README.md",
 * })
 *
 * console.log(record.manifestText === undefined) // true
 * ```
 *
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

type InventoryScanMode = "permissive" | "strict";

const readOptionalFile = Effect.fn("Goals.readOptionalFile")(function* (filePath: string, mode: InventoryScanMode) {
  const fs = yield* FileSystem.FileSystem;
  const read = fs.readFileString(filePath).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed(O.none<string>())
    )
  );
  return yield* mode === "strict" ? read : read.pipe(Effect.orElseSucceed(O.none<string>));
});

const readGoalEntries = Effect.fn("Goals.readGoalEntries")(function* (goalsDir: string, mode: InventoryScanMode) {
  const fs = yield* FileSystem.FileSystem;
  const read = fs.readDirectory(goalsDir);
  return yield* mode === "strict" ? read : read.pipe(Effect.orElseSucceed(A.empty<string>));
});

const scanGoalPacket = Effect.fn("Goals.scanGoalPacket")(function* (
  goalsDir: string,
  slug: string,
  mode: InventoryScanMode
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packetPath = path.join(goalsDir, slug);
  const readStat = fs.stat(packetPath).pipe(Effect.asSome);
  const stat = yield* mode === "strict" ? readStat : readStat.pipe(Effect.orElseSucceed(O.none));
  if (O.isNone(stat) || stat.value.type !== "Directory") return O.none<GoalPacketRecord>();

  const manifestPath = path.join(packetPath, "ops", "manifest.json");
  const readmePath = path.join(packetPath, "README.md");
  const manifestText = yield* readOptionalFile(manifestPath, mode);
  const readmeText = yield* readOptionalFile(readmePath, mode);
  const goalMdText = yield* readOptionalFile(path.join(packetPath, "GOAL.md"), mode);
  return O.some(
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
});

const scanGoalPackets = Effect.fn("Goals.scanGoalPackets")(function* (repoRoot: string, mode: InventoryScanMode) {
  const path = yield* Path.Path;
  const goalsDir = path.join(repoRoot, GOALS_DIR);
  const entries = yield* readGoalEntries(goalsDir, mode);
  const slugs = pipe(
    entries,
    A.filter((slug) => slug !== TEMPLATE_SLUG && !Str.startsWith(".")(slug)),
    A.sort(Order.String)
  );
  const records = yield* Effect.forEach(slugs, (slug) => scanGoalPacket(goalsDir, slug, mode), { concurrency: 1 });
  return pipe(records, A.getSomes, A.sort(recordBySlug));
});

/**
 * Scans `goals/` and collects every packet directory with its raw surface texts, sorted by slug.
 *
 * **Details**
 *
 * The `_template` scaffold and hidden editor or tooling directories are excluded, and a missing
 * `goals/` directory yields an empty scan rather than a failure, so the goals commands behave the
 * same in a repository that has no packets yet.
 *
 * **Example** (Scan the current working tree)
 *
 * ```ts
 * import { listGoalPackets } from "@beep/repo-cli/commands/Goals/Inventory"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(listGoalPackets())) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const listGoalPackets = Effect.fn("Goals.listGoalPackets")(function* (repoRoot = ".") {
  return yield* scanGoalPackets(repoRoot, "permissive").pipe(Effect.orElseSucceed(A.empty<GoalPacketRecord>));
});

/**
 * Scans the complete goal fleet while preserving unexpected filesystem failures.
 *
 * **When to use**
 *
 * Use when a writer must prove that every packet was readable before it mutates
 * any fleet state. Missing optional packet files remain represented as absent
 * fields, while directory, stat, and other read failures fail the Effect.
 *
 * **Example** (Build a strict inventory scan)
 *
 * ```ts
 * import { listGoalPacketsStrict } from "@beep/repo-cli/commands/Goals/Inventory"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(listGoalPacketsStrict())) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const listGoalPacketsStrict = Effect.fn("Goals.listGoalPacketsStrict")(function* (repoRoot = ".") {
  return yield* scanGoalPackets(repoRoot, "strict");
});

/**
 * Narrows an unknown value to a plain JSON object, rejecting arrays.
 *
 * **Example** (Separate an object from an array)
 *
 * ```ts
 * import { isJsonRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * console.log(isJsonRecord({ a: 1 })) // true
 * console.log(isJsonRecord([1])) // false
 * ```
 *
 * @param value - Candidate value of unknown shape.
 * @returns Whether the value is a non-array object usable as a JSON record.
 * @category guards
 * @since 0.0.0
 */
export const isJsonRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value);

/**
 * Parses a goal-manifest JSON text without throwing on malformed input.
 *
 * **Details**
 *
 * Parsing is JSONC-tolerant, so comments and trailing commas survive, but the result must still be a
 * JSON object: arrays and scalars are rejected the same way a syntax error is.
 *
 * **Example** (Distinguish valid and invalid manifest text)
 *
 * ```ts
 * import { parseGoalManifestText } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parseGoalManifestText('{ "a": 1 }'))) // true
 * console.log(O.isNone(parseGoalManifestText("nope"))) // true
 * ```
 *
 * @param text - Raw `ops/manifest.json` content.
 * @returns The parsed JSON object, or `None` when the text is not a valid JSON object.
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
 * Extracts the status token from a README `Lifecycle:` line.
 *
 * **Example** (Read a packet's declared lifecycle)
 *
 * ```ts
 * import { readmeLifecycleToken } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(readmeLifecycleToken("Lifecycle: `active`"))) // "active"
 * console.log(O.isNone(readmeLifecycleToken("# Goals Doctor"))) // true
 * ```
 *
 * @param readme - Raw README text.
 * @returns The first `Lifecycle:` token, or `None` when no recognizable line exists, which is the
 * `set-status` refusal condition.
 * @category parsing
 * @since 0.0.0
 */
export const readmeLifecycleToken = (readme: string): O.Option<string> => {
  const match = LIFECYCLE_LINE_PATTERN.exec(readme);
  return match !== null && P.isString(match[2]) ? O.some(match[2]) : O.none();
};

/**
 * Rewrites the README `Lifecycle:` line to a new status token.
 *
 * **Details**
 *
 * The line's original backtick style and any trailing text are preserved, so a status flip is a
 * minimal one-token edit rather than a rewritten line.
 *
 * **Example** (Flip a packet from active to paused)
 *
 * ```ts
 * import { rewriteReadmeLifecycleToken } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * const next = rewriteReadmeLifecycleToken("Lifecycle: `active`", "paused")
 *
 * console.log(O.getOrNull(next)) // "Lifecycle: `paused`"
 * ```
 *
 * @param readme - Raw README text.
 * @param token - Replacement status token.
 * @returns The rewritten README, or `None` when no recognizable line exists.
 * @category formatting
 * @since 0.0.0
 */
export const rewriteReadmeLifecycleToken: {
  (token: string): (readme: string) => O.Option<string>;
  (readme: string, token: string): O.Option<string>;
} = dual(2, (readme: string, token: string): O.Option<string> => {
  const match = LIFECYCLE_LINE_PATTERN.exec(readme);
  if (match === null || !P.isString(match[1]) || !P.isString(match[3])) {
    return O.none();
  }
  const start = match.index;
  const end = start + Str.length(match[0]);
  return O.some(
    `${pipe(readme, Str.slice(0, start))}${match[1]}${token}${match[3]}${pipe(readme, Str.slice(end, Str.length(readme)))}`
  );
});

/**
 * Extracts the H1 title from a packet README.
 *
 * **Example** (Read a packet title for the index)
 *
 * ```ts
 * import { readmeTitle } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(readmeTitle("# Goals Doctor\n"))) // "Goals Doctor"
 * console.log(O.isNone(readmeTitle("no heading here"))) // true
 * ```
 *
 * @param readme - Raw README text.
 * @returns The first `# ` heading text, trimmed.
 * @category parsing
 * @since 0.0.0
 */
export const readmeTitle = (readme: string): O.Option<string> => {
  const match = README_TITLE_PATTERN.exec(readme);
  return match !== null && P.isString(match[1]) ? O.some(Str.trim(match[1])) : O.none();
};

/**
 * Extracts a one-line mission from a README `## Mission` section.
 *
 * **Details**
 *
 * The section's first paragraph is joined into a single line. A missing section, or a joined
 * paragraph longer than 300 characters, yields `None` — that bound is the "cleanly extractable"
 * rule the manifest migration relies on to avoid importing prose it cannot round-trip.
 *
 * **Example** (Lift a mission out of a packet README)
 *
 * ```ts
 * import { readmeMissionLine } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * const readme = "# Title\n\n## Mission\n\nShip the thing.\n\n## Next\n"
 *
 * console.log(O.getOrNull(readmeMissionLine(readme))) // "Ship the thing."
 * ```
 *
 * @param readme - Raw README text.
 * @returns The one-line mission, or `None` when it is not cleanly extractable.
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
 * Flattens a manifest's phases into entries regardless of their wire shape.
 *
 * **Details**
 *
 * Legacy manifests store `phases` as an array, newer ones as a record keyed by phase name. Callers
 * that go through this getter never have to branch on which shape a packet happens to use.
 *
 * **Example** (Count phases on an array-shaped manifest)
 *
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
 *
 * console.log(goalManifestPhases(manifest).length) // 1
 * ```
 *
 * @param manifest - A decoded goal manifest.
 * @returns The phase entries, empty when the manifest declares none.
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
