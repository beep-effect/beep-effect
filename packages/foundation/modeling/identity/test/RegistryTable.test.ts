import { fcRuns } from "@beep/fc-runs";
import { SafePnLocal } from "@beep/identity/PnLocal";
import {
  CodeId,
  Deprecation,
  Namespace,
  NamespaceIri,
  RegistryConflict,
  RegistryShard,
  RegistryTable,
  ReleaseVersion,
  registryConflictMessage,
  ShardBinding,
  ShardDeprecation,
  Term,
  TermBinding,
  TermIri,
  TermLocal,
  TermSnapshot,
} from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const v1 = ReleaseVersion.make("1.0.0");
const local = (value: string): TermLocal => TermLocal.make(value);
const iri = (value: string): TermIri => TermIri.make(value);
const code = (value: string): CodeId => CodeId.make(value);

const vitestNs = Namespace.make({ prefix: "vitest", iri: NamespaceIri.make("https://beep-effect.com/ns/vitest/") });
const hangCode = code("@beep/test-runner/Vitest/TestHang");
const oldHang = iri("https://beep-effect.com/ns/test-utils/Vitest/TestHang");

const decodeShard = S.decodeResult(RegistryShard);
const decodeTable = S.decodeUnknownResult(S.toType(RegistryTable));
const shard = (fields: Partial<RegistryShard.Encoded> & Pick<RegistryShard.Encoded, "namespace">): RegistryShard =>
  Result.getOrThrow(decodeShard({ terms: [], bindings: [], deprecations: [], ...fields }));

const vitestShard = shard({
  namespace: { prefix: "vitest", iri: "https://beep-effect.com/ns/vitest/" },
  terms: ["TestFailure", "TestHang"],
  bindings: [{ code: hangCode, local: "TestHang", since: "1.0.0" }],
  deprecations: [{ term: oldHang, since: "1.0.0", replacement: "TestHang" }],
});
const fabioShard = shard({ namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" }, terms: ["Report"] });

const conflictsOf = (
  result: Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>>
): ReadonlyArray<RegistryConflict> => (Result.isFailure(result) ? result.failure : []);

const conflictTags = (result: Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>>) =>
  A.map(conflictsOf(result), (conflict) => conflict._tag);

describe("RegistryShard", () => {
  it("decodes the shard rows and keeps the projection optional", () => {
    expect(vitestShard.bindings).toStrictEqual([
      ShardBinding.make({ code: hangCode, local: local("TestHang"), since: v1 }),
    ]);
    expect(vitestShard.deprecations).toStrictEqual([
      ShardDeprecation.make({ term: oldHang, since: v1, replacement: O.some(local("TestHang")) }),
    ]);
    assertNone(vitestShard.projection);
    const projected = shard({ namespace: vitestShard.namespace, projection: "@beep/test-runner" });
    assertSome(projected.projection, "@beep/test-runner");
  });

  it("refuses unsorted collections and locals that do not form an IRI", () => {
    const decode = S.decodeUnknownResult(RegistryShard);
    const namespace = { prefix: "ex", iri: "https://example.test/" };
    const rows = { namespace, bindings: [], deprecations: [] };
    assertTrue(decode({ ...rows, terms: ["a", "b"] }).pipe(Result.isSuccess));
    assertTrue(decode({ ...rows, terms: ["b", "a"] }).pipe(Result.isFailure));
    assertTrue(decode({ ...rows, terms: ["a", "a"] }).pipe(Result.isFailure));
    const bindingA = { code: "@beep/ex/A", local: "a", since: "1.0.0" };
    const bindingB = { code: "@beep/ex/B", local: "b", since: "1.0.0" };
    assertTrue(decode({ ...rows, terms: ["a", "b"], bindings: [bindingA, bindingB] }).pipe(Result.isSuccess));
    assertTrue(decode({ ...rows, terms: ["a", "b"], bindings: [bindingB, bindingA] }).pipe(Result.isFailure));
    // U+E0001 is a PN_LOCAL character that RFC 3987 refuses in an IRI.
    assertTrue(decode({ ...rows, terms: ["a\u{E0001}"] }).pipe(Result.isFailure));
  });
});

describe("RegistryTable.fromShards", () => {
  it("joins every shard into one table sorted by key", () => {
    const table = Result.getOrThrow(RegistryTable.fromShards([vitestShard, fabioShard]));
    expect(A.map(table.namespaces, (namespace) => namespace.prefix)).toStrictEqual(["fabio", "vitest"]);
    expect(A.map(table.terms, (term) => term.iri)).toStrictEqual([
      "http://purl.org/spar/fabio/Report",
      "https://beep-effect.com/ns/vitest/TestFailure",
      "https://beep-effect.com/ns/vitest/TestHang",
    ]);
    expect(table.bindings).toStrictEqual([
      TermBinding.make({ code: hangCode, term: iri("https://beep-effect.com/ns/vitest/TestHang"), since: v1 }),
    ]);
    expect(table.deprecations).toStrictEqual([
      Deprecation.make({
        term: oldHang,
        since: v1,
        replacement: O.some(iri("https://beep-effect.com/ns/vitest/TestHang")),
      }),
    ]);
    expect(Result.getOrThrow(RegistryTable.fromShards([fabioShard, vitestShard]))).toStrictEqual(table);
  });

  it("reports duplicate prefixes, namespace IRIs and term IRIs", () => {
    const sameIri = shard({ namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" }, terms: ["Report"] });
    expect(conflictTags(RegistryTable.fromShards([fabioShard, fabioShard]))).toStrictEqual([
      "DuplicatePrefix",
      "DuplicateNamespaceIri",
      "DuplicateTermIri",
    ]);
    const twice = RegistryTable.fromShards([vitestShard, fabioShard, vitestShard, fabioShard]);
    expect(
      A.filterMap(conflictsOf(twice), (conflict) =>
        conflict._tag === "DuplicatePrefix" ? Result.succeed(conflict.prefix) : Result.failVoid
      )
    ).toStrictEqual(["fabio", "vitest"]);
    expect(conflictTags(RegistryTable.fromShards([fabioShard, sameIri]))).toStrictEqual([
      "DuplicateNamespaceIri",
      "DuplicateTermIri",
    ]);
    const parent = shard({
      namespace: { prefix: "qa", iri: "https://beep-effect.com/ns/qa/" },
      terms: ["receipts/v1"],
    });
    const nested = shard({
      namespace: { prefix: "receipts", iri: "https://beep-effect.com/ns/qa/receipts/" },
      terms: ["v1"],
    });
    expect(conflictTags(RegistryTable.fromShards([parent, nested]))).toStrictEqual(["DuplicateTermIri"]);
  });

  it("admits no namespace IRI that is also a term IRI", () => {
    const decode = S.decodeUnknownResult(RegistryShard);
    const rows = { terms: [], bindings: [], deprecations: [] };
    // A term IRI ends with its local, so only an IRI with no separator could be both; a namespace refuses it.
    assertTrue(decode({ ...rows, namespace: { prefix: "r", iri: "https://e.test/q" } }).pipe(Result.isFailure));
    assertTrue(decode({ ...rows, namespace: { prefix: "r", iri: "https://e.test/q/" } }).pipe(Result.isSuccess));
    // A hand-written term row may still name a namespace IRI; its IRI is not its namespace IRI and its local.
    const table = Result.getOrThrow(RegistryTable.fromShards([fabioShard]));
    const term = Term.make({ iri: iri("http://purl.org/spar/fabio/"), namespace: "fabio", local: local("Report") });
    assertTrue(decodeTable({ ...table, terms: [term] }).pipe(Result.isFailure));
  });

  it("reports a binding to an unknown term and a code bound twice", () => {
    const unknown = shard({
      namespace: vitestShard.namespace,
      terms: ["TestHang"],
      bindings: [{ code: hangCode, local: "TestHung", since: "1.0.0" }],
    });
    expect(conflictTags(RegistryTable.fromShards([unknown]))).toStrictEqual(["BindingToUnknownTerm"]);
    const other = shard({
      namespace: { prefix: "runner", iri: "https://beep-effect.com/ns/runner/" },
      terms: ["Hang"],
      bindings: [{ code: hangCode, local: "Hang", since: "1.0.0" }],
    });
    expect(conflictTags(RegistryTable.fromShards([vitestShard, other]))).toStrictEqual(["DuplicateBinding"]);
  });

  it("refuses a binding or a replacement that names only a namespace IRI", () => {
    const vocab = { prefix: "ex", iri: "https://example.test/vocab/" };
    // A shard binds locals, so only a hand-written row can bind a code to the namespace IRI itself.
    const table = Result.getOrThrow(RegistryTable.fromShards([shard({ namespace: vocab, terms: ["Entry"] })]));
    const bound = { code: hangCode, term: iri(vocab.iri), since: v1 };
    assertTrue(
      decodeTable({ ...table, bindings: [{ ...bound, term: iri(`${vocab.iri}Entry`) }] }).pipe(Result.isSuccess)
    );
    assertTrue(decodeTable({ ...table, bindings: [bound] }).pipe(Result.isFailure));
    const replaced = shard({
      namespace: vocab,
      deprecations: [{ term: "https://example.test/vocab/Old", since: "1.0.0", replacement: "" }],
    });
    expect(conflictTags(RegistryTable.fromShards([replaced]))).toStrictEqual(["ReplacementUnknown"]);
    const deprecatedNs = shard({ namespace: vocab, deprecations: [{ term: vocab.iri, since: "1.0.0" }] });
    expect(conflictTags(RegistryTable.fromShards([deprecatedNs]))).toStrictEqual(["DeprecatedTermLive"]);
  });

  it("lets only a retired namespace IRI end its replacement chain at a namespace IRI", () => {
    const vocab = { prefix: "ex", iri: "https://example.test/vocab/" };
    const retiredNs = "https://example.test/old/";
    const succeeded = (deprecations: RegistryShard.Encoded["deprecations"]) =>
      RegistryTable.fromShards([shard({ namespace: vocab, terms: ["Entry"], deprecations })]);
    // The empty local names the shard namespace: a retired namespace IRI ending in "/" or "#" may take it.
    const direct = Result.getOrThrow(succeeded([{ term: retiredNs, since: "1.0.0", replacement: "" }]));
    assertSome(A.head(direct.deprecations).pipe(O.flatMap((row) => row.replacement)), iri(vocab.iri));
    const hashNs = "https://example.test/older#";
    assertTrue(
      succeeded([
        { term: retiredNs, since: "1.0.0", replacement: "" },
        { term: hashNs, since: "1.0.0", replacement: "" },
      ]).pipe(Result.isSuccess)
    );
    // A retired term is never succeeded by a namespace IRI, and a retired namespace IRI never by a term.
    const termToNamespace = succeeded([{ term: "https://example.test/old/Entry", since: "1.0.0", replacement: "" }]);
    expect(conflictsOf(termToNamespace)).toStrictEqual([
      RegistryConflict.cases.ReplacementUnknown.make({
        term: iri("https://example.test/old/Entry"),
        replacement: iri(vocab.iri),
      }),
    ]);
    expect(A.map(conflictsOf(termToNamespace), registryConflictMessage)).toStrictEqual([
      `The replacement chain of https://example.test/old/Entry reaches ${vocab.iri}, which is neither a declared term nor deprecated with a successor.`,
    ]);
    const namespaceToTerm = succeeded([{ term: retiredNs, since: "1.0.0", replacement: "Entry" }]);
    expect(A.map(conflictsOf(namespaceToTerm), registryConflictMessage)).toStrictEqual([
      `The replacement chain of ${retiredNs} reaches https://example.test/vocab/Entry, which is neither a declared namespace IRI nor deprecated with a successor.`,
    ]);
  });

  it("reports a live deprecated term, a repeated deprecation and broken replacement chains", () => {
    const live = shard({
      namespace: vitestShard.namespace,
      terms: ["TestHang"],
      deprecations: [{ term: "https://beep-effect.com/ns/vitest/TestHang", since: "1.0.0" }],
    });
    expect(conflictTags(RegistryTable.fromShards([live]))).toStrictEqual(["DeprecatedTermLive"]);
    const again = shard({
      namespace: { prefix: "runner", iri: "https://beep-effect.com/ns/runner/" },
      deprecations: [{ term: oldHang, since: "1.0.0" }],
    });
    expect(conflictTags(RegistryTable.fromShards([vitestShard, again]))).toStrictEqual(["DuplicateDeprecation"]);
    const dangling = shard({
      namespace: vitestShard.namespace,
      deprecations: [{ term: oldHang, since: "1.0.0", replacement: "Missing" }],
    });
    expect(conflictTags(RegistryTable.fromShards([dangling]))).toStrictEqual(["ReplacementUnknown"]);
    const a = "https://beep-effect.com/ns/vitest/A";
    const b = "https://beep-effect.com/ns/vitest/B";
    const deadEnd = shard({
      namespace: vitestShard.namespace,
      deprecations: [
        { term: a, since: "1.0.0", replacement: "B" },
        { term: b, since: "1.0.0" },
      ],
    });
    expect(conflictTags(RegistryTable.fromShards([deadEnd]))).toStrictEqual(["ReplacementUnknown"]);
    const cycle = shard({
      namespace: vitestShard.namespace,
      deprecations: [
        { term: a, since: "1.0.0", replacement: "B" },
        { term: b, since: "1.0.0", replacement: "A" },
      ],
    });
    expect(conflictTags(RegistryTable.fromShards([cycle]))).toStrictEqual(["ReplacementCycle", "ReplacementCycle"]);
    const chain = shard({
      namespace: vitestShard.namespace,
      terms: ["C"],
      deprecations: [
        { term: a, since: "1.0.0", replacement: "B" },
        { term: b, since: "1.0.0", replacement: "C" },
      ],
    });
    assertTrue(RegistryTable.fromShards([chain]).pipe(Result.isSuccess));
  });
});

describe("RegistryTable properties", () => {
  it.prop(
    "a shard of any distinct safe locals forms a table that publishes each of them",
    [S.Array(SafePnLocal).check(S.isMaxLength(6))],
    ([locals]) => {
      const terms = A.sort(A.dedupe(locals), Order.String);
      const decoded = decodeShard({
        namespace: { prefix: "ex", iri: "https://example.test/ns/" },
        terms,
        bindings: [],
        deprecations: [],
      });
      // A PN_LOCAL may hold a code point RFC 3987 refuses in an IRI; the shard check refuses those.
      if (Result.isFailure(decoded)) return;
      const table = Result.getOrThrow(RegistryTable.fromShards([decoded.success]));
      const snapshot = RegistryTable.snapshot(table, TermSnapshot.empty);
      expect(snapshot.terms).toHaveLength(terms.length + 1);
      expect(RegistryTable.snapshot(table, snapshot)).toStrictEqual(snapshot);
    },
    { arbitrary: fcRuns(100) }
  );
});

describe("RegistryTable schema", () => {
  it("refuses a decoded table whose term sits outside its namespace", () => {
    const table = Result.getOrThrow(RegistryTable.fromShards([fabioShard]));
    const encoded = Result.getOrThrow(S.encodeResult(RegistryTable)(table));
    const decode = S.decodeUnknownResult(RegistryTable);
    assertTrue(decode(encoded).pipe(Result.isSuccess));
    const moved = { ...encoded, terms: [{ ...encoded.terms[0], iri: "http://purl.org/spar/fabio/Other" }] };
    assertTrue(decode(moved).pipe(Result.isFailure));
    const orphan = { ...encoded, namespaces: [] };
    assertTrue(decode(orphan).pipe(Result.isFailure));
  });
});

describe("RegistryTable.snapshot", () => {
  const table = Result.getOrThrow(RegistryTable.fromShards([vitestShard, fabioShard]));

  it("publishes every term IRI and namespace IRI at release 1.0.0 from the empty snapshot", () => {
    const first = RegistryTable.snapshot(table, TermSnapshot.empty);
    expect(first.release).toBe("1.0.0");
    expect(first.terms).toStrictEqual([
      "http://purl.org/spar/fabio/",
      "http://purl.org/spar/fabio/Report",
      "https://beep-effect.com/ns/vitest/",
      "https://beep-effect.com/ns/vitest/TestFailure",
      "https://beep-effect.com/ns/vitest/TestHang",
    ]);
    expect(first.bindings).toStrictEqual(table.bindings);
    expect(first.deprecations).toStrictEqual(table.deprecations);
    expect(RegistryTable.snapshot(TermSnapshot.empty)(table)).toStrictEqual(first);
  });

  it("keeps the release when nothing changed and bumps the minor on an addition", () => {
    const first = RegistryTable.snapshot(table, TermSnapshot.empty);
    expect(RegistryTable.snapshot(table, first)).toStrictEqual(first);
    const grown = Result.getOrThrow(
      RegistryTable.fromShards([vitestShard, shard({ namespace: fabioShard.namespace, terms: ["Article", "Report"] })])
    );
    expect(RegistryTable.snapshot(grown, first).release).toBe("1.1.0");
  });

  it("bumps the major when the table adds a deprecation", () => {
    const first = RegistryTable.snapshot(table, TermSnapshot.empty);
    const shrunk = Result.getOrThrow(
      RegistryTable.fromShards([
        vitestShard,
        shard({
          namespace: fabioShard.namespace,
          deprecations: [{ term: "http://purl.org/spar/fabio/Report", since: "2.0.0" }],
        }),
      ])
    );
    expect(RegistryTable.snapshot(shrunk, first).release).toBe("2.0.0");
  });

  it("advances a release past the safe-integer range exactly", () => {
    const first = RegistryTable.snapshot(table, TermSnapshot.empty);
    const at = (value: string) => TermSnapshot.make({ ...first, release: ReleaseVersion.make(value) });
    const grown = Result.getOrThrow(
      RegistryTable.fromShards([vitestShard, shard({ namespace: fabioShard.namespace, terms: ["Article", "Report"] })])
    );
    expect(RegistryTable.snapshot(grown, at("1.9007199254740992.0")).release).toBe("1.9007199254740993.0");
    const shrunk = Result.getOrThrow(
      RegistryTable.fromShards([
        vitestShard,
        shard({
          namespace: fabioShard.namespace,
          deprecations: [{ term: "http://purl.org/spar/fabio/Report", since: "9007199254740994.0.0" }],
        }),
      ])
    );
    expect(RegistryTable.snapshot(shrunk, at("9007199254740993.0.0")).release).toBe("9007199254740994.0.0");
  });
});

describe("RegistryTable.rebind", () => {
  const table = Result.getOrThrow(RegistryTable.fromShards([vitestShard, fabioShard]));
  const codes = (result: Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>>) =>
    A.map(Result.getOrThrow(result).bindings, (binding) => binding.code);

  it("moves one code identity and keeps its term and since", () => {
    const moved = Result.getOrThrow(RegistryTable.rebind(table, hangCode, code("@beep/test-runner/Runner/Hang")));
    expect(moved.bindings).toStrictEqual([
      TermBinding.make({
        code: code("@beep/test-runner/Runner/Hang"),
        term: iri("https://beep-effect.com/ns/vitest/TestHang"),
        since: v1,
      }),
    ]);
    expect(moved.terms).toStrictEqual(table.terms);
    expect(moved.deprecations).toStrictEqual(table.deprecations);
  });

  it("moves every code identity under a module in prefix mode and leaves other codes alone", () => {
    expect(
      codes(RegistryTable.rebind(table, code("@beep/test-runner/Vitest"), code("@beep/test-kit/Runner")))
    ).toStrictEqual(["@beep/test-kit/Runner/TestHang"]);
    expect(
      codes(RegistryTable.rebind(table, code("@beep/test-runner/Vit"), code("@beep/test-kit/Runner")))
    ).toStrictEqual([hangCode]);
  });

  it("refuses a move onto a code identity that is already bound", () => {
    const twoBound = Result.getOrThrow(
      RegistryTable.fromShards([
        shard({
          namespace: { prefix: "vitest", iri: "https://beep-effect.com/ns/vitest/" },
          terms: ["TestFailure", "TestHang"],
          bindings: [
            { code: "@beep/test-runner/Vitest/TestFailure", local: "TestFailure", since: "1.0.0" },
            { code: hangCode, local: "TestHang", since: "1.0.0" },
          ],
        }),
      ])
    );
    expect(
      conflictTags(RegistryTable.rebind(twoBound, hangCode, code("@beep/test-runner/Vitest/TestFailure")))
    ).toStrictEqual(["DuplicateBinding"]);
  });
});

describe("registryConflictMessage", () => {
  it("names the subject of every conflict", () => {
    const term = iri("https://beep-effect.com/ns/vitest/TestHang");
    const conflicts: ReadonlyArray<RegistryConflict> = [
      RegistryConflict.cases.DuplicatePrefix.make({ prefix: "vitest", iris: [vitestNs.iri] }),
      RegistryConflict.cases.DuplicateNamespaceIri.make({ iri: vitestNs.iri, prefixes: ["a", "b"] }),
      RegistryConflict.cases.DuplicateTermIri.make({ term, namespaces: ["a", "b"] }),
      RegistryConflict.cases.TermOutsideNamespace.make({ term, namespace: "vitest" }),
      RegistryConflict.cases.DuplicateBinding.make({ code: hangCode, terms: [term] }),
      RegistryConflict.cases.BindingToUnknownTerm.make({ code: hangCode, term }),
      RegistryConflict.cases.DuplicateDeprecation.make({ term }),
      RegistryConflict.cases.DeprecatedTermLive.make({ term }),
      RegistryConflict.cases.ReplacementUnknown.make({ term, replacement: oldHang }),
      RegistryConflict.cases.ReplacementCycle.make({ term }),
    ];
    const messages = A.map(conflicts, registryConflictMessage);
    expect(A.dedupe(messages)).toHaveLength(conflicts.length);
    expect(messages[0]).toContain('"vitest"');
    expect(messages[4]).toContain(hangCode);
    expect(
      A.every(A.drop(messages, 2), (message) => Str.includes(term)(message) || Str.includes(hangCode)(message))
    ).toBe(true);
    expect(Term.of(vitestNs, local("TestHang")).iri).toBe(term);
  });
});
