import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const request = S.decodeEffect(V.VaultSyncRequest)({
  principal: { kind: "User", userId: 1 },
  principalKey: "User:1",
  actorSourceKind: "User",
  sourceKind: "http",
  orgId: 1,
  workspaceId: 1,
  correlationId: "test",
  sessionRef: "verified",
});
const resolver = (orgId: number, workspaceId: number, diagnostic: boolean, member = true) =>
  V.SessionResolver.of({
    resolve: Effect.fn("SessionTest.resolve")(() => request.pipe(Effect.mapError(() => V.ScopeDenied.make({})))),
    scope: Effect.fn("SessionTest.scope")(() => Effect.succeed(V.VaultSyncScope.make({ orgId, workspaceId }))),
    grants: Effect.fn("SessionTest.grants")(() =>
      Effect.succeed(member ? [V.VaultSyncGrant.make({ orgId, workspaceId, diagnostic })] : [])
    ),
    revoked: Effect.fn("SessionTest.revoked")(() => Effect.never),
  });

it.effect("denies missing identity and missing live authorization service", () =>
  Effect.gen(function* () {
    const identity = yield* request;
    const missingIdentity = yield* Effect.flip(V.authorizeVaultSync("VaultSyncStatus.get", {}));
    const missingResolver = yield* V.authorizeVaultSync("VaultSyncStatus.get", {}).pipe(
      Effect.provideService(V.VaultSyncRequestContext, identity),
      Effect.flip
    );
    expect(missingIdentity._tag).toBe("ScopeDenied");
    expect(missingResolver._tag).toBe("ScopeDenied");
  })
);

it.effect("checks organization, workspace, membership and diagnostic permission independently", () =>
  Effect.gen(function* () {
    const identity = yield* request;
    for (const access of [
      resolver(2, 1, true),
      resolver(1, 2, true),
      resolver(1, 1, false, false),
      resolver(1, 1, false),
    ]) {
      const denial = yield* V.authorizeVaultSync("OperationQueue.get", {}).pipe(
        Effect.provideService(V.VaultSyncRequestContext, identity),
        Effect.provideService(V.SessionResolver, access),
        Effect.flip
      );
      expect(denial._tag).toBe("ScopeDenied");
    }
    yield* V.authorizeVaultSync("OperationQueue.get", {}).pipe(
      Effect.provideService(V.VaultSyncRequestContext, identity),
      Effect.provideService(V.SessionResolver, resolver(1, 1, true))
    );
    yield* V.authorizeVaultSync("VaultSyncStatus.get", {}).pipe(
      Effect.provideService(V.VaultSyncRequestContext, identity),
      Effect.provideService(V.SessionResolver, resolver(1, 1, false))
    );
  })
);

it.effect("public View contracts require the session and declare scope denials", () =>
  Effect.sync(() => {
    for (const view of [V.DestinationList, V.OpenConflicts, V.OperationQueue, V.VaultSyncStatus]) {
      expect(view.definition.middleware).toContain(V.Session);
      expect(view.definition.rejects).toContain(V.ScopeDenied);
    }
  })
);
