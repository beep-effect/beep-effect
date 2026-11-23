import { fcRuns } from "@beep/fc-runs";
import { SafePnLocal } from "@beep/identity/PnLocal";
import {
  CodeId,
  Deprecation,
  isNamespaceShapedIri,
  Namespace,
  NamespaceIri,
  ReleaseVersion,
  SnapshotViolation,
  snapshotViolationMessage,
  snapshotViolations,
  Term,
  TermBinding,
  TermIri,
  TermLocal,
  TermSnapshot,
  termSetViolations,
} from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const iri = (value: string): TermIri => TermIri.make(value);
const code = (value: string): CodeId => CodeId.make(value);
const release = (value: string): ReleaseVersion => ReleaseVersion.make(value);

const prov = Namespace.make({ prefix: "prov", iri: NamespaceIri.make("http://www.w3.org/ns/prov#") });
const vitest = Namespace.make({ prefix: "vitest", iri: NamespaceIri.make("https://beep-effect.com/ns/vitest/") });
const activity = iri("http://www.w3.org/ns/prov#Activity");
const entity = iri("http://www.w3.org/ns/prov#Entity");
const testHang = iri("https://beep-effect.com/ns/vitest/TestHang");
const oldTestHang = iri("https://beep-effect.com/ns/test-utils/Vitest/TestHang");
const v1 = release("1.0.0");
const v1_1 = release("1.1.0");
const v2 = release("2.0.0");
const hangCode = code("@beep/test-runner/Vitest/TestHang");

type TermSnapshotRows = Parameters<typeof TermSnapshot.fromRows>[0];

const baseRows: TermSnapshotRows = {
  release: v1,
  namespaces: [vitest, prov],
  terms: [testHang, entity, activity, iri(prov.iri), iri(vitest.iri)],
  bindings: [TermBinding.make({ code: hangCode, term: testHang, since: v1 })],
  deprecations: [Deprecation.make({ term: oldTestHang, since: v1, replacement: O.some(testHang) })],
};

const snapshot = (rows: Partial<TermSnapshotRows> = {}): TermSnapshot =>
  Result.getOrThrow(TermSnapshot.fromRows({ ...baseRows, ...rows }));

const tags = (violations: ReadonlyArray<SnapshotViolation>): ReadonlyArray<string> =>
  A.map(violations, (violation) => violation._tag);

const decodeSnapshot = S.decodeUnknownResult(TermSnapshot);
const encodeSnapshot = (value: TermSnapshot) => Result.getOrThrow(S.encodeResult(TermSnapshot)(value));

describe("Term schemas", () => {
  it("tells a namespace-shaped IRI from a term IRI by its final separator", () => {
    expect(A.map([prov.iri, vitest.iri, activity, testHang], isNamespaceShapedIri)).toStrictEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("refuses a namespace whose IRI does not end with its separator", () => {
    const declares = (namespaceIri: string) => S.is(Namespace)({ prefix: "ex", iri: namespaceIri });
    expect(A.map(["https://example.test/new/", "https://example.test/new#", "urn:example:/"], declares)).toStrictEqual([
      true,
      true,
      true,
    ]);
    expect(A.map(["https://example.test/old", "urn:example:", "not an iri/"], declares)).toStrictEqual([
      false,
      false,
      false,
    ]);
  });

  it("accepts declared term IRIs, code identities and release versions", () => {
    expect(S.is(TermIri)("https://beep-effect.com/ns/qa/receipts/accepted/v2")).toBe(true);
    expect(S.is(TermIri)("no scheme")).toBe(false);
    expect(S.is(CodeId)("@beep/repo-cli/commands/Research/Library/Library.schemas/Source")).toBe(true);
    expect(S.is(CodeId)("@other/pkg/Name")).toBe(false);
    expect(S.is(CodeId)("@beep/Pkg/Name")).toBe(false);
    expect(
      A.map(["@beep/p/../x/Name", "@beep/p/./Name", "@beep/p/A/..", "@beep/p/.../Name"], S.is(CodeId)),
      "A segment of dots alone would name a path outside the package; dots inside a segment are kept."
    ).toStrictEqual([false, false, false, false]);
    expect(A.map(["@beep/p/a..b/Name", "@beep/p/.hidden/Name"], S.is(CodeId))).toStrictEqual([true, true]);
    expect(S.is(ReleaseVersion)("10.20.30")).toBe(true);
    expect(S.is(ReleaseVersion)("01.0.0")).toBe(false);
    expect(S.is(ReleaseVersion)("1.0")).toBe(false);
  });

  it("admits multi-segment locals and refuses empty or unsafe segments", () => {
    expect(S.is(TermLocal)("TestHang")).toBe(true);
    expect(S.is(TermLocal)("evidence/gate-certificate/v1")).toBe(true);
    expect(S.is(TermLocal)("")).toBe(false);
    expect(S.is(TermLocal)("/leading")).toBe(false);
    expect(S.is(TermLocal)("trailing/")).toBe(false);
    expect(S.is(TermLocal)("a//b")).toBe(false);
    expect(S.is(TermLocal)("a b")).toBe(false);
  });

  it.prop(
    "a slash-joined run of safe PN_LOCAL segments is a term local",
    [S.Array(SafePnLocal).check(S.isMinLength(1), S.isMaxLength(3))],
    ([segments]) => {
      const local = A.join(segments, "/");
      expect(Result.getOrThrow(S.decodeResult(TermLocal)(local))).toBe(local);
    },
    runs
  );

  it("declares a term as its namespace IRI followed by its local", () => {
    const term = Term.of(prov, TermLocal.make("Activity"));
    expect(term.iri).toBe(activity);
    expect(term.namespace).toBe("prov");
    expect(Term.of(vitest, TermLocal.make("receipts/accepted/v2")).iri).toBe(
      "https://beep-effect.com/ns/vitest/receipts/accepted/v2"
    );
  });

  it("encodes a deprecation without a successor as an absent replacement key", () => {
    const deprecation = Deprecation.make({ term: activity, since: v1, replacement: O.none() });
    expect(Result.getOrThrow(S.encodeResult(Deprecation)(deprecation))).toStrictEqual({
      term: activity,
      since: "1.0.0",
    });
  });
});

describe("TermSnapshot", () => {
  it("sorts every collection by its key and drops exact repeats", () => {
    const built = snapshot({ terms: [entity, activity, entity] });
    expect(built.terms).toStrictEqual([activity, entity]);
    expect(A.map(built.namespaces, (namespace) => namespace.prefix)).toStrictEqual(["prov", "vitest"]);
  });

  it("round-trips through its encoded form and refuses unsorted or repeated rows", () => {
    const built = snapshot();
    const encoded = encodeSnapshot(built);
    expect(encoded.version).toBe("term-snapshot/v1");
    expect(Result.getOrThrow(decodeSnapshot(encoded))).toStrictEqual(built);
    assertTrue(decodeSnapshot({ ...encoded, terms: A.reverse(encoded.terms) }).pipe(Result.isFailure));
    assertTrue(decodeSnapshot({ ...encoded, terms: [...encoded.terms, ...encoded.terms] }).pipe(Result.isFailure));
  });

  it("refuses distinct rows with one key even when they separate an exact repeat", () => {
    const rebound = TermBinding.make({ code: hangCode, term: activity, since: v1 });
    assertTrue(
      TermSnapshot.fromRows({ ...baseRows, bindings: [...baseRows.bindings, rebound] }).pipe(Result.isFailure)
    );
    assertTrue(
      TermSnapshot.fromRows({ ...baseRows, bindings: [...baseRows.bindings, rebound, ...baseRows.bindings] }).pipe(
        Result.isFailure
      )
    );
  });

  it("starts from an empty snapshot at release 0.0.0", () => {
    expect(TermSnapshot.empty.release).toBe("0.0.0");
    expect(snapshotViolations(TermSnapshot.empty, snapshot())).toStrictEqual([]);
  });
});

describe("snapshotViolations", () => {
  it("the published term set changes only with a deprecation record", () => {
    const previous = snapshot();
    const removed = snapshot({ release: v1_1, terms: [testHang, activity, iri(prov.iri), iri(vitest.iri)] });
    expect(snapshotViolations(previous, removed)).toStrictEqual([
      SnapshotViolation.cases.TermRemoved.make({ term: entity }),
    ]);

    const deprecated = snapshot({
      release: v2,
      terms: [testHang, activity, iri(prov.iri), iri(vitest.iri)],
      deprecations: [...baseRows.deprecations, Deprecation.make({ term: entity, since: v2, replacement: O.none() })],
    });
    expect(snapshotViolations(previous, deprecated)).toStrictEqual([]);
    expect(pipeDual(previous, deprecated)).toStrictEqual([]);
  });

  it("reports a revived, removed or changed deprecation", () => {
    const previous = snapshot();
    expect(
      tags(snapshotViolations(previous, snapshot({ release: v1_1, terms: [...baseRows.terms, oldTestHang] })))
    ).toStrictEqual(["TermRevived"]);
    expect(tags(snapshotViolations(previous, snapshot({ release: v1_1, deprecations: [] })))).toStrictEqual([
      "DeprecationRemoved",
    ]);
    expect(
      tags(
        snapshotViolations(
          previous,
          snapshot({
            release: v1_1,
            deprecations: [Deprecation.make({ term: oldTestHang, since: v1, replacement: O.none() })],
          })
        )
      )
    ).toStrictEqual(["DeprecationChanged"]);
  });

  it("reports a reassigned, rewritten or ambiguous binding", () => {
    const previous = snapshot();
    expect(
      snapshotViolations(
        previous,
        snapshot({ release: v1_1, bindings: [TermBinding.make({ code: hangCode, term: activity, since: v1_1 })] })
      )
    ).toStrictEqual([SnapshotViolation.cases.BindingReassigned.make({ code: hangCode, from: testHang, to: activity })]);
    expect(
      snapshotViolations(
        previous,
        snapshot({ release: v1_1, bindings: [TermBinding.make({ code: hangCode, term: testHang, since: v1_1 })] })
      )
    ).toStrictEqual([SnapshotViolation.cases.SinceRewritten.make({ term: testHang, from: v1, to: v1_1 })]);

    const movedCode = code("@beep/test-runner/Runner/TestHang");
    expect(
      snapshotViolations(
        previous,
        snapshot({ release: v1_1, bindings: [TermBinding.make({ code: movedCode, term: testHang, since: v1 })] })
      )
    ).toStrictEqual([]);
    expect(
      snapshotViolations(
        previous,
        snapshot({
          release: v1_1,
          bindings: [...baseRows.bindings, TermBinding.make({ code: movedCode, term: testHang, since: v1 })],
        })
      )
    ).toStrictEqual([SnapshotViolation.cases.BindingAmbiguous.make({ term: testHang, codes: [movedCode, hangCode] })]);
  });

  it("orders ambiguous bindings by term", () => {
    const bind = (name: string, term: TermIri) =>
      TermBinding.make({ code: code(`@beep/test-runner/Vitest/${name}`), term, since: v1 });
    const next = snapshot({
      bindings: [bind("A", testHang), bind("B", testHang), bind("C", activity), bind("D", activity)],
    });
    expect(
      A.map(
        A.filter(snapshotViolations(snapshot(), next), SnapshotViolation.guards.BindingAmbiguous),
        (violation) => violation.term
      )
    ).toStrictEqual([activity, testHang]);
  });

  it("still refuses a removed term when its IRI becomes a namespace IRI", () => {
    const previous = snapshot();
    const extraNs = Namespace.make({ prefix: "extra", iri: NamespaceIri.make("https://example.test/extra/") });
    expect(
      snapshotViolations(
        snapshot({ terms: [...baseRows.terms, iri(extraNs.iri)] }),
        snapshot({
          release: v1_1,
          namespaces: [...baseRows.namespaces, extraNs],
          terms: [...baseRows.terms, iri(extraNs.iri)],
        })
      ),
      "A published IRI no namespace declared, which becomes a namespace IRI, is still a removed term."
    ).toStrictEqual([SnapshotViolation.cases.TermRemoved.make({ term: iri(extraNs.iri) })]);
    expect(
      snapshotViolations(
        previous,
        snapshot({
          release: v1_1,
          namespaces: [...baseRows.namespaces, extraNs],
          terms: [...baseRows.terms, iri(extraNs.iri)],
        })
      )
    ).toStrictEqual([]);
  });

  it("reports a dropped namespace and a changed prefix", () => {
    const previous = snapshot();
    const renamed = Namespace.make({ prefix: "provo", iri: prov.iri });
    expect(snapshotViolations(previous, snapshot({ release: v1_1, namespaces: [renamed, vitest] }))).toStrictEqual([
      SnapshotViolation.cases.NamespacePrefixChanged.make({ iri: prov.iri, from: "prov", to: "provo" }),
    ]);
    expect(snapshotViolations(previous, snapshot({ release: v1_1, namespaces: [vitest] }))).toStrictEqual([
      SnapshotViolation.cases.NamespaceDropped.make({ prefix: "prov", iri: prov.iri }),
    ]);
    expect(
      snapshotViolations(
        previous,
        snapshot({
          release: v2,
          namespaces: [vitest],
          deprecations: [
            ...baseRows.deprecations,
            Deprecation.make({ term: iri(prov.iri), since: v2, replacement: O.none() }),
          ],
          terms: [testHang, entity, activity, iri(vitest.iri)],
        })
      )
    ).toStrictEqual([]);
  });

  it.prop(
    "additions to the published term set are free after excluding PN_LOCAL U+E0000 to U+E0FFF, which RFC 3987 refuses",
    [S.Array(SafePnLocal).check(S.isMaxLength(8))],
    ([locals]) => {
      const added = pipe(
        locals,
        A.filter((local) => S.is(TermIri)(`${vitest.iri}${local}`)),
        A.map((local) => Term.of(vitest, TermLocal.make(local)).iri)
      );
      const grown = snapshot({ terms: [...baseRows.terms, ...added] });
      const next = TermSnapshot.make({ ...grown, release: grown.terms.length > snapshot().terms.length ? v1_1 : v1 });
      expect(snapshotViolations(snapshot(), next)).toStrictEqual([]);
    },
    runs
  );

  it("distinguishes release components 2^53 and 2^53 + 1 beyond floating point precision", () => {
    const base = snapshot({ release: release("9007199254740993.0.0") });
    const wound = snapshot({ release: release("9007199254740992.0.0") });
    expect(snapshotViolations(base, wound)).toStrictEqual([
      SnapshotViolation.cases.ReleaseRegressed.make({ from: base.release, to: wound.release }),
    ]);
    expect(snapshotViolations(wound, base)).toStrictEqual([
      SnapshotViolation.cases.ReleaseOverstated.make({
        base: wound.release,
        expected: wound.release,
        release: base.release,
      }),
    ]);
  });

  it("refuses a changed term set released below or above the release its change calls for", () => {
    const previous = snapshot();
    const added = { terms: [...baseRows.terms, iri(`${vitest.iri}Added`)] };
    expect(
      snapshotViolations(previous, snapshot(added)),
      "An addition at the base release would ship two term sets as 1.0.0; it calls for a minor bump."
    ).toStrictEqual([SnapshotViolation.cases.ReleaseUnderstated.make({ base: v1, expected: v1_1, release: v1 })]);
    expect(snapshotViolations(previous, snapshot({ ...added, release: v1_1 }))).toStrictEqual([]);
    expect(
      snapshotViolations(previous, snapshot({ ...added, release: v2 })),
      "A major for an addition alone, or any bump for no change, skips a release."
    ).toStrictEqual([SnapshotViolation.cases.ReleaseOverstated.make({ base: v1, expected: v1_1, release: v2 })]);
    expect(snapshotViolations(previous, snapshot({ release: v1_1 }))).toStrictEqual([
      SnapshotViolation.cases.ReleaseOverstated.make({ base: v1, expected: v1, release: v1_1 }),
    ]);
    const retired = {
      terms: [testHang, activity, iri(prov.iri), iri(vitest.iri)],
      deprecations: [...baseRows.deprecations, Deprecation.make({ term: entity, since: v2, replacement: O.none() })],
    };
    expect(
      snapshotViolations(previous, snapshot({ ...retired, release: v1_1 })),
      "A new deprecation calls for a major bump, so a minor bump is still understated."
    ).toStrictEqual([SnapshotViolation.cases.ReleaseUnderstated.make({ base: v1, expected: v2, release: v1_1 })]);
    expect(
      snapshotViolations(previous, previous),
      "An unchanged term set keeps its release, and the empty base calls for the genesis release."
    ).toStrictEqual([]);
    expect(snapshotViolations(TermSnapshot.empty, snapshot({ release: release("0.0.0") }))).toStrictEqual([
      SnapshotViolation.cases.ReleaseUnderstated.make({
        base: release("0.0.0"),
        expected: v1,
        release: release("0.0.0"),
      }),
    ]);
  });

  it("accepts stacked releases unseen by the empty base, with rows of any since", () => {
    expect(TermSnapshot.isPublished(TermSnapshot.empty)).toBe(false);
    expect(TermSnapshot.isPublished(snapshot())).toBe(true);
    expect(snapshotViolations(TermSnapshot.empty, snapshot({ release: v2 }))).toStrictEqual([]);
  });

  it("refuses an added row that records another release than the change", () => {
    const previous = snapshot();
    const newCode = code("@beep/test-runner/Vitest/Entity");
    const changedAt = (since: ReleaseVersion) =>
      snapshot({
        release: v2,
        terms: [testHang, entity, iri(prov.iri), iri(vitest.iri)],
        bindings: [...baseRows.bindings, TermBinding.make({ code: newCode, term: entity, since })],
        deprecations: [...baseRows.deprecations, Deprecation.make({ term: activity, since, replacement: O.none() })],
      });
    expect(snapshotViolations(previous, changedAt(v2))).toStrictEqual([]);
    const misstated = [
      SnapshotViolation.cases.BindingSinceMisstated.make({ code: newCode, term: entity, since: v1_1, expected: v2 }),
      SnapshotViolation.cases.DeprecationSinceMisstated.make({ term: activity, since: v1_1, expected: v2 }),
    ];
    expect(snapshotViolations(previous, changedAt(v1_1))).toStrictEqual(misstated);
    expect(
      termSetViolations(previous, changedAt(v1_1)),
      "Neither is a break of the term set: regenerating and correcting the row repairs both."
    ).toStrictEqual([]);
    expect(termSetViolations(changedAt(v1_1))(previous)).toStrictEqual([]);
    expect(
      snapshotViolations(previous, TermSnapshot.make({ ...changedAt(v1_1), release: release("0.9.0") })),
      "The release the rows should record does not depend on the release the snapshot states."
    ).toStrictEqual([...misstated, SnapshotViolation.cases.ReleaseRegressed.make({ from: v1, to: release("0.9.0") })]);
  });
});

const pipeDual = (previous: TermSnapshot, next: TermSnapshot) => snapshotViolations(next)(previous);

describe("snapshotViolationMessage", () => {
  const Violation = SnapshotViolation.cases;
  const otherCode = code("@beep/test-runner/Vitest/OtherHang");

  it("states every violation kind in one line naming its fields", () => {
    expect(
      A.map(
        [
          Violation.TermRemoved.make({ term: activity }),
          Violation.TermRevived.make({ term: oldTestHang }),
          Violation.DeprecationRemoved.make({ term: oldTestHang }),
          Violation.DeprecationChanged.make({ term: oldTestHang }),
          Violation.SinceRewritten.make({ term: testHang, from: v1, to: v2 }),
          Violation.BindingReassigned.make({ code: hangCode, from: testHang, to: entity }),
          Violation.BindingAmbiguous.make({ term: testHang, codes: [hangCode, otherCode] }),
          Violation.NamespaceDropped.make({ prefix: prov.prefix, iri: prov.iri }),
          Violation.NamespacePrefixChanged.make({ iri: vitest.iri, from: vitest.prefix, to: prov.prefix }),
          Violation.ReleaseRegressed.make({ from: v2, to: v1 }),
          Violation.ReleaseUnderstated.make({ base: v1, expected: v2, release: v1 }),
          Violation.ReleaseOverstated.make({ base: v1, expected: v1_1, release: v2 }),
          Violation.BindingSinceMisstated.make({ code: hangCode, term: testHang, since: v1, expected: v1_1 }),
          Violation.DeprecationSinceMisstated.make({ term: oldTestHang, since: v1_1, expected: v2 }),
        ],
        snapshotViolationMessage
      )
    ).toStrictEqual([
      "http://www.w3.org/ns/prov#Activity is removed without a deprecation.",
      "https://beep-effect.com/ns/test-utils/Vitest/TestHang is deprecated and published again.",
      "The deprecation of https://beep-effect.com/ns/test-utils/Vitest/TestHang is removed.",
      "The deprecation of https://beep-effect.com/ns/test-utils/Vitest/TestHang is changed.",
      "The binding of https://beep-effect.com/ns/vitest/TestHang changes its since from 1.0.0 to 2.0.0.",
      "Code identity @beep/test-runner/Vitest/TestHang is rebound from https://beep-effect.com/ns/vitest/TestHang to http://www.w3.org/ns/prov#Entity.",
      "https://beep-effect.com/ns/vitest/TestHang is bound by more than one code identity (@beep/test-runner/Vitest/TestHang, @beep/test-runner/Vitest/OtherHang).",
      'Namespace "prov" (http://www.w3.org/ns/prov#) is removed without a deprecation of its IRI.',
      'Namespace https://beep-effect.com/ns/vitest/ changes its prefix from "vitest" to "prov".',
      "The snapshot release goes back from 2.0.0 to 1.0.0.",
      "The snapshot changes the rows of release 1.0.0 but is released as 1.0.0; the change calls for 2.0.0.",
      "The snapshot is released as 2.0.0; its change to release 1.0.0 calls for 1.1.0.",
      "The new binding of https://beep-effect.com/ns/vitest/TestHang to @beep/test-runner/Vitest/TestHang records since 1.0.0; the change is release 1.1.0.",
      "The new deprecation of https://beep-effect.com/ns/test-utils/Vitest/TestHang records since 1.1.0; the change is release 2.0.0.",
    ]);
  });

  it("describes the violations snapshotViolations reports", () => {
    const next = snapshot({ release: release("1.1.0"), terms: [testHang, entity, iri(prov.iri), iri(vitest.iri)] });
    expect(A.map(snapshotViolations(snapshot(), next), snapshotViolationMessage)).toStrictEqual([
      "http://www.w3.org/ns/prov#Activity is removed without a deprecation.",
    ]);
  });

  it.prop(
    "every decoded violation has a non-empty message",
    [SnapshotViolation],
    ([violation]) => {
      assertTrue(Str.isNonEmpty(snapshotViolationMessage(violation)));
    },
    runs
  );
});
