/**
 * `beep ci route`: the verification route's command surface for slice 1 of
 * `goals/verification-route`. `plan` classifies a change and prints the lanes
 * it selects; `capture` pins the hosted corpus; `census` prints the loss
 * census over it; `replay` prints the route's recall with base-green
 * attribution.
 *
 * **Details**
 *
 * The command composes the four route services over the CLI root's platform
 * services. `plan` reads the working checkout; `census` and `replay` read a
 * digest-pinned corpus and the local git objects of every pull-request head
 * (`RouteGit.ensureHeads`), so they need network access once per new head set.
 *
 * @since 0.0.0
 */
import { findRepoRoot } from "@beep/repo-utils";
import { Workspaces } from "@beep/repo-workspaces";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { WaveOrder } from "../Yeet/internal/WaveOrder.ts";
import {
  RouteCensus as RouteCensusSchema,
  RouteCorpusReceipt as RouteCorpusReceiptSchema,
  RouteError,
  RoutePlan as RoutePlanSchema,
  RouteReplay as RouteReplaySchema,
} from "./Route.schemas.ts";
import {
  ChangeClassifier,
  ClassifyInput,
  RouteCensusReader,
  RouteCorpus,
  RouteCorpusCaptureOptions,
  VerificationRoute,
} from "./Route.service.ts";
import { makeRouteGit, RouteCensusReaderLive, RouteGit, VerificationRouteLive } from "./RouteCensus.ts";
import { ChangeClassifierLive } from "./RouteClassify.ts";
import { ROUTE_CORPUS_RECEIPT_FILE, RouteCorpusLive } from "./RouteCorpus.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RouteCensus, RouteCorpusReceipt, RoutePlan, RouteReplay } from "./Route.schemas.ts";
import type { RouteCensusShape, RouteCorpusLoaded } from "./Route.service.ts";

/**
 * Default corpus directory, relative to the repository root.
 *
 * **Example** (Read the default corpus directory)
 *
 * ```ts import.meta.vitest name="Read the default corpus directory"
 * import { ROUTE_CORPUS_DEFAULT_DIR } from "@beep/repo-cli/commands/Ci"
 *
 * ROUTE_CORPUS_DEFAULT_DIR // => "goals/verification-route/research/corpus"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ROUTE_CORPUS_DEFAULT_DIR = "goals/verification-route/research/corpus";

/**
 * First UTC date of the default capture window: the time-to-certainty
 * post-baseline start, so the corpus and M1 share a window edge.
 *
 * **Example** (Read the default capture start)
 *
 * ```ts import.meta.vitest name="Read the default capture start"
 * import { ROUTE_CORPUS_DEFAULT_SINCE } from "@beep/repo-cli/commands/Ci"
 *
 * ROUTE_CORPUS_DEFAULT_SINCE // => "2026-09-01"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ROUTE_CORPUS_DEFAULT_SINCE = "2026-09-01";

const DEFAULT_WORKFLOWS: ReadonlyArray<string> = ["Check", "Heavy"];

// A repo CLI outside a repository is a defect, not a route failure the user can act on.
const RouteGitFromRepo: Layer.Layer<
  RouteGit,
  never,
  Digest.Digest | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
> = Layer.effect(
  RouteGit,
  findRepoRoot().pipe(
    Effect.mapError(RouteError.mapError("workspace", "Failed to locate repository root.")),
    Effect.orDie,
    Effect.flatMap(makeRouteGit)
  )
);

// The classifier, git and corpus layers are leaves; the route needs WaveOrder and the
// workspaces' ChangeDetector; the census reader needs the classifier and git. provideMerge
// keeps every dependency satisfied in order instead of racing them in one mergeAll.
const routeLayers = Layer.mergeAll(
  VerificationRouteLive.pipe(Layer.provide(Layer.mergeAll(WaveOrder.Default, Workspaces.layerWithGit()))),
  RouteCensusReaderLive
).pipe(Layer.provideMerge(Layer.mergeAll(ChangeClassifierLive, RouteGitFromRepo, RouteCorpusLive)));

const routeFailure = <A, R>(effect: Effect.Effect<A, RouteError, R>) =>
  effect.pipe(
    Effect.catchTag("RouteError", (error) =>
      Console.error(`[ci route] ${error.reason}: ${error.message}`).pipe(
        Effect.andThen(failWithReportedExit(error.message))
      )
    )
  );

const minutes = (ms: number): string => `${(ms / 60000).toFixed(1)} min`;

// Encoding a value this command just built cannot fail by contract; a failure is a defect.
const encodeJson = <Sch extends S.Top>(
  schema: Sch,
  value: Sch["Type"]
): Effect.Effect<string, never, Sch["EncodingServices"]> =>
  S.encodeEffect(schema)(value).pipe(
    Effect.map((encoded) => JSON.stringify(encoded, null, 2)),
    Effect.orDie
  );

const renderPlan = (plan: RoutePlan): ReadonlyArray<string> => [
  `[ci route] plan ${Str.slice(0, 12)(plan.head)} against ${Str.slice(0, 12)(plan.base)} (footprint ${Str.slice(0, 12)(plan.footprintDigest)})`,
  `  atoms: ${plan.atoms.length}; affected packages: ${plan.affectedPackages.length}`,
  ...A.map(
    plan.atoms,
    (atom) => `    ${atom.kind}  ${atom.path}${O.match(atom.detail, { onNone: () => "", onSome: (d) => `  (${d})` })}`
  ),
  `  selected (${plan.selected.length}, wave order):`,
  ...A.map(
    plan.selected,
    (row) =>
      `    ${row.lane}  <- ${A.isReadonlyArrayNonEmpty(row.selectedBy) ? A.join(row.selectedBy, ", ") : "(external input)"}`
  ),
  `  skipped (${plan.skipped.length}): ${plan.skipped.length === 0 ? "none" : A.join(plan.skipped, ", ")}`,
];

const renderReceipt = (receipt: RouteCorpusReceipt): ReadonlyArray<string> => [
  `[ci route] corpus ${receipt.path} (${receipt.runs} runs, ${receipt.heads} heads, ${receipt.since}..${receipt.until}, workflows ${A.join(receipt.workflows, ", ")})`,
  `  sha256 ${receipt.sha256}`,
];

const renderCensus = (census: RouteCensus): ReadonlyArray<string> => [
  `[ci route] census over ${census.heads} pull-request heads (${census.classifiedHeads} classified; ${census.unresolvedHeads} unresolved; unknown atom share ${(census.unknownAtomShare * 100).toFixed(1)}%; footprint ${Str.slice(0, 12)(census.footprintDigest)}; corpus ${Str.slice(0, 12)(census.corpusSha256)})`,
  "  kind                 lane               pure heads  pure time    mixed heads  mixed time",
  ...pipe(
    census.rows,
    A.take(40),
    A.map(
      (row) =>
        `  ${Str.padEnd(20)(row.kind)} ${Str.padEnd(18)(row.lane)} ${Str.padStart(10)(String(row.pureHeads))}  ${Str.padStart(10)(minutes(row.pureMs))}  ${Str.padStart(11)(String(row.mixedHeads))}  ${Str.padStart(10)(minutes(row.mixedMs))}`
    )
  ),
  census.rows.length > 40 ? `  ... ${census.rows.length - 40} more row(s); use --json for all` : "",
  "  lane cost sources:",
  ...A.map(
    census.costs,
    (cost) =>
      `    ${Str.padEnd(18)(cost.lane)} ${Str.padEnd(16)(cost.basis)} ${O.match(cost.p50Ms, { onNone: () => "-", onSome: minutes })}${O.match(cost.source, { onNone: () => "", onSome: (s) => `  ${s}` })}`
  ),
];

const renderReplay = (replay: RouteReplay): ReadonlyArray<string> => [
  `[ci route] replay over ${replay.heads} pull-request heads: recall ${(replay.recall * 100).toFixed(2)}% (${replay.skippedReds} skipped red(s) of ${replay.skippedLaneRuns} skipped lane run(s); base unknown on ${replay.baseUnknownHeads} head(s); ${replay.unresolvedHeads} unresolved head(s); footprint ${Str.slice(0, 12)(replay.footprintDigest)})`,
  ...pipe(
    replay.perHead,
    A.filter((head) => head.skippedReds.length > 0),
    A.take(20),
    A.map(
      (head) =>
        `  ${Str.slice(0, 12)(head.headSha)}  skipped reds: ${A.join(head.skippedReds, ", ")}${head.baseUnknown ? "  (base unknown)" : ""}`
    )
  ),
];

const resolveCorpusReceipt = Effect.fn("Ci.route.resolveCorpusReceipt")(function* (root: string, corpus: string) {
  const path = yield* Path.Path;
  return path.isAbsolute(corpus) ? corpus : path.join(root, corpus);
});

const planCommand = Command.make(
  "plan",
  {
    base: Flag.String("base").pipe(
      Flag.optional,
      Flag.withDescription("Base commit (default: the merge base of head with origin/main)")
    ),
    head: Flag.String("head").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Head commit to classify")),
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the plan as JSON")),
  },
  Effect.fn("Ci.routePlanCommand")(function* ({ base, head, json }) {
    const root = yield* (yield* RouteGit).repoRoot;
    const program = Effect.gen(function* () {
      const git = yield* RouteGit;
      const resolvedBase = yield* O.match(base, { onNone: () => git.mergeBase(head), onSome: Effect.succeed });
      const classifier = yield* ChangeClassifier;
      const changeSet = yield* classifier.classify(ClassifyInput.make({ repoRoot: root, base: resolvedBase, head }));
      const route = yield* VerificationRoute;
      const plan = yield* route.plan(changeSet);
      const lines = json ? [yield* encodeJson(RoutePlanSchema, plan)] : renderPlan(plan);
      yield* printLines(lines);
    });
    yield* routeFailure(program);
  })
).pipe(Command.withDescription("Classify a change and print the lanes the route selects, in wave order"));

const captureCommand = Command.make(
  "capture",
  {
    since: Flag.String("since").pipe(
      Flag.withDefault(ROUTE_CORPUS_DEFAULT_SINCE),
      Flag.withDescription("First UTC date (YYYY-MM-DD) of the capture window")
    ),
    until: Flag.String("until").pipe(Flag.optional, Flag.withDescription("Last UTC date (default: today)")),
    workflows: Flag.String("workflows").pipe(
      Flag.withDefault(A.join(DEFAULT_WORKFLOWS, ",")),
      Flag.withDescription("Comma-separated hosted workflow names")
    ),
    out: Flag.String("out").pipe(
      Flag.withDefault(ROUTE_CORPUS_DEFAULT_DIR),
      Flag.withDescription("Output directory, relative to the repository root")
    ),
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the receipt as JSON")),
  },
  Effect.fn("Ci.routeCaptureCommand")(function* ({ since, until, workflows, out, json }) {
    const root = yield* (yield* RouteGit).repoRoot;
    const program = Effect.gen(function* () {
      const corpus = yield* RouteCorpus;
      const path = yield* Path.Path;
      const receipt = yield* corpus.capture(
        RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since,
          until,
          workflows: pipe(Str.split(workflows, ","), A.map(Str.trim), A.filter(Str.isNonEmpty)),
          outDir: path.isAbsolute(out) ? out : path.join(root, out),
        })
      );
      const lines = json ? [yield* encodeJson(RouteCorpusReceiptSchema, receipt)] : renderReceipt(receipt);
      yield* printLines(lines);
    });
    yield* routeFailure(program);
  })
).pipe(Command.withDescription("Capture (or extend) the digest-pinned corpus of hosted runs"));

// census and replay differ only in which reader method runs and how the report prints. The
// `Command.make` calls stay literal because the knowledge doctor derives the documented command
// surface statically from bound string names; only the handler body is shared.
const runCorpusReport = <A, Sch extends S.Top & { readonly Type: A; readonly EncodingServices: never }>(
  read: (reader: RouteCensusShape, loaded: RouteCorpusLoaded) => Effect.Effect<A, RouteError>,
  schema: Sch,
  render: (report: A) => ReadonlyArray<string>
) =>
  Effect.fnUntraced(function* ({ corpus, json }: { readonly corpus: string; readonly json: boolean }) {
    const root = yield* (yield* RouteGit).repoRoot;
    const program = Effect.gen(function* () {
      const receiptPath = yield* resolveCorpusReceipt(root, corpus);
      const loaded = yield* RouteCorpus.use((service) => service.load(receiptPath));
      const report = yield* RouteCensusReader.use((reader) => read(reader, loaded));
      const lines = json ? [yield* encodeJson(schema, report)] : render(report);
      yield* printLines(lines);
    });
    yield* routeFailure(program);
  });

// The knowledge doctor resolves this identifier to its Flag initializer, so sharing it keeps the
// command surface statically derivable.
const corpusFlag = Flag.String("corpus").pipe(
  Flag.withDefault(`${ROUTE_CORPUS_DEFAULT_DIR}/${ROUTE_CORPUS_RECEIPT_FILE}`),
  Flag.withDescription("Corpus receipt path, relative to the repository root")
);

const censusCommand = Command.make(
  "census",
  {
    corpus: corpusFlag,
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the census as JSON")),
  },
  runCorpusReport((reader, loaded) => reader.census(loaded), RouteCensusSchema, renderCensus)
).pipe(Command.withDescription("Print the loss census: hosted machine time by atom kind and lane"));

const replayCommand = Command.make(
  "replay",
  {
    corpus: corpusFlag,
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the replay as JSON")),
  },
  runCorpusReport((reader, loaded) => reader.replay(loaded), RouteReplaySchema, renderReplay)
).pipe(Command.withDescription("Replay the route over the corpus and print its recall with base-green attribution"));

// The route command tree without its services; `ciRouteCommand` provides the live
// layers once at the parent, which dispatches every subcommand inside them.
const ciRouteCommandDefinition = Command.make("route", {}, () =>
  printLines([
    "Verification route commands:",
    "- bun run beep ci route plan [--base <sha>] [--head <ref>] [--json]",
    `- bun run beep ci route capture [--since ${ROUTE_CORPUS_DEFAULT_SINCE}] [--until YYYY-MM-DD] [--workflows Check,Heavy] [--out ${ROUTE_CORPUS_DEFAULT_DIR}]`,
    "- bun run beep ci route census [--corpus <receipt>] [--json]",
    "- bun run beep ci route replay [--corpus <receipt>] [--json]",
  ])
).pipe(
  Command.withDescription("Select the checks a change kind can affect, and prove it by replay"),
  Command.withSubcommands([planCommand, captureCommand, censusCommand, replayCommand])
);

/**
 * `beep ci route`: plan, capture, census and replay.
 *
 * **Example** (Mount the route command)
 *
 * ```ts
 * import { ciRouteCommand } from "@beep/repo-cli/commands/Ci"
 * import * as Command from "effect/cli/Command"
 *
 * const ci = Command.make("ci").pipe(Command.withSubcommands([ciRouteCommand]))
 * console.log(typeof ci) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciRouteCommand = ciRouteCommandDefinition.pipe(Command.provide(routeLayers));

/**
 * The services every `beep ci route` subcommand reads.
 *
 * **Example** (Check that a service belongs to the route set)
 *
 * ```ts
 * import type { CiRouteServices } from "@beep/repo-cli/commands/Ci"
 * import type { RouteGit } from "@beep/repo-cli/commands/Ci/RouteCensus"
 *
 * // Compiles only while RouteGit is one of the route services.
 * export type ReadsGit = RouteGit extends CiRouteServices ? RouteGit : never
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export type CiRouteServices = VerificationRoute | RouteCensusReader | ChangeClassifier | RouteGit | RouteCorpus;

/**
 * Build the real `beep ci route` command tree over supplied route services.
 *
 * **Example** (Reference the test command factory)
 *
 * ```ts import.meta.vitest name="Reference the test command factory"
 * import { makeCiRouteCommandForTesting } from "@beep/repo-cli/commands/Ci"
 *
 * typeof makeCiRouteCommandForTesting // => "function"
 * ```
 *
 * @param layer - Route services the dispatched handlers read.
 * @returns The route command tree with those services.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const makeCiRouteCommandForTesting = <E, R>(layer: Layer.Layer<CiRouteServices, E, R>) =>
  ciRouteCommandDefinition.pipe(Command.provide(layer));
