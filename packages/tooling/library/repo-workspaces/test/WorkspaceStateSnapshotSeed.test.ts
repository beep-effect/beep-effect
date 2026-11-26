import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { CatalogSet, PackageStateSnapshot, WorkspaceStateSnapshot } from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const catalogs = (entries: Record<string, Record<string, string>>): CatalogSet => CatalogSet.make({ entries });

const snapshot = (options: {
  readonly catalogs: CatalogSet;
  readonly importerVersions?: Record<string, Record<string, string>>;
}): WorkspaceStateSnapshot =>
  WorkspaceStateSnapshot.make({
    packages: [PackageStateSnapshot.make({ name: "@x/a", version: "1.0.0", relativePath: "packages/a" })],
    catalogs: options.catalogs,
    ...(options.importerVersions === undefined ? {} : { importerVersions: options.importerVersions }),
  });

describe("WorkspaceStateSnapshot.withSeededCatalogs — precedence", () => {
  it("answers from the seed where this moment's own catalogs cannot", () => {
    const bare = snapshot({ catalogs: CatalogSet.empty() });
    const hookInjectedWithoutSeed = bare.resolve("effect", "catalog:");
    assertNone(hookInjectedWithoutSeed);

    const seeded = bare.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0" } }));
    assertSome(seeded.resolve("effect", "catalog:"), "^4.0.0");
  });

  it("never lets the seed override what this moment itself declared, or a real change would vanish", () => {
    const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
    const seeded = own.withSeededCatalogs(catalogs({ default: { effect: "^9.9.9" } }));
    assertSome(seeded.resolve("effect", "catalog:"), "^4.0.0");
  });

  it("applies per catalog name, not per set — a named catalog falls through independently", () => {
    const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
    const seeded = own.withSeededCatalogs(catalogs({ react18: { react: "^18.2.0" } }));
    const ownWinsInDefault = seeded.resolve("effect", "catalog:");
    assertSome(ownWinsInDefault, "^4.0.0");
    const seedAnswersInReact18 = seeded.resolve("react", "catalog:react18");
    assertSome(seedAnswersInReact18, "^18.2.0");
  });

  it("leaves `catalogs` untouched, so the field still means what it says", () => {
    const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
    const seeded = own.withSeededCatalogs(catalogs({ default: { react: "^18.2.0" } }));
    assert.deepStrictEqual(
      seeded.catalogs.entries,
      { default: { effect: "^4.0.0" } },
      "the seed is its own field: a consumer reading catalogs gets the ref's declaration, never a blend"
    );
    assert.deepStrictEqual(seeded.seededCatalogs?.entries, { default: { react: "^18.2.0" } });
  });

  it("does not mutate the receiver", () => {
    const own = snapshot({ catalogs: CatalogSet.empty() });
    own.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0" } }));
    assert.strictEqual(own.seededCatalogs, undefined);
    assertNone(own.resolve("effect", "catalog:"));
  });

  it("replaces an existing seed rather than merging with it, so precedence never depends on call order", () => {
    const seeded = snapshot({ catalogs: CatalogSet.empty() })
      .withSeededCatalogs(catalogs({ default: { effect: "^4.0.0", react: "^18.2.0" } }))
      .withSeededCatalogs(catalogs({ default: { effect: "^5.0.0" } }));
    assertSome(seeded.resolve("effect", "catalog:"), "^5.0.0");
    const reactFromReplacedSeed = seeded.resolve("react", "catalog:");
    assertNone(reactFromReplacedSeed);
  });
});

describe("WorkspaceStateSnapshot.withSeededCatalogs — against the importerVersions fallback", () => {
  const importerVersions = { "packages/a": { effect: "4.0.0-rc.109" } };

  it("prefers the seed's declared RANGE over the recorded concrete version", () => {
    const bare = snapshot({ catalogs: CatalogSet.empty(), importerVersions });
    const recordedConcreteVersion = bare.resolve("effect", "catalog:");
    assertSome(recordedConcreteVersion, "4.0.0-rc.109");

    const seeded = bare.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0" } }));
    const seededDeclaredRange = seeded.resolve("effect", "catalog:");
    assertSome(seededDeclaredRange, "^4.0.0");
  });

  it("still falls back to importerVersions for a dependency the seed does not carry", () => {
    const seeded = snapshot({ catalogs: CatalogSet.empty(), importerVersions }).withSeededCatalogs(
      catalogs({ default: { react: "^18.2.0" } })
    );
    assertSome(seeded.resolve("effect", "catalog:"), "4.0.0-rc.109");
  });

  it("applies the same precedence in resolveIn", () => {
    const seeded = snapshot({ catalogs: CatalogSet.empty(), importerVersions }).withSeededCatalogs(
      catalogs({ default: { effect: "^4.0.0" } })
    );
    assertSome(seeded.resolveIn("packages/a", "effect", "catalog:"), "^4.0.0");
  });

  it("leaves non-catalog specifiers alone", () => {
    const seeded = snapshot({ catalogs: CatalogSet.empty() }).withSeededCatalogs(
      catalogs({ default: { effect: "^4.0.0" } })
    );
    const plainRangeStaysUnresolved = seeded.resolve("effect", "^3.0.0");
    assertNone(plainRangeStaysUnresolved);
    assertSome(seeded.resolve("@x/a", "workspace:^"), "1.0.0");
  });
});

describe("WorkspaceStateSnapshot — the seeded catalogResolver", () => {
  const seeded = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) }).withSeededCatalogs(
    catalogs({ default: { effect: "^9.9.9", react: "^18.2.0" } })
  );
  it.layer(seeded.catalogResolver, { timeout: "30 seconds" })((it) => {
    it.effect("resolves through the same precedence as `resolve`", () =>
      Effect.gen(function* () {
        const resolver = yield* CatalogResolver;
        const ownBeatsSeed = yield* resolver.rangeOf("effect", O.none());
        assertSome(ownBeatsSeed, "^4.0.0");
        const seedFillsTheGap = yield* resolver.rangeOf("react", O.none());
        assertSome(seedFillsTheGap, "^18.2.0");
        const rangeOf3 = yield* resolver.rangeOf("lodash", O.none());
        assertNone(rangeOf3);
      })
    );
  });
});

describe("WorkspaceStateSnapshot.crossSeed", () => {
  it("gives each side the other's catalogs and keeps its own precedence", () => {
    const before = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
    const after = snapshot({ catalogs: catalogs({ default: { react: "^18.2.0" } }) });
    const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);

    assertSome(seededBefore.resolve("effect", "catalog:"), "^4.0.0");
    assertSome(seededBefore.resolve("react", "catalog:"), "^18.2.0");
    assertSome(seededAfter.resolve("react", "catalog:"), "^18.2.0");
    assertSome(seededAfter.resolve("effect", "catalog:"), "^4.0.0");
  });

  it("returns the pair in the order given, so a diff never reads backwards", () => {
    const before = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
    const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) });
    const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
    assertSome(seededBefore.resolve("effect", "catalog:"), "^4.0.0");
    assertSome(seededAfter.resolve("effect", "catalog:"), "^5.0.0");
  });

  it("still reports a genuine range change between the refs", () => {
    const before = snapshot({ catalogs: catalogs({ default: { effect: "^0.7.0" } }) });
    const after = snapshot({ catalogs: catalogs({ default: { effect: "^0.8.0" } }) });
    const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
    assert.notDeepEqual(
      seededBefore.resolve("effect", "catalog:"),
      seededAfter.resolve("effect", "catalog:"),
      "both sides declare the catalog, so each side's own value wins and the movement survives"
    );
  });

  it("keeps an existing layer-level seed, where replacing it drops the hook-injected catalog on both sides", () => {
    const live = catalogs({ default: { "hooked-dep": "^9.9.9" } });
    const before = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) }).withSeededCatalogs(live);
    const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) }).withSeededCatalogs(live);

    const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);

    assertSome(seededBefore.resolve("hooked-dep", "catalog:"), "^9.9.9");
    assertSome(seededAfter.resolve("hooked-dep", "catalog:"), "^9.9.9");
  });

  it("lets the other side's catalogs win over the receiver's existing seed", () => {
    const before = snapshot({ catalogs: CatalogSet.empty() }).withSeededCatalogs(
      catalogs({ default: { effect: "^1.0.0" } })
    );
    const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) });
    const [seededBefore] = WorkspaceStateSnapshot.crossSeed(before, after);
    const otherRefDeclaration = seededBefore.resolve("effect", "catalog:");
    assertSome(otherRefDeclaration, "^5.0.0");
  });

  it("suppresses a change neither ref declared — the layerNoop limitation, pinned", () => {
    const before = snapshot({ catalogs: CatalogSet.empty(), importerVersions: { ".": { effect: "0.7.0" } } });
    const after = snapshot({ catalogs: CatalogSet.empty(), importerVersions: { ".": { effect: "0.7.0" } } });
    const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
    assert.deepStrictEqual(
      seededBefore.resolve("effect", "catalog:"),
      seededAfter.resolve("effect", "catalog:"),
      "empty own catalogs, as at(ref) under layerNoop: each side gets the catalog only from the other and agrees"
    );
  });
});

describe("WorkspaceStateSnapshot — seededCatalogs and serialization", () => {
  it.effect("round-trips a seeded snapshot", () =>
    Effect.gen(function* () {
      const seeded = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) }).withSeededCatalogs(
        catalogs({ react18: { react: "^18.2.0" } })
      );
      const encoded = yield* S.encodeEffect(WorkspaceStateSnapshot)(seeded);
      const decoded = yield* S.decodeEffect(WorkspaceStateSnapshot)(encoded);
      assertSome(decoded.resolve("react", "catalog:react18"), "^18.2.0");
      assert.deepStrictEqual(decoded.catalogs.entries, { default: { effect: "^4.0.0" } });
    })
  );

  it.effect("carries hookReplays through withSeededCatalogs and crossSeed, and round-trips it", () =>
    Effect.gen(function* () {
      const replays = { "@scope/plugin": "1.0.0" };
      const before = WorkspaceStateSnapshot.make({
        packages: [],
        catalogs: catalogs({ default: { effect: "^4.0.0" } }),
        importerVersions: {},
        hookReplays: replays,
      });
      const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) });
      assert.deepStrictEqual(before.withSeededCatalogs(CatalogSet.empty()).hookReplays, replays);
      const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
      assert.deepStrictEqual(seededBefore.hookReplays, replays);
      assert.isUndefined(seededAfter.hookReplays, "the other side had none, and seeding must not invent one");
      const encoded = yield* S.encodeEffect(WorkspaceStateSnapshot)(seededBefore);
      const decoded = yield* S.decodeEffect(WorkspaceStateSnapshot)(encoded);
      assert.deepStrictEqual(decoded.hookReplays, replays);
    })
  );

  it.effect("decodes a snapshot serialized before hookReplays existed", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(WorkspaceStateSnapshot)({
        packages: [],
        catalogs: { entries: {} },
        importerVersions: {},
      });
      assert.isUndefined(decoded.hookReplays);
    })
  );

  it.effect("decodes a snapshot serialized before the field existed", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(WorkspaceStateSnapshot)({
        packages: [],
        catalogs: { entries: { default: { effect: "^4.0.0" } } },
      });
      assert.strictEqual(
        decoded.seededCatalogs,
        undefined,
        "optional so stored values stay readable; an absent seed is inert, not an empty-set answer"
      );
      assertSome(decoded.resolve("effect", "catalog:"), "^4.0.0");
    })
  );
});

describe("WorkspaceStateSnapshot — inherited names preserve fallback precedence", () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    it(`uses the seed for own dependency ${name} absent from captured catalogs`, () => {
      const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
      const seeded = own.withSeededCatalogs(catalogs({ default: R.fromEntries([[name, "^2.0.0"]]) }));
      assertSome(seeded.resolve(name, "catalog:"), "^2.0.0");
    });
    it(`uses the importer for dependency ${name} absent from both catalog sets`, () => {
      const own = snapshot({
        catalogs: catalogs({ default: { effect: "^4.0.0" } }),
        importerVersions: { ".": R.fromEntries([[name, "2.0.0"]]) },
      });
      const seeded = own.withSeededCatalogs(catalogs({ default: { other: "^3.0.0" } }));
      assertSome(seeded.resolve(name, "catalog:"), "2.0.0");
      assertSome(seeded.resolveIn(".", name, "catalog:"), "2.0.0");
    });
  }

  it("dependency defaults and merged records contain no inherited own keys", () => {
    const pkg = PackageStateSnapshot.make({ name: "bare", relativePath: "." });
    for (const name of ["constructor", "toString", "__proto__"]) {
      for (const record of [
        pkg.dependencies,
        pkg.devDependencies,
        pkg.peerDependencies,
        pkg.optionalDependencies,
        pkg.allDependencies,
      ]) {
        assertNone(R.get(record, name));
      }
    }
  });
});

it.effect.prop(
  "a workspace snapshot generated from its schema survives an encode/decode round trip",
  [Arbitrary.schema(WorkspaceStateSnapshot)],
  ([value]) =>
    Effect.gen(function* () {
      const argument = S.decodeEffect(WorkspaceStateSnapshot);
      const value1 = yield* S.encodeEffect(WorkspaceStateSnapshot)(value);
      const decoded = yield* argument(value1);
      assert.isTrue(S.toEquivalence(WorkspaceStateSnapshot)(decoded, value));
    }),
  { arbitrary: fcRuns(50) }
);
