import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Git, LsTreeEntry } from "@beep/git";
import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { WorkspaceCatalogs } from "@beep/repo-workspaces/WorkspaceCatalogs";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { WorkspaceSnapshots, WorkspaceSnapshotsOptions } from "@beep/repo-workspaces/WorkspaceSnapshots";
import { PackageStateSnapshot } from "@beep/repo-workspaces/WorkspaceStateSnapshot";
import { assert, it } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const PackageText = S.fromJsonString(PackageStateSnapshot);
const platform = Layer.mergeAll(
  Layer.succeed(WorkspaceRoot, {
    find: dual(
      (args) => P.isString(args[0]),
      Effect.fn("WorkspaceRoot.find")(() => Effect.succeed("/repo"))
    ),
  }),
  WorkspaceDiscovery.layerTest(),
  WorkspaceCatalogs.layerTest(),
  ConfigDependencyHooks.layerNoop
);

it.layer(platform, { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "historical manifest parse/stringify fidelity preserves every dependency kind",
    [Arbitrary.schema(PackageStateSnapshot)],
    ([value]) =>
      Effect.gen(function* () {
        let text = yield* S.encodeEffect(PackageText)(value);
        const git = Git.makeTest({
          show: (_cwd, _ref, path) =>
            Effect.succeed(
              path === "./package.json"
                ? O.some('{"workspaces":["packages/*"]}')
                : path === "./packages/member/package.json"
                  ? O.some(text)
                  : O.none()
            ),
          lsTree: () =>
            Effect.succeed(
              A.map(["package.json", "packages/member/package.json"], (path) =>
                LsTreeEntry.make({ path, type: "blob", mode: "100644", oid: Str.repeat(40)("0") })
              )
            ),
        });
        const service = yield* WorkspaceSnapshots.make({ cwd: "/repo" }).pipe(Effect.provideService(Git, git));
        const first = O.getOrThrow((yield* service.at("original")).package(value.name));
        assert.isTrue(
          S.toEquivalence(PackageStateSnapshot)(
            first,
            PackageStateSnapshot.make({ ...value, relativePath: "packages/member" })
          )
        );
        text = yield* S.encodeEffect(PackageText)(first);
        const second = O.getOrThrow((yield* service.at("serialized")).package(value.name));
        assert.isTrue(S.toEquivalence(PackageStateSnapshot)(first, second));
        const value1 = yield* S.encodeEffect(PackageText)(second);
        assert.strictEqual(value1, text);
      }),
    runs
  );
});

it.effect.prop(
  "snapshot options round-trip without materializing lazy defaults",
  [Arbitrary.schema(WorkspaceSnapshotsOptions)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WorkspaceSnapshotsOptions)(value);
      const decoded = yield* S.decodeEffect(WorkspaceSnapshotsOptions)(encoded);
      assert.isTrue(S.toEquivalence(WorkspaceSnapshotsOptions)(decoded, value));
      const value2 = yield* S.encodeEffect(WorkspaceSnapshotsOptions)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);

it.effect("snapshot options accept an absent stopAt and reject an explicit undefined", () =>
  Effect.gen(function* () {
    const value3 = yield* S.decodeEffect(WorkspaceSnapshotsOptions)({});
    assert.deepStrictEqual(value3, WorkspaceSnapshotsOptions.make({}));
    assertFalse(S.is(WorkspaceSnapshotsOptions)({ stopAt: undefined }));
  })
);
