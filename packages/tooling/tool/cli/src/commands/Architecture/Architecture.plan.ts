/**
 * Architecture operation-plan factories.
 *
 * @packageDocumentation
 * @category constructors
 * @since 0.0.0
 */

import { skippedWorkspaceDirectoryNames, workspaceMembers } from "@beep/repo-cli-kit/RepoWorkspaces";
import { DomainError } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { toIdentityAccessorName } from "../CreatePackage/internal/IdentityExportBlock.ts";
import { TsconfigSyncPlan } from "../TsconfigSync/TsconfigSync.plan.ts";
import {
  ArchitectureContextRole,
  ArchitecturePlanTarget,
  CanonicalSliceOperationPlan,
  defaultArchitecturePlanTarget,
  EnsureAbsentPathOperation,
  EnsureFileOperation,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "./Architecture.schemas.ts";
import { acceptedProofFiles, legacyFixturePaths } from "./internal/AcceptedProofManifest.ts";
import {
  generatedContextRoles,
  modelFirstOperationsFor,
  modelFirstRolePlansFor,
  modelFirstTargetFor,
  modelFirstWorkspaceDependenciesFor,
} from "./internal/ModelFirstContext.ts";
import {
  duplicateBindingsOf,
  ModelFirstContextRequest,
  modelFirstContextNamesFor,
  modelFirstSourceFilesFor,
} from "./internal/ModelFirstTemplates.ts";
import {
  packageShellFileOperationsFor,
  packageShellRolePlanFor,
  packageShellTargetFor,
  shellPackageJsonOperationFor,
} from "./internal/PackageShell.ts";
import {
  isStageIncluded,
  packageNameForRole,
  pathForRole,
  roleAllowedForTarget,
  rolePlanFor,
} from "./internal/RoleTopology.ts";
import {
  isPackageLevelFile,
  proofFileMatchesDomainKind,
  renderAcceptedTemplateForPlan,
  targetPathFor,
} from "./internal/TemplateRetarget.ts";
import type {
  ArchitectureOperation,
  ArchitectureOperationConflictPolicy,
  ArchitectureOperationKind,
  ArchitectureOperationSource,
  ArchitectureOperationWriteMode,
  ArchitecturePackageRole,
  ArchitectureShape,
  ArchitectureSliceRole,
  ArchitectureSliceRolePlan,
} from "./Architecture.schemas.ts";
import type { AcceptedProofFile } from "./internal/AcceptedProofManifest.ts";
import type { GeneratedContextRole, ModelFirstReferences } from "./internal/ModelFirstContext.ts";
import type { ModelFirstContextNames } from "./internal/ModelFirstTemplates.ts";

const defaultPlanTarget = defaultArchitecturePlanTarget;

const operationIdFor = (kind: ArchitectureOperationKind, operationPath: string): string => `${kind}:${operationPath}`;

// Keep these derived defaults aligned with the operation kind literal domain,
// per-operation schema defaults, and withOperationMetadata dispatch below.
const writeModeForKind = (kind: ArchitectureOperationKind): ArchitectureOperationWriteMode => {
  if (kind === "ensure-file") return "ensure-present";
  if (kind === "ensure-absent-path") return "remove-if-present";
  return "write-if-missing";
};

const conflictPolicyForKind = (kind: ArchitectureOperationKind): ArchitectureOperationConflictPolicy => {
  if (kind === "ensure-file") return "require-present";
  if (kind === "ensure-absent-path") return "remove-existing";
  return "skip-identical-fail-different";
};

const withOperationMetadata = (
  operation: ArchitectureOperation,
  operationSource: ArchitectureOperationSource
): ArchitectureOperation => {
  const operationId = operationIdFor(operation.kind, operation.path);
  const writeMode = writeModeForKind(operation.kind);
  const conflictPolicy = conflictPolicyForKind(operation.kind);
  if (operation.kind === "write-file") {
    return WriteFileOperation.make({
      ...operation,
      operationId,
      writeMode,
      conflictPolicy,
      operationSource,
    });
  }
  if (operation.kind === "write-package-json") {
    return WritePackageJsonOperation.make({
      ...operation,
      operationId,
      writeMode,
      conflictPolicy,
      operationSource,
    });
  }
  if (operation.kind === "ensure-file") {
    return EnsureFileOperation.make({
      ...operation,
      operationId,
      writeMode,
      conflictPolicy,
      operationSource,
    });
  }
  return EnsureAbsentPathOperation.make({
    ...operation,
    operationId,
    writeMode,
    conflictPolicy,
    operationSource,
  });
};

const normalizeInput = (input: Partial<ArchitecturePlanTarget> = {}): ArchitecturePlanTarget => {
  const boundedContext = input.boundedContext ?? defaultPlanTarget.boundedContext;
  const concept = input.concept ?? defaultPlanTarget.concept;
  const domainKind = input.domainKind ?? defaultPlanTarget.domainKind;
  return ArchitecturePlanTarget.make({
    boundedContext,
    concept,
    domainKind,
    conceptPath: `${domainKind}/${Str.pascalCase(concept)}`,
    stage: input.stage ?? defaultPlanTarget.stage,
  });
};

const selectFiles = (
  target: ArchitecturePlanTarget,
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>> = O.none()
): ReadonlyArray<AcceptedProofFile> =>
  pipe(
    acceptedProofFiles,
    A.filter((file) => roleAllowedForTarget(target, file.role)),
    A.filter((file) => isStageIncluded(target.stage, file.stage)),
    A.filter((file) => proofFileMatchesDomainKind(target, file)),
    A.filter((file) =>
      pipe(
        roles,
        O.map(A.contains(file.role)),
        O.getOrElse(() => true)
      )
    )
  );

const rolePlansForFiles = (
  target: ArchitecturePlanTarget,
  files: ReadonlyArray<AcceptedProofFile>
): ReadonlyArray<ArchitectureSliceRolePlan> =>
  pipe(
    files,
    A.map((file) => file.role),
    A.dedupe,
    A.map((role) => rolePlanFor(target, role))
  );

const validateRequestedRoles = Effect.fn(function* (
  target: ArchitecturePlanTarget,
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>>
) {
  if (O.isNone(roles)) return;
  const disallowedRoles = pipe(
    roles.value,
    A.filter((role) => !roleAllowedForTarget(target, role))
  );
  if (disallowedRoles.length > 0) {
    return yield* DomainError.newMessage(
      `Architecture ${target.domainKind} concepts do not support role(s): ${A.join(disallowedRoles, ", ")}`
    );
  }
});

/**
 * Build the canonical architecture lab WorkItem operation plan.
 *
 * **Example** (Build WorkItem operation plan)
 *
 * ```ts
 * import { makeCanonicalSliceOperationPlan } from "@beep/repo-cli/commands/Architecture"
 *
 * const plan = makeCanonicalSliceOperationPlan()
 * console.log(plan.target.concept) // "WorkItem"
 * ```
 *
 * @returns Schema-versioned operations for the canonical WorkItem proof slice.
 * @category constructors
 * @since 0.0.0
 */
export const makeCanonicalSliceOperationPlan = (): CanonicalSliceOperationPlan =>
  CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target: defaultPlanTarget,
    roles: pipe(
      ["domain", "use-cases", "config", "server", "tables", "client", "ui", "proof-app", "db-admin"] as const,
      A.map((role) => rolePlanFor(defaultPlanTarget, role))
    ),
    operations: [
      ...pipe(
        acceptedProofFiles,
        A.map((file) =>
          withOperationMetadata(
            EnsureFileOperation.make({
              kind: "ensure-file",
              role: file.role,
              path: file.path,
              description: `Ensure ${file.role} ${defaultPlanTarget.concept} topology file exists.`,
            }),
            "accepted-proof"
          )
        )
      ),
      ...pipe(
        legacyFixturePaths,
        A.map((path) =>
          withOperationMetadata(
            EnsureAbsentPathOperation.make({
              kind: "ensure-absent-path",
              path,
              description: "Remove the legacy fixture-lab Specimen proof surface.",
            }),
            "legacy-cleanup"
          )
        )
      ),
    ],
  });

/**
 * Build a write-capable operation plan from the accepted WorkItem proof files.
 *
 * **Example** (Build write-capable plan)
 *
 * ```ts
 * import { makeArchitectureOperationPlan } from "@beep/repo-cli/commands/Architecture"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect";
 * const program = makeArchitectureOperationPlan("/workspace/beep-effect", {
 *   boundedContext: "research-lab",
 *   concept: "Experiment",
 *   domainKind: "aggregates",
 *   stage: "core"
 * }).pipe(Effect.map((plan) => plan.target.concept))
 *
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then(console.log)
 * ```
 *
 * @effects Reads accepted architecture proof files and existing package-level files under the provided repository root.
 * @category constructors
 * @since 0.0.0
 */
export const makeArchitectureOperationPlan = Effect.fn(function* (
  repoRoot: string,
  input: Partial<ArchitecturePlanTarget> = {},
  roles: O.Option<ReadonlyArray<ArchitectureSliceRole>> = O.none()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = normalizeInput(input);
  yield* validateRequestedRoles(target, roles);
  const selectedFiles = selectFiles(target, roles);

  const writeOperations = yield* Effect.forEach(
    selectedFiles,
    Effect.fnUntraced(function* (file) {
      const operationPath = targetPathFor(file.path, target);
      const targetFileExists = isPackageLevelFile(file.path)
        ? yield* fs.exists(path.join(repoRoot, operationPath)).pipe(Effect.orElseSucceed(thunkFalse))
        : false;
      const contentPath = targetFileExists ? operationPath : file.path;
      const content = yield* fs
        .readFileString(path.join(repoRoot, contentPath))
        .pipe(Effect.mapError(DomainError.newCause(`Failed to read architecture file "${contentPath}"`)));

      return withOperationMetadata(
        WriteFileOperation.make({
          kind: "write-file",
          role: file.role,
          path: operationPath,
          writer: file.writer,
          content: targetFileExists
            ? content
            : renderAcceptedTemplateForPlan({ content, target, sourcePath: file.path }),
          description: targetFileExists
            ? `Preserve existing ${file.role} package-level file while planning ${target.concept}.`
            : `Write ${file.role} ${target.concept} file from the accepted architecture proof.`,
        }),
        "accepted-proof"
      );
    }),
    { concurrency: 1 }
  );

  return CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target,
    roles: rolePlansForFiles(target, selectedFiles),
    operations: [
      ...writeOperations,
      ...pipe(
        legacyFixturePaths,
        A.map((path) =>
          withOperationMetadata(
            EnsureAbsentPathOperation.make({
              kind: "ensure-absent-path",
              path,
              description: "Remove the legacy fixture-lab Specimen proof surface.",
            }),
            "legacy-cleanup"
          )
        )
      ),
    ],
  });
});

/**
 * Build a shell-only slice role package operation plan.
 *
 * **Example** (Build shell package plan)
 *
 * ```ts
 * import { makeArchitecturePackageOperationPlan } from "@beep/repo-cli/commands/Architecture/index"
 * import * as Effect from "effect/Effect";
 * const program = Effect.map(
 *   makeArchitecturePackageOperationPlan({ boundedContext: "research-lab", role: "domain" }),
 *   (plan) => plan.roles[0]?.packageName,
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Builds the shell package plan in memory; filesystem writes happen only when the plan is later applied.
 * @category constructors
 * @since 0.0.0
 */
export const makeArchitecturePackageOperationPlan = Effect.fn(function* (input: {
  readonly boundedContext: string;
  readonly role: ArchitecturePackageRole;
}) {
  const target = packageShellTargetFor(input.boundedContext);
  const rolePlan = packageShellRolePlanFor(target, input.role);

  return CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target,
    roles: [rolePlan],
    operations: [
      withOperationMetadata(shellPackageJsonOperationFor(target, input.role), "package-shell"),
      ...pipe(
        packageShellFileOperationsFor(target, input.role),
        A.map((operation) => withOperationMetadata(operation, "package-shell"))
      ),
    ],
  });
});

const isContextRole = S.is(ArchitectureContextRole);

const ensureIdentityAccessorsFree = Effect.fnUntraced(function* (
  repoRoot: string,
  members: ReadonlyArray<{ readonly name: string; readonly relativePath: string }>,
  target: ArchitecturePlanTarget
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const identity = yield* O.match(
    A.findFirst(members, (member) => member.name === "@beep/identity"),
    {
      onNone: () =>
        DomainError.newMessage(
          "The @beep/identity workspace is not in the repository; its registry names every identity accessor."
        ),
      onSome: Effect.succeed,
    }
  );
  const registryPath = path.join(repoRoot, identity.relativePath, "src/packages.ts");
  const registry = yield* fs
    .readFileString(registryPath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read the identity registry "${registryPath}"`)));
  const owners = HashMap.fromIterable(
    A.map(
      A.fromIterable(
        pipe(registry, Str.matchAll(/export const (\$\w+): Identity\.IdentityComposer<"@beep\/([^"]+)">/gu))
      ),
      (match) => [String(match[1]), String(match[2])] as const
    )
  );
  const clashes = A.flatMap(generatedContextRoles, (role) => {
    const slug = Str.replace("@beep/", "")(packageNameForRole(target, role));
    const accessor = toIdentityAccessorName(slug);
    return pipe(
      HashMap.get(owners, accessor),
      O.filter((owner) => owner !== slug),
      O.map((owner) => `${accessor} (registered to @beep/${owner})`),
      O.toArray
    );
  });
  if (A.isReadonlyArrayNonEmpty(clashes)) {
    return yield* DomainError.newMessage(
      `Context "${target.boundedContext}" would reuse identity accessors another package owns: ${A.join(clashes, ", ")}. Choose another context name.`
    );
  }
});

const modelFirstReferencesFor = Effect.fnUntraced(function* (repoRoot: string, names: ModelFirstContextNames) {
  const path = yield* Path.Path;
  const members = yield* workspaceMembers(repoRoot).pipe(
    Effect.mapError(DomainError.newCause("Failed to read the workspace manifests"))
  );
  const target = modelFirstTargetFor(names);
  const taken = A.flatMap(generatedContextRoles, (role) =>
    A.filter(
      members,
      (member) => member.name === packageNameForRole(target, role) && member.relativePath !== pathForRole(target, role)
    )
  );
  if (A.isReadonlyArrayNonEmpty(taken)) {
    const owners = A.map(taken, (member) => `${member.name} (owned by ${member.relativePath})`);
    return yield* DomainError.newMessage(
      `Context "${names.context}" would generate workspace names already in use: ${A.join(owners, ", ")}. Choose another context name.`
    );
  }
  yield* ensureIdentityAccessorsFree(repoRoot, members, target);
  const descriptors = yield* TsconfigSyncPlan.buildWorkspaceDescriptors(repoRoot).pipe(
    Effect.mapError(DomainError.newCause("Failed to read the workspace tsconfigs"))
  );
  const ownerConfigs = HashMap.fromIterable([
    ...A.map(
      descriptors,
      (descriptor) =>
        [
          descriptor.packageName,
          O.map(O.fromUndefinedOr(descriptor.ownerTsconfigPath), (owner) => path.relative(repoRoot, owner)),
        ] as const
    ),
    ...A.map(
      generatedContextRoles,
      (role) => [packageNameForRole(target, role), O.some(`${pathForRole(target, role)}/tsconfig.json`)] as const
    ),
  ]);
  const referencesOf = Effect.fnUntraced(function* (role: GeneratedContextRole) {
    const ownersOfDependencies = yield* Effect.forEach(
      modelFirstWorkspaceDependenciesFor(names, role),
      (dependency) =>
        O.match(HashMap.get(ownerConfigs, dependency), {
          onNone: () => DomainError.newMessage(`Workspace package "${dependency}" is not in the repository.`),
          onSome: Effect.succeed,
        }),
      { concurrency: 1 }
    );
    return pipe(
      A.getSomes(ownersOfDependencies),
      A.sort(Order.String),
      A.map((tsconfig) => path.relative(pathForRole(target, role), tsconfig))
    );
  });
  return {
    contract: yield* referencesOf("contract"),
    model: yield* referencesOf("model"),
    host: yield* referencesOf("host"),
  } satisfies ModelFirstReferences;
});
const isContextSlug = S.is(S.String.check(S.isPattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)));
const isModuleName = S.is(S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]*$/u)));

/**
 * The slice shape a decoded operation plan describes, read from its roles: a
 * plan whose every role is a context role is model-first.
 *
 * **Example** (A legacy plan's shape)
 *
 * ```ts
 * import { makeCanonicalSliceOperationPlan, shapeOfOperationPlan } from "@beep/repo-cli/commands/Architecture"
 *
 * console.log(shapeOfOperationPlan(makeCanonicalSliceOperationPlan())) // "legacy"
 * ```
 *
 * @param plan - The decoded operation plan.
 * @returns The plan's slice shape.
 * @category getters
 * @since 0.0.0
 */
export const shapeOfOperationPlan = (plan: CanonicalSliceOperationPlan): ArchitectureShape =>
  A.isReadonlyArrayNonEmpty(plan.roles) && A.every(plan.roles, (rolePlan) => isContextRole(rolePlan.role))
    ? "model-first"
    : "legacy";

/**
 * Build the operation plan of a model-first bounded context: the `contract`,
 * `model` and `host` packages, each with the manifest, tsconfig overlays and
 * shell `beep create-package` emits, and the context's first Module rendered
 * from inline templates.
 *
 * **Details**
 *
 * The context is a kebab-case slug and the Module a PascalCase name. The
 * plan's packages have exact exports, one per `src/` file. `web` is not
 * generated until the bindings generator lands.
 *
 * A generated workspace name another workspace owns at another path is refused, and so is an
 * identity accessor (`$<PascalCase slug>Id`) the registry already gives another package: the
 * registrar keeps the first export of a name, so `notes2-contract` and `notes-2-contract` would
 * share `$Notes2ContractId`. The same names at this context's own paths replay a saved plan.
 * Each package gets one project reference per direct workspace dependency, dev dependencies
 * included, sorted by target path and pointing at that workspace's `tsconfig.build.json`, else
 * its `tsconfig.json`, else nothing. That is the set the tsconfig sync writes, so
 * apply-then-check stays idempotent.
 *
 * **Example** (Plan the notes context)
 *
 * ```ts
 * import { makeModelFirstContextOperationPlan } from "@beep/repo-cli/commands/Architecture"
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.map(
 *   makeModelFirstContextOperationPlan({ repoRoot: "/workspace/beep-effect", context: "notes", module: "Note" }),
 *   (plan) => plan.roles.map((role) => role.packageName)
 * )
 * Effect.runPromise(program.pipe(Effect.provide(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer))))).then(console.log)
 * ```
 *
 * @effects Reads the workspace manifests to resolve project references; filesystem writes happen only when the plan is applied.
 * @category constructors
 * @since 0.0.0
 */
export const makeModelFirstContextOperationPlan = Effect.fn(function* (input: {
  readonly repoRoot: string;
  readonly context: string;
  readonly module: string;
}) {
  if (!isContextSlug(input.context)) {
    return yield* DomainError.newMessage(
      `Invalid context "${input.context}": a context is a kebab-case slug such as "notes" or "case-files".`
    );
  }
  if (A.contains(skippedWorkspaceDirectoryNames, input.context)) {
    return yield* DomainError.newMessage(
      `Invalid context "${input.context}": workspace discovery skips a directory named ${input.context} (${A.join(skippedWorkspaceDirectoryNames, ", ")}), so its packages would never be registered.`
    );
  }
  if (!isModuleName(input.module)) {
    return yield* DomainError.newMessage(
      `Invalid Module "${input.module}": a Module is a PascalCase name such as "Note".`
    );
  }
  const names = modelFirstContextNamesFor(
    ModelFirstContextRequest.make({ context: input.context, module: input.module })
  );
  const clashes = A.flatMap(modelFirstSourceFilesFor(names), (file) =>
    A.map(duplicateBindingsOf(file.content), (name) => `${file.role}/${file.path}: ${name}`)
  );
  if (A.isReadonlyArrayNonEmpty(clashes)) {
    return yield* DomainError.newMessage(
      `Context "${input.context}" with Module "${input.module}" would bind a name twice in a generated file (${A.join(clashes, ", ")}). Choose another context or Module name.`
    );
  }
  const references = yield* modelFirstReferencesFor(input.repoRoot, names);
  return CanonicalSliceOperationPlan.make({
    schemaVersion: "architecture-operation-plan/v1",
    target: modelFirstTargetFor(names),
    roles: modelFirstRolePlansFor(names),
    operations: A.map(modelFirstOperationsFor(names, references), (operation) =>
      withOperationMetadata(operation, "model-first-template")
    ),
  });
});

const isProjectConfig = S.is(S.String.check(S.isPattern(/\/tsconfig(\.[a-z]+)?\.json$/u)));

const projectConfigs = (plan: CanonicalSliceOperationPlan): HashMap.HashMap<string, string> =>
  HashMap.fromIterable(
    pipe(
      plan.operations,
      A.filter(S.is(WriteFileOperation)),
      A.filter((operation) => isProjectConfig(operation.path)),
      A.map((operation) => [operation.path, operation.content] as const)
    )
  );

/**
 * Refuse a saved model-first plan whose project references no longer match
 * the workspace graph, for example after `@beep/contract-kit` moved.
 *
 * **Details**
 *
 * The plan is regenerated for its context and Module against the current
 * workspace manifests; every planned tsconfig must equal the regenerated one.
 * A plan generated against the current graph passes unchanged. Applying a
 * stale plan would write references the registration sync then rewrites, so
 * `check` would report drift against the same plan.
 *
 * **Example** (Check a fresh plan)
 *
 * ```ts
 * import {
 *   ensureCurrentModelFirstReferences,
 *   makeModelFirstContextOperationPlan,
 * } from "@beep/repo-cli/commands/Architecture"
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.flatMap(
 *   makeModelFirstContextOperationPlan({ repoRoot: "/workspace/beep-effect", context: "notes", module: "Note" }),
 *   (plan) => ensureCurrentModelFirstReferences("/workspace/beep-effect", plan)
 * )
 * Effect.runPromise(program.pipe(Effect.provide(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer))))).then(console.log)
 * ```
 *
 * @effects Reads the workspace manifests to regenerate the plan's references.
 * @category validation
 * @since 0.0.0
 */
export const ensureCurrentModelFirstReferences = Effect.fn(function* (
  repoRoot: string,
  plan: CanonicalSliceOperationPlan
) {
  const current = yield* makeModelFirstContextOperationPlan({
    repoRoot,
    context: plan.target.boundedContext,
    module: plan.target.concept,
  });
  const expected = projectConfigs(current);
  const stale = pipe(
    A.fromIterable(projectConfigs(plan)),
    A.filter(([path, content]) => !O.contains(HashMap.get(expected, path), content)),
    A.map(([path]) => path),
    A.sort(Order.String)
  );
  if (A.isReadonlyArrayEmpty(stale)) return;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const written = yield* Effect.filter(
    A.map(plan.operations, (operation) => operation.path),
    (file) => fs.exists(path.join(repoRoot, file)).pipe(Effect.orElseSucceed(thunkFalse)),
    { concurrency: 1 }
  );
  const regenerate = `Regenerate the plan with \`beep architecture plan --slice ${plan.target.boundedContext} --concept ${plan.target.concept}\``;
  const recovery = A.isReadonlyArrayNonEmpty(written)
    ? ` These files of the plan already exist, likely from an interrupted apply: ${A.join(A.sort(written, Order.String), ", ")}. Review and reconcile each against the regenerated plan (keep local edits; move or delete a file the regenerated plan should write) before applying it, since apply never overwrites a differing file.`
    : "";
  return yield* DomainError.newMessage(
    `The plan's project references no longer match the workspace graph (${A.join(stale, ", ")}). ${regenerate}.${recovery}`
  );
});

const isWritePackageJsonOperation = S.is(WritePackageJsonOperation);

/**
 * The package directories a model-first plan writes, read from its validated
 * package-manifest operations, after checking that each role plan names the
 * directory its role's manifest is written to.
 *
 * **Details**
 *
 * Registration uses these paths, so an edited plan whose role paths disagree
 * with the files it writes is refused before anything is written; an
 * unmodified plan replays.
 *
 * **Example** (The notes packages)
 *
 * ```ts
 * import { makeModelFirstContextOperationPlan, modelFirstPackagePathsOf } from "@beep/repo-cli/commands/Architecture"
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.flatMap(
 *   makeModelFirstContextOperationPlan({ repoRoot: "/workspace/beep-effect", context: "notes", module: "Note" }),
 *   modelFirstPackagePathsOf
 * )
 * Effect.runPromise(program.pipe(Effect.provide(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer))))).then(console.log)
 * ```
 *
 * @param plan - A model-first operation plan.
 * @returns The repo-relative package directories, in manifest order.
 * @category validation
 * @since 0.0.0
 */
export const modelFirstPackagePathsOf = Effect.fn(function* (plan: CanonicalSliceOperationPlan) {
  const manifests = A.filter(plan.operations, isWritePackageJsonOperation);
  const mismatched = A.filter(
    plan.roles,
    (rolePlan) =>
      !A.some(
        manifests,
        (manifest) =>
          manifest.role === rolePlan.role &&
          manifest.repositoryDirectory === rolePlan.path &&
          manifest.packageName === rolePlan.packageName
      )
  );
  if (A.isReadonlyArrayNonEmpty(mismatched)) {
    return yield* DomainError.newMessage(
      `The plan's role paths do not match the package manifests it writes (${A.join(
        A.map(mismatched, (rolePlan) => `${rolePlan.role}: ${rolePlan.path}`),
        ", "
      )}). Regenerate the plan instead of editing it.`
    );
  }
  return A.map(manifests, (manifest) => manifest.repositoryDirectory);
});
