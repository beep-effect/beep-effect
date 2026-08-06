import {
  FallowReportFinding,
  FallowReportOk,
  FallowReportPayload,
  FindingAttributionSummary,
  fallowEnvelopeFileName,
} from "@beep/repo-cli/test/Quality";
import {
  FallowFeedbackAllowedRoot,
  QualityIssueIndex,
  runYeetFallowFeedbackForTesting,
} from "@beep/repo-cli/test/Yeet";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const TestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const decodeQualityIssueIndex = S.decodeUnknownEffect(S.fromJsonString(QualityIssueIndex));

const RUN_STARTED_AT = "2026-06-16T00:00:00.000Z";
const BEFORE_RUN_START = "2026-06-15T00:00:00.000Z";
const AFTER_RUN_START = "2026-06-16T00:00:01.000Z";

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(TestLayer));

// An ok envelope for one feature family whose finding family agrees with its
// subcommand unless `findingFamily` deliberately breaks the producer contract.
const okEnvelope = (options: {
  readonly advisory: boolean;
  readonly feature?: "audit" | "health";
  readonly findingFamily?: "audit" | "health";
  readonly generatedAt: string;
}): FallowReportOk => {
  const feature = options.feature ?? "health";
  return FallowReportOk.make({
    schemaVersion: "fallow-report-envelope/v1",
    toolVersion: "fallow-test",
    command: `beep quality fallow ${feature}`,
    subcommand: feature,
    baseRef: "origin/main",
    generatedAt: options.generatedAt,
    advisory: options.advisory,
    dirtyWorktree: false,
    reportPath: `.beep/fallow/${feature}.json`,
    rawOutputRef: `.beep/fallow/raw/${feature}.json`,
    attributionKinds: ["inherited-adjacent"],
    findingAttributionSummary: FindingAttributionSummary.make({
      introduced: NonNegativeInt.make(0),
      inheritedAdjacent: NonNegativeInt.make(1),
      notApplicable: NonNegativeInt.make(0),
    }),
    status: "ok",
    exitStatus: NonNegativeInt.make(0),
    report: FallowReportPayload.make({
      findingCount: NonNegativeInt.make(1),
      findings: [
        FallowReportFinding.make({
          attribution: "inherited-adjacent",
          blocking: false,
          featureFamily: options.findingFamily ?? feature,
          id: `${feature}-advisory`,
          parser: `fallow/${feature}/v1`,
          sourceRef: `packages/example/src/${feature}.ts`,
          subCategory: `fallow:${feature}:fixture`,
        }),
      ],
    }),
  });
};

const writeEnvelopeText = Effect.fn("YeetFallowSelfHealTest.writeEnvelopeText")(function* (
  fromDir: string,
  text: string,
  fileName = fallowEnvelopeFileName("health", true)
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(fromDir, { recursive: true });
  const filePath = path.join(fromDir, fileName);
  yield* fs.writeFileString(filePath, `${text}\n`);
  return filePath;
});

// Always written to the advisory-named file for its family: a check-mode envelope
// sitting under an advisory name is exactly the mode-mismatch defect under test.
const writeEnvelope = Effect.fn("YeetFallowSelfHealTest.writeEnvelope")(function* (
  fromDir: string,
  envelope: FallowReportOk
) {
  return yield* writeEnvelopeText(
    fromDir,
    yield* encodeJson(envelope),
    fallowEnvelopeFileName(envelope.subcommand, true)
  );
});

const consoleText = Effect.fn("YeetFallowSelfHealTest.consoleText")(function* () {
  return pipe(yield* TestConsole.logLines, A.filter(P.isString), A.join("\n"));
});

describe("yeet fallow advisory self-heal", () => {
  it.effect("purges stale advisory envelopes, skips the phase, and exits 0", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, generatedAt: BEFORE_RUN_START })
        );

        yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)));

        expect(yield* fs.exists(envelopePath)).toBe(false);

        const index = yield* decodeQualityIssueIndex(yield* fs.readFileString(emitPath));
        expect(index.issues).toEqual([]);
        expect(index.packages).toEqual([]);

        const output = yield* consoleText();
        expect(output).toContain("advisory feedback skipped: stale envelopes purged (1)");
        expect(output).toContain("health (stale)");
        expect(output).toContain("older than the Yeet run start");
        expect(output).toContain("regenerable state");
      })
    )
  );

  it.effect("purges advisory-named envelopes that were produced in check mode", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: false, generatedAt: AFTER_RUN_START })
        );

        yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)));

        expect(yield* fs.exists(envelopePath)).toBe(false);

        const index = yield* decodeQualityIssueIndex(yield* fs.readFileString(emitPath));
        expect(index.issues).toEqual([]);

        const output = yield* consoleText();
        expect(output).toContain("advisory feedback skipped: stale envelopes purged (1)");
        expect(output).toContain("health (mode-mismatch)");
      })
    )
  );

  it.effect("keeps fresh advisory envelopes and emits their findings", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, generatedAt: AFTER_RUN_START })
        );

        yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)));

        expect(yield* fs.exists(envelopePath)).toBe(true);

        const index = yield* decodeQualityIssueIndex(yield* fs.readFileString(emitPath));
        expect(index.issues).toHaveLength(1);
        expect(index.issues[0]).toMatchObject({ blocking: false, id: "fallow:health:health-advisory" });

        const output = yield* consoleText();
        expect(output).toContain("Fallow advisory issue index written to");
        expect(output).not.toContain("advisory feedback skipped");
      })
    )
  );

  it.effect("treats an envelope with an unparseable generatedAt as stale", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, generatedAt: "not-a-timestamp" })
        );

        yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)));

        expect(yield* fs.exists(envelopePath)).toBe(false);
        expect(yield* consoleText()).toContain("health (stale)");
      })
    )
  );

  it.effect("leaves envelopes untouched when the run start is unknown", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, generatedAt: BEFORE_RUN_START })
        );

        yield* runYeetFallowFeedbackForTesting({ advisory: true, emit: emitPath, from: fromDir }).pipe(
          Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir))
        );

        expect(yield* fs.exists(envelopePath)).toBe(true);
        const index = yield* decodeQualityIssueIndex(yield* fs.readFileString(emitPath));
        expect(index.issues).toHaveLength(1);
      })
    )
  );

  it.effect("fails an undecodable envelope with the one-command remedy", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        yield* writeEnvelopeText(fromDir, "{ not json");

        const error = yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)), Effect.flip);

        expect(error.message).toContain("Failed to decode Fallow envelope");
        expect(error.message).toContain("Remedy: rm -rf .beep/fallow");
        expect(error.command).toBe("rm -rf .beep/fallow");
      })
    )
  );

  // Ledger #55 / decision 25: staleness is decided before any contract check, so a
  // leftover envelope self-heals no matter what else it carries. Nothing about a
  // pre-run-start envelope may fail the publish.
  it.effect("self-heals a stale envelope that also disagrees with its feature family", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, findingFamily: "audit", generatedAt: BEFORE_RUN_START })
        );

        yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)));

        expect(yield* fs.exists(envelopePath)).toBe(false);

        const index = yield* decodeQualityIssueIndex(yield* fs.readFileString(emitPath));
        expect(index.issues).toEqual([]);

        const output = yield* consoleText();
        expect(output).toContain("advisory feedback skipped: stale envelopes purged (1)");
        expect(output).toContain("health (stale)");
        expect(output).not.toContain("disagree with the subcommand feature family");
      })
    )
  );

  it.effect("fails a fresh envelope whose findings disagree with its feature family", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const envelopePath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, findingFamily: "audit", generatedAt: AFTER_RUN_START })
        );

        const error = yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)), Effect.flip);

        expect(error.message).toContain("disagree with the subcommand feature family");
        expect(error.message).toContain("Remedy: rm -rf .beep/fallow");
        expect(error.command).toBe("rm -rf .beep/fallow");
        expect(error.exitCode).toBe(1);
        // Current-run producer output, not regenerable leftover state, so the
        // envelope survives for inspection instead of being silently purged.
        expect(yield* fs.exists(envelopePath)).toBe(true);
      })
    )
  );

  it.effect("heals leftovers first, then still fails a surviving fresh family mismatch", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fromDir = path.join(tmpDir, ".beep", "fallow");
        const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
        const stalePath = yield* writeEnvelope(fromDir, okEnvelope({ advisory: true, generatedAt: BEFORE_RUN_START }));
        const freshPath = yield* writeEnvelope(
          fromDir,
          okEnvelope({ advisory: true, feature: "audit", findingFamily: "health", generatedAt: AFTER_RUN_START })
        );

        const error = yield* runYeetFallowFeedbackForTesting({
          advisory: true,
          emit: emitPath,
          from: fromDir,
          runStartedAt: RUN_STARTED_AT,
        }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)), Effect.flip);

        expect(yield* fs.exists(stalePath)).toBe(false);
        expect(yield* fs.exists(freshPath)).toBe(true);
        expect(error.message).toContain(".beep/fallow/audit.json");

        // The purge note and the absent-directory index are still emitted, so no
        // downstream consumer can read a half-truth built from the stale file.
        const index = yield* decodeQualityIssueIndex(yield* fs.readFileString(emitPath));
        expect(index.issues).toEqual([]);
        expect(yield* consoleText()).toContain("health (stale)");
      })
    )
  );
});
