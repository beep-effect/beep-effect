import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { getWorkspacePackagesSync } from "../../effected/workspaces/WorkspacesSync.ts";
import type { SyncFileSystem } from "../../effected/workspaces/WorkspacesSync.ts";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { WorkspaceEnumerationDepthError } from "../../effected/workspaces/WorkspacesSync.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
      }),
    runs,
  );
};

describe("WorkspacesSync schema fidelity", () => {
  roundTrips("WorkspaceEnumerationDepthError: decode(encode(x)) equals x and never fails", WorkspaceEnumerationDepthError);
});

// README: the optional typed-entry fast path changes cost while preserving
// enumeration results. Repeated reads preserve package and manifest fidelity.
const MemberDocument = S.Struct({
  name: S.Literals(["a", "@scope/b", "c"]),
  version: S.Literals(["1.0.0", "2.0.0"]),
  private: S.Boolean,
  custom: S.Json,
});
const MemberText = S.fromJsonString(MemberDocument);

it.layer(Path.layer, { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "typed and fallback enumeration agree and preserve manifest fields",
    [MemberDocument.pipe(S.Array, Arbitrary.schema)],
    ([documents]) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const files: Record<string, string> = { "/repo/package.json": '{"name":"root","workspaces":["packages/*"]}' };
        for (const [index, document] of A.map(documents, (document, index) => [index, document] as const)) {
          files[`/repo/packages/member-${index}/package.json`] = yield* S.encodeEffect(MemberText)(document);
        }
        const fs = MemoryFileSystem.makeSync(files).sync;
        const typed: SyncFileSystem = {
          ...fs,
          readDirectoryWithTypes: (dir) =>
            A.map(fs.readDirectory(dir), (name) => ({ name, isDirectory: fs.isDirectory(path.join(dir, name)), isSymbolicLink: false })),
        };
        const fallback = getWorkspacePackagesSync("/repo", { fileSystem: fs, path });
        assert.deepStrictEqual(getWorkspacePackagesSync("/repo", { fileSystem: typed, path }), fallback);
        assert.deepStrictEqual(getWorkspacePackagesSync("/repo", { fileSystem: fs, path }), fallback);
        assert.strictEqual(fallback.length, documents.length + 1);
        for (const [index, document] of A.map(documents, (document, index) => [index, document] as const)) {
          const member = A.findFirst(fallback, (pkg) => pkg.relativePath === `packages/member-${index}`);
          assertSome(member, O.getOrThrow(member));
          assert.strictEqual(member.value.name, document.name);
          assert.strictEqual(member.value.version, document.version);
          assert.strictEqual(member.value.private, document.private);
          const parsed = yield* S.decodeEffect(MemberText)(fs.readFile(member.value.packageJsonPath));
          assert.deepStrictEqual(member.value.manifestRecord.custom, parsed.custom);
        }
      }),
    runs,
  );
});
