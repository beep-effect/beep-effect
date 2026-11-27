/**
 * Architecture command wiring.
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { A, Text } from "@beep/utils";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { registerScaffoldedWorkspaces, scaffoldedRegistrationGaps } from "../CreatePackage/CreatePackage.command.ts";
import { registerMissingWorkspaceIdentityPackages } from "../CreatePackage/internal/IdentityBulkRegistration.ts";
import {
  ensureCurrentModelFirstReferences,
  makeArchitectureOperationPlan,
  makeArchitecturePackageOperationPlan,
  makeModelFirstContextOperationPlan,
  modelFirstPackagePathsOf,
  shapeOfOperationPlan,
} from "./Architecture.plan.ts";
import {
  ArchitectureDomainKind,
  ArchitecturePackageRole,
  ArchitecturePlanStage,
  ArchitectureShape,
  ArchitectureSliceRole,
  decodeCanonicalSliceOperationPlanJson,
  defaultArchitecturePlanTarget,
  encodeCanonicalSliceOperationPlanJson,
} from "./Architecture.schemas.ts";
import { applyCanonicalSliceOperationPlan, checkCanonicalSliceOperationPlan } from "./OperationPlanExecution.ts";
import type {
  CanonicalSliceOperationPlan,
  OperationPlanApplyResult,
  OperationPlanCheckResult,
} from "./Architecture.schemas.ts";

const decodeUnknownArchitectureDomainKind = S.decodeUnknownEffect(ArchitectureDomainKind);
const decodeUnknownArchitecturePackageRole = S.decodeUnknownEffect(ArchitecturePackageRole);
const decodeUnknownArchitecturePlanStage = S.decodeUnknownEffect(ArchitecturePlanStage);
const decodeUnknownArchitectureSliceRole = S.decodeUnknownEffect(ArchitectureSliceRole);
const decodeUnknownArchitectureShape = S.decodeUnknownEffect(ArchitectureShape);

const planFileFlag = Flag.String("file").pipe(
  Flag.withAlias("f"),
  Flag.withDescription("Path to a JSON operation plan emitted by `beep architecture plan`")
);

const stageFlag = (defaultValue: ArchitecturePlanStage) =>
  Flag.String("stage").pipe(
    Flag.withDescription("Architecture proof stage: core, persistence, protocol, client, or full"),
    Flag.withDefault(defaultValue)
  );

const domainKindFlag = Flag.String("domain-kind").pipe(
  Flag.withDescription("Domain-kind archetype for the concept: aggregates, entities, or values"),
  Flag.withDefault(defaultArchitecturePlanTarget.domainKind)
);

const dryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Emit the schema-versioned JSON operation plan without writing files")
);

const shapeFlag = Flag.String("shape").pipe(
  Flag.withDescription(
    "Slice shape: model-first (the four-package context) or legacy (the seven-package slice); see `plan --help` for how plan resolves it"
  ),
  Flag.optional
);

const planStageFlag = Flag.String("stage").pipe(
  Flag.withDescription(
    "Legacy shape only: architecture proof stage (core, persistence, protocol, client, or full; default full)"
  ),
  Flag.optional
);

const planDomainKindFlag = Flag.String("domain-kind").pipe(
  Flag.withDescription("Legacy shape only: domain-kind archetype (aggregates, entities, or values)"),
  Flag.optional
);

const decodeShape = (value: string): Effect.Effect<ArchitectureShape, DomainError> =>
  decodeUnknownArchitectureShape(value).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid architecture shape "${value}". Supported shapes: model-first, legacy`)
    )
  );

const planFromFlags = Effect.fn(function* (flags: {
  readonly shape: O.Option<string>;
  readonly slice: O.Option<string>;
  readonly concept: O.Option<string>;
  readonly domainKind: O.Option<string>;
  readonly stage: O.Option<string>;
}) {
  const usesLegacyFlags = O.isSome(flags.domainKind) || O.isSome(flags.stage);
  const explicit = O.isSome(flags.slice) && O.isSome(flags.concept);
  const resolved = yield* O.match(flags.shape, {
    onNone: () => Effect.succeed(explicit && !usesLegacyFlags ? ("model-first" as const) : ("legacy" as const)),
    onSome: decodeShape,
  });
  const legacy = () =>
    makePlanFromCommand(
      O.getOrElse(flags.slice, () => defaultArchitecturePlanTarget.boundedContext),
      O.getOrElse(flags.concept, () => defaultArchitecturePlanTarget.concept),
      O.getOrElse(flags.domainKind, () => defaultArchitecturePlanTarget.domainKind),
      O.getOrElse(flags.stage, () => defaultArchitecturePlanTarget.stage)
    );
  const modelFirst = Effect.fnUntraced(function* () {
    if (usesLegacyFlags) {
      return yield* DomainError.newMessage("--stage and --domain-kind apply to the legacy shape only.");
    }
    const missing = A.getSomes([
      O.isNone(flags.slice) ? O.some("--slice") : O.none(),
      O.isNone(flags.concept) ? O.some("--concept") : O.none(),
    ]);
    return yield* O.match(O.all({ context: flags.slice, module: flags.concept }), {
      onNone: () =>
        DomainError.newMessage(
          `--shape model-first needs the context and its Module: missing ${A.join(missing, " and ")}.`
        ),
      onSome: (names) =>
        Effect.flatMap(findRepoRoot(), (repoRoot) => makeModelFirstContextOperationPlan({ repoRoot, ...names })),
    });
  });
  return yield* ArchitectureShape.match(resolved, { "model-first": modelFirst, legacy });
});

const ensurePlanShape = Effect.fn(function* (plan: CanonicalSliceOperationPlan, shape: O.Option<string>) {
  const actual = shapeOfOperationPlan(plan);
  if (O.isNone(shape)) return actual;
  const expected = yield* decodeShape(shape.value);
  if (expected !== actual) {
    return yield* DomainError.newMessage(`The plan describes a ${actual} slice, not a ${expected} one.`);
  }
  return actual;
});

const planSliceFlag = Flag.String("slice").pipe(
  Flag.withDescription("Slice or bounded-context name (legacy default: architecture-lab); the context for model-first"),
  Flag.optional
);

const planConceptFlag = Flag.String("concept").pipe(
  Flag.withDescription("Concept name (legacy default: WorkItem); the first Module for model-first"),
  Flag.optional
);

const decodeStage = (value: string): Effect.Effect<ArchitecturePlanStage, DomainError> =>
  decodeUnknownArchitecturePlanStage(value).pipe(
    Effect.mapError(DomainError.newCause(`Invalid architecture stage "${value}"`))
  );

const decodeDomainKind = (value: string): Effect.Effect<ArchitectureDomainKind, DomainError> =>
  decodeUnknownArchitectureDomainKind(value).pipe(
    Effect.mapError(DomainError.newCause(`Invalid architecture domain kind "${value}"`))
  );

const decodeRole = (value: string): Effect.Effect<ArchitectureSliceRole, DomainError> =>
  decodeUnknownArchitectureSliceRole(value).pipe(
    Effect.mapError(DomainError.newCause(`Invalid architecture role "${value}"`))
  );

const decodePackageRole = (value: string): Effect.Effect<ArchitecturePackageRole, DomainError> =>
  decodeUnknownArchitecturePackageRole(value).pipe(
    Effect.mapError(
      DomainError.newCause(
        `Invalid architecture package role "${value}". Supported package roles: domain, use-cases, config, server, tables, client, ui`
      )
    )
  );

const makePlanFromCommand = Effect.fn(function* (
  slice: string,
  concept: string,
  domainKindValue: string,
  stageValue: string,
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>> = O.none()
) {
  const repoRoot = yield* findRepoRoot();
  const domainKind = yield* decodeDomainKind(domainKindValue);
  const stage = yield* decodeStage(stageValue);
  return yield* makeArchitectureOperationPlan(repoRoot, { boundedContext: slice, concept, domainKind, stage }, roles);
});

const makePackagePlanFromCommand = Effect.fn(function* (slice: string, roleValue: string) {
  const role = yield* decodePackageRole(roleValue);
  return yield* makeArchitecturePackageOperationPlan({ boundedContext: slice, role });
});

const printPlanJson = Effect.fn(function* (plan: CanonicalSliceOperationPlan) {
  const json = yield* encodeCanonicalSliceOperationPlanJson(plan);
  yield* Console.log(json);
});

const readOperationPlanFile = Effect.fn(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath);
  return yield* decodeCanonicalSliceOperationPlanJson(content);
});

const reportCheckResult = Effect.fn(function* (result: OperationPlanCheckResult) {
  yield* Console.log(
    `architecture operation-plan idempotent=${result.idempotent} operations=${result.operationStatuses.length} missing=${
      result.missingPaths.length
    } differing=${result.differingPaths.length} unexpected=${result.unexpectedPaths.length}`
  );
});

const reportApplyResult = Effect.fn(function* (result: OperationPlanApplyResult) {
  yield* Console.log(
    `architecture operation-plan apply written=${result.writtenPaths.length} skipped=${result.skippedPaths.length} removed=${result.removedPaths.length}`
  );
});

const ensureIdempotent = Effect.fn(function* (result: OperationPlanCheckResult) {
  if (!result.idempotent) {
    return yield* DomainError.make({
      message: Text.joinLines([
        "Architecture operation plan is not idempotent.",
        `missing=${A.join(result.missingPaths, ",")}`,
        `differing=${A.join(result.differingPaths, ",")}`,
        `unexpected=${A.join(result.unexpectedPaths, ",")}`,
      ]),
    });
  }
});

const registerModelFirstPackages = Effect.fn(function* (rootDir: string, packagePaths: ReadonlyArray<string>) {
  const { addedWorkspaces, registeredSlugs } = yield* registerScaffoldedWorkspaces(rootDir, packagePaths);
  yield* Console.log(
    `architecture context registration: workspaces=${A.join(addedWorkspaces, ",")} identities=${A.join(
      registeredSlugs,
      ","
    )}`
  );
  yield* Console.log(
    "architecture context registration: run `bun install` from the repository root before running the new packages' checks or tests."
  );
});

const registerLegacyIdentities = Effect.fn(function* (rootDir: string) {
  const registeredSlugs = yield* registerMissingWorkspaceIdentityPackages(rootDir);
  if (A.isReadonlyArrayNonEmpty(registeredSlugs)) {
    yield* Console.log(`architecture identity registration: registered ${A.join(registeredSlugs, ", ")}`);
  }
});

const applyAndRegister = Effect.fn(function* (plan: CanonicalSliceOperationPlan, register: boolean) {
  const rootDir = yield* findRepoRoot();
  const shape = shapeOfOperationPlan(plan);
  const packagePaths = shape === "model-first" ? yield* modelFirstPackagePathsOf(plan) : [];
  if (shape === "model-first") yield* ensureCurrentModelFirstReferences(rootDir, plan);
  const result = yield* applyCanonicalSliceOperationPlan(rootDir, plan);
  yield* reportApplyResult(result);
  yield* ArchitectureShape.match(shape, {
    "model-first": () => registerModelFirstPackages(rootDir, packagePaths),
    legacy: () => (register ? registerLegacyIdentities(rootDir) : Effect.void),
  });
});

// After an interrupted apply the files can all match while the packages were
// never registered; check would then call the plan idempotent.
const ensureModelFirstRegistration = Effect.fn(function* (rootDir: string, plan: CanonicalSliceOperationPlan) {
  const packagePaths = yield* modelFirstPackagePathsOf(plan);
  const { missingWorkspaces, missingIdentities } = yield* scaffoldedRegistrationGaps(rootDir, packagePaths);
  if (A.isReadonlyArrayNonEmpty(missingWorkspaces) || A.isReadonlyArrayNonEmpty(missingIdentities)) {
    return yield* DomainError.newMessage(
      Text.joinLines([
        "Architecture operation plan is not registered.",
        `missing-workspaces=${A.join(missingWorkspaces, ",")}`,
        `missing-identities=${A.join(missingIdentities, ",")}`,
        "Run `beep architecture apply --file <plan>` to register them.",
      ])
    );
  }
});

const runWriteCommand = Effect.fn(function* (plan: CanonicalSliceOperationPlan, dryRun: boolean) {
  if (dryRun) {
    yield* printPlanJson(plan);
    return;
  }
  yield* applyAndRegister(plan, true);
});

const architecturePlanCommand = Command.make(
  "plan",
  {
    shape: shapeFlag,
    slice: planSliceFlag,
    concept: planConceptFlag,
    domainKind: planDomainKindFlag,
    stage: planStageFlag,
  },
  Effect.fn(function* (flags) {
    const plan = yield* planFromFlags(flags);
    yield* printPlanJson(plan);
  })
).pipe(
  Command.withDescription(
    "Emit a schema-versioned architecture operation plan as JSON. A bare plan is the legacy lab plan; --shape model-first, or an explicit --slice (the context) and --concept (its Module) with no --stage or --domain-kind, plans a model-first context"
  )
);

const architectureApplyCommand = Command.make(
  "apply",
  {
    file: planFileFlag,
    shape: shapeFlag,
  },
  Effect.fn(function* ({ file, shape }) {
    const plan = yield* readOperationPlanFile(file);
    yield* ensurePlanShape(plan, shape);
    yield* applyAndRegister(plan, false);
  })
).pipe(
  Command.withDescription(
    "Consume and apply a canonical architecture operation-plan JSON document; a model-first plan also registers its packages"
  )
);

const architectureCheckCommand = Command.make(
  "check",
  {
    file: planFileFlag,
    shape: shapeFlag,
  },
  Effect.fn(function* ({ file, shape }) {
    const rootDir = yield* findRepoRoot();
    const plan = yield* readOperationPlanFile(file);
    const planShape = yield* ensurePlanShape(plan, shape);
    // A model-first plan is checked like apply checks it, and its registration is
    // checked too, all read-only; legacy plans check their files alone.
    if (planShape === "model-first") yield* ensureCurrentModelFirstReferences(rootDir, plan);
    const result = yield* checkCanonicalSliceOperationPlan(rootDir, plan);
    yield* reportCheckResult(result);
    yield* ensureIdempotent(result);
    if (planShape === "model-first") yield* ensureModelFirstRegistration(rootDir, plan);
  })
).pipe(Command.withDescription("Validate that a canonical architecture operation plan is idempotent"));

const createContextCommand = Command.make(
  "context",
  {
    context: Argument.String("context").pipe(
      Argument.withDescription("Kebab-case context slug: the packages/<context> folder")
    ),
    module: Argument.String("Module").pipe(Argument.withDescription("PascalCase name of the context's first Module")),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ context, module, dryRun }) {
    const repoRoot = yield* findRepoRoot();
    const plan = yield* makeModelFirstContextOperationPlan({ repoRoot, context, module });
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(
  Command.withDescription(
    "Create a model-first bounded context: the contract, model and host packages with its first Module"
  )
);

const legacyConceptConfig = {
  slice: Argument.String("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
  concept: Argument.String("concept").pipe(Argument.withDescription("Concept name")),
  domainKind: domainKindFlag,
  stage: stageFlag("core"),
  dryRun: dryRunFlag,
};

const writeLegacyConcept = Effect.fn(function* ({
  slice,
  concept,
  domainKind,
  stage,
  dryRun,
}: {
  readonly slice: string;
  readonly concept: string;
  readonly domainKind: string;
  readonly stage: string;
  readonly dryRun: boolean;
}) {
  const plan = yield* makePlanFromCommand(slice, concept, domainKind, stage);
  yield* runWriteCommand(plan, dryRun);
});

const createSliceCommand = Command.make("slice", legacyConceptConfig, writeLegacyConcept).pipe(
  Command.withDescription(
    "Legacy seven-package shape: create a canonical slice from the architecture operation-plan factory"
  )
);

const createPackageCommand = Command.make(
  "package",
  {
    slice: Argument.String("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
    role: Argument.String("role").pipe(Argument.withDescription("Slice package role to create")),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ slice, role, dryRun }) {
    const plan = yield* makePackagePlanFromCommand(slice, role);
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(Command.withDescription("Legacy seven-package shape: create a shell-only canonical slice role package"));

const addConceptCommand = Command.make("concept", legacyConceptConfig, writeLegacyConcept).pipe(
  Command.withDescription("Legacy seven-package shape: add a concept through the architecture operation-plan factory")
);

const addRoleCommand = Command.make(
  "role",
  {
    slice: Argument.String("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
    concept: Argument.String("concept").pipe(Argument.withDescription("Concept name")),
    role: Argument.String("role").pipe(Argument.withDescription("Architecture role to add")),
    domainKind: domainKindFlag,
    stage: stageFlag(defaultArchitecturePlanTarget.stage),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ slice, concept, role, domainKind, stage, dryRun }) {
    const decodedRole = yield* decodeRole(role);
    const plan = yield* makePlanFromCommand(slice, concept, domainKind, stage, O.some([decodedRole]));
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(
  Command.withDescription("Legacy seven-package shape: add a role through the architecture operation-plan factory")
);

const printCreateIndex = () =>
  printLines(["architecture create commands: context (model-first), slice and package (legacy)"]);

const printAddIndex = () => printLines(["architecture add commands (legacy): concept, role"]);

const architectureCreateCommand = Command.make("create", {}, printCreateIndex).pipe(
  Command.withDescription("Create canonical architecture parts"),
  Command.withSubcommands([createContextCommand, createSliceCommand, createPackageCommand])
);

const architectureAddCommand = Command.make("add", {}, printAddIndex).pipe(
  Command.withDescription("Add parts to a legacy seven-package slice"),
  Command.withSubcommands([addConceptCommand, addRoleCommand])
);

const printArchitectureIndex = () => printLines(["architecture commands: create, add, plan, apply, check"]);
/**
 * Architecture automation command group.
 *
 * **Example** (Register architecture command)
 *
 * ```ts
 * import { architectureCommand } from "@beep/repo-cli/commands/Architecture/index"
 *
 * const commandGroups = { architecture: architectureCommand }
 * console.log(Object.keys(commandGroups)) // ["architecture"]
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const architectureCommand = Command.make("architecture", {}, printArchitectureIndex).pipe(
  Command.withDescription("Schema-versioned architecture operation-plan utilities"),
  Command.withSubcommands([
    architectureCreateCommand,
    architectureAddCommand,
    architecturePlanCommand,
    architectureApplyCommand,
    architectureCheckCommand,
  ])
);
