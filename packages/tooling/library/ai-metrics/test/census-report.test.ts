import { CensusBaselineFile, CensusReport, censusBaselineFileName } from "@beep/repo-ai-metrics/census-report";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";

// Every path in a schema's decoded side that can hold free text, or whose node is not known to be text-free.
// Literal domains, version tags and declarations without text parameters (DateTime) hold none.
const keyOf = (name: PropertyKey) => (P.isString(name) ? name : "<symbol>");

const textFreeDeclarations: ReadonlyArray<string> = ["DateTime.Utc", "Option"];
const textFreeLeaves: ReadonlyArray<string> = ["Number", "Boolean", "Literal", "Null", "Undefined", "Enum"];

const freeTextPaths = (ast: SchemaAST.AST, path: string): ReadonlyArray<string> =>
  Match.value(ast).pipe(
    Match.tag("String", "TemplateLiteral", () => [path]),
    Match.tag("Objects", (objects) => [
      ...A.flatMap(objects.propertySignatures, (property) =>
        freeTextPaths(property.type, `${path}.${keyOf(property.name)}`)
      ),
      ...A.flatMap(objects.indexSignatures, (index) => [
        ...freeTextPaths(index.parameter, `${path}[key]`),
        ...freeTextPaths(index.type, `${path}[value]`),
      ]),
    ]),
    Match.tag("Arrays", (arrays) =>
      A.flatMap([...arrays.elements, ...arrays.rest], (element) => freeTextPaths(element, `${path}[]`))
    ),
    Match.tag("Union", (union) => A.flatMap(union.types, (member) => freeTextPaths(member, path))),
    // A declaration passes only by name: the census uses UTC instants and options. Any other one is unverified.
    Match.tag("Declaration", (declaration) => {
      const expected = String(declaration.annotations?.expected);
      return A.some(textFreeDeclarations, (name) => Str.startsWith(name)(expected))
        ? A.flatMap(declaration.typeParameters, (parameter) => freeTextPaths(parameter, `${path}<>`))
        : [`${path}:Declaration(${expected})`];
    }),
    Match.tag("Suspend", (suspend) => freeTextPaths(suspend.thunk(), path)),
    // Leaves that cannot hold text pass by name; any other node (unknown, any, object, symbol) fails closed.
    Match.orElse((leaf) => (A.contains(textFreeLeaves, leaf._tag) ? [] : [`${path}:${leaf._tag}`]))
  );

const walk = (schema: S.Top) => freeTextPaths(SchemaAST.toType(schema.ast), "$");

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
      count: S.Finite,
    });
    expect(walk(leaky)).toEqual([
      "$.rows[].note",
      "$.tags[key]",
      "$.maybe<>",
      "$.later",
      "$.loose:Unknown",
      "$.link:Declaration(URL)",
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
