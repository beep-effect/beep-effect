import { CitationOracleAssertions } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const site = {
  id: "tests/test_ModelsTest.py:20:8:caseDeclaration",
  path: "tests/test_ModelsTest.py",
  line: 20,
  column: 8,
  sourceSha256: hash,
  functionId: "tests/test_ModelsTest.py:10:4:testFunction",
  symbol: "ModelsTest.test_model.assertEqual",
  assertion: "assertEqual",
  expression: "self.assertEqual(actual, expected)",
};
const payload =
  '{ "operands":[{"kind":"value","value":"x"},{"kind":"value","value":"x"}],"keywordArguments":{},"passed":true,"relation":{"kind":"comparison","equal":true},"context":{"values":{},"frames":[]} }';
const event = {
  id: `model-test::${site.id}::1`,
  test: "model-test",
  declarationId: site.id,
  ordinal: 1,
  assertion: "assertEqual",
  normalizedSha256: hash,
  payload,
};
// Synthetic schema controls stay bounded. The portable checker exercises the
// full source/discovery/hash/loop graph against committed real observations.
const fixture = {
  schemaVersion: "citation-oracle-assertions/v1",
  scope: "assertion/iteration observations; not target parity proof",
  commit: "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e",
  tree: "a35a58fac03400f71a93a93485b77f1d56f2b02f",
  python: "3.11.15",
  clockDate: "2026-10-28",
  hashSeed: "0",
  normalizationVersion: "assertion-values/v1",
  testsRun: 52,
  license: "BSD-2-Clause",
  licenseSha256: "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772",
  lockSha256: "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a",
  exporterSha256: hash,
  normalizerSha256: hash,
  source: { declarations: [site], functions: [], loops: [], literalParameters: [], fixtureGuards: [] },
  iterations: [],
  events: [event],
  artifacts: {},
};
const accepts = (value: unknown) => Result.isSuccess(S.decodeUnknownResult(CitationOracleAssertions)(value));

describe("assertion oracle evidence", () => {
  it.effect("requires fixed metadata during decode and encode rather than constructing defaults", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(CitationOracleAssertions)(fixture);
      const fields = [
        "schemaVersion",
        "scope",
        "commit",
        "tree",
        "license",
        "licenseSha256",
        "clockDate",
        "hashSeed",
        "normalizationVersion",
        "testsRun",
        "lockSha256",
      ] as const;
      for (const field of fields) {
        expect(accepts(R.remove(fixture, field))).toBe(false);
        const encoded = yield* S.encodeUnknownEffect(CitationOracleAssertions)(R.remove(decoded, field)).pipe(
          Effect.exit
        );
        expect(Exit.isFailure(encoded)).toBe(true);
      }
    })
  );

  it("requires observed success and relation tags inside the preserved payload", () => {
    for (const invalid of [
      Str.replace('"passed":true,', "")(payload),
      Str.replace('"kind":"comparison",', "")(payload),
    ]) {
      expect(accepts({ ...fixture, events: [{ ...event, payload: invalid }] })).toBe(false);
    }
  });

  it.effect("preserves original assertion bytes through both codec directions", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(CitationOracleAssertions)(fixture);
      expect(decoded.events[0]?.payload.value.operands.length).toBe(2);
      const encoded = yield* S.encodeEffect(CitationOracleAssertions)(decoded);
      expect(encoded.events[0]?.payload).toBe(payload);
    })
  );

  it.effect("rejects forged typed payloads with stale raw bytes", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(CitationOracleAssertions)(fixture);
      const first = decoded.events[0];
      if (first === undefined) throw new Error("expected synthetic observation");
      const forged = {
        ...decoded,
        events: [{ ...first, payload: { ...first.payload, value: { ...first.payload.value, operands: [] } } }],
      };
      const result = yield* S.encodeUnknownEffect(CitationOracleAssertions)(forged).pipe(Effect.exit);
      expect(Exit.isFailure(result)).toBe(true);
    })
  );

  it("rejects missing, duplicate and mismatched assertion declarations", () => {
    expect(accepts({ ...fixture, events: [] })).toBe(false);
    expect(accepts({ ...fixture, events: [event, event] })).toBe(false);
    expect(accepts({ ...fixture, source: { ...fixture.source, declarations: [] } })).toBe(false);
    expect(accepts({ ...fixture, events: [{ ...event, id: "forged" }] })).toBe(false);
    expect(accepts({ ...fixture, events: [{ ...event, assertion: "assertNotEqual" }] })).toBe(false);
  });

  it("rejects malformed or unclassified operands and outcomes", () => {
    expect(accepts({ ...fixture, events: [{ ...event, payload: "{" }] })).toBe(false);
    expect(accepts({ ...fixture, events: [{ ...event, assertion: "unknown" }] })).toBe(false);
    expect(
      accepts({ ...fixture, events: [{ ...event, payload: Str.replace('"passed":true', '"passed":false')(payload) }] })
    ).toBe(false);
    expect(
      accepts({
        ...fixture,
        events: [{ ...event, payload: Str.replace('"kind":"value"', '"kind":"unknown"')(payload) }],
      })
    ).toBe(false);
  });

  it("rejects mismatched literal counts and nonconsecutive source items", () => {
    const parameter = {
      ...site,
      targets: ["cases"],
      role: "assigned",
      collectionKind: "List",
      itemCount: 2,
      items: [{ ordinal: 1, expression: "x", expressionSha256: hash }],
    };
    expect(accepts({ ...fixture, source: { ...fixture.source, literalParameters: [parameter] } })).toBe(false);
    expect(
      accepts({
        ...fixture,
        source: {
          ...fixture.source,
          literalParameters: [{ ...parameter, itemCount: 1, items: [{ ...parameter.items[0], ordinal: 2 }] }],
        },
      })
    ).toBe(false);
  });
});
