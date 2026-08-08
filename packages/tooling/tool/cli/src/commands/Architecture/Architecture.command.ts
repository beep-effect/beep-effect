/**
 * Architecture command wiring.
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { A, Text } from "@beep/utils";
import { Console, Effect, FileSystem } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import { makeArchitectureOperationPlan, makeArchitecturePackageOperationPlan } from "./Architecture.plan.ts";
import {
  ArchitectureDomainKind,
  ArchitecturePackageRole,
  ArchitecturePlanStage,
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

const planFileFlag = Flag.string("file").pipe(
  Flag.withAlias("f"),
  Flag.withDescription("Path to a JSON operation plan emitted by `beep architecture plan`")
);

const stageFlag = (defaultValue: ArchitecturePlanStage) =>
  Flag.string("stage").pipe(
    Flag.withDescription("Architecture proof stage: core, persistence, protocol, client, or full"),
    Flag.withDefault(defaultValue)
  );

const domainKindFlag = Flag.string("domain-kind").pipe(
  Flag.withDescription("Domain-kind archetype for the concept: aggregates, entities, or values"),
  Flag.withDefault(defaultArchitecturePlanTarget.domainKind)
);

const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDescription("Emit the schema-versioned JSON operation plan without writing files")
);

const planSliceFlag = Flag.string("slice").pipe(
  Flag.withDescription("Slice or bounded-context name"),
  Flag.withDefault(defaultArchitecturePlanTarget.boundedContext)
);

const planConceptFlag = Flag.string("concept").pipe(
  Flag.withDescription("Concept name"),
  Flag.withDefault(defaultArchitecturePlanTarget.concept)
);

const decodeStage = (value: string): Effect.Effect<ArchitecturePlanStage, DomainError> =>
  S.decodeUnknownEffect(ArchitecturePlanStage)(value).pipe(
    Effect.mapError(DomainError.newCause(`Invalid architecture stage "${value}"`))
  );

const decodeDomainKind = (value: string): Effect.Effect<ArchitectureDomainKind, DomainError> =>
  S.decodeUnknownEffect(ArchitectureDomainKind)(value).pipe(
    Effect.mapError(DomainError.newCause(`Invalid architecture domain kind "${value}"`))
  );

const decodeRole = (value: string): Effect.Effect<ArchitectureSliceRole, DomainError> =>
  S.decodeUnknownEffect(ArchitectureSliceRole)(value).pipe(
    Effect.mapError(DomainError.newCause(`Invalid architecture role "${value}"`))
  );

const decodePackageRole = (value: string): Effect.Effect<ArchitecturePackageRole, DomainError> =>
  S.decodeUnknownEffect(ArchitecturePackageRole)(value).pipe(
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

const runWriteCommand = Effect.fn(function* (plan: CanonicalSliceOperationPlan, dryRun: boolean) {
  if (dryRun) {
    yield* printPlanJson(plan);
    return;
  }
  const rootDir = yield* findRepoRoot();
  const result = yield* applyCanonicalSliceOperationPlan(rootDir, plan);
  yield* reportApplyResult(result);
  const registeredSlugs = yield* CreatePackageIdentityRegistration.registerMissingWorkspaceIdentityPackages(rootDir);
  if (A.isReadonlyArrayNonEmpty(registeredSlugs)) {
    yield* Console.log(`architecture identity registration: registered ${A.join(registeredSlugs, ", ")}`);
  }
});

const architecturePlanCommand = Command.make(
  "plan",
  {
    slice: planSliceFlag,
    concept: planConceptFlag,
    domainKind: domainKindFlag,
    stage: stageFlag(defaultArchitecturePlanTarget.stage),
  },
  Effect.fn(function* ({ slice, concept, domainKind, stage }) {
    const plan = yield* makePlanFromCommand(slice, concept, domainKind, stage);
    yield* printPlanJson(plan);
  })
).pipe(Command.withDescription("Emit a schema-versioned architecture operation plan as JSON"));

const architectureApplyCommand = Command.make(
  "apply",
  {
    file: planFileFlag,
  },
  Effect.fn(function* ({ file }) {
    const rootDir = yield* findRepoRoot();
    const plan = yield* readOperationPlanFile(file);
    const result = yield* applyCanonicalSliceOperationPlan(rootDir, plan);
    yield* reportApplyResult(result);
  })
).pipe(Command.withDescription("Consume and apply a canonical architecture operation-plan JSON document"));

const architectureCheckCommand = Command.make(
  "check",
  {
    file: planFileFlag,
  },
  Effect.fn(function* ({ file }) {
    const rootDir = yield* findRepoRoot();
    const plan = yield* readOperationPlanFile(file);
    const result = yield* checkCanonicalSliceOperationPlan(rootDir, plan);
    yield* reportCheckResult(result);
    yield* ensureIdempotent(result);
  })
).pipe(Command.withDescription("Validate that a canonical architecture operation plan is idempotent"));

const createSliceCommand = Command.make(
  "slice",
  {
    slice: Argument.string("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
    concept: Argument.string("concept").pipe(Argument.withDescription("Concept name")),
    domainKind: domainKindFlag,
    stage: stageFlag("core"),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ slice, concept, domainKind, stage, dryRun }) {
    const plan = yield* makePlanFromCommand(slice, concept, domainKind, stage);
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(Command.withDescription("Create a canonical slice from the architecture operation-plan factory"));

const createPackageCommand = Command.make(
  "package",
  {
    slice: Argument.string("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
    role: Argument.string("role").pipe(Argument.withDescription("Slice package role to create")),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ slice, role, dryRun }) {
    const plan = yield* makePackagePlanFromCommand(slice, role);
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(Command.withDescription("Create a shell-only canonical slice role package"));

const addConceptCommand = Command.make(
  "concept",
  {
    slice: Argument.string("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
    concept: Argument.string("concept").pipe(Argument.withDescription("Concept name")),
    domainKind: domainKindFlag,
    stage: stageFlag("core"),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ slice, concept, domainKind, stage, dryRun }) {
    const plan = yield* makePlanFromCommand(slice, concept, domainKind, stage);
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(Command.withDescription("Add a concept through the architecture operation-plan factory"));

const addRoleCommand = Command.make(
  "role",
  {
    slice: Argument.string("slice").pipe(Argument.withDescription("Slice or bounded-context name")),
    concept: Argument.string("concept").pipe(Argument.withDescription("Concept name")),
    role: Argument.string("role").pipe(Argument.withDescription("Architecture role to add")),
    domainKind: domainKindFlag,
    stage: stageFlag(defaultArchitecturePlanTarget.stage),
    dryRun: dryRunFlag,
  },
  Effect.fn(function* ({ slice, concept, role, domainKind, stage, dryRun }) {
    const decodedRole = yield* decodeRole(role);
    const plan = yield* makePlanFromCommand(slice, concept, domainKind, stage, O.some([decodedRole]));
    yield* runWriteCommand(plan, dryRun);
  })
).pipe(Command.withDescription("Add a role through the architecture operation-plan factory"));

const printCreateIndex = () => printLines(["architecture create commands: slice, package"]);

const printAddIndex = () => printLines(["architecture add commands: concept, role"]);

const architectureCreateCommand = Command.make("create", {}, printCreateIndex).pipe(
  Command.withDescription("Create canonical architecture parts"),
  Command.withSubcommands([createSliceCommand, createPackageCommand])
);

const architectureAddCommand = Command.make("add", {}, printAddIndex).pipe(
  Command.withDescription("Add canonical architecture parts"),
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
