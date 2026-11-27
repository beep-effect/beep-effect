import { ImporterDependency } from "@beep/lockfiles/ImporterDependency";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
import { LockfileIntegrity } from "@beep/lockfiles/LockfileIntegrity";
import { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import { WorkspaceDependency } from "@beep/lockfiles/WorkspaceDependency";
import { DependencySpecifier } from "@beep/npm-spec/DependencySpecifier";
import { IntegrityHash } from "@beep/npm-spec/IntegrityHash";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

const roundTrip = Effect.fn("roundTrip")(function* <S extends Schema.Codec<unknown, unknown>>(
  schema: S,
  value: S["Type"]
) {
  const encoded = yield* Schema.encodeUnknownEffect(schema)(value);
  const decoded = yield* Schema.decodeUnknownEffect(schema)(encoded);
  assert.deepStrictEqual(decoded, value);
});

// decision: roundtrip-literal-leaf-arbitraries
const dictionary = <V extends Schema.Top>(
  keys: ReadonlyArray<string>,
  value: V
): Arbitrary.Arbitrary<Record<string, V["Type"]>> =>
  Arbitrary.schema(Schema.Struct(R.fromEntries(A.map(keys, (key) => [key, Schema.optionalKey(value)] as const)))).pipe(
    Arbitrary.map((entries) => {
      assertTrue(Schema.is(Schema.Record(Schema.String, Schema.toType(value)))(entries));
      return { ...entries };
    })
  );

const optional = <S extends Schema.Top>(schema: S): Arbitrary.Arbitrary<S["Type"] | undefined> =>
  Arbitrary.schema(Schema.Struct({ value: Schema.optionalKey(schema) })).pipe(
    Arbitrary.map((entries: { readonly value?: S["Type"] }) => entries.value)
  );

const arrayOf = <A>(item: Arbitrary.Arbitrary<A>, maxLength: number): Arbitrary.Arbitrary<Array<A>> =>
  Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: maxLength }))).pipe(
    Arbitrary.flatMap((length) => Arbitrary.all(Array.from({ length }, () => item)))
  );

// decision: roundtrip-literal-leaf-arbitraries
const Integrity = Schema.Literals([
  "sha512-LgVTMpQtIopCi79SJeDiP0TfWi5CNEc/L/aRdTh3yIvmZXTnheWpKjSZhnvMl8iXbC1tFg9gdHHDMLoV7CnG+w==",
  "sha1-Zm9vYmFy",
  "sha256-YWJjZGVmZ2g=",
  "sha512.deadbeefcafe",
  "10c0/99a4b0f0e7991796b1e7e3f52dceb9137cae2a9dfc8fc0784a550dc4c558e15a",
]);

const specifierArb = Arbitrary.schema(
  Schema.Literals([
    "catalog:",
    "catalog:react18",
    "workspace:*",
    "workspace:^1.2.3",
    "^1.0.0",
    "1.2.3",
    "latest",
    "file:../local",
    "npm:lodash@^4.0.0",
  ])
).pipe(
  Arbitrary.map((s) => Result.getOrThrowWith(Schema.decodeResult(DependencySpecifier.FromString)(s), (error) => error))
);

const DepField = Schema.Literals(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]);

// decision: roundtrip-literal-leaf-arbitraries
const importerDependencyArb: Arbitrary.Arbitrary<ImporterDependency> = Arbitrary.all({
  name: Arbitrary.schema(Schema.Literals(["lodash", "chalk", "@scope/x", "typescript"])),
  specifier: specifierArb,
  depType: Arbitrary.schema(DepField),
  resolution: optional(
    Schema.Struct({
      version: Schema.Literals(["1.0.0", "5.9.3"]),
      peerSuffix: Schema.optionalKey(
        Schema.Literals(["(effect@4.0.0-beta.101)", "(ioredis@5.11.1(supports-color@8.1.1))"])
      ),
    })
  ),
}).pipe(
  Arbitrary.map(({ name, specifier, depType, resolution }) =>
    ImporterDependency.make({
      name,
      specifier,
      depType,
      ...(resolution !== undefined ? { version: resolution.version } : {}),
      ...(resolution?.peerSuffix !== undefined ? { peerSuffix: resolution.peerSuffix } : {}),
    })
  )
);

const lockfileImporterArb: Arbitrary.Arbitrary<LockfileImporter> = Arbitrary.all({
  path: Arbitrary.schema(Schema.Literals([".", "packages/core", "packages/utils"])),
  dependencies: arrayOf(importerDependencyArb, 3),
}).pipe(Arbitrary.map((r) => LockfileImporter.make(r)));

const resolvedPackageArb: Arbitrary.Arbitrary<ResolvedPackage> = Arbitrary.all({
  name: Arbitrary.schema(Schema.Literals(["lodash", "chalk", "packages/core", "@scope/x"])),
  version: Arbitrary.schema(Schema.Literals(["1.0.0", "0.0.0", "5.6.2"])),
  integrity: optional(Integrity).pipe(
    Arbitrary.map((s) =>
      s === undefined ? undefined : Result.getOrThrowWith(Schema.decodeResult(IntegrityHash)(s), (error) => error)
    )
  ),
  isWorkspace: Arbitrary.schema(Schema.Boolean),
  relativePath: optional(Schema.Literals(["packages/core", "packages/utils"])),
  dependencies: dictionary(["a", "b"], Schema.Literals(["^1.0.0", "2.x"])),
  peerDependencies: dictionary(["react", "b"], Schema.Literals(["^18.0.0", "2.x"])),
  peerDependenciesMeta: dictionary(["react", "b"], Schema.Struct({ optional: Schema.Boolean })),
  resolved: dictionary(["a", "b"], Schema.Literals(["a@1.0.0", "b@2.0.0"])),
  unresolvedEdges: Arbitrary.schema(Schema.Array(Schema.Literals(["c", "d"])).check(Schema.isMaxLength(2))),
}).pipe(
  Arbitrary.map((r) =>
    ResolvedPackage.make({
      name: r.name,
      version: r.version,
      instanceId: `${r.name}@${r.version}`,
      isWorkspace: r.isWorkspace,
      dependencies: r.dependencies,
      peerDependencies: r.peerDependencies,
      peerDependenciesMeta: r.peerDependenciesMeta,
      resolved: r.resolved,
      unresolvedEdges: r.unresolvedEdges,
      ...(r.integrity !== undefined ? { integrity: r.integrity } : {}),
      ...(r.relativePath !== undefined ? { relativePath: r.relativePath } : {}),
    })
  )
);

const lockfileArb: Arbitrary.Arbitrary<Lockfile> = Arbitrary.all({
  format: Arbitrary.schema(Schema.Literals(["bun", "npm", "pnpm", "yarn"])),
  lockfileVersion: Arbitrary.schema(Schema.Literals(["9.0", "6.0", "3"])),
  packages: arrayOf(resolvedPackageArb, 4),
  workspaceDependencies: Arbitrary.schema(Schema.Array(WorkspaceDependency).check(Schema.isMaxLength(3))),
  importers: arrayOf(lockfileImporterArb, 3),
}).pipe(Arbitrary.map((r) => Lockfile.make(r)));

describe("codec round-trips: encode ∘ decode identity is contract for serialization consumers", () => {
  it.effect.prop("ResolvedPackage: decode ∘ encode is identity", [resolvedPackageArb], ([pkg]) =>
    roundTrip(ResolvedPackage, pkg)
  );

  it.effect.prop("WorkspaceDependency: decode ∘ encode is identity", [WorkspaceDependency], ([dep]) =>
    roundTrip(WorkspaceDependency, dep)
  );

  it.effect.prop("ImporterDependency: decode ∘ encode is identity", [importerDependencyArb], ([dep]) =>
    roundTrip(ImporterDependency, dep)
  );

  it.effect.prop("LockfileImporter: decode ∘ encode is identity", [lockfileImporterArb], ([importer]) =>
    roundTrip(LockfileImporter, importer)
  );

  it.effect.prop("Lockfile (with importers): decode ∘ encode is identity", [lockfileArb], ([lockfile]) =>
    roundTrip(Lockfile, lockfile)
  );

  it.effect.prop("LockfileIntegrity: decode ∘ encode is identity", [LockfileIntegrity], ([report]) =>
    roundTrip(LockfileIntegrity, LockfileIntegrity.make(report))
  );

  it.effect("a parsed fixture-shaped lockfile survives encode ∘ decode", () =>
    Effect.gen(function* () {
      const lockfile = Lockfile.make({
        format: "pnpm",
        lockfileVersion: "9.0",
        packages: [
          ResolvedPackage.make({
            name: "packages/core",
            version: "0.0.0",
            instanceId: "packages/core",
            isWorkspace: true,
            relativePath: "packages/core",
          }),
          ResolvedPackage.make({
            name: "chalk",
            version: "5.6.2",
            instanceId: "chalk@5.6.2",
            integrity: yield* IntegrityHash.decode("sha512-abc"),
            isWorkspace: false,
            dependencies: { "supports-color": "^9.0.0" },
            peerDependencies: { "supports-color": "^9.0.0" },
            peerDependenciesMeta: { "supports-color": { optional: true } },
            resolved: { "supports-color": "supports-color@9.0.0" },
            unresolvedEdges: ["ghost-dep"],
          }),
        ],
        workspaceDependencies: [
          WorkspaceDependency.make({
            from: "packages/core",
            to: "@acme/utils",
            depType: "dependencies",
            constraint: "workspace:*",
          }),
        ],
        importers: [
          LockfileImporter.make({
            path: "packages/core",
            dependencies: [
              ImporterDependency.make({
                name: "lodash",
                specifier: yield* Schema.decodeEffect(DependencySpecifier.FromString)("catalog:"),
                version: "4.17.23",
                depType: "dependencies",
              }),
            ],
          }),
        ],
      });
      yield* roundTrip(Lockfile, lockfile);
    })
  );
});
