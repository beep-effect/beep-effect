import { CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const site = {
  id: "tests/test_UtilsTest.py:24:21:clean_text",
  path: "tests/test_UtilsTest.py",
  line: 24,
  column: 21,
  operation: "clean_text",
  sourceSha256: hash,
};
const payload =
  '{ "stages": {}, "input": {"text":" x ","steps":["all_whitespace"]}, "outcome": {"kind":"success","value":" x "} }';
const observation = {
  id: `tests.test_UtilsTest.UtilsTest.test_clean_text::${site.id}::1`,
  test: "tests.test_UtilsTest.UtilsTest.test_clean_text",
  sourceSiteId: site.id,
  ordinal: 1,
  operation: "clean_text",
  normalizedSha256: hash,
  payload,
};
// Bounded synthetic schema controls. The real corpus and its cryptographic,
// coordinate and independent-source checks run through ops/check-operations.ts.
const fixture = {
  schemaVersion: "citation-oracle-operations/v1",
  scope: "public-operation-observations; model/helper assertion proof remains separate",
  commit: "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e",
  tree: "a35a58fac03400f71a93a93485b77f1d56f2b02f",
  clockDate: "2026-10-28",
  hashSeed: "0",
  normalizationVersion: "public-operation-normalization/v1",
  python: "3.11.15",
  testsRun: 52,
  license: "BSD-2-Clause",
  licenseSha256: "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772",
  lockSha256: "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a",
  exporterSha256: hash,
  dependencies: { eyecite: "2.7.6" },
  sourceSites: [site],
  cases: [observation],
  artifacts: {},
};
const accepts = (value: unknown) => Result.isSuccess(S.decodeUnknownResult(CitationOracleOperations)(value));

describe("normalized public-operation oracle evidence", () => {
  it.effect("decodes typed data while preserving exact payload bytes on encode", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(CitationOracleOperations)(fixture);
      const first = decoded.cases[0];
      if (first?.operation !== "clean_text") throw new Error("expected synthetic cleaning case");
      expect(first.payload.raw).toBe(payload);
      expect(first.payload.value.input.text).toBe(" x ");
      const encoded = yield* S.encodeEffect(CitationOracleOperations)(decoded);
      expect(encoded.cases[0]?.payload).toBe(payload);
    })
  );

  it.effect("rejects a forged parsed value instead of re-encoding stale payload hashes", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(CitationOracleOperations)(fixture);
      const first = decoded.cases[0];
      if (first?.operation !== "clean_text") throw new Error("expected synthetic cleaning case");
      const changed = {
        ...decoded,
        cases: [
          {
            ...first,
            payload: {
              ...first.payload,
              value: { ...first.payload.value, input: { ...first.payload.value.input, text: "changed" } },
            },
          },
        ],
      };
      const result = yield* S.encodeUnknownEffect(CitationOracleOperations)(changed).pipe(Effect.exit);
      expect(Exit.isFailure(result)).toBe(true);
    })
  );

  it("rejects malformed JSON and unknown operation/output discriminants", () => {
    expect(accepts({ ...fixture, cases: [{ ...observation, payload: "{" }] })).toBe(false);
    expect(accepts({ ...fixture, cases: [{ ...observation, operation: "unknown" }] })).toBe(false);
    expect(
      accepts({
        ...fixture,
        cases: [
          { ...observation, payload: '{"input":{"text":"x","steps":[]},"stages":{},"outcome":{"kind":"unknown"}}' },
        ],
      })
    ).toBe(false);
  });

  it("rejects missing, duplicate or mismatched source/runtime rows", () => {
    expect(accepts({ ...fixture, cases: [] })).toBe(false);
    expect(accepts({ ...fixture, cases: [observation, observation] })).toBe(false);
    expect(accepts({ ...fixture, sourceSites: [site, site] })).toBe(false);
    expect(accepts({ ...fixture, sourceSites: [] })).toBe(false);
    expect(accepts({ ...fixture, cases: [{ ...observation, sourceSiteId: "unknown" }] })).toBe(false);
    expect(accepts({ ...fixture, cases: [{ ...observation, id: "wrong" }] })).toBe(false);
  });

  it("rejects wrong pins, clock, lock and license evidence", () => {
    expect(accepts({ ...fixture, commit: "wrong" })).toBe(false);
    expect(accepts({ ...fixture, clockDate: "2027-01-01" })).toBe(false);
    expect(accepts({ ...fixture, lockSha256: hash })).toBe(false);
    expect(accepts({ ...fixture, license: "unknown" })).toBe(false);
  });
});
