/**
 * Test-only assertion operands and source-defined loop observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { CitationOracleArtifact, CitationOracleJson } from "./citationOracleJson.ts";

const $I = $LawPracticeUseCasesId.create("internal/citationOracleAssertions");
const Assertion = LiteralKit([
  "assertEqual",
  "assertNotEqual",
  "assertListEqual",
  "assertIn",
  "assertTrue",
  "assertFalse",
  "assertIsNone",
  "assert_not_called",
  "assertResolution",
  "assertRaises",
]);
const SourceFields = {
  id: S.NonEmptyString,
  path: S.NonEmptyString,
  line: S.Natural,
  column: S.Natural,
  sourceSha256: Sha256Hex,
};
const Declaration = S.Struct({
  ...SourceFields,
  functionId: S.NonEmptyString,
  symbol: S.NonEmptyString,
  assertion: Assertion,
  expression: S.NonEmptyString,
});
const FunctionSite = S.Struct({ ...SourceFields, symbol: S.NonEmptyString, entryLine: S.Natural, endLine: S.Natural });
const Loop = S.Struct({
  ...SourceFields,
  functionId: S.NonEmptyString,
  bodyLine: S.Natural,
  endLine: S.Natural,
  targets: S.Array(S.String),
  iterableExpression: S.NonEmptyString,
  literalParameterId: S.optionalKey(S.NonEmptyString),
});
const Parameter = S.Struct({
  ...SourceFields,
  functionId: S.NonEmptyString,
  targets: S.Array(S.String),
  role: LiteralKit(["assigned", "iterable", "positional", "keyword", "call-vector"]),
  collectionKind: LiteralKit(["List", "Tuple", "Set", "Dict", "ArgumentVector"]),
  callee: S.optionalKey(S.NonEmptyString),
  callLine: S.optionalKey(S.Natural),
  argumentIndex: S.optionalKey(S.Natural),
  keyword: S.optionalKey(S.String),
  itemCount: S.Natural,
  items: S.Array(S.Struct({ ordinal: S.Natural, expression: S.String, expressionSha256: Sha256Hex })),
});
const Guard = S.Struct({
  ...SourceFields,
  functionId: S.NonEmptyString,
  expression: S.NonEmptyString,
  reason: S.tag("Rejects an invalid test-fixture construction; not a citation-engine operation."),
});
const Iteration = S.Struct({
  id: S.NonEmptyString,
  test: S.NonEmptyString,
  functionId: S.NonEmptyString,
  invocationOrdinal: S.Natural,
  loopId: S.NonEmptyString,
  ordinal: S.Natural,
  indexWithinParent: S.Natural,
  parentIterationIds: S.Array(S.NonEmptyString),
  literalParameterId: S.optionalKey(S.NonEmptyString),
  bindings: S.JsonObject,
});
const Operand = S.Union([
  S.Struct({ kind: S.tag("value"), value: S.Json }),
  S.Struct({ kind: LiteralKit(["identity-value", "identity-hash"]), identitySlot: S.Natural, target: S.Json }),
]);
const Relation = S.Union([
  S.Struct({ kind: S.tag("comparison"), equal: S.Boolean }),
  S.Struct({ kind: S.tag("membership"), contains: S.Boolean }),
  S.Struct({ kind: S.tag("truth"), truth: S.Boolean }),
  S.Struct({ kind: S.tag("none"), isNone: S.Boolean }),
  S.Struct({ kind: S.tag("mock"), callCount: S.Natural }),
  S.Struct({ kind: S.tag("helper-invocation") }),
  S.Struct({ kind: S.tag("raises"), expectedType: S.JsonObject, actualType: S.JsonObject, actualMessage: S.String }),
]);
const Payload = S.Struct({
  operands: S.Array(Operand),
  keywordArguments: S.JsonObject,
  passed: S.tag(true),
  relation: Relation,
  context: S.Struct({
    values: S.JsonObject,
    frames: S.Array(
      S.Struct({ functionId: S.NonEmptyString, invocationOrdinal: S.Natural, iterationIds: S.Array(S.NonEmptyString) })
    ),
  }),
});
const Event = S.Struct({
  id: S.NonEmptyString,
  test: S.NonEmptyString,
  declarationId: S.NonEmptyString,
  ordinal: S.Natural,
  assertion: Assertion,
  normalizedSha256: Sha256Hex,
  payload: CitationOracleJson(Payload),
});
const Report = S.Struct({
  schemaVersion: S.tag("citation-oracle-assertions/v1"),
  scope: S.tag("assertion/iteration observations; not target parity proof"),
  commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
  python: S.NonEmptyString,
  clockDate: S.tag("2026-10-28"),
  hashSeed: S.tag("0"),
  normalizationVersion: S.tag("assertion-values/v1"),
  testsRun: S.tag(52),
  license: S.tag("BSD-2-Clause"),
  licenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
  lockSha256: S.tag("864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"),
  exporterSha256: Sha256Hex,
  normalizerSha256: Sha256Hex,
  source: S.Struct({
    declarations: S.Array(Declaration),
    functions: S.Array(FunctionSite),
    loops: S.Array(Loop),
    literalParameters: S.Array(Parameter),
    fixtureGuards: S.Array(Guard),
  }),
  iterations: S.Array(Iteration),
  events: S.Array(Event),
  artifacts: S.Record(Sha256Hex, CitationOracleArtifact),
});
const unique = (ids: ReadonlyArray<string>) => A.length(A.dedupe(ids)) === A.length(ids);
const Accounting = S.makeFilter(
  (report: typeof Report.Type) => {
    const declarations = report.source.declarations;
    return (
      unique(A.map(report.events, (row) => row.id)) &&
      unique(A.map(report.iterations, (row) => row.id)) &&
      A.every(
        [
          declarations,
          report.source.functions,
          report.source.loops,
          report.source.literalParameters,
          report.source.fixtureGuards,
        ],
        (rows) => unique(A.map(rows, (row) => row.id))
      ) &&
      A.every(declarations, (row) => A.some(report.events, (event) => event.declarationId === row.id)) &&
      A.every(
        report.events,
        (row) =>
          row.ordinal > 0 &&
          row.id === `${row.test}::${row.declarationId}::${row.ordinal}` &&
          A.some(declarations, (site) => site.id === row.declarationId && site.assertion === row.assertion)
      ) &&
      A.every(
        report.source.literalParameters,
        (row) =>
          row.itemCount === A.length(row.items) && A.every(row.items, (item, index) => item.ordinal === index + 1)
      )
    );
  },
  $I.annote("AssertionAccounting", {
    description:
      "Unique declarations, iterations and assertion events with complete declared observations and literal item accounting.",
    message: "Assertion evidence has duplicate, missing or inconsistent source/runtime rows.",
  })
);

/**
 * Source-bound assertion observations, including identity-sensitive comparisons.
 *
 * **Details**
 *
 * This is oracle evidence, not a claim of target-engine parity. The portable
 * checker additionally verifies independent discovery, hashes and loop coverage.
 *
 * **Example** (Reject an unversioned assertion report)
 *
 * ```ts
 * import { CitationOracleAssertions } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationOracleAssertions)({})) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationOracleAssertions extends S.Opaque<CitationOracleAssertions, { readonly brand: unique symbol }>()(
  Report.check(Accounting).pipe(
    $I.annoteSchema("CitationOracleAssertions", {
      description:
        "Pinned, byte-preserving assertion operands, producer context and independently inventoried literal-loop observations.",
    })
  )
) {}
