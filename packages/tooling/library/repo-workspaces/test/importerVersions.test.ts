import { Lockfile } from "@beep/lockfiles";
import { CatalogSet, WorkspaceStateSnapshot } from "@beep/repo-workspaces";
import { importerVersionsOf, unanimousVersionOf } from "@beep/repo-workspaces/internal/importerVersions";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const reproductionDevDepsLock = (effectVersion: string, platformNodeVersion: string) => `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

catalogs:
  effect:
    effect:
      specifier: ${effectVersion}
      version: ${effectVersion}

importers:

  .:
    devDependencies:
      effect:
        specifier: catalog:effect
        version: ${effectVersion}
      '@effect/platform-node':
        specifier: catalog:effect
        version: ${platformNodeVersion}
      local-link:
        specifier: link:../local
        version: link:../local

packages: {}
`;

const parse = (text: string) => Lockfile.parse(text, { format: "pnpm" });

describe("importerVersionsOf", () => {
  it.effect("indexes an importer's recorded versions by dependency name across fields", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse(reproductionDevDepsLock("4.0.0-beta.99", "4.0.0-beta.99"));
      const index = importerVersionsOf(lockfile);
      assert.strictEqual(
        index["."]?.effect,
        "4.0.0-beta.99",
        "the lockfile records effect only as a devDependency, as pnpm wrote it for the reproduction repo, and the catalog:effect:peers peer has no importer row of its own, so the fallback joins by name across fields"
      );
    })
  );

  it.effect("strips pnpm's peer-disambiguation suffix", () =>
    Effect.gen(function* () {
      const peerSuffixedVersion = "4.0.0-beta.101(effect@4.0.0-beta.101)(ioredis@5.11.1(supports-color@8.1.1))";
      const lockfile = yield* parse(reproductionDevDepsLock("4.0.0-beta.101", peerSuffixedVersion));
      const index = importerVersionsOf(lockfile);
      assert.strictEqual(
        index["."]?.["@effect/platform-node"],
        "4.0.0-beta.101",
        "@effected/lockfiles stores the raw peer chain pnpm writes verbatim, so an unstripped fallback would print it as the version in a changeset table"
      );
    })
  );

  it.effect("skips link: entries — a filesystem edge is not a version", () =>
    Effect.gen(function* () {
      const lockfile = yield* parse(reproductionDevDepsLock("4.0.0-beta.99", "4.0.0-beta.99"));
      const index = importerVersionsOf(lockfile);
      assert.isUndefined(index["."]?.["local-link"]);
    })
  );
});

describe("unanimousVersionOf", () => {
  it("answers when every importer recording the dependency agrees", () => {
    const index = { ".": { effect: "1.2.3" }, "packages/a": { effect: "1.2.3" } };
    assert.strictEqual(unanimousVersionOf(index, "effect"), "1.2.3");
  });

  it("abstains when importers disagree — no single correct answer exists", () => {
    const index = { ".": { effect: "1.2.3" }, "packages/a": { effect: "4.5.6" } };
    assert.isUndefined(unanimousVersionOf(index, "effect"));
  });

  it("ignores importers that record nothing for the dependency", () => {
    const index = { ".": { effect: "1.2.3" }, "packages/a": { other: "9.9.9" } };
    assert.strictEqual(unanimousVersionOf(index, "effect"), "1.2.3");
  });

  it("answers nothing when no importer records it", () => {
    assert.isUndefined(unanimousVersionOf({ ".": { other: "1.0.0" } }, "effect"));
  });
});

const catalogFreeSnapshot = (importerVersions: Record<string, Record<string, string>>) =>
  WorkspaceStateSnapshot.make({
    packages: [],
    catalogs: CatalogSet.empty(),
    importerVersions,
  });

describe("WorkspaceStateSnapshot.resolve — a hook-injected catalog no committed source declares still resolves to a version", () => {
  it("resolves an unresolvable catalog: specifier through the importer index", () => {
    const before = catalogFreeSnapshot({ ".": { effect: "4.0.0-beta.99" } });
    const after = catalogFreeSnapshot({ ".": { effect: "4.0.0-beta.101" } });

    const from = before.resolve("effect", "catalog:effect:peers");
    const to = after.resolve("effect", "catalog:effect:peers");

    assertSome(from, "4.0.0-beta.99");
    assertSome(to, "4.0.0-beta.101");
    assert.notStrictEqual(
      O.getOrNull(from),
      O.getOrNull(to),
      "the two sides must differ so a diff emits a row: in spencerbeggs/type-registry-effect (Actions run 30130459942) effect moved 4.0.0-beta.99 to 4.0.0-beta.101 and zero changesets were written, because catalog:effect:peers, injected by the @effected/pnpm-plugin-effect pnpmfile hook, is in neither pnpm-workspace.yaml (no catalogs at all) nor the lockfile catalogs: block (pnpm records no peer-only catalog), so both sides resolved the same raw string"
    );
  });

  it("abstains when importers disagree rather than inventing an answer", () => {
    const divergent = catalogFreeSnapshot({ ".": { effect: "1.0.0" }, "packages/a": { effect: "2.0.0" } });
    assertNone(divergent.resolve("effect", "catalog:effect:peers"));
  });

  it("leaves a plain range alone for the consumer's raw-specifier fallback, never replacing it with an installed version", () => {
    const state = catalogFreeSnapshot({ ".": { effect: "4.0.0-beta.99" } });
    assertNone(state.resolve("effect", "^4.0.0"));
  });

  it("prefers the catalog set when it can answer", () => {
    const state = WorkspaceStateSnapshot.make({
      packages: [],
      catalogs: CatalogSet.fromCatalogs({ default: { effect: "1.0.0" } }),
      importerVersions: { ".": { effect: "9.9.9" } },
    });
    assertSome(state.resolve("effect", "catalog:"), "1.0.0");
  });
});

describe("WorkspaceStateSnapshot.resolveIn", () => {
  it("answers precisely where resolve must abstain", () => {
    const divergent = catalogFreeSnapshot({ ".": { effect: "1.0.0" }, "packages/a": { effect: "2.0.0" } });
    assertSome(divergent.resolveIn(".", "effect", "catalog:effect:peers"), "1.0.0");
    assertSome(divergent.resolveIn("packages/a", "effect", "catalog:effect:peers"), "2.0.0");
  });

  it("answers nothing for an unknown importer", () => {
    const state = catalogFreeSnapshot({ ".": { effect: "1.0.0" } });
    assertNone(state.resolveIn("packages/nope", "effect", "catalog:effect:peers"));
  });
});

describe("WorkspaceStateSnapshot — wire compatibility", () => {
  it("decodes a value serialized before the optional importerVersions existed, its absent index leaving the fallback inert", () => {
    const decoded = Result.getOrThrow(
      S.decodeResult(WorkspaceStateSnapshot)({
        packages: [],
        catalogs: { entries: {} },
      })
    );
    assertNone(decoded.resolve("effect", "catalog:effect:peers"));
  });
});

describe("importer versions — own-key records", () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    it(`does not fabricate an inherited importer ${name}`, () => {
      const state = catalogFreeSnapshot({ ".": { effect: "1.0.0" } });
      assertNone(state.resolveIn(name, "name", "catalog:missing"));
      assertNone(state.resolveIn(name, "effect", "catalog:missing"));
    });
    it(`does not fabricate an inherited dependency ${name}`, () => {
      const state = catalogFreeSnapshot({ ".": { effect: "1.0.0" } });
      assertNone(state.resolveIn(".", name, "catalog:missing"));
      assertNone(state.resolve(name, "catalog:missing"));
      assert.isUndefined(unanimousVersionOf({ ".": { effect: "1.0.0" } }, name));
    });
    it(`preserves own importer and dependency ${name}, first field wins since pnpm records one version across fields, so a conflict is a malformed lockfile`, () => {
      const lockfile = Result.getOrThrow(
        S.decodeResult(Lockfile)({
          format: "pnpm",
          lockfileVersion: "9.0",
          packages: [],
          workspaceDependencies: [],
          importers: [
            {
              path: name,
              dependencies: [
                { name, specifier: "^1.0.0", version: "1.0.0", depType: "dependencies" },
                { name, specifier: "^2.0.0", version: "2.0.0", depType: "devDependencies" },
              ],
            },
            { path: "packages/z", dependencies: [] },
            { path: "packages/a", dependencies: [] },
          ],
        })
      );
      const index = importerVersionsOf(lockfile);
      assert.deepStrictEqual(R.keys(index), [name, "packages/z", "packages/a"]);
      assertSome(O.flatMap(R.get(index, name), R.get(name)), "1.0.0");
      assert.strictEqual(unanimousVersionOf(index, name), "1.0.0");
      const state = catalogFreeSnapshot(index);
      assertSome(state.resolveIn(name, name, "catalog:missing"), "1.0.0");
    });
  }
});
