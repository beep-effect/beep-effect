/**
 * Workspace vault store repository adapters.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { PostgresDrizzle } from "@beep/postgres";
import { PosInt } from "@beep/schema/Int";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Workspace } from "@beep/workspace-domain/entities/Workspace";
import { DbSchema } from "@beep/workspace-tables";
import { fromWorkspaceRow, toWorkspaceInsert } from "@beep/workspace-tables/entities/Workspace";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { eq } from "drizzle-orm";
import { Effect, FileSystem, HashMap, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";

const WORKSPACE_TABLE_NAME = "workspace_workspace" as const;

const encodeWorkspaceId = S.encodeSync(WorkspaceIdentity.WorkspaceId);

const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;

const publicIdFor = (id: PosInt): string => `${WORKSPACE_TABLE_NAME}_a${id}`;

const baseWorkspaceEntity = (id: PosInt, vaultRootPath: O.Option<WorkspaceVaultRootPath>): Workspace =>
  S.decodeUnknownSync(Workspace)({
    createdAt: id,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: "WorkspaceWorkspace",
    fixtureKey: "workspace.default",
    id,
    name: "Default Workspace",
    orgId: 1,
    organizationFixtureKey: "organization.default",
    ownerPrincipalFixtureKey: "principal.default",
    publicId: publicIdFor(id),
    rowVersion: 1,
    schemaVersion: "0.0.0",
    source: "System",
    updatedAt: id,
    updatedByPrincipal: SYSTEM_PRINCIPAL,
    vaultRootPath: O.getOrNull(vaultRootPath),
  });

const workspaceIdToNumber = (workspaceId: WorkspaceIdentity.WorkspaceId): PosInt =>
  PosInt.make(Number(encodeWorkspaceId(workspaceId)));

const configFor = (
  workspaceId: WorkspaceIdentity.WorkspaceId,
  vaultRootPath: O.Option<WorkspaceVaultRootPath>
): WorkspaceUseCases.Workspace.WorkspaceVaultConfig =>
  WorkspaceUseCases.Workspace.WorkspaceVaultConfig.make({
    vaultRootPath,
    workspaceId,
  });

const vaultRootInvalid = (
  path: WorkspaceVaultRootPath,
  reason: string
): WorkspaceUseCases.Workspace.WorkspaceVaultRootInvalid =>
  WorkspaceUseCases.Workspace.WorkspaceVaultRootInvalid.make({ path, reason });

const validateVaultRoot = Effect.fn("Workspace.WorkspaceVaultStore.validateVaultRoot")(function* (
  fs: FileSystem.FileSystem,
  path: WorkspaceVaultRootPath
) {
  const info = yield* fs
    .stat(path)
    .pipe(Effect.mapError(() => vaultRootInvalid(path, "Workspace vault root does not exist.")));

  if (info.type !== "Directory") {
    return yield* vaultRootInvalid(path, "Workspace vault root is not a directory.");
  }

  yield* fs
    .access(path, { writable: true })
    .pipe(Effect.mapError(() => vaultRootInvalid(path, "Workspace vault root is not writable.")));
});

/**
 * Builds an in-memory workspace vault store for deterministic tests.
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryWorkspaceVaultStore = Effect.fn("Workspace.WorkspaceVaultStore.makeInMemory")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const store = yield* Ref.make(HashMap.empty<number, WorkspaceVaultRootPath>());

  return WorkspaceUseCases.Workspace.WorkspaceVaultStore.of({
    getVaultConfig: Effect.fn("Workspace.WorkspaceVaultStore.getVaultConfig")(function* (workspaceId) {
      const state = yield* Ref.get(store);
      return configFor(workspaceId, HashMap.get(state, Number(encodeWorkspaceId(workspaceId))));
    }),
    setVaultRoot: Effect.fn("Workspace.WorkspaceVaultStore.setVaultRoot")(function* (input) {
      yield* validateVaultRoot(fs, input.vaultRootPath);
      const id = Number(encodeWorkspaceId(input.workspaceId));
      yield* Ref.update(store, HashMap.set(id, input.vaultRootPath));
      return configFor(input.workspaceId, O.some(input.vaultRootPath));
    }),
  });
});

const repositoryUnavailable =
  (operation: string) =>
  <A2, E, R>(
    effect: Effect.Effect<A2, E, R>
  ): Effect.Effect<A2, WorkspaceUseCases.Workspace.WorkspaceVaultStoreUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Workspace vault store adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: WORKSPACE_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        WorkspaceUseCases.Workspace.WorkspaceVaultStoreUnavailable.make({
          reason: `${operation} failed against ${WORKSPACE_TABLE_NAME}`,
        })
      )
    );

const workspaceTable = DbSchema.workspace;

/**
 * Builds a Drizzle-backed workspace vault store.
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleWorkspaceVaultStore = Effect.fn("Workspace.WorkspaceVaultStore.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;
  const fs = yield* FileSystem.FileSystem;

  return WorkspaceUseCases.Workspace.WorkspaceVaultStore.of({
    getVaultConfig: Effect.fn("Workspace.WorkspaceVaultStore.drizzleGetVaultConfig")(function* (workspaceId) {
      const id = workspaceIdToNumber(workspaceId);
      const rows = yield* db
        .select()
        .from(workspaceTable)
        .where(eq(workspaceTable.id, id))
        .limit(1)
        .pipe(repositoryUnavailable("select Workspace"));
      const workspace = rows[0] === undefined ? O.none<Workspace>() : O.some(fromWorkspaceRow(rows[0]));
      return configFor(
        workspaceId,
        O.match(workspace, {
          onNone: O.none<WorkspaceVaultRootPath>,
          onSome: (value) => value.vaultRootPath,
        })
      );
    }),
    setVaultRoot: Effect.fn("Workspace.WorkspaceVaultStore.drizzleSetVaultRoot")(function* (input) {
      yield* validateVaultRoot(fs, input.vaultRootPath);
      const id = workspaceIdToNumber(input.workspaceId);
      const rows = yield* db
        .select()
        .from(workspaceTable)
        .where(eq(workspaceTable.id, id))
        .limit(1)
        .pipe(repositoryUnavailable("select Workspace"));
      if (rows.length === 0) {
        const seed = baseWorkspaceEntity(id, O.some(input.vaultRootPath));
        yield* db
          .insert(workspaceTable)
          .values({ ...toWorkspaceInsert(seed), id })
          .pipe(repositoryUnavailable("insert Workspace"), Effect.asVoid);
      } else {
        yield* db
          .update(workspaceTable)
          .set({ vaultRootPath: input.vaultRootPath })
          .where(eq(workspaceTable.id, id))
          .pipe(repositoryUnavailable("update Workspace vault root"), Effect.asVoid);
      }
      return configFor(input.workspaceId, O.some(input.vaultRootPath));
    }),
  });
});

/**
 * Default workspace vault store factory.
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeWorkspaceVaultStore = makeInMemoryWorkspaceVaultStore;
