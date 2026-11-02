import {
  ChangeAtom,
  ChangeClassifier,
  ChangeSet,
  CI_LANE_ID_VALUES,
  HostedRun,
  makeCiRouteCommandForTesting,
  ROUTE_CORPUS_DEFAULT_DIR,
  ROUTE_CORPUS_RECEIPT_FILE,
  RouteCensus,
  RouteCorpus,
  RouteCorpusLoaded,
  RouteCorpusReceipt,
  RouteError,
  RoutePlan,
  RouteReplay,
} from "@beep/repo-cli/commands/Ci";
import { RouteCensusReaderLive, RouteGit, verificationRouteLayer } from "@beep/repo-cli/commands/Ci/RouteCensus";
import { WaveOrder } from "@beep/repo-cli/test/Yeet";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import replayRunsJson from "./fixtures/ci-route/census/replay-runs.json" with { type: "json" };
import { expectReportedExit, NodeCommandTestLayer } from "./support/CommandTest.ts";
import type { ChangeAtomKind, RouteCorpusCaptureOptions } from "@beep/repo-cli/commands/Ci";

const decodeRuns = S.decodeUnknownEffect(S.Array(HostedRun));
// Every `--json` report decodes back through the schema the command encoded it with.
const decodeJson = <Sch extends S.Top & { readonly DecodingServices: never }>(schema: Sch) =>
  S.decodeUnknownEffect(S.fromJsonString(schema));
const decodePlan = decodeJson(RoutePlan);
const decodeReceipt = decodeJson(RouteCorpusReceipt);
const decodeCensus = decodeJson(RouteCensus);
const decodeReplay = decodeJson(RouteReplay);

const ROOT = "/repo";
const MERGE_BASES: Readonly<Record<string, string>> = { HEAD: "mb0", a1: "m1", b2: "m9", c3: "zz" };
const DEFAULT_RECEIPT = `${ROOT}/${ROUTE_CORPUS_DEFAULT_DIR}/${ROUTE_CORPUS_RECEIPT_FILE}`;

const atom = (kind: ChangeAtomKind, path: string, detail?: string): ChangeAtom =>
  ChangeAtom.make({ kind, path, digest: "00", detail: O.fromUndefinedOr(detail) });

const receipt = RouteCorpusReceipt.make({
  schemaVersion: "route-corpus/v1",
  capturedAt: "2026-10-31T00:00:00Z",
  since: "2026-09-01",
  until: "2026-10-30",
  workflows: ["Check", "Heavy"],
  runs: 7,
  heads: 6,
  path: "goals/verification-route/research/corpus/runs.json",
  sha256: "c0ffee",
});

type Recorded = {
  readonly captures: Ref.Ref<ReadonlyArray<RouteCorpusCaptureOptions>>;
  readonly loads: Ref.Ref<ReadonlyArray<string>>;
};

// Replay fixture: a1 is based on m1, b2 on m9 (whose newest main ancestor is m0), and c3
// has no main run at or below its base.
const services = (recorded: Recorded, runs: ReadonlyArray<HostedRun>, atoms: ReadonlyArray<ChangeAtom>) => {
  const classifier = Layer.succeed(
    ChangeClassifier,
    ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")(function* (input) {
        return ChangeSet.make({ base: input.base, head: input.head, changedPaths: [], atoms });
      }),
    })
  );
  const git = Layer.succeed(
    RouteGit,
    RouteGit.of({
      repoRoot: Effect.succeed(ROOT),
      mergeBase: Effect.fn("RouteGit.mergeBase")(function* (head) {
        return yield* Effect.fromOption(R.get(MERGE_BASES, head)).pipe(
          Effect.mapError(() => RouteError.new("git", `no merge base for ${head}`))
        );
      }),
      isAncestor: Effect.fn("RouteGit.isAncestor")(function* (ancestor, descendant) {
        return ancestor === "m0" && descendant === "m9";
      }),
      ensureHeads: Effect.fn("RouteGit.ensureHeads")(function* () {
        return A.empty<string>();
      }),
    })
  );
  const corpus = Layer.succeed(
    RouteCorpus,
    RouteCorpus.of({
      capture: Effect.fn("RouteCorpus.capture")(function* (options) {
        yield* Ref.update(recorded.captures, A.append(options));
        return receipt;
      }),
      load: Effect.fn("RouteCorpus.load")(function* (receiptPath) {
        yield* Ref.update(recorded.loads, A.append(receiptPath));
        if (Str.includes("missing")(receiptPath)) {
          return yield* RouteError.new("corpus-pin", `no receipt at ${receiptPath}`);
        }
        return RouteCorpusLoaded.make({ receipt, runs });
      }),
    })
  );
  const leaves = Layer.mergeAll(classifier, git, corpus, NodeCommandTestLayer);
  return Layer.mergeAll(
    verificationRouteLayer((base, head) => Effect.succeed([`${base}:affected`, `${head}:affected`])).pipe(
      Layer.provide(Layer.mergeAll(WaveOrder.Default, NodeCommandTestLayer))
    ),
    RouteCensusReaderLive
  ).pipe(Layer.provideMerge(leaves));
};

const harness = Effect.fn("RouteCommandTest.harness")(function* (atoms: ReadonlyArray<ChangeAtom>) {
  const runs = yield* decodeRuns(replayRunsJson);
  const recorded: Recorded = {
    captures: yield* Ref.make<ReadonlyArray<RouteCorpusCaptureOptions>>([]),
    loads: yield* Ref.make<ReadonlyArray<string>>([]),
  };
  const run = Command.runWith(makeCiRouteCommandForTesting(services(recorded, runs, atoms)), { version: "0.0.0" });
  return { recorded, run };
});

const CliLayer = Layer.mergeAll(NodeCommandTestLayer, NodeStdio.layer, NodeTerminal.layer);

const withConsole = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

it.layer(CliLayer, { timeout: "30 seconds" })("beep ci route command", (it) => {
  it.effect("lists the subcommands when run without one", () =>
    withConsole(
      Effect.gen(function* () {
        const { run } = yield* harness([]);
        yield* run([]);
        const lines = yield* TestConsole.logLines;
        expect(lines[0]).toBe("Verification route commands:");
        expect(A.length(lines)).toBe(5);
      })
    )
  );

  it.effect("plans an all-unknown change against an explicit base, with atom details", () =>
    withConsole(
      Effect.gen(function* () {
        const { run } = yield* harness([atom("unknown", "mystery.bin"), atom("pkg:catalog", "package.json", "biome")]);
        yield* run(["plan", "--base", "base0", "--head", "head1"]);
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(lines[0]).toMatch(/^\[ci route\] plan head1 against base0 \(footprint [0-9a-f]{12}\)$/u);
        expect(lines[1]).toBe("  atoms: 2; affected packages: 2");
        expect(lines[2]).toBe("    unknown  mystery.bin");
        expect(lines[3]).toBe("    pkg:catalog  package.json  (biome)");
        expect(lines).toContain(`  selected (${CI_LANE_ID_VALUES.length}, wave order):`);
        assertSome(A.last(lines), "  skipped (0): none");
      })
    )
  );

  it.effect("plans against the merge base by default and names external selections and skips", () =>
    withConsole(
      Effect.gen(function* () {
        const { run } = yield* harness([]);
        yield* run(["plan"]);
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(lines[0]).toMatch(/^\[ci route\] plan HEAD against mb0 /u);
        expect(lines).toContain("    security  <- (external input)");
        assertSome(
          A.last(lines),
          `  skipped (${CI_LANE_ID_VALUES.length - 1}): ${A.join(
            A.filter(CI_LANE_ID_VALUES, (lane) => lane !== "security"),
            ", "
          )}`
        );
      })
    )
  );

  it.effect("prints the plan as decodable JSON", () =>
    withConsole(
      Effect.gen(function* () {
        const { run } = yield* harness([atom("docs:markdown", "README.md")]);
        yield* run(["plan", "--base", "base0", "--head", "head1", "--json"]);
        const lines = yield* TestConsole.logLines;
        expect(A.length(lines)).toBe(1);
        const plan = yield* decodePlan(String(lines[0]));
        expect([plan.base, plan.head, plan.affectedPackages]).toEqual([
          "base0",
          "head1",
          ["base0:affected", "head1:affected"],
        ]);
      })
    )
  );

  it.effect("captures with trimmed workflows and an output directory under the repository root", () =>
    withConsole(
      Effect.gen(function* () {
        const { recorded, run } = yield* harness([]);
        yield* run(["capture", "--since", "2026-10-01", "--workflows", " Check, ,Heavy ", "--out", "corpus-out"]);
        yield* run(["capture", "--until", "2026-10-05", "--out", "/abs/corpus", "--json"]);

        const captures = yield* Ref.get(recorded.captures);
        expect(
          A.map(captures, (options) => [options.repoRoot, options.since, options.workflows, options.outDir])
        ).toEqual([
          [ROOT, "2026-10-01", ["Check", "Heavy"], `${ROOT}/corpus-out`],
          [ROOT, "2026-09-01", ["Check", "Heavy"], "/abs/corpus"],
        ]);
        const [first, second] = captures;
        assertNone(O.flatMap(O.fromUndefinedOr(first), (options) => options.until));
        assertSome(
          O.flatMap(O.fromUndefinedOr(second), (options) => options.until),
          "2026-10-05"
        );
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(lines[0]).toBe(
          "[ci route] corpus goals/verification-route/research/corpus/runs.json (7 runs, 6 heads, 2026-09-01..2026-10-30, workflows Check, Heavy)"
        );
        expect(lines[1]).toBe("  sha256 c0ffee");
        expect(yield* decodeReceipt(String(lines[2]))).toEqual(receipt);
      })
    )
  );

  it.effect("prints the census from the default receipt, and as JSON from a given one", () =>
    withConsole(
      Effect.gen(function* () {
        const { recorded, run } = yield* harness([atom("pkg:catalog", "package.json")]);
        yield* run(["census"]);
        const text = A.map(yield* TestConsole.logLines, String);
        expect(text[0]).toMatch(
          /^\[ci route\] census over 3 pull-request heads \(3 classified; 0 unresolved; unknown atom share 0\.0%; /u
        );
        expect(text).toContain("  lane cost sources:");

        yield* run(["census", "--corpus", "/abs/RECEIPTS.json", "--json"]);
        const json = A.map(yield* TestConsole.logLines, String);
        const census = yield* decodeCensus(yield* Effect.fromOption(A.last(json)));
        expect([census.heads, census.corpusSha256]).toEqual([3, "c0ffee"]);
        expect(yield* Ref.get(recorded.loads)).toEqual([DEFAULT_RECEIPT, "/abs/RECEIPTS.json"]);
      })
    )
  );

  it.effect("prints the replay recall and each head with skipped reds", () =>
    withConsole(
      Effect.gen(function* () {
        const { run } = yield* harness([]);
        yield* run(["replay"]);
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(lines[0]).toMatch(/^\[ci route\] replay over 3 pull-request heads: recall \d+\.\d{2}% \(3 skipped red/u);
        expect(lines).toContain("  a1  skipped reds: check");
        expect(lines).toContain("  b2  skipped reds: sast");
        expect(lines).toContain("  c3  skipped reds: lint  (base unknown)");

        yield* run(["replay", "--json"]);
        const json = A.map(yield* TestConsole.logLines, String);
        const replay = yield* decodeReplay(yield* Effect.fromOption(A.last(json)));
        expect([replay.heads, replay.skippedReds, replay.baseUnknownHeads]).toEqual([3, 3, 1]);
      })
    )
  );

  it.effect("reports a route failure on stderr and exits non-zero", () =>
    withConsole(
      Effect.gen(function* () {
        const { run } = yield* harness([]);
        expectReportedExit(yield* run(["census", "--corpus", "missing/RECEIPTS.json"]).pipe(Effect.exit));
        expectReportedExit(yield* run(["plan", "--head", "unknown-head"]).pipe(Effect.exit));
        expect(yield* TestConsole.errorLines).toEqual([
          `[ci route] corpus-pin: no receipt at ${ROOT}/missing/RECEIPTS.json`,
          "[ci route] git: no merge base for unknown-head",
        ]);
      })
    )
  );
});
