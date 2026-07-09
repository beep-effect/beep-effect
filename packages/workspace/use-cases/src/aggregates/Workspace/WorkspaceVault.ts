/**
 * Workspace vault configuration use-case contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceUseCasesId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";
import { Context, Effect, flow } from "effect";
import * as S from "effect/Schema";
import type { Effect as EffectType } from "effect";

const $I = $WorkspaceUseCasesId.create("aggregates/Workspace/WorkspaceVault");

/**
 * Workspace vault configuration read model.
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
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceVaultStoreUnavailable extends TaggedErrorClass<WorkspaceVaultStoreUnavailable>(
  $I`WorkspaceVaultStoreUnavailable`
)(
  "WorkspaceVaultStoreUnavailable",
  {
    reason: S.NonEmptyString,
  },
  $I.annote("WorkspaceVaultStoreUnavailable", {
    description: "The workspace vault store could not serve the request.",
  })
) {}

/**
 * Raised when a selected workspace vault root is not usable by the server.
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceVaultRootInvalid extends TaggedErrorClass<WorkspaceVaultRootInvalid>(
  $I`WorkspaceVaultRootInvalid`
)(
  "WorkspaceVaultRootInvalid",
  {
    path: S.String,
    reason: S.NonEmptyString,
  },
  $I.annote("WorkspaceVaultRootInvalid", {
    description: "The selected workspace vault root is not an existing writable directory.",
  })
) {}

/**
 * Internal typed workspace vault store failure.
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
 *
 * @category errors
 * @since 0.0.0
 */
export type WorkspaceVaultStoreError = typeof WorkspaceVaultStoreError.Type;

/**
 * Client-safe workspace vault configuration failure.
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceVaultActionError extends TaggedErrorClass<WorkspaceVaultActionError>(
  $I`WorkspaceVaultActionError`
)(
  "WorkspaceVaultActionError",
  {
    message: S.String,
  },
  $I.annote("WorkspaceVaultActionError", {
    description: "Client-safe workspace vault configuration failure.",
  })
) {
  static readonly new = (message: string) => WorkspaceVaultActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}

/**
 * Workspace vault store service shape.
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
 * @category repositories
 * @since 0.0.0
 */
export class WorkspaceVaultStore extends Context.Service<WorkspaceVaultStore, WorkspaceVaultStoreShape>()(
  $I`WorkspaceVaultStore`
) {}
