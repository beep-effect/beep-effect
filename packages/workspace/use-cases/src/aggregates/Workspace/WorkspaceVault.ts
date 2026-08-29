/**
 * Workspace vault configuration use-case contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";
import { Context, Effect, flow } from "effect";
import * as S from "effect/Schema";
import type { Effect as EffectType } from "effect";

const $I = $WorkspaceUseCasesId.create("aggregates/Workspace/WorkspaceVault");

/**
 * Workspace vault configuration read model.
 *
 * **Example** (Make workspace vault config)
 *
 * ```ts
 * import { WorkspaceVaultConfig } from "@beep/workspace-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const config = WorkspaceVaultConfig.make({
 *   vaultRootPath: O.none(),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(config.vaultRootPath._tag)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class WorkspaceVaultConfig extends S.Class<WorkspaceVaultConfig>($I`WorkspaceVaultConfig`)(
  {
    vaultRootPath: S.OptionFromNullOr(WorkspaceVaultRootPath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Configured local vault root path, absent before onboarding.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace owning the vault configuration.",
    }),
  },
  $I.annote("WorkspaceVaultConfig", {
    description: "Workspace vault configuration read model.",
  })
) {}

/**
 * Input accepted when persisting a workspace vault root.
 *
 * **Example** (Make set vault input)
 *
 * ```ts
 * import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace"
 * import { SetWorkspaceVaultInput } from "@beep/workspace-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = SetWorkspaceVaultInput.make({
 *   vaultRootPath: S.decodeUnknownSync(WorkspaceVaultRootPath)("/tmp/beep-documents-vault"),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.vaultRootPath)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class SetWorkspaceVaultInput extends S.Class<SetWorkspaceVaultInput>($I`SetWorkspaceVaultInput`)(
  {
    vaultRootPath: WorkspaceVaultRootPath.annotateKey({
      description: "Absolute local filesystem path selected as the workspace vault root.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace owning the vault configuration.",
    }),
  },
  $I.annote("SetWorkspaceVaultInput", {
    description: "Input accepted when persisting a workspace vault root.",
  })
) {}

/**
 * Raised when the workspace vault store cannot serve a request.
 *
 * **Example** (Create store unavailable error)
 *
 * ```ts
 * import { WorkspaceVaultStoreUnavailable } from "@beep/workspace-use-cases/public"
 *
 * const error = WorkspaceVaultStoreUnavailable.make({ reason: "select Workspace failed" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceVaultStoreUnavailable extends S.TaggedError<WorkspaceVaultStoreUnavailable>(
  $I`WorkspaceVaultStoreUnavailable`
)(
  "WorkspaceVaultStoreUnavailable",
  {
    reason: S.NonEmptyString,
  },
  $I.annoteError<WorkspaceVaultStoreUnavailable>("WorkspaceVaultStoreUnavailable", {
    description: "The workspace vault store could not serve the request.",
  })
) {}

/**
 * Raised when a selected workspace vault root is not usable by the server.
 *
 * **Example** (Create root invalid error)
 *
 * ```ts
 * import { WorkspaceVaultRootInvalid } from "@beep/workspace-use-cases/public"
 *
 * const error = WorkspaceVaultRootInvalid.make({
 *   path: "/tmp/beep-documents-vault",
 *   reason: "Workspace vault root is not writable."
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceVaultRootInvalid extends S.TaggedError<WorkspaceVaultRootInvalid>($I`WorkspaceVaultRootInvalid`)(
  "WorkspaceVaultRootInvalid",
  {
    path: S.String,
    reason: S.NonEmptyString,
  },
  $I.annoteError<WorkspaceVaultRootInvalid>("WorkspaceVaultRootInvalid", {
    description: "The selected workspace vault root is not an existing writable directory.",
  })
) {}

/**
 * Internal typed workspace vault store failure.
 *
 * **Example** (Decode vault store error)
 *
 * ```ts
 * import { WorkspaceVaultRootInvalid, WorkspaceVaultStoreError } from "@beep/workspace-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(WorkspaceVaultStoreError)(
 *   WorkspaceVaultRootInvalid.make({
 *     path: "/tmp/beep-documents-vault",
 *     reason: "Workspace vault root is not writable."
 *   })
 * )
 * console.log(decoded._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const WorkspaceVaultStoreError = S.Union([WorkspaceVaultStoreUnavailable, WorkspaceVaultRootInvalid]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("WorkspaceVaultStoreError", {
    description: "Internal typed workspace vault store failure.",
  })
);

/**
 * {@inheritDoc WorkspaceVaultStoreError}
 * @category errors
 * @since 0.0.0
 */
export type WorkspaceVaultStoreError = typeof WorkspaceVaultStoreError.Type;

/**
 * Client-safe workspace vault configuration failure.
 *
 * **Example** (Create action error message)
 *
 * ```ts
 * import { WorkspaceVaultActionError } from "@beep/workspace-use-cases/public"
 *
 * const error = WorkspaceVaultActionError.new("SetWorkspaceVault failed")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceVaultActionError extends S.TaggedError<WorkspaceVaultActionError>($I`WorkspaceVaultActionError`)(
  "WorkspaceVaultActionError",
  {
    message: S.String,
  },
  $I.annoteError<WorkspaceVaultActionError>("WorkspaceVaultActionError", {
    description: "Client-safe workspace vault configuration failure.",
  })
) {
  static readonly new = (message: string) => WorkspaceVaultActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}

/**
 * Workspace vault store service shape.
 *
 * **Example** (Implement vault store shape)
 *
 * ```ts
 * import { WorkspaceVaultConfig } from "@beep/workspace-use-cases/public"
 * import type { WorkspaceVaultStoreShape } from "@beep/workspace-use-cases/public"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const service: WorkspaceVaultStoreShape = {
 *   getVaultConfig: (workspaceId) => Effect.succeed(WorkspaceVaultConfig.make({
 *     vaultRootPath: O.none(),
 *     workspaceId
 *   })),
 *   setVaultRoot: (input) => Effect.succeed(WorkspaceVaultConfig.make({
 *     vaultRootPath: O.some(input.vaultRootPath),
 *     workspaceId: input.workspaceId
 *   }))
 * }
 * console.log(service)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface WorkspaceVaultStoreShape {
  readonly getVaultConfig: (
    workspaceId: WorkspaceIdentity.WorkspaceId
  ) => EffectType.Effect<WorkspaceVaultConfig, WorkspaceVaultStoreError>;
  readonly setVaultRoot: (
    input: SetWorkspaceVaultInput
  ) => EffectType.Effect<WorkspaceVaultConfig, WorkspaceVaultStoreError>;
}

/**
 * Workspace vault store service tag.
 *
 * **Example** (Provide vault store service)
 *
 * ```ts
 * import { WorkspaceVaultConfig, WorkspaceVaultStore } from "@beep/workspace-use-cases/public"
 * import type { WorkspaceVaultStoreShape } from "@beep/workspace-use-cases/public"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const service: WorkspaceVaultStoreShape = {
 *   getVaultConfig: (workspaceId) => Effect.succeed(WorkspaceVaultConfig.make({
 *     vaultRootPath: O.none(),
 *     workspaceId
 *   })),
 *   setVaultRoot: (input) => Effect.succeed(WorkspaceVaultConfig.make({
 *     vaultRootPath: O.some(input.vaultRootPath),
 *     workspaceId: input.workspaceId
 *   }))
 * }
 * const program = Effect.gen(function* () {
 *   return (yield* WorkspaceVaultStore) === service
 * }).pipe(Effect.provideService(WorkspaceVaultStore, service))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class WorkspaceVaultStore extends Context.Service<WorkspaceVaultStore, WorkspaceVaultStoreShape>()(
  $I`WorkspaceVaultStore`
) {}
