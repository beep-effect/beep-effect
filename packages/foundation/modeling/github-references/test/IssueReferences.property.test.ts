import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(
  name: string,
  schema: S.Codec<T, E>,
  arbitrary: Arbitrary.Arbitrary<T> = Arbitrary.schema(schema)
): void => {
  it.effect.prop(
    `${name}: encode/decode preserves values and never fails`,
    [arbitrary],
    ([value]) =>
      Effect.gen(function* () {
        assertTrue(S.is(schema)(value));
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
      }),
    runs
  );
};

import * as G from "@beep/github-references/IssueReferences";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const spanArbitrary = Arbitrary.schema(G.IssueReference.fields.end.check(S.isGreaterThan(0))).pipe(
  Arbitrary.flatMap((end) =>
    Arbitrary.schema(G.IssueReference.fields.start.check(S.isLessThan(end))).pipe(
      Arbitrary.map((start) => ({ start, end }))
    )
  )
);
const referenceArbitrary = Arbitrary.all({
  keyword: Arbitrary.schema(G.IssueReference.fields.keyword),
  issueNumber: Arbitrary.schema(G.IssueReference.fields.issueNumber),
  span: spanArbitrary,
}).pipe(Arbitrary.map(({ keyword, issueNumber, span }) => ({ keyword, issueNumber, ...span })));
const Sample = S.Struct({
  keyword: G.ClosingKeyword,
  issue: S.Int.check(S.isBetween({ minimum: 0, maximum: 999999 })),
  colon: S.Boolean,
});
const stringifyBare = (value: Pick<G.BareLineReference, "keyword" | "issueNumber">): string =>
  `${value.keyword} #${value.issueNumber}`;
const stringifyHarvest = (values: ReadonlyArray<G.IssueReference>): string => {
  let text = "";
  for (const value of values) {
    const item = `#${value.issueNumber}`;
    text += Str.repeat(value.start - text.length)(" ");
    text += value.keyword + Str.repeat(value.end - value.start - value.keyword.length - item.length)(" ") + item;
  }
  return text;
};
describe("IssueReferences property floor", () => {
  roundTrips("ClosingKeyword", G.ClosingKeyword);
  roundTrips("IssueReference", G.IssueReference, referenceArbitrary);
  it.effect.prop(
    "schema-derived issue references have ordered spans",
    [referenceArbitrary],
    ([reference]) => Effect.sync(() => assertTrue(reference.end > reference.start)),
    runs
  );
  roundTrips("BareLineReference", G.BareLineReference);
  it.effect.prop(
    "parseBareLineReference: canonicalization idempotence and parse/stringify fidelity",
    [Arbitrary.schema(Sample), Arbitrary.schema(S.String)],
    ([sample, noise]) =>
      Effect.sync(() => {
        for (const text of [
          ` ${Str.toUpperCase(sample.keyword)}${sample.colon ? ":" : ""}\t#00${sample.issue} `,
          noise,
        ]) {
          const parsed = G.parseBareLineReference(text);
          const canonical = O.match(parsed, { onNone: () => "", onSome: stringifyBare });
          assert.deepStrictEqual(G.parseBareLineReference(canonical), parsed);
          assert.strictEqual(
            O.match(G.parseBareLineReference(canonical), { onNone: () => "", onSome: stringifyBare }),
            canonical
          );
        }
      }),
    runs
  );
  it.effect.prop(
    "parseBareLines: canonicalization idempotence and parse/stringify fidelity",
    [Arbitrary.schema(Sample), Arbitrary.schema(S.String)],
    ([sample, noise]) =>
      Effect.sync(() => {
        for (const text of [
          "ignored\n" +
            Str.toUpperCase(sample.keyword) +
            ": #00" +
            sample.issue +
            "\r\n" +
            sample.keyword +
            " #" +
            sample.issue,
          noise,
        ]) {
          const parsed = G.parseBareLines(text);
          const canonical = A.join(A.map(parsed, stringifyBare), "\n");
          assert.deepStrictEqual(G.parseBareLines(canonical), parsed);
          assert.strictEqual(A.join(A.map(G.parseBareLines(canonical), stringifyBare), "\n"), canonical);
        }
      }),
    runs
  );
  it.effect.prop(
    "harvestIssueReferences: normalization idempotence and fidelity including exact offsets",
    [Arbitrary.schema(Sample), Arbitrary.schema(S.String)],
    ([sample, noise]) =>
      Effect.sync(() => {
        const structured = A.map(
          ["\t", "\n", "\r\n", "\v", "\f", "\u00a0", "\u2028"],
          (gap) =>
            "prefix " +
            Str.toUpperCase(sample.keyword) +
            gap +
            "#00" +
            sample.issue +
            " and " +
            sample.keyword +
            " #" +
            sample.issue +
            "."
        );
        for (const text of [...structured, noise]) {
          const parsed = G.harvestIssueReferences(text);
          if (structured.includes(text)) {
            const secondStart = O.getOrElse(Str.indexOf(" and ")(text), constant(-1)) + 5;
            assert.deepStrictEqual(parsed, [
              G.IssueReference.make({
                keyword: sample.keyword,
                issueNumber: sample.issue,
                start: 7,
                end: secondStart - 5,
              }),
              G.IssueReference.make({
                keyword: sample.keyword,
                issueNumber: sample.issue,
                start: secondStart,
                end: text.length - 1,
              }),
            ]);
          }
          const canonical = stringifyHarvest(parsed);
          assert.deepStrictEqual(G.harvestIssueReferences(canonical), parsed);
          assert.strictEqual(stringifyHarvest(G.harvestIssueReferences(canonical)), canonical);
          for (const hit of parsed)
            assert.deepStrictEqual(
              G.parseBareLineReference(stringifyBare(hit)),
              O.some(G.BareLineReference.make({ keyword: hit.keyword, issueNumber: hit.issueNumber }))
            );
        }
      }),
    runs
  );
  it.effect.prop(
    "README: case, duplicate order, required hash, colon dialect and unsafe-number rejection",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.sync(() => {
        const inline = `${Str.toUpperCase(sample.keyword)} #${sample.issue}`;
        assert.deepStrictEqual(
          A.map(G.harvestIssueReferences(`${inline}; ${inline}`), ({ keyword, issueNumber }) => ({
            keyword,
            issueNumber,
          })),
          [
            { keyword: sample.keyword, issueNumber: sample.issue },
            { keyword: sample.keyword, issueNumber: sample.issue },
          ]
        );
        assert.deepStrictEqual(G.harvestIssueReferences(`${sample.keyword}: #${sample.issue}`), []);
        assert.deepStrictEqual(
          G.parseBareLineReference(`${sample.keyword}: #${sample.issue}`),
          O.some({ keyword: sample.keyword, issueNumber: sample.issue })
        );
        assert.deepStrictEqual(G.parseBareLineReference(`${inline} trailing`), O.none());
        assert.deepStrictEqual(G.harvestIssueReferences(`${sample.keyword} ${sample.issue}`), []);
        assert.deepStrictEqual(
          A.map(G.harvestIssueReferences(`${sample.keyword} #9007199254740992; ${inline}`), (hit) => hit.issueNumber),
          [sample.issue]
        );
      }),
    runs
  );
});
