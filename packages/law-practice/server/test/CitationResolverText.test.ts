import { FullCitation, IdCitation } from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import authorities from "../../use-cases/test/fixtures/eyecite/authority-identity-cases.json" with { type: "json" };
import cases from "../../use-cases/test/fixtures/eyecite/resolver-text-cases.json" with { type: "json" };
import { citationPythonTextData } from "../src/internal/Citation/PythonTextData.ts";
import {
  hasInvalidCitationPinCite,
  isCitationPythonDigit,
  stripCitationAntecedentPunctuation,
} from "../src/internal/Citation/ResolverText.ts";

const Cases = S.Struct({
  schemaVersion: S.Literal("citation-resolver-text-cases/v1"),
  oracleCommit: S.Literal("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  unicodeVersion: S.Literal("14.0.0"),
  integerMaxDigits: S.Literal(4300),
  characterFacts: S.Struct({
    unicodeVersion: S.Literal("14.0.0"),
    digits: S.String,
    decimalDigits: S.String,
    whitespace: S.String,
  }),
  punctuation: S.Array(S.Struct({ input: S.String, output: S.String })),
  digits: S.Array(S.Struct({ input: S.String, output: S.Boolean })),
  pins: S.Array(
    S.Struct({
      kind: S.Literals(["case", "law", "journal"]),
      page: S.NullOr(S.String),
      pin: S.NullOr(S.String),
      outcome: S.Union([
        S.Struct({ status: S.tag("value"), invalid: S.Boolean }),
        S.Struct({ status: S.tag("error"), kind: S.Literals(["ValueError", "AttributeError"]) }),
      ]).pipe(S.toTaggedUnion("status")),
    })
  ),
});
const fixture = S.decodeUnknownEffect(Cases)(cases);

it.effect("matches all 60 canonical punctuation/whitespace observations", () =>
  Effect.gen(function* () {
    const data = yield* fixture;
    expect(A.length(data.punctuation)).toBe(60);
    for (const row of data.punctuation) expect(stripCitationAntecedentPunctuation(row.input)).toBe(row.output);
  })
);

it.effect("retains all frozen digit classifications and Unicode-version boundaries", () =>
  Effect.gen(function* () {
    const data = yield* fixture;
    expect(citationPythonTextData).toEqual(data.characterFacts);
    expect(A.length(A.fromIterable(citationPythonTextData.digits))).toBe(788);
    expect(A.length(A.fromIterable(citationPythonTextData.decimalDigits))).toBe(660);
    expect(A.length(A.fromIterable(citationPythonTextData.whitespace))).toBe(29);
    expect(A.length(data.digits)).toBe(955);
    for (const row of data.digits) expect(isCitationPythonDigit(row.input)).toBe(row.output);
  })
);

it.effect("matches 38 pin checks including Unicode decimals, big integers and canonical exceptions", () =>
  Effect.gen(function* () {
    const data = yield* fixture;
    expect(A.length(data.pins)).toBe(38);
    for (const row of data.pins) {
      const index = row.kind === "case" ? 0 : row.kind === "law" ? 8 : 11;
      const base = yield* S.encodeEffect(FullCitation)(
        yield* S.decodeUnknownEffect(FullCitation)(A.getUnsafe(authorities.cases, index).input.citation)
      );
      const components =
        row.page === "missing" ? R.remove(base.components, "page") : { ...base.components, page: row.page };
      const fullCitation = yield* S.decodeEffect(FullCitation)({ ...base, components });
      const idCitation = yield* S.decodeEffect(IdCitation)({
        type: "id",
        components: {},
        metadata: { pinCite: row.pin, parenthetical: null },
      });
      const effect = hasInvalidCitationPinCite({ fullCitation, idCitation });
      if (row.outcome.status === "value") expect(yield* effect).toBe(row.outcome.invalid);
      else {
        const failure = yield* Effect.flip(effect);
        expect(failure.reason).toBe(row.outcome.kind === "ValueError" ? "integer-conversion" : "canonical-page-type");
        expect("cause" in failure).toBe(false);
      }
    }
  })
);

it.effect("returns a sanitized private failure for malformed inputs", () =>
  Effect.gen(function* () {
    const failure = yield* Effect.flip(hasInvalidCitationPinCite({ secret: "private-source-text" }));
    expect(failure.reason).toBe("invalid-input");
    expect(failure.message).not.toContain("private-source-text");
    expect("cause" in failure).toBe(false);
  })
);
