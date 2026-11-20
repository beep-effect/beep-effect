import { fcRuns } from "@beep/fc-runs";
import { IRI } from "@beep/identity/Iri";
import { SafePnLocal } from "@beep/identity/PnLocal";
import {
  CodeId,
  Deprecation,
  Namespace,
  ReleaseVersion,
  SnapshotViolation,
  snapshotViolationMessage,
  snapshotViolations,
  Term,
  TermBinding,
  TermIri,
  TermLocal,
  TermSnapshot,
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

const prov = Namespace.make({ prefix: "prov", iri: IRI.make("http://www.w3.org/ns/prov#") });
const vitest = Namespace.make({ prefix: "vitest", iri: IRI.make("https://beep-effect.com/ns/vitest/") });
const activity = iri("http://www.w3.org/ns/prov#Activity");
const entity = iri("http://www.w3.org/ns/prov#Entity");
const testHang = iri("https://beep-effect.com/ns/vitest/TestHang");
const oldTestHang = iri("https://beep-effect.com/ns/test-utils/Vitest/TestHang");
const v1 = release("1.0.0");
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
  it("accepts declared term IRIs, code identities and release versions", () => {
    expect(S.is(TermIri)("https://beep-effect.com/ns/qa/receipts/accepted/v2")).toBe(true);
    expect(S.is(TermIri)("no scheme")).toBe(false);
    expect(S.is(CodeId)("@beep/repo-cli/commands/Research/Library/Library.schemas/Source")).toBe(true);
    expect(S.is(CodeId)("@other/pkg/Name")).toBe(false);
    expect(S.is(CodeId)("@beep/Pkg/Name")).toBe(false);
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

  it("refuses two distinct rows with one key", () => {
    const rebound = TermBinding.make({ code: hangCode, term: activity, since: v1 });
    assertTrue(
      TermSnapshot.fromRows({ ...baseRows, bindings: [...baseRows.bindings, rebound] }).pipe(Result.isFailure)
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
    const removed = snapshot({ terms: [testHang, activity, iri(prov.iri), iri(vitest.iri)] });
    expect(snapshotViolations(previous, removed)).toStrictEqual([
      SnapshotViolation.cases.TermRemoved.make({ term: entity }),
    ]);

    const deprecated = snapshot({
      terms: [testHang, activity, iri(prov.iri), iri(vitest.iri)],
      deprecations: [
        ...baseRows.deprecations,
        Deprecation.make({ term: entity, since: release("2.0.0"), replacement: O.none() }),
      ],
    });
    expect(snapshotViolations(previous, deprecated)).toStrictEqual([]);
    expect(pipeDual(previous, deprecated)).toStrictEqual([]);
  });

  it("reports a revived, removed or changed deprecation", () => {
    const previous = snapshot();
    expect(tags(snapshotViolations(previous, snapshot({ terms: [...baseRows.terms, oldTestHang] })))).toStrictEqual([
      "TermRevived",
    ]);
    expect(tags(snapshotViolations(previous, snapshot({ deprecations: [] })))).toStrictEqual(["DeprecationRemoved"]);
    expect(
      tags(
        snapshotViolations(
          previous,
          snapshot({ deprecations: [Deprecation.make({ term: oldTestHang, since: v1, replacement: O.none() })] })
        )
      )
    ).toStrictEqual(["DeprecationChanged"]);
  });

  it("reports a reassigned, rewritten or ambiguous binding", () => {
    const previous = snapshot();
    expect(
      snapshotViolations(
        previous,
        snapshot({ bindings: [TermBinding.make({ code: hangCode, term: activity, since: v1 })] })
      )
    ).toStrictEqual([SnapshotViolation.cases.BindingReassigned.make({ code: hangCode, from: testHang, to: activity })]);
    expect(
      snapshotViolations(
        previous,
        snapshot({ bindings: [TermBinding.make({ code: hangCode, term: testHang, since: release("1.1.0") })] })
      )
    ).toStrictEqual([SnapshotViolation.cases.SinceRewritten.make({ term: testHang, from: v1, to: release("1.1.0") })]);

    const movedCode = code("@beep/test-runner/Runner/TestHang");
    expect(
      snapshotViolations(
        previous,
        snapshot({ bindings: [TermBinding.make({ code: movedCode, term: testHang, since: v1 })] })
      )
    ).toStrictEqual([]);
    expect(
      snapshotViolations(
        previous,
        snapshot({
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

  it("reports a dropped namespace and a changed prefix", () => {
    const previous = snapshot();
    const renamed = Namespace.make({ prefix: "provo", iri: prov.iri });
    expect(snapshotViolations(previous, snapshot({ namespaces: [renamed, vitest] }))).toStrictEqual([
      SnapshotViolation.cases.NamespacePrefixChanged.make({ iri: prov.iri, from: "prov", to: "provo" }),
    ]);
    expect(snapshotViolations(previous, snapshot({ namespaces: [vitest] }))).toStrictEqual([
      SnapshotViolation.cases.NamespaceDropped.make({ prefix: "prov", iri: prov.iri }),
    ]);
    expect(
      snapshotViolations(
        previous,
        snapshot({
          namespaces: [vitest],
          deprecations: [
            ...baseRows.deprecations,
            Deprecation.make({ term: iri(prov.iri), since: release("2.0.0"), replacement: O.none() }),
          ],
          terms: [testHang, entity, activity, iri(vitest.iri)],
        })
      )
    ).toStrictEqual([]);
  });

  it.prop(
    "additions to the published term set are free",
    [S.Array(SafePnLocal).check(S.isMaxLength(8))],
    ([locals]) => {
      // A PN_LOCAL may hold code points RFC 3987 refuses (U+E0000 to U+E0FFF), and Term.of refuses those.
      const added = pipe(
        locals,
        A.filter((local) => S.is(TermIri)(`${vitest.iri}${local}`)),
        A.map((local) => Term.of(vitest, TermLocal.make(local)).iri)
      );
      const next = snapshot({ release: release("1.1.0"), terms: [...baseRows.terms, ...added] });
      expect(snapshotViolations(snapshot(), next)).toStrictEqual([]);
    },
    runs
  );
});

const pipeDual = (previous: TermSnapshot, next: TermSnapshot) => snapshotViolations(next)(previous);

describe("snapshotViolationMessage", () => {
  const Violation = SnapshotViolation.cases;
  const v2 = release("2.0.0");
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
