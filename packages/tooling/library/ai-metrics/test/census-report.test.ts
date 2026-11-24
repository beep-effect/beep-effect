import { CensusBaselineFile, CensusReport, censusBaselineFileName } from "@beep/repo-ai-metrics/census-report";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";

const keyOf = (name: PropertyKey) => (P.isString(name) ? name : "<symbol>");

const textFreeDeclarationsTheCensusUsesUtcInstantsAndOptions: ReadonlyArray<string> = ["DateTime.Utc", "Option"];
const textFreeLeavesAnyOtherNodeFailsClosed: ReadonlyArray<string> = [
  "Number",
  "Boolean",
  "Literal",
  "Null",
  "Undefined",
  "Enum",
];

const decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree = (
  ast: SchemaAST.AST,
  path: string
): ReadonlyArray<string> =>
  Match.value(ast).pipe(
    Match.tag("String", "TemplateLiteral", () => [path]),
    Match.tag("Objects", (objects) => [
      ...A.flatMap(objects.propertySignatures, (property) =>
        decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(property.type, `${path}.${keyOf(property.name)}`)
      ),
      ...A.flatMap(objects.indexSignatures, (index) => [
        ...decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(index.parameter, `${path}[key]`),
        ...decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(index.type, `${path}[value]`),
      ]),
    ]),
    Match.tag("Arrays", (arrays) =>
      A.flatMap([...arrays.elements, ...arrays.rest], (element) =>
        decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(element, `${path}[]`)
      )
    ),
    Match.tag("Union", (union) =>
      A.flatMap(union.types, (member) => decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(member, path))
    ),
    Match.tag("Declaration", (declaration) => {
      const expected = String(declaration.annotations?.expected);
      return A.contains(textFreeDeclarationsTheCensusUsesUtcInstantsAndOptions, expected)
        ? A.flatMap(declaration.typeParameters, (parameter) =>
            decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(parameter, `${path}<>`)
          )
        : [`${path}:Declaration(${expected})`];
    }),
    Match.tag("Suspend", (suspend) => decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(suspend.thunk(), path)),
    Match.orElse((leaf) =>
      A.contains(textFreeLeavesAnyOtherNodeFailsClosed, leaf._tag) ? [] : [`${path}:${leaf._tag}`]
    )
  );

const walk = (schema: S.Top) => decodedPathsThatCanHoldFreeTextOrAreNotKnownTextFree(SchemaAST.toType(schema.ast), "$");

describe("census report schema (AC1)", () => {
  it("holds no free-text string anywhere in the report", () => {
    expect(walk(CensusReport)).toEqual([]);
  });

  it("holds no free-text string anywhere in the baseline file", () => {
    expect(walk(CensusBaselineFile)).toEqual([]);
  });

  it("finds a free-text field when one is present", () => {
    const leaky = S.Struct({
      version: S.tag("v1"),
      rows: S.Array(S.Struct({ note: S.String })),
      tags: S.Record(S.String, S.Finite),
      maybe: S.OptionFromNullOr(S.TemplateLiteral(["x-", S.String])),
      later: S.suspend(() => S.String),
      loose: S.Unknown,
      link: S.URL,
      declarationNamedLikeAnAllowedOneIsStillUnverified: S.URL.annotate({ expected: "OptionSecret" }),
      count: S.Finite,
    });
    expect(walk(leaky)).toEqual([
      "$.rows[].note",
      "$.tags[key]",
      "$.maybe<>",
      "$.later",
      "$.loose:Unknown",
      "$.link:Declaration(URL)",
      "$.declarationNamedLikeAnAllowedOneIsStillUnverified:Declaration(OptionSecret)",
    ]);
  });

  it("names a baseline file by its window end and rule version", () => {
    expect(censusBaselineFileName(DateTime.makeUnsafe("2026-11-18T11:57:45Z"), "census-rules/2026-11-18")).toBe(
      "2026-11-18T11-57-45Z--census-rules-2026-11-18.json"
    );
    expect(censusBaselineFileName("census-rules/2026-11-18")(DateTime.makeUnsafe("2026-11-18T11:57:45.123Z"))).toBe(
      "2026-11-18T11-57-45.123Z--census-rules-2026-11-18.json"
    );
  });
});
