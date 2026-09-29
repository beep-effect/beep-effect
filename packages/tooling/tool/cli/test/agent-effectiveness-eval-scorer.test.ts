import { fileURLToPath } from "node:url";
import {
  AgentEffectivenessEvalScoreBreakdown,
  AgentEffectivenessEvalScorerError,
  aggregateLawFraction,
  buildAgentEffectivenessEvalScoreReport,
  CompletionResult,
  encodeAgentEffectivenessEvalScoreReportJson,
  evalConfigurationId,
  evaluateLaw,
  evaluateSkillOptCompletion,
  LawEvaluation,
  lawComponentScore,
  runAgentEffectivenessEvalScoreCommand,
  SkillOptTaskManifest,
} from "@beep/repo-cli/test/AgentEffectiveness";
import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, FileSystem, Layer, Match, Path, PlatformError, pipe, Ref, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { AgentEffectivenessEvalLaneReport } from "@beep/repo-cli/test/AgentEffectiveness";

const decodeUnknownSkillOptTaskManifestJson = S.decodeUnknownEffect(S.fromJsonString(SkillOptTaskManifest));

const TestLayer = NodeServices.layer;
const decodeTaskManifest = S.decodeUnknownEffect(SkillOptTaskManifest);

const provideLayer =
  <ROut, E2>(layer: Layer.Layer<ROut, E2, never>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideTestLayer = provideLayer(TestLayer);

const fixtureRoot = fileURLToPath(new URL("./fixtures/agent-effectiveness/scorer-pass/fixture", import.meta.url));
const taskPath = fileURLToPath(new URL("./fixtures/agent-effectiveness/scorer-pass/task.json", import.meta.url));

const writeText = Effect.fn("AgentEffectivenessEvalScorerTest.writeText")(function* (
  filePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const withTempFixture = <A, E, R>(use: (fixtureDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (dir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(dir, { force: true, recursive: true });
      })
  ).pipe(provideTestLayer);

const makeTask = (completion: unknown) =>
  decodeTaskManifest({
    id: "scorer-test",
    ruleIds: ["SFV4-fn-schema"],
    derivedFrom: [],
    prompt: "Use a schema-first contact payload.",
    fixture: "fixture",
    entrypoint: "src/Contact.ts",
    completion,
    weights: { completion: 0.5, law: 0.5 },
  });

const textStream = (text: string) => (Str.isEmpty(text) ? Stream.empty : Stream.make(new TextEncoder().encode(text)));

const outputHandle = ({ stdout = "", stderr = "", exitCode = 0 }: LaneOutput) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    stdout: textStream(stdout),
    stderr: textStream(stderr),
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

type LaneOutput = {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
};

type LaneResponse = LaneOutput | "spawn-failure";

type LaneResponses = {
  readonly bun?: LaneResponse;
  readonly biome?: LaneResponse;
  readonly tsgo?: LaneResponse;
};

const biomeReportJson = (changed: number, unchanged: number, diagnostics: ReadonlyArray<unknown> = []) =>
  JSON.stringify({ summary: { changed, unchanged }, diagnostics });

const commandName = (command: string): string => pipe(command, Str.split("/"), A.lastNonEmpty);

const readConfigArgument = (args: ReadonlyArray<string>): O.Option<string> =>
  pipe(
    args,
    A.findFirst(Str.startsWith("--config-path=")),
    O.map(Str.slice("--config-path=".length)),
    O.orElse(() =>
      pipe(
        A.findFirstIndex(args, (arg) => arg === "-p"),
        O.flatMap((index) => A.get(args, index + 1))
      )
    )
  );

/**
 * Spawner stand-in for the three law-lane tools: records each spawned command
 * name, snapshots the scorer-generated config a lane is pointed at, and answers
 * with a canned output or a spawn failure.
 */
const fakeLawLayer = (
  spawned: Ref.Ref<ReadonlyArray<string>>,
  configs: Ref.Ref<ReadonlyArray<string>>,
  responses: LaneResponses
) =>
  Layer.mergeAll(
    BunCrypto.layer,
    NodeFileSystem.layer,
    NodePath.layer,
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("unexpected piped law-lane command");
        }
        const name = commandName(command.command);
        const response: LaneResponse = Match.value(name).pipe(
          Match.when("biome", () => responses.biome ?? { stdout: biomeReportJson(0, 1) }),
          Match.when("tsgo", () => responses.tsgo ?? {}),
          Match.orElse(() => responses.bun ?? {})
        );
        const snapshotConfig = pipe(
          readConfigArgument(command.args),
          O.match({
            onNone: () => Effect.void,
            onSome: (configPath) =>
              Effect.gen(function* () {
                const fs = yield* FileSystem.FileSystem;
                const text = yield* fs.readFileString(configPath);
                yield* Ref.update(configs, A.append(text));
              }).pipe(Effect.provide(NodeFileSystem.layer), Effect.orDie),
          })
        );
        return Ref.update(spawned, A.append(name)).pipe(
          Effect.andThen(snapshotConfig),
          Effect.andThen(
            response === "spawn-failure"
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "NotFound",
                    module: "ChildProcess",
                    method: "spawn",
                    description: `${name} is not installed`,
                  })
                )
              : Effect.succeed(outputHandle(response))
          )
        );
      })
    )
  );

const runFakeLaw = (
  responses: LaneResponses,
  prepareRepo: (
    repoRoot: string
  ) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path> = writeRepoBiomeConfig
) =>
  Effect.gen(function* () {
    const spawned = yield* Ref.make<ReadonlyArray<string>>([]);
    const configs = yield* Ref.make<ReadonlyArray<string>>([]);
    const law = yield* Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixtureDir = yield* fs.makeTempDirectoryScoped();
        const repoRoot = yield* fs.makeTempDirectoryScoped();
        yield* prepareRepo(repoRoot);
        yield* writeText(path.join(fixtureDir, "src", "Contact.ts"), "export const contact = 1;\n");
        return { repoRoot, law: yield* evaluateLaw(fixtureDir, repoRoot, ["src/Contact.ts"]) };
      })
    ).pipe(provideLayer(fakeLawLayer(spawned, configs, responses)));
    return { ...law, commands: yield* Ref.get(spawned), configs: yield* Ref.get(configs) };
  });

const writeRepoBiomeConfig = (repoRoot: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    yield* writeText(
      path.join(repoRoot, "biome.jsonc"),
      [
        "{",
        "  // repo biome config stand-in",
        '  "vcs": { "enabled": true, "useIgnoreFile": true },',
        '  "plugins": ["./rules/root.grit", 7],',
        '  "files": { "includes": ["**", "!**/out"] },',
        '  "overrides": [',
        '    { "includes": ["**/src/**"], "plugins": ["./rules/src.grit"] },',
        '    { "includes": ["**/test/**"], "linter": { "enabled": false } },',
        '    "not-an-override"',
        "  ]",
        "}",
        "",
      ].join("\n")
    );
  });

const laneReport = (law: LawEvaluation, lane: AgentEffectivenessEvalLaneReport["lane"]) =>
  pipe(
    law.lanes,
    A.findFirst((report) => report.lane === lane)
  );

const expectMeasured = (law: LawEvaluation) => {
  expect(A.map(law.lanes, (report) => [report.lane, report.status, report.environmentDiagnostics])).toEqual([
    ["schema-first", "measured", []],
    ["tsgo", "measured", []],
    ["biome", "measured", []],
  ]);
};

const emptyLaw = LawEvaluation.make({
  schemaFirst: [],
  tsgo: [],
  biome: [],
});

describe("agent-effectiveness eval scorer", () => {
  it.effect("fingerprints injected skills outside the repository independently of score", () =>
    withTempFixture(
      Effect.fnUntraced(function* (fixtureDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* fs.makeTempDirectoryScoped();
        yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Shared guidance\n");
        const candidate = path.join(fixtureDir, ".claude", "skills", "skillopt-target", "SKILL.md");
        const identity = () => evalConfigurationId(repoRoot, fixtureDir, O.some("opus"), O.some("medium"));
        const missing = yield* identity();
        yield* writeText(candidate, "# Candidate A\n");
        const first = yield* identity();
        expect(first).not.toBe(missing);
        expect(yield* identity()).toBe(first);
        yield* writeText(candidate, "# Candidate B\n");
        expect(yield* identity()).not.toBe(first);
        yield* writeText(candidate, "# Candidate A\n");
        expect(yield* identity()).toBe(first);
        yield* writeText(path.join(fixtureDir, ".agents", "skills", "skillopt-target", "SKILL.md"), "# Candidate A\n");
        const bothRoots = yield* identity();
        expect(bothRoots).not.toBe(first);
        yield* writeText(
          path.join(fixtureDir, ".claude", "skills", "skillopt-target", "references", "notes.md"),
          "n\n"
        );
        expect(yield* identity()).not.toBe(bothRoots);

        // Two rollout dirs with different candidate content get different ids;
        // identical content in a different dir gets the same id.
        const otherDir = yield* fs.makeTempDirectoryScoped();
        const otherIdentity = () => evalConfigurationId(repoRoot, otherDir, O.some("opus"), O.some("medium"));
        yield* writeText(path.join(otherDir, ".claude", "skills", "skillopt-target", "SKILL.md"), "# Candidate B\n");
        const other = yield* otherIdentity();
        expect(other).not.toBe(first);
        expect(Str.startsWith("skillopt-scorer-")(other)).toBe(true);
        yield* writeText(path.join(otherDir, ".claude", "skills", "skillopt-target", "SKILL.md"), "# Candidate A\n");
        expect(yield* otherIdentity()).toBe(first);
      })
    )
  );

  it.effect("scores completion checks from exports and manifest patterns", () =>
    withTempFixture(
      Effect.fnUntraced(function* (fixtureDir) {
        const path = yield* Path.Path;
        yield* writeText(
          path.join(fixtureDir, "src", "Contact.ts"),
          [
            'import * as S from "effect/Schema";',
            "",
            'export class ContactPayload extends S.Class<ContactPayload>("ContactPayload")({',
            "  email: S.String,",
            "}) {}",
            "",
          ].join("\n")
        );
        const task = yield* makeTask({
          requiredExports: ["ContactPayload"],
          requiredPatterns: ["\\bS\\.Class\\b"],
          forbiddenPatterns: ["\\binterface ContactPayload\\b"],
        });

        const completion = yield* evaluateSkillOptCompletion(task, fixtureDir);

        expect(completion.fraction).toBe(1);
        expect(completion.violations).toEqual([]);
      })
    )
  );

  it.effect("reports failed completion checks deterministically", () =>
    withTempFixture(
      Effect.fnUntraced(function* (fixtureDir) {
        const path = yield* Path.Path;
        yield* writeText(
          path.join(fixtureDir, "src", "Contact.ts"),
          ["export interface ContactPayload {", "  email: string;", "}", ""].join("\n")
        );
        const task = yield* makeTask({
          requiredExports: ["ContactPayloadModel"],
          requiredPatterns: ["\\bS\\.Class\\b"],
          forbiddenPatterns: ["\\binterface ContactPayload\\b"],
        });

        const completion = yield* evaluateSkillOptCompletion(task, fixtureDir);

        expect(completion.fraction).toBe(0);
        expect(
          pipe(
            completion.violations,
            A.map((violation) => violation.message)
          )
        ).toEqual([
          "Forbidden pattern /\\binterface ContactPayload\\b/ matched.",
          'Missing required export "ContactPayloadModel".',
          "Missing required pattern /\\bS\\.Class\\b/.",
        ]);
      })
    )
  );

  it("maps law violations with deterministic reciprocal decay", () => {
    expect(lawComponentScore(0)).toBe(1);
    expect(lawComponentScore(1)).toBe(0.5);
    expect(lawComponentScore(2)).toBe(0.333333);
    expect(aggregateLawFraction({ schemaFirst: 1, tsgo: 0.5, biome: 0.25 })).toBe(0.583333);
  });

  it.effect("renders byte-identical reports for the same fixed fixture", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const task = yield* fs.readFileString(taskPath).pipe(Effect.flatMap(decodeUnknownSkillOptTaskManifestJson));
        const firstCompletion = yield* evaluateSkillOptCompletion(task, fixtureRoot);
        const secondCompletion = yield* evaluateSkillOptCompletion(task, fixtureRoot);
        const firstReport = buildAgentEffectivenessEvalScoreReport(task, firstCompletion, emptyLaw);
        const secondReport = buildAgentEffectivenessEvalScoreReport(task, secondCompletion, emptyLaw);
        const firstJson = yield* encodeAgentEffectivenessEvalScoreReportJson(firstReport);
        const secondJson = yield* encodeAgentEffectivenessEvalScoreReportJson(secondReport);

        expect(firstJson).toBe(secondJson);
        expect(firstReport.breakdown).toEqual(
          AgentEffectivenessEvalScoreBreakdown.make({
            completion: 1,
            schemaFirst: 1,
            tsgo: 1,
            biome: 1,
          })
        );
      })
    )
  );

  it.effect("returns all three law lane results and runs tsgo after the read-only lanes", () =>
    Effect.gen(function* () {
      const { commands, configs, law, repoRoot } = yield* runFakeLaw({});

      expect(LawEvaluation.make({ schemaFirst: law.schemaFirst, tsgo: law.tsgo, biome: law.biome })).toEqual(emptyLaw);
      expectMeasured(law);
      expect(A.sort(commands, Str.Order)).toEqual(["biome", "bun", "tsgo"]);
      expect(A.last(commands)).toEqual(O.some("tsgo"));

      const [biomeConfig, tsgoConfig] = yield* Effect.all(
        A.map(configs, (text) => S.decodeUnknownEffect(S.UnknownFromJsonString)(text))
      );
      expect(biomeConfig).toMatchObject({
        root: true,
        vcs: { enabled: false },
        files: { includes: ["packages/fixture/**"] },
        plugins: [`${repoRoot}/rules/root.grit`, 7],
        overrides: [
          { includes: ["**/src/**"], plugins: [`${repoRoot}/rules/src.grit`] },
          { includes: ["**/test/**"], linter: { enabled: false } },
          "not-an-override",
        ],
      });
      expect(tsgoConfig).toMatchObject({
        extends: `${repoRoot}/tsconfig.base.json`,
        compilerOptions: { lib: ["ESNext", "ESNext.Disposable"], types: ["node"], moduleResolution: "NodeNext" },
        files: ["packages/fixture/src/Contact.ts"],
      });
    }).pipe(provideTestLayer)
  );

  it.effect("reports lanes that could not measure the fixture as environment failures", () =>
    Effect.gen(function* () {
      const { law } = yield* runFakeLaw({
        bun: { stderr: "error: Module not found", exitCode: 1 },
        biome: {
          stdout: biomeReportJson(0, 0),
          stderr: "No files were processed in the specified paths.",
          exitCode: 1,
        },
        tsgo: {
          stdout: [
            "error TS5083: Cannot read file '/elsewhere/tsconfig.base.json'.",
            "../../node_modules/effect/dist/Effect.d.ts(12175,52): error TS2304: Cannot find name 'AsyncDisposable'.",
            "src/Contact.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.",
          ].join("\n"),
          exitCode: 2,
        },
      });

      expect(
        pipe(
          laneReport(law, "schema-first"),
          O.map((report) => report.status)
        )
      ).toEqual(O.some("environment-failure"));
      expect(
        pipe(
          laneReport(law, "biome"),
          O.map((report) => [report.status, report.filesProcessed, report.environmentDiagnostics])
        )
      ).toEqual(
        O.some([
          "environment-failure",
          0,
          ["No files were processed in the specified paths.", "biome processed no files."],
        ])
      );
      expect(
        pipe(
          laneReport(law, "tsgo"),
          O.map((report) => [report.status, report.environmentDiagnostics])
        )
      ).toEqual(
        O.some([
          "environment-failure",
          [
            "error TS5083: Cannot read file '/elsewhere/tsconfig.base.json'.",
            "../../node_modules/effect/dist/Effect.d.ts(12175,52): error TS2304: Cannot find name 'AsyncDisposable'.",
          ],
        ])
      );
      expect(A.map(law.tsgo, (violation) => [violation.file, violation.ruleId, violation.line])).toEqual([
        ["src/Contact.ts", "TS2322", 1],
      ]);

      const task = yield* makeTask({});
      const report = buildAgentEffectivenessEvalScoreReport(
        task,
        CompletionResult.make({ fraction: 1, violations: [] }),
        law
      );
      expect(report.status).toBe("environment-failure");
      expect(report.breakdown).toEqual(
        AgentEffectivenessEvalScoreBreakdown.make({ completion: 1, schemaFirst: 0, tsgo: 0, biome: 0 })
      );
      expect(report.score).toBe(0);
    }).pipe(provideTestLayer)
  );

  it.effect("reports unstartable tools, unusable Biome config, and silent failures as environment failures", () =>
    Effect.gen(function* () {
      const { commands, law } = yield* runFakeLaw(
        {
          bun: "spawn-failure",
          tsgo: { stdout: "fatal: tsgo shim could not find a compiler", exitCode: 1 },
        },
        () => Effect.void
      );

      expect(A.sort(commands, Str.Order)).toEqual(["bun", "tsgo"]);
      expect(A.map(law.lanes, (report) => [report.lane, report.status, report.filesProcessed])).toEqual([
        ["schema-first", "environment-failure", 0],
        ["tsgo", "environment-failure", 1],
        ["biome", "environment-failure", 0],
      ]);
      expect(A.flatMap(law.lanes, (report) => report.environmentDiagnostics)).toEqual([
        expect.stringMatching(/^schema-first could not start: Failed to run subprocess: bun run /u),
        "schema-first processed no files.",
        "tsgo exited 1 without diagnostics: fatal: tsgo shim could not find a compiler",
        expect.stringMatching(/^Biome configuration unusable: Failed to read .*biome\.jsonc\.$/u),
        "biome processed no files.",
      ]);
    }).pipe(provideTestLayer)
  );

  it.effect("reports a Biome run without a JSON report and diagnostics outside the staged sources", () =>
    Effect.gen(function* () {
      const unparsable = yield* runFakeLaw({ biome: { stderr: "check ━━ Some errors", exitCode: 1 } });
      expect(
        pipe(
          laneReport(unparsable.law, "biome"),
          O.map((report) => report.environmentDiagnostics)
        )
      ).toEqual(O.some(["Biome exited 1 without a JSON report: check ━━ Some errors", "biome processed no files."]));

      const located = yield* runFakeLaw({
        biome: {
          stdout: biomeReportJson(0, 1, [
            {
              category: "lint/suspicious/noVar",
              description: "Use let or const instead of var.",
              location: { path: { file: "packages/fixture/src/Contact.ts" } },
            },
            { category: "configuration", message: "Unknown key.", location: { path: "biome.json" } },
            { message: "No location." },
          ]),
          exitCode: 1,
        },
      });
      expect(A.map(located.law.biome, (violation) => [violation.file, violation.ruleId, violation.message])).toEqual([
        ["src/Contact.ts", "lint/suspicious/noVar", "Use let or const instead of var."],
      ]);
      expect(
        pipe(
          laneReport(located.law, "biome"),
          O.map((report) => report.environmentDiagnostics)
        )
      ).toEqual(O.some(["configuration: Unknown key.", "biome: No location."]));
    }).pipe(provideTestLayer)
  );

  it.effect("fails the score command without recording when a lane cannot measure the fixture", () =>
    Effect.gen(function* () {
      const spawned = yield* Ref.make<ReadonlyArray<string>>([]);
      const configs = yield* Ref.make<ReadonlyArray<string>>([]);
      const exit = yield* runAgentEffectivenessEvalScoreCommand({
        dataRoot: O.none(),
        dir: fixtureRoot,
        json: false,
        modelId: O.none(),
        reasoningEffort: O.none(),
        record: true,
        taskPath,
      }).pipe(provideLayer(fakeLawLayer(spawned, configs, { biome: {} })), Effect.exit);

      expect(Exit.isFailure(exit)).toBe(true);
      const error = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
      expect(error).toBeInstanceOf(AgentEffectivenessEvalScorerError);
      expect(S.is(AgentEffectivenessEvalScorerError)(error) ? error.message : "").toContain(
        "Scorer law lanes could not measure the fixture: biome (Biome exited 0 without a JSON report"
      );
    })
  );

  it.effect(
    "scores a fixture copied outside the repository with a dangling tsconfig extends and ignores fixture-local tool config",
    () =>
      withTempFixture(
        Effect.fnUntraced(function* (fixtureDir) {
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          yield* writeText(
            path.join(fixtureDir, "tsconfig.json"),
            JSON.stringify({ extends: "../../../../../tsconfig.base.json", include: ["src/**/*.ts"] })
          );
          yield* writeText(
            path.join(fixtureDir, "src", "Contact.ts"),
            'export const contact: number = "x";\nexport var legacy = 1;\n'
          );
          const score = evaluateLaw(fixtureDir, repoRoot, ["src/Contact.ts"]);

          const baseline = yield* score;
          expectMeasured(baseline);
          expect(A.map(baseline.lanes, (report) => report.filesProcessed)).toEqual([1, 1, 1]);
          expect(A.map(baseline.tsgo, (violation) => [violation.file, violation.ruleId])).toContainEqual([
            "src/Contact.ts",
            "TS2322",
          ]);
          expect(A.map(baseline.biome, (violation) => violation.ruleId)).toContain("lint/suspicious/noVar");

          yield* writeText(
            path.join(fixtureDir, "tsconfig.json"),
            JSON.stringify({ compilerOptions: { noCheck: true, strict: false }, include: [] })
          );
          yield* writeText(
            path.join(fixtureDir, "biome.json"),
            JSON.stringify({ root: true, formatter: { enabled: false }, linter: { enabled: false } })
          );
          expect(yield* score).toEqual(baseline);
        })
      ),
    { timeout: 120_000 }
  );
});
