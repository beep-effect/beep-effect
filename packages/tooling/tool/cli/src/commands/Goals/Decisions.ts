/**
 * `beep goals decisions` — conflict-free decision records: each lane writes its
 * own file under `goals/<slug>/decisions/`, and this command projects the
 * directory into the generated `## Decision log` block of `SPEC.md` (and the
 * `## Checkpoints` block of `PLAN.md` for `kind: checkpoint`); `check` reports
 * drift, `write` regenerates, `add` creates a schema-valid file and regenerates
 * in one step. `add --final <n>` with `--attribute-red` or `--operator-ruling`
 * also writes the completion-claim blocks for a goal's final PR.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { createContainedFileString, writeContainedFileString } from "@beep/repo-cli-kit/cli/FsGuards";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GoalSlug } from "./Bootstrap.schemas.ts";
import { resolveToday } from "./Bootstrap.ts";
import { goalDecisionLogReport } from "./Decisions.projection.ts";
import { GOAL_DECISIONS_DIR, GoalDecisionKind, GoalDecisionLogReport } from "./Decisions.schemas.ts";
import { GoalDecisionLog } from "./Decisions.service.ts";
import { makeGoalPacketFilesystemReader } from "./Doctor.ts";
import { GoalPacketNotFoundError, GoalPlanInputError } from "./Goals.errors.ts";
import { GoalAttributedRedCause, GoalRedAttributionBlock } from "./Goals.schemas.ts";
import { listGoalPackets } from "./Inventory.ts";
import { canonicalJsonTextPretty } from "./PacketCore/PacketDigest.ts";
import type { GoalDecisionLogShape } from "./Decisions.service.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/Decisions");

const encodeReports = S.encodeEffect(S.Array(GoalDecisionLogReport));

const writeDrift = Effect.fn("Goals.writeDecisionDrift")(function* (record: GoalPacketRecord) {
  const reader = makeGoalPacketFilesystemReader();
  const report = yield* goalDecisionLogReport(record, reader);
  if (A.isReadonlyArrayNonEmpty(report.invalid)) {
    return report;
  }
  const path = yield* Path.Path;
  for (const projection of report.projections) {
    if (projection.applies && projection.drift) {
      yield* writeContainedFileString(
        ".",
        path.join(record.packetPath, projection.target.document),
        projection.expected
      );
    }
  }
  return yield* goalDecisionLogReport(record, reader);
});

const makeLive = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const reader = makeGoalPacketFilesystemReader();
  const provide = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>): Effect.Effect<A, E> =>
    effect.pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
  const shape: GoalDecisionLogShape = {
    report: (record) => provide(goalDecisionLogReport(record, reader)),
    write: (record) => provide(writeDrift(record)),
  };
  return GoalDecisionLog.of(shape);
});

/**
 * Filesystem-backed {@link GoalDecisionLog}: reads `decisions/` and the
 * packet documents from the working tree and writes projections in place.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { GoalDecisionLogLive } from "@beep/repo-cli/commands/Goals/Decisions"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(GoalDecisionLogLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GoalDecisionLogLive = Layer.effect(GoalDecisionLog, makeLive);

const isGoalSlug = S.is(GoalSlug);

const selectPacket = Effect.fn("Goals.selectDecisionPacket")(function* (slug: string) {
  if (!isGoalSlug(slug)) {
    return yield* GoalPlanInputError.new(`--slug "${slug}" is not a lowercase hyphenated goal slug.`);
  }
  const records = yield* listGoalPackets();
  const record = A.findFirst(records, (candidate) => candidate.slug === slug);
  if (O.isNone(record)) {
    return yield* GoalPacketNotFoundError.new(slug, `No packet directory "goals/${slug}".`);
  }
  return record.value;
});
const selectPackets = Effect.fn("Goals.selectDecisionPackets")(function* (slug: O.Option<string>) {
  return yield* O.match(slug, {
    onNone: listGoalPackets,
    onSome: (slug: string) => selectPacket(slug).pipe(Effect.map(A.of)),
  });
});

const driftLine = (report: GoalDecisionLogReport): ReadonlyArray<string> => [
  ...A.map(
    report.invalid,
    (item) => `- ${report.slug} [decision-file-invalid] ${GOAL_DECISIONS_DIR}/${item.file}: ${item.message}`
  ),
  ...pipe(
    report.projections,
    A.filter((projection) => projection.applies && projection.drift),
    A.map(
      (projection) =>
        `- ${report.slug} [decision-log-drift] ${projection.target.document} ${projection.target.heading} block is stale.`
    )
  ),
];

const printSummary = Effect.fn("Goals.printDecisionSummary")(function* (
  reports: ReadonlyArray<GoalDecisionLogReport>,
  driftLabel: string
) {
  const totals = summarize(reports);
  yield* Console.log(
    `[goals:decisions] packets=${A.length(reports)} decisions=${totals.decisions} invalid=${totals.invalid} ${driftLabel}=${totals.drift}`
  );
  for (const line of A.flatMap(reports, driftLine)) {
    yield* Console.error(line);
  }
  return totals;
});

const summarize = (reports: ReadonlyArray<GoalDecisionLogReport>) => ({
  decisions: A.reduce(reports, 0, (sum, report) => sum + A.length(report.decisions)),
  invalid: A.reduce(reports, 0, (sum, report) => sum + A.length(report.invalid)),
  drift: A.reduce(
    reports,
    0,
    (sum, report) =>
      sum + A.length(A.filter(report.projections, (projection) => projection.applies && projection.drift))
  ),
});

/**
 * Runs `beep goals decisions check`: prints drift and invalid files and fails
 * when either exists.
 *
 * **Example** (Build the check effect)
 *
 * ```ts
 * import { runGoalsDecisionsCheck } from "@beep/repo-cli/commands/Goals/Decisions"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(runGoalsDecisionsCheck({ slug: O.none(), json: false })))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsDecisionsCheck = Effect.fn("Goals.runDecisionsCheck")(function* (options: {
  readonly slug: O.Option<string>;
  readonly json: boolean;
}) {
  const service = yield* GoalDecisionLog;
  const records = yield* selectPackets(options.slug);
  const reports = yield* Effect.forEach(records, service.report);
  if (options.json) {
    // Reports are built through `GoalDecisionLogReport.make`, so encoding cannot fail.
    const rendered = yield* encodeReports(reports).pipe(Effect.orDie, Effect.map(canonicalJsonTextPretty));
    yield* Console.log(Str.trimEnd(rendered));
  } else {
    yield* printSummary(reports, "drift");
  }
  const totals = summarize(reports);
  if (totals.invalid > 0 || totals.drift > 0) {
    return yield* failWithReportedExit(
      "goals decisions: stale or invalid decision projections; run `bun run beep goals decisions write`."
    );
  }
});

/**
 * Runs `beep goals decisions write`: regenerates every stale block.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { runGoalsDecisionsWrite } from "@beep/repo-cli/commands/Goals/Decisions"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(runGoalsDecisionsWrite({ slug: O.none() })))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsDecisionsWrite = Effect.fn("Goals.runDecisionsWrite")(function* (options: {
  readonly slug: O.Option<string>;
}) {
  const service = yield* GoalDecisionLog;
  const records = yield* selectPackets(options.slug);
  const reports = yield* Effect.forEach(records, service.write);
  const totals = yield* printSummary(reports, "drift_remaining");
  if (totals.invalid > 0) {
    return yield* failWithReportedExit("goals decisions: invalid decision files block the projection; fix them first.");
  }
});

const slugify = (title: string): string =>
  pipe(title, Str.toLowerCase, Str.replace(/[^a-z0-9]+/g, "-"), Str.replace(/^-+|-+$/g, ""));

// Double-quoted YAML scalar: only backslash and the quote need escaping for single-line text.
const yamlScalar = (value: string): string => `"${pipe(value, Str.replace(/\\/g, "\\\\"), Str.replace(/"/g, '\\"'))}"`;

/**
 * Input of `beep goals decisions add`, as parsed from the command line.
 *
 * **Details**
 *
 * `final`, `attributeRed` and `operatorRuling` write the completion-claim
 * blocks: each `attributeRed` entry is `<context>=<cause>#<fix>` and becomes
 * one red of a `redAttribution` block for `final`, and `operatorRuling`
 * writes an `operatorRuling` block for `final`. All three default to absent,
 * so an input without claims constructs as before.
 *
 * **Example** (Construct an add input)
 *
 * ```ts
 * import { GoalDecisionAddInput } from "@beep/repo-cli/commands/Goals/Decisions"
 * import * as O from "effect/Option"
 *
 * const input = GoalDecisionAddInput.make({
 *   slug: "demo",
 *   title: "Forward-only migration",
 *   reversal: "Move the entries back.",
 *   body: O.none(),
 *   kind: O.none(),
 *   lane: O.none(),
 *   pullRequest: O.none(),
 *   date: O.some("2026-11-05"),
 *   topic: O.none(),
 * })
 * console.log(input.slug)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecisionAddInput extends S.Opaque<GoalDecisionAddInput, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    title: S.String,
    reversal: S.String,
    body: S.Option(S.String),
    kind: S.Option(S.String),
    lane: S.Option(S.String),
    pullRequest: S.Option(S.String),
    date: S.Option(S.String),
    topic: S.Option(S.String),
    final: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    attributeRed: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed(A.empty<string>()))),
    operatorRuling: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("GoalDecisionAddInput", {
      description: "Raw command-line input of beep goals decisions add before validation.",
    })
  )
) {}

const isKind = S.is(GoalDecisionKind);
const isAttributedRedCause = S.is(GoalAttributedRedCause);
const decodeRedAttribution = S.decodeUnknownEffect(GoalRedAttributionBlock, { errors: "all" });

const positiveInteger = (flag: string, raw: O.Option<string>) =>
  O.match(raw, {
    onNone: () => Effect.succeedNone,
    onSome: (value) =>
      /^[1-9]\d*$/.test(value)
        ? Effect.succeedSome(Number(value))
        : Effect.fail(GoalPlanInputError.new(`${flag} "${value}" is not a positive integer.`)),
  });

// `<context>=<cause>#<fix>`: the context runs to the last "=" and may itself contain "=" or "#".
const ATTRIBUTE_RED = /^(.+)=([^=#]+)#\s*([1-9]\d*)$/;

const parseAttributeRed = Effect.fn("Goals.parseAttributeRed")(function* (raw: string) {
  const parts = pipe(
    Str.trim(raw),
    Str.match(ATTRIBUTE_RED),
    O.flatMap((match) => O.all([O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2]), O.fromUndefinedOr(match[3])]))
  );
  if (O.isNone(parts)) {
    return yield* GoalPlanInputError.new(
      `--attribute-red "${raw}" is not "<context>=<cause>#<fix PR>" (for example "Heavy / Check=inherited#2994").`
    );
  }
  const [context, cause, fix] = parts.value;
  const attribution = Str.trim(cause);
  if (!isAttributedRedCause(attribution)) {
    return yield* GoalPlanInputError.new(
      `--attribute-red "${raw}": cause "${attribution}" must be one of: ${A.join(GoalAttributedRedCause.literals, ", ")}.`
    );
  }
  return { context: Str.trim(context), attribution, fixPullRequest: Number(fix) };
});

// Claims need --final and a kind: decision file; --final needs a claim.
const checkClaimFlags = Effect.fn("Goals.checkDecisionClaimFlags")(function* (
  kind: GoalDecisionKind,
  finalPullRequest: O.Option<number>,
  claims: boolean
) {
  if (claims && kind !== GoalDecisionKind.Enum.decision) {
    return yield* GoalPlanInputError.new(
      "--attribute-red and --operator-ruling write completion claims, which only a kind: decision file may carry."
    );
  }
  if (O.isSome(finalPullRequest) && !claims) {
    return yield* GoalPlanInputError.new("--final needs --attribute-red or --operator-ruling.");
  }
  if (O.isNone(finalPullRequest) && claims) {
    return yield* GoalPlanInputError.new(
      "--attribute-red and --operator-ruling need --final <n>, the goal's final PR."
    );
  }
});

// The reds as one validated redAttribution block for the final, or None without any.
const redAttributionBlock = (final: number, reds: ReadonlyArray<unknown>) =>
  A.isReadonlyArrayNonEmpty(reds)
    ? decodeRedAttribution({ finalPullRequest: final, reds }).pipe(
        Effect.mapBoth({
          onSuccess: O.some,
          onFailure: (error) =>
            GoalPlanInputError.new(
              `--attribute-red does not form a valid redAttribution block for #${final}: ${pipe(
                String(error.message),
                Str.replace(/\s+/g, " "),
                Str.slice(0, 200)
              )}`
            ),
        })
      )
    : Effect.succeed(O.none<GoalRedAttributionBlock>());

// The claim blocks a decision file carries; both stay None without --attribute-red or --operator-ruling.
const completionClaims = Effect.fn("Goals.decisionCompletionClaims")(function* (
  kind: GoalDecisionKind,
  finalPullRequest: O.Option<number>,
  input: GoalDecisionAddInput
) {
  const reds = yield* Effect.forEach(input.attributeRed, parseAttributeRed);
  yield* checkClaimFlags(kind, finalPullRequest, A.isReadonlyArrayNonEmpty(reds) || input.operatorRuling);
  if (O.isNone(finalPullRequest)) {
    return { redAttribution: O.none<GoalRedAttributionBlock>(), operatorRuling: O.none<number>() };
  }
  const final = finalPullRequest.value;
  const redAttribution = yield* redAttributionBlock(final, reds);
  return { redAttribution, operatorRuling: input.operatorRuling ? O.some(final) : O.none<number>() };
});

const redAttributionLines = (block: GoalRedAttributionBlock): ReadonlyArray<string> => [
  "redAttribution:",
  `  finalPullRequest: ${block.finalPullRequest}`,
  "  reds:",
  ...A.map(
    block.reds,
    (red) =>
      `    - { context: ${yamlScalar(red.context)}, attribution: ${red.attribution}, fixPullRequest: ${red.fixPullRequest} }`
  ),
];

/**
 * Runs `beep goals decisions add`: writes a schema-valid decision file and
 * regenerates the packet's blocks.
 *
 * **Details**
 *
 * `--attribute-red` and `--operator-ruling` need `--final` and a
 * `kind: decision` file, and `--final` needs one of them. The reds are
 * validated as a `redAttribution` block (unique contexts, no fix PR equal to
 * the final) before anything is written.
 *
 * **Example** (Build the add effect)
 *
 * ```ts
 * import { GoalDecisionAddInput, runGoalsDecisionsAdd } from "@beep/repo-cli/commands/Goals/Decisions"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const effect = runGoalsDecisionsAdd(GoalDecisionAddInput.make({
 *   slug: "demo",
 *   title: "Forward-only migration",
 *   reversal: "Move the entries back.",
 *   body: O.none(),
 *   kind: O.none(),
 *   lane: O.none(),
 *   pullRequest: O.none(),
 *   date: O.some("2026-11-05"),
 *   topic: O.none(),
 * }))
 * console.log(Effect.isEffect(effect))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsDecisionsAdd = Effect.fn("Goals.runDecisionsAdd")(function* (input: GoalDecisionAddInput) {
  const service = yield* GoalDecisionLog;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const record = yield* selectPacket(input.slug);
  const kind = O.getOrElse(input.kind, () => GoalDecisionKind.Enum.decision);
  if (!isKind(kind)) {
    return yield* GoalPlanInputError.new(
      `--kind "${kind}" must be one of: ${A.join(GoalDecisionKind.literals, ", ")}.`
    );
  }
  const date = yield* resolveToday(input.date);
  const topic = slugify(O.getOrElse(input.topic, () => input.title));
  if (Str.isEmpty(topic)) {
    return yield* GoalPlanInputError.new("--topic (or --title) must contain at least one letter or digit.");
  }
  const pullRequest = yield* positiveInteger("--pr", input.pullRequest);
  const finalPullRequest = yield* positiveInteger("--final", input.final);
  if (Str.isEmpty(Str.trim(input.title)) || Str.isEmpty(Str.trim(input.reversal))) {
    return yield* GoalPlanInputError.new("--title and --reversal must be non-empty single lines.");
  }
  const claims = yield* completionClaims(kind, finalPullRequest, input);
  const frontmatter = [
    "---",
    `title: ${yamlScalar(Str.trim(input.title))}`,
    `date: ${date}`,
    ...(kind === GoalDecisionKind.Enum.decision ? A.empty<string>() : [`kind: ${kind}`]),
    ...O.match(input.lane, { onNone: A.empty<string>, onSome: (lane) => [`lane: ${yamlScalar(Str.trim(lane))}`] }),
    ...O.match(pullRequest, { onNone: A.empty<string>, onSome: (pr) => [`pullRequest: ${pr}`] }),
    `reversal: ${yamlScalar(Str.trim(input.reversal))}`,
    ...O.match(claims.redAttribution, { onNone: A.empty<string>, onSome: redAttributionLines }),
    ...O.match(claims.operatorRuling, {
      onNone: A.empty<string>,
      onSome: (final) => ["operatorRuling:", `  finalPullRequest: ${final}`],
    }),
    "---",
    "",
  ];
  const body = pipe(
    input.body,
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.match({ onNone: A.empty<string>, onSome: (text) => [text, ""] })
  );
  const file = `${date}-${topic}.md`;
  const directory = path.join(record.packetPath, GOAL_DECISIONS_DIR);
  yield* fs.makeDirectory(directory, { recursive: true });
  yield* createContainedFileString(".", path.join(directory, file), A.join([...frontmatter, ...body], "\n"));
  yield* Console.log(`[goals:decisions] wrote ${record.packetPath}/${GOAL_DECISIONS_DIR}/${file}`);
  const report = yield* service.write(record);
  for (const line of driftLine(report)) {
    yield* Console.error(line);
  }
  if (A.isReadonlyArrayNonEmpty(report.invalid)) {
    return yield* failWithReportedExit("goals decisions add: the packet has invalid decision files; fix them first.");
  }
});

const slugFlag = Flag.String("slug").pipe(Flag.withDescription("Limit to one packet slug under goals/"), Flag.optional);
const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print every packet's report as canonical JSON")
);

const checkCommand = Command.make(
  "check",
  { slug: slugFlag, json: jsonFlag },
  Effect.fn("Goals.decisionsCheckCommand")(function* ({ slug, json }) {
    yield* runGoalsDecisionsCheck({ slug, json });
  })
).pipe(Command.withDescription("Report decision files that do not decode and SPEC.md/PLAN.md blocks that drift"));

const writeCommand = Command.make(
  "write",
  { slug: slugFlag },
  Effect.fn("Goals.decisionsWriteCommand")(function* ({ slug }) {
    yield* runGoalsDecisionsWrite({ slug });
  })
).pipe(Command.withDescription("Regenerate the SPEC.md Decision log and PLAN.md Checkpoints blocks from decisions/"));

const addCommand = Command.make(
  "add",
  {
    slug: Argument.String("slug").pipe(Argument.withDescription("Goal packet slug under goals/")),
    title: Flag.String("title").pipe(Flag.withDescription("Decision title (rendered as `### <title>, <date>`)")),
    reversal: Flag.String("reversal").pipe(Flag.withDescription("One line: how to reverse the decision")),
    body: Flag.String("body").pipe(Flag.withDescription("Markdown body of the decision"), Flag.optional),
    kind: Flag.String("kind").pipe(
      Flag.withDescription("decision (SPEC.md, default) or checkpoint (PLAN.md)"),
      Flag.optional
    ),
    lane: Flag.String("lane").pipe(Flag.withDescription("Branch or lane that took the decision"), Flag.optional),
    pullRequest: Flag.String("pr").pipe(Flag.withDescription("Pull request number"), Flag.optional),
    date: Flag.String("date").pipe(Flag.withDescription("ISO date (YYYY-MM-DD); defaults to today"), Flag.optional),
    topic: Flag.String("topic").pipe(
      Flag.withDescription("File-name topic (lowercase hyphenated); defaults to the slugified title"),
      Flag.optional
    ),
    final: Flag.String("final").pipe(
      Flag.withDescription("The goal's final PR that --attribute-red and --operator-ruling claims name"),
      Flag.optional
    ),
    attributeRed: Flag.String("attribute-red").pipe(
      Flag.withDescription(
        'Repeatable "<context>=<cause>#<fix PR>": a red required check the final merged over (cause inherited, introduced or mixed)'
      ),
      Flag.atLeast(0)
    ),
    operatorRuling: Flag.Boolean("operator-ruling").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Record the operator's ruling that closes the --final PR")
    ),
  },
  Effect.fn("Goals.decisionsAddCommand")(function* (input) {
    yield* runGoalsDecisionsAdd(GoalDecisionAddInput.make(input));
  })
).pipe(Command.withDescription("Create goals/<slug>/decisions/<date>-<topic>.md and regenerate the packet's blocks"));

/**
 * `bun run beep goals decisions` — conflict-free decision records.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { goalsDecisionsCommand } from "@beep/repo-cli/commands/Goals/Decisions"
 *
 * console.log(goalsDecisionsCommand.name) // "decisions"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsDecisionsCommand = Command.make("decisions").pipe(
  Command.withDescription("Project goals/<slug>/decisions/*.md into generated SPEC.md and PLAN.md blocks"),
  Command.withSubcommands([checkCommand, writeCommand, addCommand]),
  Command.provide(GoalDecisionLogLive)
);
