#!/usr/bin/env bun

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem, Inspectable, Layer, pipe, Runtime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";

const $I = $RepoCliId.create("goals/fallow-advisory-ratchets/ops/validate-packet");

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

const packetRoot = "goals/fallow-advisory-ratchets";
const parentFeatureMatrixPath = "goals/fallow-quality-enforcement/research/feature-matrix.jsonc";
const validatorVersion = "fallow-advisory-ratchets-validator/v1";
const goalCharLimit = 4000;

const requiredFiles = [
  `${packetRoot}/GOAL.md`,
  `${packetRoot}/README.md`,
  `${packetRoot}/SPEC.md`,
  `${packetRoot}/PLAN.md`,
  `${packetRoot}/ops/manifest.json`,
  `${packetRoot}/ops/validate-packet.ts`,
  `${packetRoot}/tasks/tasks.jsonc`,
  `${packetRoot}/tasks/tasks.schema.json`,
];

const commandPattern = /^(?:bun|bunx|git|ruby|test|beep|fallow|npx)(?:\s|$)/;
const repoRefPattern = /^(?:\.?[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/[A-Za-z0-9._-]+)*(?:#[A-Za-z0-9._/-]+)?$/;
const taskIdPattern = /^far-[0-9]{3}$/;
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
  S.makeFilter((value) => taskIdPattern.test(value) || "Expected a task id matching far-NNN.")
).pipe(
  $I.annoteSchema("TaskIdString", {
    description: "Packet task identifier in the far-NNN namespace.",
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
  "packet-authored",
  "policy-inventory",
  "ratchet-candidate",
  "promotion-readiness",
  "deferred",
  "none",
]).pipe($I.annoteSchema("DecisionGateKind", { description: "Decision gate kind for a packet task." }));

const DecisionGateStatus = LiteralKit(["open", "blocked", "passed", "failed"]).pipe(
  $I.annoteSchema("DecisionGateStatus", { description: "Decision gate status for a packet task." })
);

const FeatureFamily = LiteralKit([
  "audit",
  "dead-code",
  "health",
  "boundaries",
  "flags",
  "security",
  "fix-preview",
  "runtime-coverage",
  "editor-mcp-hooks",
]).pipe(
  $I.annoteSchema("FeatureFamily", {
    description: "Fallow feature family tracked by the parent feature matrix.",
  })
);

const BaselineStatus = LiteralKit(["pending", "measured", "not-applicable", "blocked"]).pipe(
  $I.annoteSchema("BaselineStatus", { description: "Measurement status for a parent matrix row." })
);

const FalsePositiveStatus = LiteralKit([
  "none-known",
  "waived-with-expiry",
  "config-gap",
  "tool-bug",
  "doctrine-gap",
  "unknown",
]).pipe($I.annoteSchema("FalsePositiveStatus", { description: "False-positive status for a parent matrix row." }));

const CiMode = LiteralKit(["none", "advisory-artifact", "warning-check", "blocking-check"]).pipe(
  $I.annoteSchema("CiMode", { description: "CI behavior for a parent matrix row." })
);

const PromotionStatus = LiteralKit([
  "research",
  "advisory",
  "candidate-blocking",
  "blocking",
  "deferred",
  "rejected",
]).pipe($I.annoteSchema("PromotionStatus", { description: "Promotion status for a parent matrix row." }));

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
    description: "Implementation task row for the fallow-advisory-ratchets goal.",
  })
) {}

class TasksDocument extends S.Class<TasksDocument>($I`TasksDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-advisory-ratchets/tasks/v1"),
    updated: TrimmedNonEmptyString,
    validatorVersion: S.Literal(validatorVersion),
    tasks: S.NonEmptyArray(TaskRow),
  },
  $I.annote("TasksDocument", {
    description: "Task inventory for the fallow-advisory-ratchets goal.",
  })
) {}

class ManifestInitiative extends S.Class<ManifestInitiative>($I`ManifestInitiative`)(
  {
    id: S.Literal("fallow-advisory-ratchets"),
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
    status: LiteralKit(["pending", "in-progress", "done", "seeded"]),
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
    relatedPackets: S.NonEmptyArray(S.Unknown),
    requiredArtifacts: S.NonEmptyArray(RepoRefString),
    phases: S.NonEmptyArray(ManifestPhase),
    verificationCommands: S.NonEmptyArray(CommandString),
    stopConditions: S.NonEmptyArray(TrimmedNonEmptyString),
  },
  $I.annote("InitiativeManifestDocument", {
    description: "Machine-readable routing manifest for the fallow-advisory-ratchets packet.",
  })
) {}

class FeatureRow extends S.Class<FeatureRow>($I`FeatureRow`)(
  {
    id: TrimmedNonEmptyString,
    featureFamily: FeatureFamily,
    baselineStatus: BaselineStatus,
    falsePositiveStatus: FalsePositiveStatus,
    ciMode: CiMode,
    promotionStatus: PromotionStatus,
  },
  $I.annote("FeatureRow", {
    description: "Minimal parent feature-matrix row fields inspected by this child-packet validator.",
  })
) {}

class FeatureMatrixDocument extends S.Class<FeatureMatrixDocument>($I`FeatureMatrixDocument`)(
  {
    $schema: S.String,
    schemaVersion: S.Literal("fallow-quality-enforcement/feature-matrix/v1"),
    updated: TrimmedNonEmptyString,
    validatorVersion: S.Literal("fallow-quality-enforcement-validator/v1"),
    features: S.NonEmptyArray(FeatureRow),
  },
  $I.annote("FeatureMatrixDocument", {
    description: "Parent Fallow feature-family matrix.",
  })
) {}

const decodeTasksDocument = S.decodeUnknownEffect(TasksDocument);
const decodeManifestDocument = S.decodeUnknownEffect(InitiativeManifestDocument);
const decodeFeatureMatrixDocument = S.decodeUnknownEffect(FeatureMatrixDocument);

const parseErrorsMessage = (relativePath: string, errors: ReadonlyArray<ParseError>): string =>
  `${relativePath}: jsonc parse failed at offsets ${A.join(
    A.map(errors, (error) => `${error.offset}`),
    ", "
  )}`;

const readText = Effect.fn("readText")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(relativePath)
    .pipe(Effect.mapError((cause) => [`${relativePath}: ${Inspectable.toStringUnknown(cause, 0)}`]));
});

const readJsonc = Effect.fn("readJsonc")(function* (relativePath: string) {
  const text = yield* readText(relativePath);
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
  return yield* readText(`${packetRoot}/GOAL.md`).pipe(
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

const rowByFamily = (matrix: FeatureMatrixDocument, featureFamily: typeof FeatureFamily.Type): O.Option<FeatureRow> =>
  A.findFirst(matrix.features, (row) => row.featureFamily === featureFamily);

const requireRow = (
  matrix: FeatureMatrixDocument,
  featureFamily: typeof FeatureFamily.Type,
  check: (row: FeatureRow) => ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    rowByFamily(matrix, featureFamily),
    O.match({
      onNone: () => [`${parentFeatureMatrixPath}: missing ${featureFamily} feature row`],
      onSome: check,
    })
  );

const assertBlocking = (row: FeatureRow): ReadonlyArray<string> => [
  ...(row.promotionStatus === "blocking"
    ? A.empty<string>()
    : [`${row.id}: expected promotionStatus blocking, got ${row.promotionStatus}`]),
  ...(row.ciMode === "blocking-check"
    ? A.empty<string>()
    : [`${row.id}: expected ciMode blocking-check, got ${row.ciMode}`]),
];

const assertNotBlocking = (row: FeatureRow): ReadonlyArray<string> => [
  ...(row.promotionStatus === "blocking" || row.promotionStatus === "candidate-blocking"
    ? [`${row.id}: ${row.featureFamily} must not be promoted by this packet yet`]
    : A.empty<string>()),
  ...(row.ciMode === "blocking-check"
    ? [`${row.id}: ${row.featureFamily} must not use blocking-check before its ratchet prerequisites pass`]
    : A.empty<string>()),
];

const parentMatrixDiagnostics = (matrix: FeatureMatrixDocument): ReadonlyArray<string> => [
  ...requireRow(matrix, "audit", assertBlocking),
  ...requireRow(matrix, "dead-code", assertBlocking),
  ...requireRow(matrix, "health", (row) => [
    ...assertNotBlocking(row),
    ...(row.baselineStatus === "measured" ? A.empty<string>() : [`${row.id}: health baseline must stay measured`]),
    ...(row.promotionStatus === "advisory"
      ? A.empty<string>()
      : [`${row.id}: health must stay advisory during packet authoring`]),
  ]),
  ...requireRow(matrix, "boundaries", assertNotBlocking),
  ...requireRow(matrix, "flags", assertNotBlocking),
  ...requireRow(matrix, "security", assertNotBlocking),
  ...requireRow(matrix, "fix-preview", assertNotBlocking),
  ...requireRow(matrix, "runtime-coverage", (row) => [
    ...assertNotBlocking(row),
    ...(row.promotionStatus === "deferred" ? A.empty<string>() : [`${row.id}: runtime coverage must remain deferred`]),
  ]),
  ...requireRow(matrix, "editor-mcp-hooks", (row) => [
    ...assertNotBlocking(row),
    ...(row.promotionStatus === "deferred" ? A.empty<string>() : [`${row.id}: editor MCP hooks must remain deferred`]),
  ]),
];

const includesText = (text: string, required: string): ReadonlyArray<string> =>
  Str.includes(required)(text) ? A.empty<string>() : [`SPEC.md: missing required contract phrase: ${required}`];

const specTextDiagnostics = Effect.fn("specTextDiagnostics")(function* () {
  const text = yield* readText(`${packetRoot}/SPEC.md`).pipe(Effect.orElseSucceed(() => ""));
  return [
    ...includesText(text, "Do not remove Knip."),
    ...includesText(text, "Do not run non-dry-run `fallow fix`."),
    ...includesText(text, "Do not make runtime coverage blocking."),
    ...includesText(text, "standards/feature-flags.inventory.jsonc"),
    ...includesText(text, 'The thesis is "new debt fails"'),
  ];
});

const validate = Effect.fn("validate")(function* () {
  const fileDiagnostics = yield* requiredFileDiagnostics();
  if (!A.isReadonlyArrayEmpty(fileDiagnostics)) {
    return fileDiagnostics;
  }

  const goalDiagnostics = yield* goalCharLimitDiagnostics();
  const specDiagnostics = yield* specTextDiagnostics();

  const tasksDiagnostics = yield* diagnosticsFrom(
    decodeJsonc(`${packetRoot}/tasks/tasks.jsonc`, decodeTasksDocument),
    taskCrossDiagnostics
  );

  const manifestDiagnostics = yield* decodeJsonc(`${packetRoot}/ops/manifest.json`, decodeManifestDocument).pipe(
    Effect.flatMap((manifest) => manifestArtifactDiagnostics(manifest)),
    Effect.catch((errors) => Effect.succeed(errors))
  );

  const matrixDiagnostics = yield* diagnosticsFrom(
    decodeJsonc(parentFeatureMatrixPath, decodeFeatureMatrixDocument),
    parentMatrixDiagnostics
  );

  return [...goalDiagnostics, ...specDiagnostics, ...tasksDiagnostics, ...manifestDiagnostics, ...matrixDiagnostics];
});

const program = Effect.gen(function* () {
  const diagnostics = yield* validate();

  if (A.isReadonlyArrayEmpty(diagnostics)) {
    yield* Console.log("fallow-advisory-ratchets packet ok");
    return;
  }

  yield* Console.error("fallow-advisory-ratchets packet failed:");
  yield* Effect.forEach(diagnostics, (diagnostic) => Console.error(`- ${diagnostic}`));
  return yield* PacketValidationFailed.make({});
});

NodeRuntime.runMain(program.pipe(Effect.provide(Layer.mergeAll(NodeServices.layer))));
