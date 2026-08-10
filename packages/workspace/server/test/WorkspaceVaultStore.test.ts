import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { WorkspaceVaultStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Workspace";
import { Workspace } from "@beep/workspace-use-cases/server";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const WorkspaceVaultStoreTestLayer = WorkspaceVaultStoreInMemoryLayer.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const decode = S.decodeUnknownResult(schema);
  const encode = S.encodeResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema)(fc), (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      expect(equivalent(decoded, value)).toBe(true);
    }),
    fcRuns(10)
  );
};

describe("@beep/workspace-server WorkspaceVaultStore", () => {
  it("round-trips workspace vault error schemas with schema-derived arbitraries", () => {
    assertSchemaRoundTrip(Workspace.WorkspaceVaultActionError);
    assertSchemaRoundTrip(Workspace.WorkspaceVaultStoreError);
  });

  it.effect(
    "starts unconfigured and persists the selected vault root",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* Workspace.WorkspaceVaultStore;
      const workspaceId = yield* S.decodeEffect(WorkspaceIdentity.WorkspaceId)(1);
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-workspace-vault-" });

      const before = yield* store.getVaultConfig(workspaceId);
      expect(O.isNone(before.vaultRootPath)).toBe(true);

      const input = yield* S.decodeEffect(Workspace.SetWorkspaceVaultInput)({
        vaultRootPath,
        workspaceId: 1,
      });
      const configured = yield* store.setVaultRoot(input);
      const after = yield* store.getVaultConfig(workspaceId);

      expect(O.getOrUndefined(configured.vaultRootPath)).toBe(vaultRootPath);
      expect(after).toStrictEqual(configured);
    }, provideScopedLayer(WorkspaceVaultStoreTestLayer))
  );

  it.effect(
    "rejects a missing vault root before persisting it",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* Workspace.WorkspaceVaultStore;
      const workspaceId = yield* S.decodeEffect(WorkspaceIdentity.WorkspaceId)(1);
      const parent = yield* fs.makeTempDirectoryScoped({ prefix: "beep-workspace-vault-parent-" });
      const missingVaultRootPath = path.join(parent, "missing-vault");

      const input = yield* S.decodeEffect(Workspace.SetWorkspaceVaultInput)({
        vaultRootPath: missingVaultRootPath,
        workspaceId: 1,
      });
      const result = yield* Effect.result(store.setVaultRoot(input));
      const after = yield* store.getVaultConfig(workspaceId);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("WorkspaceVaultRootInvalid");
        expect(result.failure.reason).toContain("does not exist");
      }
      expect(O.isNone(after.vaultRootPath)).toBe(true);
    }, provideScopedLayer(WorkspaceVaultStoreTestLayer))
  );
});
