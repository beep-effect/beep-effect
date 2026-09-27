import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns } from "@beep/test-utils";
import { WorkspaceVaultStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Workspace";
import { Workspace } from "@beep/workspace-use-cases/server";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeWorkspaceSetWorkspaceVaultInput = S.decodeEffect(Workspace.SetWorkspaceVaultInput);
const decodeWorkspaceIdentityWorkspaceId = S.decodeEffect(WorkspaceIdentity.WorkspaceId);

const WorkspaceVaultStoreTestLayer = WorkspaceVaultStoreInMemoryLayer.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const decode = S.decodeUnknownResult(schema);
  const encode = S.encodeResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  expect(equivalent(decoded, value)).toBe(true);
};

describe("@beep/workspace-server WorkspaceVaultStore", () => {
  it.prop(
    "round-trips workspace vault error schemas with schema-derived arbitraries",
    {
      actionError: Arbitrary.schema(Workspace.WorkspaceVaultActionError),
      storeError: Arbitrary.schema(Workspace.WorkspaceVaultStoreError),
    },
    ({ actionError, storeError }) => {
      assertSchemaRoundTrip(Workspace.WorkspaceVaultActionError, actionError);
      assertSchemaRoundTrip(Workspace.WorkspaceVaultStoreError, storeError);
    },
    { arbitrary: fcRuns(10) }
  );

  it.layer(Layer.fresh(WorkspaceVaultStoreTestLayer))((it) => {
    it.effect(
      "starts unconfigured and persists the selected vault root",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* Workspace.WorkspaceVaultStore;
        const workspaceId = yield* decodeWorkspaceIdentityWorkspaceId(1);
        const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-workspace-vault-" });

        const before = yield* store.getVaultConfig(workspaceId);
        assertNone(before.vaultRootPath);

        const input = yield* decodeWorkspaceSetWorkspaceVaultInput({
          vaultRootPath,
          workspaceId: 1,
        });
        const configured = yield* store.setVaultRoot(input);
        const after = yield* store.getVaultConfig(workspaceId);

        assertSome(configured.vaultRootPath, vaultRootPath);
        expect(after).toStrictEqual(configured);
      })
    );
  });

  it.layer(Layer.fresh(WorkspaceVaultStoreTestLayer))((it) => {
    it.effect(
      "rejects a missing vault root before persisting it",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const store = yield* Workspace.WorkspaceVaultStore;
        const workspaceId = yield* decodeWorkspaceIdentityWorkspaceId(1);
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "beep-workspace-vault-parent-" });
        const missingVaultRootPath = path.join(parent, "missing-vault");

        const input = yield* decodeWorkspaceSetWorkspaceVaultInput({
          vaultRootPath: missingVaultRootPath,
          workspaceId: 1,
        });
        const result = yield* Effect.result(store.setVaultRoot(input));
        const after = yield* store.getVaultConfig(workspaceId);

        pipe(result, Result.isFailure, assertTrue);
        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe("WorkspaceVaultRootInvalid");
          expect(result.failure.reason).toContain("does not exist");
        }
        assertNone(after.vaultRootPath);
      })
    );
  });
});
