import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import { DependencySpecifier } from "../../../effected/npm/DependencySpecifier.ts";
import { ImporterDependency } from "../../../effected/lockfiles/ImporterDependency.ts";
import { LockfileImporter } from "../../../effected/lockfiles/LockfileImporter.ts";
import { PeerDeclarations, FramingReason, ContentFailure, FramingFailure, ParseFailure, LockfileFields, WorkspaceEntry, splitNameVersion, splitPeerSuffix, importerDependencies, peerDeclarations, extractWorkspaceDeps } from "../../../effected/lockfiles/internal/shared.ts";
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoding decodes without failure and preserves the value`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

roundTrips("PeerDeclarations", PeerDeclarations);
roundTrips("FramingReason", FramingReason);
roundTrips("ContentFailure", ContentFailure);
roundTrips("FramingFailure", FramingFailure);
roundTrips("ParseFailure", ParseFailure);
roundTrips("WorkspaceEntry", WorkspaceEntry);
// ClassifiedSpecifier's native arbitrary generates independent raw text and tags.
// Classify its text before sampling the enclosing bundle to respect that codec's domain.
const canonical = (value: LockfileFields): LockfileFields => ({ ...value, importers: A.map(value.importers, (importer) => LockfileImporter.make({ ...importer, dependencies: A.map(importer.dependencies, (dep) => ImporterDependency.make({ ...dep, specifier: Result.getOrThrowWith(S.decodeResult(DependencySpecifier.FromString)(dep.specifier.raw).pipe(Result.orElse(() => S.decodeResult(DependencySpecifier.FromString)("*"))), (error) => error) })) })) });
it.effect.prop("LockfileFields encoding decodes without failure and preserves the normalized bundle", [Arbitrary.schema(LockfileFields).pipe(Arbitrary.map(canonical))], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(LockfileFields)(value);
  const decoded = yield* S.decodeEffect(LockfileFields)(encoded);
  assertTrue(S.toEquivalence(LockfileFields)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(LockfileFields)(decoded), encoded);
}), runs);
it.effect.prop("peer suffix splitting is lossless and its plain projection is idempotent", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const parsed = splitPeerSuffix(text);
  assert.strictEqual(`${parsed.plain}${parsed.peerSuffix ?? ""}`, text);
  assert.deepStrictEqual(splitPeerSuffix(`${parsed.plain}${parsed.peerSuffix ?? ""}`), parsed);
  assert.deepStrictEqual(splitPeerSuffix(parsed.plain), { plain: parsed.plain });
}), runs);
it.effect.prop("name-version splitting preserves every recorded character and reparses identically", [Arbitrary.schema(S.Struct({ name: S.Literals(["effect", "@scope/lib"]), version: S.String }))], ([sample]) => Effect.sync(() => {
  const text = `${sample.name}@${sample.version}`;
  const parsed = splitNameVersion(text);
  assert.deepStrictEqual(parsed, sample);
  assert.deepStrictEqual(splitNameVersion(`${parsed?.name}@${parsed?.version}`), parsed);
}), runs);

const Sections = S.Struct({ dependencies: S.Record(S.Literals(["lib", "external"]), S.Literals(["workspace:*", "^1.0.0", "link:../lib"])) });
it.effect.prop("importer and workspace-edge extraction retain section, name and specifier through serialization", [Arbitrary.schema(Sections)], ([sections]) => Effect.gen(function* () {
  const codec = S.fromJsonString(Sections);
  const text = yield* S.encodeEffect(codec)(sections);
  const read = yield* S.decodeEffect(codec)(text);
  assert.strictEqual(yield* S.encodeEffect(codec)(read), text);
  const dependencies = importerDependencies(sections, (specifier) => ({ specifier }));
  assert.deepStrictEqual(importerDependencies(read, (specifier) => ({ specifier })), dependencies);
  assert.deepStrictEqual(A.map(dependencies, (dep) => [dep.name, dep.specifier.raw, dep.depType]), A.map(R.toEntries(sections.dependencies), ([name, specifier]) => [name, specifier, "dependencies"]));
  const names = HashSet.fromIterable(["app", "lib"]);
  const extract = (entry: WorkspaceEntry) => extractWorkspaceDeps(MutableHashMap.fromIterable([["app", entry]]), names);
  assert.deepStrictEqual(extract(read), extract(sections));
  assert.deepStrictEqual(A.map(extract(read), (edge) => [edge.from, edge.to, edge.constraint]), A.map(A.filter(R.toEntries(sections.dependencies), ([name]) => name === "lib"), ([name, specifier]) => ["app", name, specifier]));
}), runs);
it.effect.prop("peer declaration normalization is idempotent and retains declarations and optional flags", [Arbitrary.schema(PeerDeclarations)], ([peers]) => Effect.sync(() => {
  const normalized = peerDeclarations(peers.peerDependencies, peers.peerDependenciesMeta, undefined);
  assert.deepStrictEqual(normalized, peers);
  assert.deepStrictEqual(peerDeclarations(normalized.peerDependencies, normalized.peerDependenciesMeta, undefined), normalized);
}), runs);
