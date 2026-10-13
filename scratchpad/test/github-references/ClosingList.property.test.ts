import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, arbitrary: Arbitrary.Arbitrary<T> = Arbitrary.schema(schema)): void => {
  it.effect.prop(name + ": encode/decode preserves values and never fails", [arbitrary], ([value]) =>
    Effect.gen(function* () {
      assertTrue(S.is(schema)(value));
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};
import * as O from "effect/Option";
import * as G from "../../effected/github-references/ClosingList.ts";
import { ClosingKeyword } from "../../effected/github-references/IssueReferences.ts";

const referenceArbitrary = Arbitrary.all({
  keyword: Arbitrary.schema(G.ReferenceList.fields.keyword),
  issueNumbers: Arbitrary.schema(G.ReferenceList.fields.issueNumbers),
}).pipe(Arbitrary.map((reference) => ({ ...reference, closing: S.is(ClosingKeyword)(reference.keyword) })));
const spanArbitrary = Arbitrary.schema(G.HarvestedReferenceList.fields.end.check(S.isGreaterThan(0))).pipe(
  Arbitrary.flatMap((end) => Arbitrary.schema(G.HarvestedReferenceList.fields.start.check(S.isLessThan(end))).pipe(
    Arbitrary.map((start) => ({ start, end })),
  )),
);
const harvestedArbitrary = Arbitrary.all({ reference: referenceArbitrary, span: spanArbitrary }).pipe(
  Arbitrary.map(({ reference, span }) => ({ ...reference, ...span })),
);

const Sample = S.Struct({
  keyword: G.ListKeyword,
  issues: S.NonEmptyArray(S.Int.check(S.isBetween({ minimum: 0, maximum: 999999 }))),
  separator: S.Literals([",", ", ", " and ", ", and ", "\tand\t"]),
  colon: S.Boolean,
});
const stringifyList = (value: G.ClosingList | G.ReferenceList): string =>
  value.keyword + " " + value.issueNumbers.map((issue) => "#" + issue).join(",");
const stringifyHarvest = (values: ReadonlyArray<G.HarvestedReferenceList>): string => {
  let text = "";
  for (const value of values) {
    const items = value.issueNumbers.map((issue) => "#" + issue).join(",");
    text += " ".repeat(value.start - text.length);
    text += value.keyword + " ".repeat(value.end - value.start - value.keyword.length - items.length) + items;
  }
  return text;
};
const singleProperty = <T>(name: string, parse: (text: string) => O.Option<T>, stringify: (value: T) => string): void => {
  it.effect.prop(name + ": canonicalization is idempotent and parse/stringify is faithful",
    [Arbitrary.schema(Sample), Arbitrary.schema(S.String)], ([sample, noise]) => Effect.sync(() => {
      const line = " " + sample.keyword.toUpperCase() + (sample.colon ? ":" : "") + "\t" + sample.issues.map((issue) => "#00" + issue).join(sample.separator) + " ";
      for (const text of [line, noise]) {
        const parsed = parse(text);
        const canonical = O.match(parsed, { onNone: () => "", onSome: stringify });
        assert.deepStrictEqual(parse(canonical), parsed);
        assert.strictEqual(O.match(parse(canonical), { onNone: () => "", onSome: stringify }), canonical);
      }
    }), runs);
};
const arrayProperty = <T>(name: string, parse: (text: string) => ReadonlyArray<T>, stringify: (values: ReadonlyArray<T>) => string): void => {
  it.effect.prop(name + ": canonicalization is idempotent and parse/stringify is faithful",
    [Arbitrary.schema(Sample), Arbitrary.schema(S.String)], ([sample, noise]) => Effect.sync(() => {
      const items = sample.issues.map((issue) => "#00" + issue).join(sample.separator);
      const line = sample.keyword.toUpperCase() + (sample.colon ? ":" : "") + "\t" + items;
      for (const text of [line, "ignored\n" + line + "\r\n" + line, "prose " + sample.keyword + " " + items + ". fixes #7", noise]) {
        const parsed = parse(text);
        const canonical = stringify(parsed);
        assert.deepStrictEqual(parse(canonical), parsed);
        assert.strictEqual(stringify(parse(canonical)), canonical);
      }
    }), runs);
};
describe("ClosingList property floor", () => {
  roundTrips("ReferenceKeyword", G.ReferenceKeyword);
  roundTrips("ListKeyword", G.ListKeyword);
  roundTrips("ClosingList", G.ClosingList);
  roundTrips("ReferenceList", G.ReferenceList, referenceArbitrary);
  roundTrips("HarvestedReferenceList", G.HarvestedReferenceList, harvestedArbitrary);
  it.effect.prop("schema-derived lists have consistent closing flags and ordered harvested spans",
    [referenceArbitrary, harvestedArbitrary], ([reference, harvested]) => Effect.sync(() => {
      assert.strictEqual(reference.closing, S.is(ClosingKeyword)(reference.keyword));
      assert.strictEqual(harvested.closing, S.is(ClosingKeyword)(harvested.keyword));
      assertTrue(harvested.end > harvested.start);
    }), runs);
  singleProperty("parseClosingList", G.parseClosingList, stringifyList);
  singleProperty("parseReferenceList", G.parseReferenceList, stringifyList);
  const stringifyLines = (values: ReadonlyArray<G.ClosingList | G.ReferenceList>) => values.map(stringifyList).join("\n");
  arrayProperty("parseClosingLists", G.parseClosingLists, stringifyLines);
  arrayProperty("parseReferenceLists", G.parseReferenceLists, stringifyLines);
  arrayProperty("collectReferenceLists", G.collectReferenceLists, stringifyLines);
  arrayProperty("harvestReferenceLists", G.harvestReferenceLists, stringifyHarvest);
  it.effect.prop("README: duplicates, order, case, atomic unsafe-number rejection and exact spans",
    [Arbitrary.schema(Sample)], ([sample]) => Effect.sync(() => {
      const issues = A.appendAll(sample.issues, sample.issues);
      const line = sample.keyword.toUpperCase() + " " + issues.map((issue) => "#" + issue).join(sample.separator);
      assert.deepStrictEqual(G.parseReferenceList(line), O.some({ keyword: sample.keyword, closing: S.is(ClosingKeyword)(sample.keyword), issueNumbers: issues }));
      assert.deepStrictEqual(G.parseReferenceList(line + ", #9007199254740992"), O.none());
      assert.deepStrictEqual(G.harvestReferenceLists(line + ", #9007199254740992"), []);
      const prose = "prefix " + line + " suffix";
      for (const hit of G.harvestReferenceLists(prose)) {
        assert.deepStrictEqual(G.parseReferenceList(prose.slice(hit.start, hit.end)), O.some({ keyword: hit.keyword, closing: hit.closing, issueNumbers: hit.issueNumbers }));
      }
    }), runs);
});
