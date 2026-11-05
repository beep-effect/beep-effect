import { CitationOracleDiscovery } from "@beep/law-practice-use-cases/test";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const declaration = {
  id: "tests/test_Example.py:3:0:caseDeclaration",
  kind: "caseDeclaration",
  path: "tests/test_Example.py",
  line: 3,
  column: 0,
  symbol: "Example.test_example.assertEqual",
  sourceSha256: hash,
};
const method = {
  ...declaration,
  id: "tests/test_Example.py:2:0:testMethod",
  kind: "testMethod",
  line: 2,
  symbol: "Example.test_example",
};
const event = {
  id: `tests.test_Example.Example.test_example::${declaration.id}::1`,
  test: "tests.test_Example.Example.test_example",
  declarationId: declaration.id,
  ordinal: 1,
  assertion: "assertEqual",
};
const report = {
  schemaVersion: "citation-oracle-audit/v1",
  scope: "source-and-runtime-assertion-discovery; not normalized parity proof",
  commit: "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e",
  tree: "a35a58fac03400f71a93a93485b77f1d56f2b02f",
  python: "3.11.15",
  license: "BSD-2-Clause",
  licenseSha256: "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772",
  exporterSha256: hash,
  sourceFiles: [{ path: declaration.path, sha256: hash }],
  sourceRows: [method, declaration],
  runtime: {
    successful: true,
    testsRun: 1,
    failures: 0,
    errors: 0,
    skipped: 0,
    assertionEvents: [event],
    unobservedDeclarations: [],
  },
};
const accepts = S.is(CitationOracleDiscovery);

describe("citation oracle discovery evidence", () => {
  it("accepts coherent discovery without claiming semantic parity", () => {
    expect(accepts(report)).toBe(true);
  });

  it("rejects wrong pins, licenses, unknown row kinds and malformed digests", () => {
    expect(accepts({ ...report, commit: "wrong" })).toBe(false);
    expect(accepts({ ...report, license: "unlicensed" })).toBe(false);
    expect(accepts({ ...report, exporterSha256: "missing" })).toBe(false);
    expect(accepts({ ...report, sourceRows: [{ ...declaration, kind: "unknown" }] })).toBe(false);
  });

  it("rejects duplicate source declarations and runtime events", () => {
    expect(accepts({ ...report, sourceRows: [method, declaration, declaration] })).toBe(false);
    expect(accepts({ ...report, runtime: { ...report.runtime, assertionEvents: [event, event] } })).toBe(false);
  });

  it("rejects a missing declaration or an unobserved assertion", () => {
    expect(accepts({ ...report, sourceRows: [method] })).toBe(false);
    expect(accepts({ ...report, runtime: { ...report.runtime, assertionEvents: [] } })).toBe(false);
  });

  it("rejects inconsistent file hashes, event identities and method counts", () => {
    expect(accepts({ ...report, sourceFiles: [] })).toBe(false);
    expect(
      accepts({
        ...report,
        sourceRows: [
          method,
          { ...declaration, sourceSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
        ],
      })
    ).toBe(false);
    expect(accepts({ ...report, runtime: { ...report.runtime, assertionEvents: [{ ...event, id: "wrong" }] } })).toBe(
      false
    );
    expect(accepts({ ...report, runtime: { ...report.runtime, testsRun: 2 } })).toBe(false);
  });

  it("rejects failed, skipped or incomplete upstream discovery runs", () => {
    expect(accepts({ ...report, runtime: { ...report.runtime, successful: false } })).toBe(false);
    expect(accepts({ ...report, runtime: { ...report.runtime, skipped: 1 } })).toBe(false);
    expect(accepts({ ...report, runtime: { ...report.runtime, unobservedDeclarations: [declaration.id] } })).toBe(
      false
    );
  });
});
