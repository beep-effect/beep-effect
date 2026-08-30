#!/usr/bin/env bun

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem, Inspectable, Layer, Runtime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";

const $I = $RepoCliId.create("goals/fallow-zero-dead-code/ops/validate-packet");

class PacketValidationFailed extends S.TaggedError<PacketValidationFailed>($I`PacketValidationFailed`)(
  "PacketValidationFailed",
  {},
  $I.annote("PacketValidationFailed", {
    description: "Packet validation failed after its diagnostics were reported.",
  })
) {
  override readonly [Runtime.errorExitCode] = 1;
  override readonly [Runtime.errorReported] = false;
}

const packetRoot = "goals/fallow-zero-dead-code";
const validatorVersion = "fallow-zero-dead-code-validator/v1";
const goalCharLimit = 4000;
const regressionBaselinePath = "standards/fallow.dead-code.regression-baseline.jsonc";

const requiredFiles = [
  `${packetRoot}/GOAL.md`,
  `${packetRoot}/README.md`,
  `${packetRoot}/SPEC.md`,
  `${packetRoot}/PLAN.md`,
  `${packetRoot}/ops/manifest.json`,
  `${packetRoot}/ops/validate-packet.ts`,
  `${packetRoot}/tasks/tasks.jsonc`,
  `${packetRoot}/tasks/tasks.schema.json`,
  `${packetRoot}/research/triage.md`,
  `${packetRoot}/history/review-rounds.jsonc`,
];

const commandPattern = /^(?:bun|bunx|git|ruby|test|beep|fallow|npx)(?:\s|$)/;
const repoRefPattern = /^(?:\.?[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/[A-Za-z0-9._-]+)*(?:#[A-Za-z0-9._/-]+)?$/;
const taskIdPattern = /^fzd-[0-9]{3}$/;
const ownerPattern = /^@[A-Za-z0-9][A-Za-z0-9-]*$/;

const isTrimmedNonEmpty = (value: string): boolean => Str.length(value) > 0 && value === Str.trim(value);

const TrimmedNonEmptyString = S.String.check(
  S.makeFilter((value) => isTrimmedNonEmpty(value) || "Expected a trimmed non-empty string.")
).pipe(
  $I.annoteSchema("TrimmedNonEmptyString", {
    description: "String value that cannot be empty or whitespace-only.",
  })
);

const RepoRefString = S.String.check(
  S.makeFilter((value) => (isTrimmedNonEmpty(value) && repoRefPattern.test(value)) || "Expected a repo-relative ref.")
).pipe(
  $I.annoteSchema("RepoRefString", {
    description: "Repository-relative path, markdown anchor, or checked-in evidence reference.",
  })
);

const CommandString = S.String.check(
  S.makeFilter(
    (value) => (isTrimmedNonEmpty(value) && commandPattern.test(value)) || "Expected a known repo command prefix."
  )
).pipe(
  $I.annoteSchema("CommandString", {
    description: "Command string tracked by the packet.",
  })
);

const TaskIdString = S.String.check(
  S.makeFilter((value) => taskIdPattern.test(value) || "Expected a task id matching fzd-NNN.")
).pipe(
  $I.annoteSchema("TaskIdString", {
    description: "Packet task identifier in the fzd-NNN namespace.",
  })
);

const OwnerString = S.String.check(
  S.makeFilter((value) => ownerPattern.test(value) || "Expected an @-prefixed owner handle.")
).pipe(
  $I.annoteSchema("OwnerString", {
    description: "Owner handle responsible for a packet task.",
  })
);

const PositiveInt = S.Int.check(
  S.isGreaterThan(0, {
    description: "A positive integer used for packet task ranking.",
    identifier: $I`PositiveIntCheck`,
    message: "Task rank must be greater than zero",
    title: "Positive Int",
  })
).pipe(
  $I.annoteSchema("PositiveInt", {
    description: "Positive integer schema for ordered packet tasks.",
  })
);

const TaskStatus = LiteralKit(["seeded", "selected", "in-progress", "done", "deferred", "rejected", "blocked"]).pipe(
  $I.annoteSchema("TaskStatus", { description: "Lifecycle status for a packet task." })
);

const TaskPhase = LiteralKit(["P0", "P1", "P2", "P3", "P4"]).pipe(
  $I.annoteSchema("TaskPhase", { description: "Execution phase for a packet task." })
);

const RiskLevel = LiteralKit(["low", "medium", "high"]).pipe(
  $I.annoteSchema("RiskLevel", { description: "Risk level for a packet task." })
);

const DecisionGateKind = LiteralKit([
  "research-complete",
  "zero-findings",
  "feature-matrix-promotion",
  "merge-readiness",
  "none",
]).pipe($I.annoteSchema("DecisionGateKind", { description: "Decision gate kind for a packet task." }));

const DecisionGateStatus = LiteralKit(["open", "blocked", "passed", "failed"]).pipe(
  $I.annoteSchema("DecisionGateStatus", { description: "Decision gate status for a packet task." })
);

class DecisionGate extends S.Class<DecisionGate>($I`DecisionGate`)(
  {
    kind: DecisionGateKind,
    status: DecisionGateStatus,
    evidence: S.NonEmptyArray(RepoRefString),
  },
  $I.annote("DecisionGate", {
    description: "Decision gate attached to a packet task.",
  })
) {}

class TaskRow extends S.Class<TaskRow>($I`TaskRow`)(
  {
    id: TaskIdString,
    rank: PositiveInt,
    status: TaskStatus,
    phase: TaskPhase,
    title: TrimmedNonEmptyString,
    summary: TrimmedNonEmptyString,
    implementationScope: S.NonEmptyArray(RepoRefString),
    proofCommands: S.NonEmptyArray(CommandString),
    acceptanceCommands: S.NonEmptyArray(CommandString),
    dependencies: S.Array(TaskIdString),
    rollbackPlan: TrimmedNonEmptyString,
    evidenceRefs: S.NonEmptyArray(RepoRefString),
    owner: OwnerString,
    riskLevel: RiskLevel,
    decisionGate: DecisionGate,
  },
  $I.annote("TaskRow", {
    description: "Implementation task row for the fallow-zero-dead-code goal.",
  })
) {}

class TasksDocument extends S.Class<TasksDocument>($I`TasksDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-zero-dead-code/tasks/v1"),
    updated: TrimmedNonEmptyString,
    validatorVersion: S.Literal(validatorVersion),
    tasks: S.NonEmptyArray(TaskRow),
  },
  $I.annote("TasksDocument", {
    description: "Task inventory for the fallow-zero-dead-code goal.",
  })
) {}

const ReviewFindingSeverity = LiteralKit(["required", "nice-to-have"]).pipe(
  $I.annoteSchema("ReviewFindingSeverity", { description: "Severity of a review finding." })
);

const ReviewClosureStatus = LiteralKit(["open", "fixed", "waived"]).pipe(
  $I.annoteSchema("ReviewClosureStatus", { description: "Closure status of a review finding." })
);

class ReviewFinding extends S.Class<ReviewFinding>($I`ReviewFinding`)(
  {
    id: TrimmedNonEmptyString,
    severity: ReviewFindingSeverity,
    title: TrimmedNonEmptyString,
    sourceRefs: S.NonEmptyArray(RepoRefString),
    concreteFix: TrimmedNonEmptyString,
    closureStatus: ReviewClosureStatus,
    closureEvidenceRefs: S.Array(RepoRefString),
  },
  $I.annote("ReviewFinding", {
    description: "Single critic finding tracked toward packet closeout.",
  })
) {}

class ReviewRound extends S.Class<ReviewRound>($I`ReviewRound`)(
  {
    roundId: TrimmedNonEmptyString,
    criticId: TrimmedNonEmptyString,
    criticRole: TrimmedNonEmptyString,
    requiredFindingCount: NonNegativeInt,
    openRequiredFindingCount: NonNegativeInt,
    findings: S.Array(ReviewFinding),
  },
  $I.annote("ReviewRound", {
    description: "Critic review round recorded during packet closeout.",
  })
) {}

class ReviewRoundsDocument extends S.Class<ReviewRoundsDocument>($I`ReviewRoundsDocument`)(
  {
    schemaVersion: S.Literal("fallow-zero-dead-code/review-rounds/v1"),
    updated: TrimmedNonEmptyString,
    validatorVersion: S.Literal(validatorVersion),
    rounds: S.Array(ReviewRound),
  },
  $I.annote("ReviewRoundsDocument", {
    description: "Review round inventory for the fallow-zero-dead-code goal.",
  })
) {}

class ManifestInitiative extends S.Class<ManifestInitiative>($I`ManifestInitiative`)(
  {
    id: S.Literal("fallow-zero-dead-code"),
    title: TrimmedNonEmptyString,
    status: TrimmedNonEmptyString,
    created: TrimmedNonEmptyString,
    updated: TrimmedNonEmptyString,
    packetAnchorDocument: S.Literal("SPEC.md"),
  },
  $I.annote("ManifestInitiative", {
    description: "Initiative identity block of the packet manifest.",
  })
) {}

class ManifestPhase extends S.Class<ManifestPhase>($I`ManifestPhase`)(
  {
    id: TaskPhase,
    name: TrimmedNonEmptyString,
    status: LiteralKit(["pending", "in-progress", "done"]),
  },
  $I.annote("ManifestPhase", {
    description: "Phase row in the packet manifest.",
  })
) {}

class InitiativeManifestDocument extends S.Class<InitiativeManifestDocument>($I`InitiativeManifestDocument`)(
  {
    schemaVersion: S.Literal("initiative-manifest/v1"),
    initiative: ManifestInitiative,
    packetPath: S.Literal(packetRoot),
    lifecycle: TrimmedNonEmptyString,
    executionCapable: S.Boolean,
    currentSourceOfTruth: S.NonEmptyArray(RepoRefString),
    agentLaunchers: S.NonEmptyArray(S.Unknown),
    relatedPackets: S.Array(S.Unknown),
    requiredArtifacts: S.NonEmptyArray(RepoRefString),
    phases: S.NonEmptyArray(ManifestPhase),
    verificationCommands: S.NonEmptyArray(CommandString),
    stopConditions: S.NonEmptyArray(TrimmedNonEmptyString),
  },
  $I.annote("InitiativeManifestDocument", {
    description: "Machine-readable routing manifest for the fallow-zero-dead-code packet.",
  })
) {}

class RegressionBaselineDocument extends S.Class<RegressionBaselineDocument>($I`RegressionBaselineDocument`)(
  {
    check: S.Record(S.String, S.Number),
  },
  $I.annote("RegressionBaselineDocument", {
    description: "Fallow dead-code regression baseline counts (only the check block is inspected).",
  })
) {}

const decodeTasksDocument = S.decodeUnknownEffect(TasksDocument);
const decodeReviewRoundsDocument = S.decodeUnknownEffect(ReviewRoundsDocument);
const decodeManifestDocument = S.decodeUnknownEffect(InitiativeManifestDocument);
const decodeRegressionBaselineDocument = S.decodeUnknownEffect(RegressionBaselineDocument);

const parseErrorsMessage = (relativePath: string, errors: ReadonlyArray<ParseError>): string =>
  `${relativePath}: jsonc parse failed at offsets ${A.join(
    A.map(errors, (error) => `${error.offset}`),
    ", "
  )}`;

const readJsonc = Effect.fn("readJsonc")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(relativePath)
    .pipe(Effect.mapError((cause) => [`${relativePath}: ${Inspectable.toStringUnknown(cause, 0)}`]));
  const parseErrors: Array<ParseError> = [];
  const parsed = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (parseErrors.length > 0) {
    return yield* Effect.fail([parseErrorsMessage(relativePath, parseErrors)]);
  }

  return parsed;
});

const decodeJsonc = <A>(
  relativePath: string,
  decode: (input: unknown) => Effect.Effect<A, unknown, never>
): Effect.Effect<A, ReadonlyArray<string>, FileSystem.FileSystem> =>
  readJsonc(relativePath).pipe(
    Effect.flatMap((parsed) =>
      decode(parsed).pipe(
        Effect.mapError((cause) => [`${relativePath}: schema decode failed: ${Inspectable.toStringUnknown(cause, 0)}`])
      )
    )
  );

const diagnosticsFrom = <A>(
  effect: Effect.Effect<A, ReadonlyArray<string>, FileSystem.FileSystem>,
  check: (value: A) => ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> =>
  effect.pipe(
    Effect.map(check),
    Effect.catch((errors) => Effect.succeed(errors))
  );

const requiredFileDiagnostics = Effect.fn("requiredFileDiagnostics")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const checks = yield* Effect.forEach(requiredFiles, (file) =>
    fs.exists(file).pipe(
      Effect.map((exists) => (exists ? O.none<string>() : O.some(`${file}: required packet file is missing`))),
      Effect.orElseSucceed(() => O.some(`${file}: existence check failed`))
    )
  );
  return A.getSomes(checks);
});

const goalCharLimitDiagnostics = Effect.fn("goalCharLimitDiagnostics")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(`${packetRoot}/GOAL.md`).pipe(
    Effect.map((text) =>
      Str.length(text) <= goalCharLimit
        ? A.empty<string>()
        : [`${packetRoot}/GOAL.md: exceeds ${goalCharLimit} characters (${Str.length(text)})`]
    ),
    Effect.orElseSucceed(() => [`${packetRoot}/GOAL.md: could not be read`])
  );
});

const taskCrossDiagnostics = (document: TasksDocument): ReadonlyArray<string> => {
  const tasks = document.tasks;
  const ids = A.map(tasks, (task) => task.id);
  const duplicateIdDiagnostics =
    A.length(A.dedupe(ids)) === A.length(ids) ? A.empty<string>() : ["tasks.jsonc: duplicate task ids"];
  const ranks = A.map(tasks, (task) => task.rank);
  const orderedRankDiagnostics = A.flatMap(tasks, (task, index) =>
    index > 0 && O.isSome(A.get(ranks, index - 1)) && task.rank <= O.getOrElse(A.get(ranks, index - 1), () => 0)
      ? [`tasks.jsonc: ${task.id} rank ${task.rank} is not strictly increasing`]
      : A.empty<string>()
  );
  const statusById = (id: string): O.Option<string> =>
    O.map(
      A.findFirst(tasks, (task) => task.id === id),
      (task) => task.status
    );
  const dependencyDiagnostics = A.flatMap(tasks, (task) =>
    A.flatMap(task.dependencies, (dependency) => {
      if (!A.contains(ids, dependency)) {
        return [`tasks.jsonc: ${task.id} depends on unknown task ${dependency}`];
      }
      if (task.status === "done" && O.getOrElse(statusById(dependency), () => "missing") !== "done") {
        return [`tasks.jsonc: ${task.id} is done but dependency ${dependency} is not`];
      }
      return A.empty<string>();
    })
  );
  return [...duplicateIdDiagnostics, ...orderedRankDiagnostics, ...dependencyDiagnostics];
};

const zeroBaselineDiagnostics = (
  document: TasksDocument
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> => {
  const rebaselineDone = O.exists(
    A.findFirst(document.tasks, (task) => task.id === "fzd-004"),
    (task) => task.status === "done"
  );
  if (!rebaselineDone) {
    return Effect.succeed(A.empty<string>());
  }
  return diagnosticsFrom(decodeJsonc(regressionBaselinePath, decodeRegressionBaselineDocument), (baseline) =>
    A.flatMap(R.toEntries(baseline.check), ([key, value]) =>
      value === 0 ? A.empty<string>() : [`${regressionBaselinePath}: check.${key} must be 0 once fzd-004 is done`]
    )
  );
};

const manifestArtifactDiagnostics = Effect.fn("manifestArtifactDiagnostics")(function* (
  manifest: InitiativeManifestDocument
) {
  const fs = yield* FileSystem.FileSystem;
  const checks = yield* Effect.forEach(manifest.requiredArtifacts, (artifact) =>
    fs.exists(artifact).pipe(
      Effect.map((exists) => (exists ? O.none<string>() : O.some(`${artifact}: manifest required artifact missing`))),
      Effect.orElseSucceed(() => O.some(`${artifact}: existence check failed`))
    )
  );
  return A.getSomes(checks);
});

const validate = Effect.fn("validate")(function* () {
  const fileDiagnostics = yield* requiredFileDiagnostics();
  if (!A.isReadonlyArrayEmpty(fileDiagnostics)) {
    return fileDiagnostics;
  }

  const goalDiagnostics = yield* goalCharLimitDiagnostics();

  const tasksDiagnostics = yield* diagnosticsFrom(
    decodeJsonc(`${packetRoot}/tasks/tasks.jsonc`, decodeTasksDocument),
    taskCrossDiagnostics
  );

  const baselineDiagnostics = yield* decodeJsonc(`${packetRoot}/tasks/tasks.jsonc`, decodeTasksDocument).pipe(
    Effect.flatMap(zeroBaselineDiagnostics),
    Effect.catch((errors) => Effect.succeed(errors))
  );

  const reviewDiagnostics = yield* diagnosticsFrom(
    decodeJsonc(`${packetRoot}/history/review-rounds.jsonc`, decodeReviewRoundsDocument),
    (document) =>
      A.flatMap(document.rounds, (round) => {
        const requiredRows = A.filter(round.findings, (finding) => finding.severity === "required");
        const openRequiredRows = A.filter(requiredRows, (finding) => finding.closureStatus === "open");
        return [
          ...(round.requiredFindingCount === A.length(requiredRows)
            ? A.empty<string>()
            : [
                `review-rounds.jsonc: ${round.roundId} requiredFindingCount ${round.requiredFindingCount} does not match ${A.length(requiredRows)} required finding row(s)`,
              ]),
          ...(round.openRequiredFindingCount === A.length(openRequiredRows)
            ? A.empty<string>()
            : [
                `review-rounds.jsonc: ${round.roundId} openRequiredFindingCount ${round.openRequiredFindingCount} does not match ${A.length(openRequiredRows)} open required finding row(s)`,
              ]),
        ];
      })
  );

  const manifestDiagnostics = yield* decodeJsonc(`${packetRoot}/ops/manifest.json`, decodeManifestDocument).pipe(
    Effect.flatMap((manifest) => manifestArtifactDiagnostics(manifest)),
    Effect.catch((errors) => Effect.succeed(errors))
  );

  return [
    ...goalDiagnostics,
    ...tasksDiagnostics,
    ...baselineDiagnostics,
    ...reviewDiagnostics,
    ...manifestDiagnostics,
  ];
});

const program = Effect.gen(function* () {
  const diagnostics = yield* validate();

  if (A.isReadonlyArrayEmpty(diagnostics)) {
    yield* Console.log("fallow-zero-dead-code packet ok");
    return;
  }

  yield* Console.error("fallow-zero-dead-code packet failed:");
  yield* Effect.forEach(diagnostics, (diagnostic) => Console.error(`- ${diagnostic}`));
  return yield* PacketValidationFailed.make({});
});

NodeRuntime.runMain(program.pipe(Effect.provide(Layer.mergeAll(NodeServices.layer))));
