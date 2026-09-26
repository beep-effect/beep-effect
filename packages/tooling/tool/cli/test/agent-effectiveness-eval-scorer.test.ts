import { fileURLToPath } from "node:url";
import {
  AgentEffectivenessEvalScoreBreakdown,
  aggregateLawFraction,
  buildAgentEffectivenessEvalScoreReport,
  encodeAgentEffectivenessEvalScoreReportJson,
  evalConfigurationId,
  evaluateLaw,
  evaluateSkillOptCompletion,
  lawComponentScore,
  SkillOptTaskManifest,
} from "@beep/repo-cli/test/AgentEffectiveness";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe, Ref, Sink, Stream } from "effect";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { AgentEffectivenessEvalViolation } from "@beep/repo-cli/test/AgentEffectiveness";

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

const cleanHandle = ChildProcessSpawner.makeHandle({
  all: Stream.empty,
  stdout: Stream.empty,
  stderr: Stream.empty,
  stdin: Sink.drain,
  exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.empty,
  isRunning: Effect.succeed(false),
  kill: () => Effect.void,
  pid: ChildProcessSpawner.ProcessId(1),
  unref: Effect.succeed(Effect.void),
});

const recordingLawLayer = (spawned: Ref.Ref<ReadonlyArray<string>>) =>
  Layer.mergeAll(
    BunCrypto.layer,
    NodeFileSystem.layer,
    NodePath.layer,
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make((command) =>
        ChildProcess.isStandardCommand(command)
          ? Ref.update(spawned, A.append(pipe(command.command, Str.split("/"), A.lastNonEmpty))).pipe(
              Effect.as(cleanHandle)
            )
          : Effect.die("unexpected piped law-lane command")
      )
    )
  );

const emptyLaw = {
  schemaFirst: A.empty<AgentEffectivenessEvalViolation>(),
  tsgo: A.empty<AgentEffectivenessEvalViolation>(),
  biome: A.empty<AgentEffectivenessEvalViolation>(),
};

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
      const spawned = yield* Ref.make<ReadonlyArray<string>>([]);
      const law = yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fixtureDir = yield* fs.makeTempDirectoryScoped();
          yield* writeText(path.join(fixtureDir, "src", "Contact.ts"), "export const contact = 1;\n");
          return yield* evaluateLaw(fixtureDir, "/repo", ["src/Contact.ts"]);
        })
      ).pipe(provideLayer(recordingLawLayer(spawned)));
      const commands = yield* Ref.get(spawned);

      expect(law).toEqual(emptyLaw);
      expect(A.sort(commands, Str.Order)).toEqual(["biome", "bun", "tsgo"]);
      expect(A.last(commands)).toEqual(O.some("tsgo"));
    })
  );
});
