import { iri } from "@beep/identity/Registry";
import { Literal, LiteralFormRefused } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import type { LiteralParts } from "@beep/rdf/Rdf";

const xsdString = iri("xsd:string");
const rdfLangString = iri("rdf:langString");

const outcome = (parts: typeof LiteralParts.Encoded) =>
  Result.match(Literal.fromParts(parts), {
    onFailure: (refusal) => refusal._tag,
    onSuccess: (literal) => literal.form._tag,
  });

describe("Literal.fromParts", () => {
  it("names the form engine parts carry and refuses every other combination", () => {
    const cases: ReadonlyArray<readonly [typeof LiteralParts.Encoded, string]> = [
      [{ value: "a", datatype: xsdString }, "Simple"],
      [{ value: "a", datatype: xsdString, language: "" }, "Simple"],
      [{ value: "1", datatype: iri("xsd:integer") }, "Typed"],
      [{ value: "a", datatype: rdfLangString, language: "en" }, "LangTagged"],
      [{ value: "a", datatype: rdfLangString }, "LiteralFormRefused"],
      [{ value: "1", datatype: "not an iri" }, "LiteralFormRefused"],
      [{ value: "a", datatype: rdfLangString, language: "not a tag!" }, "LiteralFormRefused"],
      [{ value: "a", datatype: xsdString, language: "en" }, "LiteralFormRefused"],
    ];
    expect(A.map(cases, ([parts]) => outcome(parts))).toEqual(A.map(cases, ([, expected]) => expected));
  });

  it("keeps the refused parts on the refusal", () => {
    assertFailure(
      Literal.fromParts({ value: "a", datatype: xsdString, language: "en" }),
      LiteralFormRefused.make({ value: "a", datatype: xsdString, language: O.some("en") })
    );
  });
});
