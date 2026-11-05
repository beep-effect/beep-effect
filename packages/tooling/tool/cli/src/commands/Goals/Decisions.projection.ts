/**
 * Pure decision-log projection: parse `decisions/*.md`, render the generated
 * block, and splice it into `SPEC.md` / `PLAN.md`.
 *
 * **Details**
 *
 * Nothing here touches the filesystem. Readers hand in file names and text
 * through {@link GoalDecisionReader}; `beep goals doctor` and `beep goals
 * decisions` share this core so the drift check and the writer can never
 * disagree about the expected text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FrontmatterSource } from "@beep/markdown/FrontmatterSource";
import { Frontmatter } from "@beep/markdown/MarkdownNode";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import { optionalProp } from "@beep/repo-cli-kit/cli/OptionRecord";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  GOAL_DECISIONS_DIR,
  GoalDecision,
  GoalDecisionFileInvalid,
  GoalDecisionFileName,
  GoalDecisionFrontmatter,
  GoalDecisionKind,
  GoalDecisionLogReport,
  GoalDecisionProjection,
  GoalDecisionTarget,
} from "./Decisions.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

/**
 * First line of the generated block; everything between it and
 * {@link GOAL_DECISIONS_END_MARKER} is owned by the generator.
 *
 * **Example** (Log the marker)
 *
 * ```ts
 * import { GOAL_DECISIONS_BEGIN_MARKER } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 *
 * console.log(GOAL_DECISIONS_BEGIN_MARKER) // "<!-- beep:decisions:begin -->"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_DECISIONS_BEGIN_MARKER = "<!-- beep:decisions:begin -->";

/**
 * Last line of the generated block.
 *
 * **Example** (Log the marker)
 *
 * ```ts
 * import { GOAL_DECISIONS_END_MARKER } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 *
 * console.log(GOAL_DECISIONS_END_MARKER) // "<!-- beep:decisions:end -->"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_DECISIONS_END_MARKER = "<!-- beep:decisions:end -->";

/**
 * The two projection targets: `decision` files render into `SPEC.md`'s
 * `## Decision log`, `checkpoint` files into `PLAN.md`'s `## Checkpoints`.
 *
 * **Example** (List target documents)
 *
 * ```ts
 * import { GOAL_DECISION_TARGETS } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 *
 * console.log(GOAL_DECISION_TARGETS.map((target) => target.document)) // ["SPEC.md", "PLAN.md"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_DECISION_TARGETS: ReadonlyArray<GoalDecisionTarget> = [
  GoalDecisionTarget.make({ kind: GoalDecisionKind.Enum.decision, document: "SPEC.md", heading: "Decision log" }),
  GoalDecisionTarget.make({ kind: GoalDecisionKind.Enum.checkpoint, document: "PLAN.md", heading: "Checkpoints" }),
];

/**
 * Packet document a decision kind projects into.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalDecisionDocument = GoalDecisionTarget["document"];

/**
 * The reads the decision projection needs from one packet.
 *
 * **Details**
 *
 * `decisionFiles` lists the file names directly under `<packetPath>/decisions`
 * (empty when the directory is absent); `readDecision` returns one file's text;
 * `readDocument` returns `SPEC.md` or `PLAN.md`, `None` when the document does
 * not exist. The goals doctor's packet reader extends this port, so the working
 * filesystem and a Git tree both feed the same projection.
 *
 * @category services
 * @since 0.0.0
 */
export interface GoalDecisionReader<E, R> {
  readonly decisionFiles: (packetPath: string) => Effect.Effect<ReadonlyArray<string>, E, R>;
  readonly readDecision: (packetPath: string, file: string) => Effect.Effect<string, E, R>;
  readonly readDocument: (packetPath: string, document: GoalDecisionDocument) => Effect.Effect<O.Option<string>, E, R>;
}

const isDecisionFileName = S.is(GoalDecisionFileName);
const decodeFrontmatter = S.decodeUnknownEffect(GoalDecisionFrontmatter);

const invalid = (file: string, message: string): Result.Result<GoalDecision, GoalDecisionFileInvalid> =>
  Result.fail(GoalDecisionFileInvalid.make({ file, message }));

const fileDate = (file: string): string => Str.slice(0, 10)(file);

/**
 * Parses one decision file: name grammar, YAML frontmatter and the
 * name/frontmatter date agreement.
 *
 * **Example** (Parse a valid file)
 *
 * ```ts
 * import { parseGoalDecision } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 * import * as Effect from "effect/Effect"
 *
 * const raw = "---\ntitle: Forward-only\ndate: 2026-11-05\nreversal: Revert.\n---\n\nBody.\n"
 * console.log(Effect.isEffect(parseGoalDecision("2026-11-05-forward-only.md", raw))) // true
 * ```
 *
 * @param file - File name under `decisions/`.
 * @param raw - Full file text.
 * @returns The decision, or why the file was rejected.
 * @category parsing
 * @since 0.0.0
 */
export const parseGoalDecision = Effect.fn("Goals.parseGoalDecision")(function* (file: string, raw: string) {
  if (!isDecisionFileName(file)) {
    return invalid(file, "file name is not <YYYY-MM-DD>-<topic>.md (lowercase hyphenated topic).");
  }
  const split = FrontmatterSource.split(raw);
  if (split.frontmatter === undefined) {
    return invalid(file, "missing YAML frontmatter (title, date, reversal).");
  }
  const block = split.frontmatter;
  const decoded = yield* YamlFrontmatter.decode(Frontmatter.make({ format: block.format, value: block.value })).pipe(
    Effect.flatMap(decodeFrontmatter),
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    const issue = pipe(String(decoded.failure.message), Str.replace(/\s+/g, " "), Str.slice(0, 200));
    return invalid(file, `frontmatter does not decode as GoalDecisionFrontmatter: ${issue}`);
  }
  const frontmatter = decoded.success;
  if (frontmatter.date !== fileDate(file)) {
    return invalid(file, `frontmatter date ${frontmatter.date} differs from the file name date ${fileDate(file)}.`);
  }
  return Result.succeed(GoalDecision.make({ file, frontmatter, body: Str.trim(split.body) }));
});

const byDateThenFile: Order.Order<GoalDecision> = Order.combine(
  Order.mapInput(Order.String, (decision: GoalDecision) => decision.frontmatter.date),
  Order.mapInput(Order.String, (decision: GoalDecision) => decision.file)
);

const attribution = (decision: GoalDecision): O.Option<string> => {
  const parts = A.getSomes([
    O.map(O.fromUndefinedOr(decision.frontmatter.lane), (lane) => `Lane \`${lane}\``),
    O.map(O.fromUndefinedOr(decision.frontmatter.pullRequest), (pr) => `PR #${pr}`),
  ]);
  return A.isReadonlyArrayNonEmpty(parts) ? O.some(A.join(parts, " · ")) : O.none();
};

const renderEntry = (decision: GoalDecision): ReadonlyArray<string> => [
  `### ${decision.frontmatter.title}, ${decision.frontmatter.date}`,
  "",
  ...(Str.isEmpty(decision.body) ? A.empty<string>() : [decision.body, ""]),
  ...O.match(attribution(decision), { onNone: A.empty<string>, onSome: (line) => [line, ""] }),
  `Reverse: ${decision.frontmatter.reversal}`,
  "",
];

/**
 * Renders the generated block for one target from the packet's decisions of
 * that kind, oldest first (date, then file name).
 *
 * **Details**
 *
 * The block is deterministic text: markers on their own lines, a one-line
 * provenance note pointing at `decisions/` and the regenerating command, then
 * one `### <title>, <date>` entry per decision ending in its `Reverse:` line.
 * Changing this renderer changes every projected packet, so a change is a
 * repo-wide `--write`.
 *
 * **Example** (Render an empty block)
 *
 * ```ts
 * import { GOAL_DECISION_TARGETS, renderGoalDecisionBlock } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 *
 * const block = renderGoalDecisionBlock("demo", GOAL_DECISION_TARGETS[0], [])
 * console.log(block.split("\n")[0]) // "<!-- beep:decisions:begin -->"
 * ```
 *
 * @param slug - Packet slug named in the provenance note.
 * @param target - Which kind renders here.
 * @param decisions - Every parsed decision of the packet; other kinds are filtered out.
 * @returns The block text without a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderGoalDecisionBlock: {
  (target: GoalDecisionTarget, decisions: ReadonlyArray<GoalDecision>): (slug: string) => string;
  (slug: string, target: GoalDecisionTarget, decisions: ReadonlyArray<GoalDecision>): string;
} = dual(3, (slug: string, target: GoalDecisionTarget, decisions: ReadonlyArray<GoalDecision>): string => {
  const entries = pipe(
    decisions,
    A.filter((decision) => decision.frontmatter.kind === target.kind),
    A.sort(byDateThenFile)
  );
  const note = `_Generated from [\`${GOAL_DECISIONS_DIR}/\`](./${GOAL_DECISIONS_DIR}/) by \`bun run beep goals decisions write --slug ${slug}\`; add a \`kind: ${target.kind}\` file there, never edit this block._`;
  const body = A.isReadonlyArrayNonEmpty(entries)
    ? A.flatMap(entries, renderEntry)
    : [`_No ${target.kind} files yet._`, ""];
  return A.join([GOAL_DECISIONS_BEGIN_MARKER, note, "", ...body, GOAL_DECISIONS_END_MARKER], "\n");
});

const headingPattern = (heading: string): RegExp => new RegExp(`^## ${heading}$`, "i");
const isSectionHeading = (line: string): boolean => Str.startsWith("## ")(line);
const isBlank = (line: string): boolean => Str.isEmpty(Str.trim(line));
const withoutTrailingBlanks = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.dropWhile(A.reverse(lines), isBlank).reverse();
const joinDocument = (lines: ReadonlyArray<string>): string => `${A.join(lines, "\n")}\n`;

/**
 * Splices the generated block into a packet document.
 *
 * **Details**
 *
 * An existing marker pair is replaced in place. Without markers the block is
 * appended at the end of the target's `## ` section (authored text above it
 * stays frozen, which is the forward-only migration), or a new section is
 * appended when the heading is missing. A lone marker fails: the document is
 * ambiguous and must be repaired by hand.
 *
 * **Example** (Append a new section)
 *
 * ```ts
 * import { GOAL_DECISION_TARGETS, spliceGoalDecisionBlock } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const spliced = spliceGoalDecisionBlock(O.some("# Spec\n"), GOAL_DECISION_TARGETS[0], "<!-- block -->")
 * console.log(Result.isSuccess(spliced)) // true
 * ```
 *
 * @param document - Current document text, `None` when the file is absent.
 * @param target - Section the block belongs to.
 * @param block - Rendered block from {@link renderGoalDecisionBlock}.
 * @returns The full expected document, or why it cannot be projected.
 * @category formatting
 * @since 0.0.0
 */
export const spliceGoalDecisionBlock: {
  (target: GoalDecisionTarget, block: string): (document: O.Option<string>) => Result.Result<string, string>;
  (document: O.Option<string>, target: GoalDecisionTarget, block: string): Result.Result<string, string>;
} = dual(3, (document: O.Option<string>, target: GoalDecisionTarget, block: string): Result.Result<string, string> => {
  const blockLines = Str.split(block, "\n");
  const lines = pipe(
    document,
    O.map((text) => withoutTrailingBlanks(Str.split(text, "\n"))),
    O.getOrElse(A.empty<string>)
  );
  const begin = A.findFirstIndex(lines, (line) => Str.trim(line) === GOAL_DECISIONS_BEGIN_MARKER);
  const end = A.findFirstIndex(lines, (line) => Str.trim(line) === GOAL_DECISIONS_END_MARKER);
  if (O.isSome(begin) && O.isSome(end) && begin.value < end.value) {
    return Result.succeed(
      joinDocument([...A.take(lines, begin.value), ...blockLines, ...A.drop(lines, end.value + 1)])
    );
  }
  if (O.isSome(begin) || O.isSome(end)) {
    return Result.fail(
      `${target.document} has an unbalanced ${GOAL_DECISIONS_BEGIN_MARKER}/${GOAL_DECISIONS_END_MARKER} pair; repair the markers by hand.`
    );
  }
  const heading = A.findFirstIndex(lines, (line) => headingPattern(target.heading).test(Str.trim(line)));
  if (O.isNone(heading)) {
    const prefix = A.isReadonlyArrayEmpty(lines) ? A.empty<string>() : [...lines, ""];
    return Result.succeed(joinDocument([...prefix, `## ${target.heading}`, "", ...blockLines]));
  }
  const rest = A.drop(lines, heading.value + 1);
  const sectionLength = O.getOrElse(A.findFirstIndex(rest, isSectionHeading), () => A.length(rest));
  const section = withoutTrailingBlanks(A.take(rest, sectionLength));
  const after = A.drop(rest, sectionLength);
  return Result.succeed(
    joinDocument([
      ...A.take(lines, heading.value + 1),
      ...section,
      "",
      ...blockLines,
      ...(A.isReadonlyArrayEmpty(after) ? A.empty<string>() : ["", ...after]),
    ])
  );
});

const hasBeginMarker = (text: string): boolean =>
  A.some(Str.split(text, "\n"), (line) => Str.trim(line) === GOAL_DECISIONS_BEGIN_MARKER);

const projectTarget = (
  slug: string,
  target: GoalDecisionTarget,
  decisions: ReadonlyArray<GoalDecision>,
  current: O.Option<string>
): Result.Result<GoalDecisionProjection, string> => {
  const hasKind = A.some(decisions, (decision) => decision.frontmatter.kind === target.kind);
  const applies = hasKind || O.exists(current, hasBeginMarker);
  const block = renderGoalDecisionBlock(slug, target, decisions);
  return Result.map(spliceGoalDecisionBlock(current, target, block), (expected) =>
    GoalDecisionProjection.make({
      target,
      applies,
      drift: applies && !O.exists(current, (text) => text === expected),
      expected,
      ...optionalProp("current", current),
    })
  );
};

/**
 * Reads one packet's decision files and projects them into its documents.
 *
 * **Details**
 *
 * A packet with no `decisions/` directory and no marker block reports every
 * projection as not applying, so the forward-only migration leaves it alone.
 * An unbalanced marker pair is reported as an invalid "file" named after the
 * document, and rejected files never render: the doctor blocks on them and
 * the writer refuses until they decode.
 *
 * **Example** (Report over an empty reader)
 *
 * ```ts
 * import { goalDecisionLogReport } from "@beep/repo-cli/commands/Goals/Decisions.projection"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const record = GoalPacketRecord.make({
 *   slug: "demo",
 *   packetPath: "goals/demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   readmePath: "goals/demo/README.md",
 * })
 * const report = goalDecisionLogReport(record, {
 *   decisionFiles: () => Effect.succeed([]),
 *   readDecision: () => Effect.succeed(""),
 *   readDocument: () => Effect.succeed(O.none()),
 * })
 * console.log(Effect.isEffect(report)) // true
 * ```
 *
 * @param record - Packet to project.
 * @param reader - Source of decision files and documents.
 * @returns Decisions, rejected files and one projection per target.
 * @category use-cases
 * @since 0.0.0
 */
export const goalDecisionLogReport = Effect.fn("Goals.decisionLogReport")(function* <E, R>(
  record: GoalPacketRecord,
  reader: GoalDecisionReader<E, R>
) {
  const listed = yield* reader.decisionFiles(record.packetPath);
  const files = A.sort(listed, Order.String);
  const parsed = yield* Effect.forEach(files, (file) =>
    Effect.flatMap(reader.readDecision(record.packetPath, file), (raw) => parseGoalDecision(file, raw))
  );
  const [decisions, rejected] = A.separate(parsed);
  let invalidFiles: ReadonlyArray<GoalDecisionFileInvalid> = rejected;
  let projections = A.empty<GoalDecisionProjection>();
  for (const target of GOAL_DECISION_TARGETS) {
    const current = yield* reader.readDocument(record.packetPath, target.document);
    const projected = projectTarget(record.slug, target, decisions, current);
    if (Result.isSuccess(projected)) {
      projections = A.append(projections, projected.success);
    } else {
      invalidFiles = A.append(
        invalidFiles,
        GoalDecisionFileInvalid.make({ file: target.document, message: projected.failure })
      );
    }
  }
  return GoalDecisionLogReport.make({ slug: record.slug, decisions, invalid: invalidFiles, projections });
});
