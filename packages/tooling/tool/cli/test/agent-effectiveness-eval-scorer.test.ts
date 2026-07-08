import { fileURLToPath } from "node:url";
import {
  AgentEffectivenessEvalScoreBreakdown,
  aggregateLawFraction,
  buildAgentEffectivenessEvalScoreReport,
  encodeAgentEffectivenessEvalScoreReportJson,
  evaluateSkillOptCompletion,
  lawComponentScore,
  SkillOptTaskManifest,
} from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as S from "effect/Schema";
import type { AgentEffectivenessEvalViolation } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer";

const TestLayer = NodeServices.layer;
const decodeTaskManifest = S.decodeUnknownEffect(SkillOptTaskManifest);

const provideTestLayer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(Layer.build(TestLayer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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

const emptyLaw = {
  schemaFirst: A.empty<AgentEffectivenessEvalViolation>(),
  tsgo: A.empty<AgentEffectivenessEvalViolation>(),
  biome: A.empty<AgentEffectivenessEvalViolation>(),
};

describe("agent-effectiveness eval scorer", () => {
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
        const task = yield* fs
          .readFileString(taskPath)
          .pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(SkillOptTaskManifest))));
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
});
