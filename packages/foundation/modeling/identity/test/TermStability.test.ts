import { fcRuns } from "@beep/fc-runs";
import { RegistryDeprecations } from "@beep/identity/internal/generated/Registry.data";
import { SafePnLocal } from "@beep/identity/PnLocal";
import * as Registry from "@beep/identity/Registry";
import { CodeId, RegistryShard, RegistryTable, snapshotViolations, TermIri, TermSnapshot } from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import committedSnapshot from "../registry/term-snapshot.json" with { type: "json" };
import retired from "./fixtures/p1-retired-iris.json" with { type: "json" };

// The path-derived IRIs P1 re-published, frozen from the live research-library fold and the
// test-runner pins at the P1 base, each with the registry IRI that replaces it.
const RetiredIris = S.Array(S.Struct({ term: TermIri, replacement: TermIri }));
const deprecated: Readonly<Record<string, unknown>> = RegistryDeprecations;

const isLive = (iri: string): boolean =>
  O.isSome(Registry.contract(iri)) || A.some(R.values(Registry.RegistryVocab), (entry) => entry.iri === iri);

// The committed source shards, as their encoded rows, and the committed term snapshot.
const shardTexts = import.meta.glob<string>("../registry/namespaces/*.json", {
  eager: true,
  import: "default",
  query: "?raw",
});
const decodeShardJson = S.decodeResult(S.fromJsonString(RegistryShard));
const decodeShard = S.decodeResult(RegistryShard);
const encodeShard = S.encodeResult(RegistryShard);
const committedShards: ReadonlyArray<RegistryShard.Encoded> = A.map(R.values(shardTexts), (text) =>
  Result.getOrThrow(Result.flatMap(decodeShardJson(text), encodeShard))
);
const committed = Result.getOrThrow(S.decodeUnknownResult(TermSnapshot)(committedSnapshot));

const tableOf = (shards: ReadonlyArray<RegistryShard.Encoded>): RegistryTable =>
  Result.getOrThrow(RegistryTable.fromShards(A.map(shards, (shard) => Result.getOrThrow(decodeShard(shard)))));

const violationsOf = (shards: ReadonlyArray<RegistryShard.Encoded>) =>
  snapshotViolations(committed, RegistryTable.snapshot(tableOf(shards), committed));

const editShard =
  (prefix: string, edit: (shard: RegistryShard.Encoded) => RegistryShard.Encoded) =>
  (shards: ReadonlyArray<RegistryShard.Encoded>): ReadonlyArray<RegistryShard.Encoded> =>
    A.map(shards, (shard) => (shard.namespace.prefix === prefix ? edit(shard) : shard));

const byTerm = Order.mapInput(Order.String, (row: { readonly term: string }) => row.term);

const prefLabel = Registry.iri("skos:prefLabel");
const withoutPrefLabel = editShard("skos", (shard) => ({
  ...shard,
  terms: A.filter(shard.terms, (local) => local !== "prefLabel"),
}));
const deprecatingPrefLabel = editShard("skos", (shard) => ({
  ...shard,
  deprecations: A.sort(A.append(shard.deprecations, { term: prefLabel, since: "3.0.0" }), byTerm),
}));

// The research-library namespace IRI P1 retired, whose successor is the `research-library` namespace.
const retiredLibraryNamespace = "https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas/";

const LibraryModule = CodeId.make("@beep/repo-cli/commands/Research/Library/Library.schemas");
const CatalogModule = CodeId.make("@beep/repo-cli/commands/Research/Catalog/Catalog.schemas");

describe("term stability", () => {
  it("L0-3 the published term set changes only with a deprecation record", () => {
    const table = tableOf(committedShards);
    expect(RegistryTable.snapshot(table, committed)).toStrictEqual(committed);

    const removed = violationsOf(withoutPrefLabel(committedShards));
    expect(A.map(removed, (violation) => violation._tag)).toStrictEqual(["TermRemoved"]);
    expect(violationsOf(deprecatingPrefLabel(withoutPrefLabel(committedShards)))).toStrictEqual([]);

    const renamedPrefix = violationsOf(
      editShard("skos", (shard) => ({ ...shard, namespace: { ...shard.namespace, prefix: "skosx" } }))(committedShards)
    );
    expect(A.map(renamedPrefix, (violation) => violation._tag)).toStrictEqual(["NamespacePrefixChanged"]);

    const droppedDeprecation = violationsOf(
      editShard("vitest", (shard) => ({ ...shard, deprecations: A.drop(shard.deprecations, 1) }))(committedShards)
    );
    expect(A.map(droppedDeprecation, (violation) => violation._tag)).toStrictEqual(["DeprecationRemoved"]);

    const revived = violationsOf(
      A.append(
        editShard("research-library", (shard) => ({
          ...shard,
          deprecations: A.filter(shard.deprecations, (row) => row.term !== retiredLibraryNamespace),
        }))(committedShards),
        { namespace: { prefix: "lib", iri: retiredLibraryNamespace }, terms: [], bindings: [], deprecations: [] }
      )
    );
    expect(A.map(revived, (violation) => violation._tag)).toStrictEqual(["TermRevived", "DeprecationRemoved"]);
  });

  it.prop(
    "L0-3 additions to the published term set report no violation",
    [S.Array(SafePnLocal).check(S.isMaxLength(6))],
    ([locals]) => {
      const added = decodeShard({
        namespace: { prefix: "gen", iri: "https://example.test/gen/" },
        terms: A.sort(A.dedupe(locals), Order.String),
        bindings: [],
        deprecations: [],
      });
      // A PN_LOCAL may hold a code point RFC 3987 refuses in an IRI; the shard check refuses those.
      if (Result.isFailure(added)) return;
      const next = RegistryTable.snapshot(
        tableOf(A.append(committedShards, Result.getOrThrow(encodeShard(added.success)))),
        committed
      );
      expect(snapshotViolations(committed, next)).toStrictEqual([]);
      expect(next.release).toBe("2.1.0");
    },
    { arbitrary: fcRuns(25) }
  );

  it("L0-3 renaming a module changes no published IRI", () => {
    const before = tableOf(committedShards);
    const after = Result.getOrThrow(RegistryTable.rebind(before, LibraryModule, CatalogModule));
    const previous = RegistryTable.snapshot(before, committed);
    const next = RegistryTable.snapshot(after, previous);

    expect(snapshotViolations(previous, next)).toStrictEqual([]);
    expect(next.namespaces).toStrictEqual(previous.namespaces);
    expect(next.terms).toStrictEqual(previous.terms);
    expect(next.deprecations).toStrictEqual(previous.deprecations);

    const beforeView = Registry.view(before);
    const afterView = Registry.view(after);
    const moved = A.filter(before.bindings, (binding) => Str.startsWith(`${LibraryModule}/`)(binding.code));
    expect(moved).toHaveLength(16);
    for (const binding of moved) {
      const renamed = `${CatalogModule}${Str.slice(LibraryModule.length)(binding.code)}`;
      assertSome(
        O.map(afterView.bindingOf(renamed), (term) => term.iri),
        binding.term
      );
      expect(afterView.bindingOf(renamed)).toStrictEqual(beforeView.bindingOf(binding.code));
      // The binding moved: a file move without a rebind leaves the old module unbound.
      assertNone(afterView.bindingOf(binding.code));
    }
  });

  it.effect(
    "L0-3 every re-published path-derived IRI has a deprecation naming its replacement",
    Effect.fnUntraced(function* () {
      const retiredIris = yield* S.decodeEffect(RetiredIris)(retired);
      expect(retiredIris).toHaveLength(113);
      for (const { term, replacement } of retiredIris) {
        expect(R.has(deprecated, term), term).toBe(true);
        assertSome(Registry.replacementOf(term), replacement);
        expect(isLive(replacement), replacement).toBe(true);
        expect(isLive(term), term).toBe(false);
      }
    })
  );
});
