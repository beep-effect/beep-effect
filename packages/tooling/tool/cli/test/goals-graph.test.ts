import {
  buildCatalogReport,
  buildExplainReport,
  buildFrontierReport,
  CapabilityCatalogReport,
  CapabilityGraphAnswers,
  CapabilityProjection,
  canonicalJsonTextPretty,
  compileCapabilityProjection,
  evaluateCapabilityGraph,
  GoalExplainReport,
  GoalFrontierReport,
  GoalManifest,
  GoalStatus,
  GraphCapabilityEdge,
  goalsCommand,
  loadCapabilityProjection,
  renderCapabilityMermaidSection,
  renderCatalogHuman,
  renderExplainHuman,
  renderFrontierHuman,
  runCapabilityGraph,
} from "@beep/repo-cli/test/Goals";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import { ChildProcess } from "effect/process";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import type { CapabilitySlug } from "@beep/repo-cli/test/Goals";

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

interface PacketSpec {
  readonly executionCapable?: boolean;
  readonly id: string;
  readonly provides?: ReadonlyArray<CapabilitySlug>;
  readonly requires?: ReadonlyArray<CapabilitySlug>;
  readonly status: GoalStatus;
}

const manifestOf = (spec: PacketSpec): GoalManifest =>
  GoalManifest.make({
    initiative: { id: spec.id, status: spec.status, title: `Title ${spec.id}` },
    completionGate: COMPLETION_GATE,
    executionCapable: spec.executionCapable ?? true,
    provides: [...(spec.provides ?? [])],
    requires: [...(spec.requires ?? [])],
  });

const encodeManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));

const encodeAnswers = (answers: CapabilityGraphAnswers) =>
  Effect.map(S.encodeUnknownEffect(CapabilityGraphAnswers)(answers), canonicalJsonTextPretty);

// Multiplication by an odd constant modulo 2^32 is a bijection, so this is a
// deterministic, seedable permutation that is neither forward nor reverse.
const seededShuffle = <T>(items: ReadonlyArray<T>, seed: number): ReadonlyArray<T> =>
  pipe(
    A.map(items, (item, index) => ({ item, key: ((index + seed) * 2654435761) % 4294967296 })),
    A.sort(Order.mapInput(Order.Number, (entry: { readonly key: number }) => entry.key)),
    A.map((entry) => entry.item)
  );

const ORDERS: ReadonlyArray<readonly [string, <T>(items: ReadonlyArray<T>) => ReadonlyArray<T>]> = [
  ["forward", (items) => items],
  ["reverse", (items) => A.reverse(items)],
  ["seeded-shuffle", (items) => seededShuffle(items, 7)],
];

// Reorders every row family so SQLite sees a different insertion order.
const permuteRows = (
  projection: CapabilityProjection,
  order: <T>(items: ReadonlyArray<T>) => ReadonlyArray<T>
): CapabilityProjection =>
  CapabilityProjection.make({
    packets: order(projection.packets),
    capabilities: order(projection.capabilities),
    provides: order(projection.provides),
    requires: order(projection.requires),
    duplicates: projection.duplicates,
  });

/**
 * Differential core: for every insertion order, the compiled projection is
 * order-independent and the SQL engine reproduces the reference answers
 * byte-for-byte. Returns the reference answers for fixture assertions.
 */
const differential = Effect.fn("differential")(function* (specs: ReadonlyArray<PacketSpec>) {
  const manifests = A.map(specs, manifestOf);
  const reference = compileCapabilityProjection(manifests);
  const expected = evaluateCapabilityGraph(reference);
  const expectedText = yield* encodeAnswers(expected);
  for (const [name, order] of ORDERS) {
    const compiled = compileCapabilityProjection(order(manifests));
    strictEqual(canonicalJsonTextPretty(compiled), canonicalJsonTextPretty(reference), `projection under ${name}`);
    const sql = yield* runCapabilityGraph(permuteRows(compiled, order));
    strictEqual(yield* encodeAnswers(sql), expectedText, `sql answers under ${name}`);
    strictEqual(yield* encodeAnswers(evaluateCapabilityGraph(permuteRows(compiled, order))), expectedText);
  }
  return { projection: reference, answers: expected };
});

// A dense four-capability alphabet makes overlaps, OR alternatives, fog, and
// cycles common in small generated censuses.
const GeneratedPacket = S.Struct({
  status: GoalStatus,
  executionCapable: S.Boolean,
  provides: S.Array(S.Literals(["cap/a", "cap/b", "cap/c", "cap/d"])),
  requires: S.Array(S.Literals(["cap/a", "cap/b", "cap/c", "cap/d"])),
});
const GeneratedCensus = S.Array(GeneratedPacket).check(S.isMaxLength(7));

const toSpecs = (census: typeof GeneratedCensus.Type): ReadonlyArray<PacketSpec> =>
  A.map(census, (packet, index) => ({
    id: `pkt-${index}`,
    status: packet.status,
    executionCapable: packet.executionCapable,
    provides: packet.provides,
    // GoalManifest rejects self-cycles (D6), so a generated packet never requires what it provides.
    requires: A.filter(packet.requires, (capability) => !A.contains(packet.provides, capability)),
  }));

// Effect's ChildProcess runs under both Bun and the Node coverage workers.
const gitPorcelain = Effect.fn("GoalsGraphTest.gitPorcelain")(function* (repoRoot: string) {
  const handle = yield* ChildProcess.make("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    stdin: "ignore",
    stderr: "ignore",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  strictEqual(yield* handle.exitCode, 0);
  return output;
});

const explain = (projection: CapabilityProjection, answers: CapabilityGraphAnswers, slug: string) =>
  O.getOrThrow(buildExplainReport(projection, answers, slug));

it.layer(NodeServices.layer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("goals capability graph — sealed differential fixtures", { concurrent: false }, () => {
    it.effect("1. AND gate: blocked until every required capability is available", () =>
      Effect.gen(function* () {
        const blocked = yield* differential([
          { id: "pkt-a", status: "completed-retained", provides: ["cap/a"] },
          { id: "pkt-b", status: "active", provides: ["cap/b"] },
          { id: "pkt-c", status: "active", requires: ["cap/a", "cap/b"] },
        ]);
        deepStrictEqual(blocked.answers.available, ["cap/a"]);
        deepStrictEqual(blocked.answers.frontier, ["pkt-b"]);
        const c = explain(blocked.projection, blocked.answers, "pkt-c");
        strictEqual(c.ready, false);
        deepStrictEqual(
          A.map(c.unlockPath, (step) => [step.slug, step.depth, step.ready] as const),
          [["pkt-b", 1, true]]
        );

        const unblocked = yield* differential([
          { id: "pkt-a", status: "completed-retained", provides: ["cap/a"] },
          { id: "pkt-b", status: "completed-retained", provides: ["cap/b"] },
          { id: "pkt-c", status: "active", requires: ["cap/a", "cap/b"] },
        ]);
        deepStrictEqual(unblocked.answers.frontier, ["pkt-c"]);
        deepStrictEqual(explain(unblocked.projection, unblocked.answers, "pkt-c").unlockPath, []);
      })
    );

    it.effect("2. orphan: a capability nobody provides is fog and never frontier", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-c", status: "active", requires: ["cap/missing"] },
        ]);
        deepStrictEqual(answers.fog, ["cap/missing"]);
        deepStrictEqual(answers.frontier, []);
        const catalog = buildCatalogReport(projection, answers);
        deepStrictEqual(
          A.map(catalog.entries, (entry) => [entry.capability, entry.orphan, entry.fog] as const),
          [["cap/missing", true, true]]
        );
        strictEqual(buildFrontierReport(projection, answers).fog[0], "cap/missing");
      })
    );

    it.effect("3. cycle: mutual requirements form one sorted SCC and explain returns it instead of a path", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-b", status: "active", provides: ["cap/b"], requires: ["cap/a"] },
          { id: "pkt-a", status: "active", provides: ["cap/a"], requires: ["cap/b"] },
          { id: "pkt-z", status: "active", requires: ["cap/a"] },
        ]);
        deepStrictEqual(answers.cycles, [["pkt-a", "pkt-b"]]);
        deepStrictEqual(answers.frontier, []);
        const a = explain(projection, answers, "pkt-a");
        deepStrictEqual(a.cycle, ["pkt-a", "pkt-b"]);
        deepStrictEqual(a.unlockPath, []);
        const z = explain(projection, answers, "pkt-z");
        strictEqual(z.cycle, undefined);
        deepStrictEqual(
          A.map(z.unlockPath, (step) => [step.slug, step.depth] as const),
          [
            ["pkt-a", 1],
            ["pkt-b", 2],
          ]
        );
      })
    );

    it.effect("4. completed provider: satisfies its consumer and is a relic, not frontier", () =>
      Effect.gen(function* () {
        const { answers } = yield* differential([
          { id: "pkt-a", status: "completed-retained", provides: ["cap/a"] },
          { id: "pkt-b", status: "active", requires: ["cap/a"] },
        ]);
        deepStrictEqual(answers.available, ["cap/a"]);
        deepStrictEqual(answers.frontier, ["pkt-b"]);
      })
    );

    it.effect("5. multi-provider OR: a collision is visible and the completed provider satisfies", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-a1", status: "active", provides: ["cap/a"] },
          { id: "pkt-a2", status: "completed-retained", provides: ["cap/a"] },
          { id: "pkt-b", status: "active", requires: ["cap/a"] },
        ]);
        deepStrictEqual(answers.frontier, ["pkt-a1", "pkt-b"]);
        const [entry] = buildCatalogReport(projection, answers).entries;
        strictEqual(entry?.collision, true);
        deepStrictEqual(
          A.map(entry?.providers ?? [], (row) => [row.provider, row.satisfies] as const),
          [
            ["pkt-a1", false],
            ["pkt-a2", true],
          ]
        );
      })
    );

    it.effect("6. duplicate/order control: repeats collapse to one edge plus one finding per array", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-p", status: "active", provides: ["cap/y", "cap/x", "cap/y", "cap/x"] },
          { id: "pkt-q", status: "active", provides: ["cap/w", "cap/w"], requires: ["cap/y", "cap/x", "cap/y"] },
        ]);
        deepStrictEqual(
          A.map(projection.provides, (edge) => `${edge.packetId}:${edge.capability}`),
          ["pkt-q:cap/w", "pkt-p:cap/x", "pkt-p:cap/y"]
        );
        deepStrictEqual(
          A.map(
            projection.duplicates,
            (duplicate) => `${duplicate.packetId}:${duplicate.edge}:${duplicate.capability}`
          ),
          ["pkt-p:provides:cap/x", "pkt-p:provides:cap/y", "pkt-q:provides:cap/w", "pkt-q:requires:cap/y"]
        );
        deepStrictEqual(
          A.map(
            buildCatalogReport(projection, answers).entries,
            (entry) => [entry.capability, A.length(entry.duplicates)] as const
          ),
          [
            ["cap/w", 1],
            ["cap/x", 1],
            ["cap/y", 2],
          ]
        );
        assertTrue(Str.includes("cap/y [duplicate]")(renderCatalogHuman(buildCatalogReport(projection, answers))));
      })
    );

    it.effect("rejects duplicate packet ids in every input order", () =>
      Effect.gen(function* () {
        const manifests = A.map(
          [
            { id: "pkt-a", status: "completed-retained" as const, provides: ["cap/x" as const] },
            { id: "pkt-a", status: "active" as const },
          ],
          manifestOf
        );
        for (const order of [manifests, A.reverse(manifests)]) {
          const exit = yield* Effect.exit(Effect.try(() => compileCapabilityProjection(order)));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("duplicate packet id");
        }
      })
    );

    it.effect("surfaces the engine's own failure text instead of a fixed message", () =>
      Effect.gen(function* () {
        // A provides edge naming a packet that has no row violates the foreign key.
        const dangling = CapabilityProjection.make({
          packets: [],
          capabilities: ["cap/x"],
          provides: [GraphCapabilityEdge.make({ packetId: "pkt-ghost", capability: "cap/x" })],
          requires: [],
          duplicates: [],
        });
        const error = yield* Effect.flip(runCapabilityGraph(dangling));
        expect(error.message).toMatch(/^The in-memory capability-graph engine failed: .*FOREIGN KEY/i);
      })
    );

    it.effect("D7: the unlock walk routes through a non-execution-capable packet and annotates it", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-t", status: "active", requires: ["cap/x"] },
          { id: "pkt-x", status: "active", provides: ["cap/x"], requires: ["cap/y"], executionCapable: false },
          { id: "pkt-y", status: "paused", provides: ["cap/y"] },
        ]);
        deepStrictEqual(answers.frontier, []);
        deepStrictEqual(
          A.map(
            explain(projection, answers, "pkt-t").unlockPath,
            (step) => [step.slug, step.depth, step.executionCapable, step.status] as const
          ),
          [
            ["pkt-x", 1, false, "active"],
            ["pkt-y", 2, true, "paused"],
          ]
        );
      })
    );

    it.effect("D8: superseded and reference providers never satisfy; strands and reference-provides are flagged", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-old", status: "superseded", provides: ["cap/old"] },
          { id: "pkt-ref", status: "reference", provides: ["cap/ref"] },
          { id: "pkt-use", status: "active", requires: ["cap/old", "cap/ref"] },
        ]);
        deepStrictEqual(answers.available, []);
        deepStrictEqual(answers.fog, ["cap/old", "cap/ref"]);
        deepStrictEqual(explain(projection, answers, "pkt-use").unlockPath, []);
        deepStrictEqual(
          A.map(
            buildCatalogReport(projection, answers).entries,
            (entry) => [entry.capability, entry.orphan, entry.stranded, entry.referenceProviders] as const
          ),
          [
            ["cap/old", false, true, []],
            ["cap/ref", false, false, ["pkt-ref"]],
          ]
        );
      })
    );
  });

  describe("goals capability graph — generated differential", { concurrent: false }, () => {
    it.effect.prop(
      "property: schema-generated censuses give byte-identical SQL and reference answers",
      [Arbitrary.schema(GeneratedCensus)],
      Effect.fnUntraced(function* ([census]) {
        const projection = compileCapabilityProjection(A.map(toSpecs(census), manifestOf));
        const sql = yield* runCapabilityGraph(projection);
        strictEqual(yield* encodeAnswers(sql), yield* encodeAnswers(evaluateCapabilityGraph(projection)));
      }),
      { arbitrary: { runs: 64 } }
    );
  });

  describe("goals capability graph — reports and renderers", { concurrent: false }, () => {
    it.effect("reports round-trip through their schemas and render human text", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-a", status: "active", provides: ["cap/a"], requires: ["cap/z"] },
          { id: "pkt-b", status: "active", requires: ["cap/a"] },
          { id: "pkt-c", status: "completed-retained", provides: ["cap/c"] },
          { id: "pkt-d", status: "active", requires: ["cap/c"] },
        ]);
        const frontier = buildFrontierReport(projection, answers);
        deepStrictEqual(pipe(projection, buildFrontierReport(answers)), frontier);
        deepStrictEqual(pipe(projection, buildCatalogReport(answers)), buildCatalogReport(projection, answers));
        deepStrictEqual(
          pipe(projection, buildExplainReport(answers, "pkt-b")),
          buildExplainReport(projection, answers, "pkt-b")
        );
        const roundTrip = <A, I>(schema: S.Codec<A, I>, value: A) =>
          Effect.flatMap(S.encodeUnknownEffect(schema)(value), S.decodeUnknownEffect(schema));
        deepStrictEqual(yield* roundTrip(GoalFrontierReport, frontier), frontier);
        const b = explain(projection, answers, "pkt-b");
        deepStrictEqual(yield* roundTrip(GoalExplainReport, b), b);
        const catalog = buildCatalogReport(projection, answers);
        deepStrictEqual(yield* roundTrip(CapabilityCatalogReport, catalog), catalog);

        const frontierText = renderFrontierHuman(frontier);
        assertTrue(Str.includes("pkt-d — Title pkt-d")(frontierText));
        assertTrue(Str.includes("fog:cap/z")(frontierText));
        const explainText = renderExplainHuman(b);
        assertTrue(Str.includes("blocked")(explainText));
        assertTrue(Str.includes("1. pkt-a (active) provides cap/a")(explainText));
        assertTrue(Str.includes("ready but not actionable")(renderExplainHuman(explain(projection, answers, "pkt-c"))));
        assertTrue(Str.includes("cap/z [orphan, fog]")(renderCatalogHuman(catalog)));
        strictEqual(O.isNone(buildExplainReport(projection, answers, "pkt-missing")), true);
        strictEqual(renderExplainHuman(explain(projection, answers, "pkt-c")).includes("requirements: none"), true);
      })
    );

    it.effect("a cycle renders in both the frontier and the explain text", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-a", status: "active", provides: ["cap/a"], requires: ["cap/b"] },
          { id: "pkt-b", status: "active", provides: ["cap/b"], requires: ["cap/a"] },
        ]);
        assertTrue(Str.includes("pkt-a <-> pkt-b")(renderFrontierHuman(buildFrontierReport(projection, answers))));
        assertTrue(Str.includes("cycle: pkt-a <-> pkt-b")(renderExplainHuman(explain(projection, answers, "pkt-a"))));
      })
    );
  });

  describe("goals capability graph — Mermaid INDEX section", { concurrent: false }, () => {
    it.effect("renders live packets, relic providers, fog, and blockers; collapses other completed packets", () =>
      Effect.gen(function* () {
        const { projection, answers } = yield* differential([
          { id: "pkt-done", status: "completed-retained", provides: ["cap/done"] },
          { id: "pkt-history", status: "completed-retained", provides: ["cap/old"] },
          { id: "pkt-live", status: "active", provides: ["cap/live"], requires: ["cap/done", "cap/ghost"] },
          { id: "pkt-next", status: "paused", requires: ["cap/live"] },
          { id: "pkt-ref", status: "reference", provides: ["cap/ghost"] },
        ]);
        const section = renderCapabilityMermaidSection(projection, answers);
        const has = (line: string) => assertTrue(Str.includes(line)(section));
        has("2 live packets, 1 relic providers, 1 fog capabilities; 1 other completed packets collapsed");
        has('  p_pkt_live["pkt-live"]:::active');
        has('  p_pkt_next["pkt-next"]:::paused');
        has('  p_pkt_done(["pkt-done"]):::relic');
        has('  fog_cap_ghost{{"fog:cap/ghost"}}:::fog');
        has('  p_pkt_done -->|"cap/done"| p_pkt_live');
        has('  p_pkt_live -.->|"cap/live"| p_pkt_next');
        has("  fog_cap_ghost -.-> p_pkt_live");
        has("| [pkt-live](./pkt-live/README.md) | `cap/ghost` |");
        has("| [pkt-next](./pkt-next/README.md) | `cap/live` |");
        assertTrue(!Str.includes("pkt-history")(section));
        // A reference provider is not drawn, so it must not appear as an edge endpoint either.
        assertTrue(!Str.includes("p_pkt_ref")(section));
        strictEqual(pipe(projection, renderCapabilityMermaidSection(answers)), section);
      })
    );
  });

  describe("goals capability graph — evergreen census", { concurrent: false }, () => {
    it.effect(
      "decodes every tracked manifest, agrees with the reference evaluator, and writes nothing",
      () =>
        Effect.gen(function* () {
          const repoRoot = yield* findRepoRoot();
          const before = yield* gitPorcelain(repoRoot);
          const projection = yield* loadCapabilityProjection(repoRoot);
          const sql = yield* runCapabilityGraph(projection);
          strictEqual(yield* encodeAnswers(sql), yield* encodeAnswers(evaluateCapabilityGraph(projection)));
          const catalog = buildCatalogReport(projection, sql);
          for (const capability of ["knowledge/doctor", "skills/warehouse", "goals/graph", "goals/bootstrap"]) {
            const entry = A.findFirst(catalog.entries, (candidate) => candidate.capability === capability);
            assertTrue(
              O.exists(entry, (found) =>
                A.some(found.providers, (row) => row.provider === "knowledge-surface-automation")
              )
            );
          }
          expect(yield* gitPorcelain(repoRoot)).toBe(before);
        }),
      60_000
    );
  });

  describe("goals next|explain|catalog commands", { concurrent: false }, () => {
    const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
    const writeManifest = (spec: PacketSpec) =>
      Effect.flatMap(encodeManifestJson(manifestOf(spec)), (text) =>
        writeProjectFile(`goals/${spec.id}/ops/manifest.json`, `${text}\n`)
      );
    const lastLog = Effect.map(TestConsole.logLines, (lines) => pipe(A.filter(lines, P.isString), A.last));

    it.effect(
      "prints JSON and human reports, funnels unknown slugs, and fails closed on a broken census",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeManifest({ id: "pkt-a", status: "completed-retained", provides: ["cap/a"] });
            yield* writeManifest({ id: "pkt-b", status: "active", requires: ["cap/a"] });

            const next = yield* Effect.exit(runGoalsCommand(["next", "--json"]));
            next.pipe(Exit.isSuccess, assertTrue);
            assertTrue(O.exists(yield* lastLog, Str.includes('"schemaVersion": "goal-frontier/v1"')));

            const explained = yield* Effect.exit(runGoalsCommand(["explain", "pkt-b", "--json"]));
            explained.pipe(Exit.isSuccess, assertTrue);
            assertTrue(O.exists(yield* lastLog, Str.includes('"ready": true')));

            (yield* Effect.exit(runGoalsCommand(["catalog", "--json"]))).pipe(Exit.isSuccess, assertTrue);
            (yield* Effect.exit(runGoalsCommand(["catalog"]))).pipe(Exit.isSuccess, assertTrue);
            (yield* Effect.exit(runGoalsCommand(["next"]))).pipe(Exit.isSuccess, assertTrue);
            (yield* Effect.exit(runGoalsCommand(["explain", "pkt-b"]))).pipe(Exit.isSuccess, assertTrue);

            expectReportedExit(yield* Effect.exit(runGoalsCommand(["explain", "pkt-missing"])));
            const errors = A.filter(yield* TestConsole.errorLines, P.isString);
            assertTrue(A.some(errors, (line) => line.includes("bun run beep goals bootstrap --slug pkt-missing")));
            expectReportedExit(yield* Effect.exit(runGoalsCommand(["explain", "Not_A_Slug"])));

            yield* writeProjectFile("goals/pkt-c/ops/manifest.json", '{"initiative": {"id": "pkt-other"}}\n');
            expectReportedExit(yield* Effect.exit(runGoalsCommand(["next"])));
            yield* writeManifest({ id: "pkt-c", status: "active" });
            yield* writeProjectFile("goals/pkt-d/ops/manifest.json", "{ not json\n");
            expectReportedExit(yield* Effect.exit(runGoalsCommand(["catalog"])));
            yield* writeManifest({ id: "pkt-d", status: "active" });
            yield* writeProjectFile("goals/pkt-e/README.md", "# no manifest\n");
            expectReportedExit(yield* Effect.exit(runGoalsCommand(["explain", "pkt-b"])));
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );

    it.effect("refuses a manifest whose initiative.id differs from its directory", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeManifest({ id: "pkt-a", status: "active" });
          const renamed = yield* encodeManifestJson(manifestOf({ id: "pkt-z", status: "active" }));
          yield* writeProjectFile("goals/pkt-b/ops/manifest.json", renamed);
          expectReportedExit(yield* Effect.exit(runGoalsCommand(["next", "--json"])));
          const errors = A.filter(yield* TestConsole.errorLines, P.isString);
          assertTrue(A.some(errors, (line) => line.includes('declares initiative.id "pkt-z"')));
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
