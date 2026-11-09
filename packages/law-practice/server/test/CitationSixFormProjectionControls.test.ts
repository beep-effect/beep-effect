import { makeCitationSixFormProjection } from "@beep/law-practice-server/internal/Citation/SixFormProjection";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";

const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const id = (start: number, end: number) => ({ type: "id", range: { start, end }, components: [] });
const output = (tokens: ReadonlyArray<unknown>, excludedRanges: ReadonlyArray<unknown> = []) => ({
  tokens,
  outsideProfile: A.length(excludedRanges),
  excludedRanges,
});
const fixture = Effect.gen(function* () {
  const { limits } = yield* defaultCitationEnginePolicy;
  const projection = yield* makeCitationSixFormProjection(limits);
  return { limits, projection };
});

it.layer(BunCrypto.layer)("six-form hostile observation controls", (it) => {
  it.effect("refuses malformed DTOs and count incoherence instead of manufacturing verified occurrences", () =>
    Effect.gen(function* () {
      const { projection } = yield* fixture;
      const source = yield* citationFixtureSourceProof("Id.");
      for (const raw of [
        {},
        { ...output([]), outsideProfile: 1 },
        { ...output([], [{ start: 0, end: 3 }]), outsideProfile: 0 },
        output([{ ...id(0, 3), type: "invented" }]),
      ]) {
        const failure = yield* projection.project(source, artifact, raw).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
      }
    })
  );

  it.effect("refuses empty, reversed, out-of-source and disordered supported or component ranges", () =>
    Effect.gen(function* () {
      const { projection } = yield* fixture;
      const source = yield* citationFixtureSourceProof("Id. Id. Id.");
      for (const tokens of [
        [id(0, 0)],
        [id(3, 0)],
        [id(0, 12)],
        [id(4, 7), id(0, 3)],
        [id(0, 3), id(2, 7)],
        [{ ...id(0, 3), components: [{ name: "pincite", range: { start: 10, end: 12 } }] }],
      ]) {
        const failure = yield* projection.project(source, artifact, output(tokens)).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
      }
    })
  );

  it.effect("verifies omitted-source barriers and rejects disordered, overlapping and out-of-source exclusions", () =>
    Effect.gen(function* () {
      const { projection } = yield* fixture;
      const source = yield* citationFixtureSourceProof("Id. Id. Id.");
      const projected = yield* projection.project(
        source,
        artifact,
        output([id(0, 3), id(8, 11)], [{ start: 4, end: 7 }])
      );
      expect(projected.mentions).toHaveLength(2);
      expect(A.getUnsafe(projected.excludedAnchors, 0).anchor).toMatchObject({
        startChar: 4,
        endChar: 7,
        quote: "Id.",
      });
      for (const excluded of [
        [
          { start: 8, end: 11 },
          { start: 4, end: 7 },
        ],
        [
          { start: 4, end: 7 },
          { start: 6, end: 8 },
        ],
        [{ start: 2, end: 5 }],
        [{ start: 4, end: 4 }],
        [{ start: 10, end: 12 }],
      ]) {
        const failure = yield* projection.project(source, artifact, output([id(0, 3)], excluded)).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
      }
    })
  );

  it.effect("verifies Id and Ibid lexical evidence but refuses an observation over unrelated text", () =>
    Effect.gen(function* () {
      const { projection } = yield* fixture;
      for (const text of ["Id.", "Ibid."]) {
        const source = yield* citationFixtureSourceProof(text);
        const projected = yield* projection.project(source, artifact, output([id(0, Str.length(text))]));
        const mention = A.getUnsafe(projected.mentions, 0);
        expect(A.getUnsafe(mention.components, 0).anchor.anchor.quote).toBe(text);
      }
      const source = yield* citationFixtureSourceProof("word");
      const failure = yield* projection.project(source, artifact, output([id(0, 4)])).pipe(Effect.flip);
      expect(failure._tag).toBe("CitationInputError");
    })
  );

  it.effect("requires unique supra lexical and antecedent evidence while permitting an orphan supra", () =>
    Effect.gen(function* () {
      const { projection } = yield* fixture;
      for (const text of ["Alpha, supra", "supra"]) {
        const source = yield* citationFixtureSourceProof(text);
        const token = {
          type: "supra",
          range: { start: 0, end: Str.length(text) },
          components: [],
          partyName: text === "supra" ? null : "Alpha",
        };
        const projected = yield* projection.project(source, artifact, output([token]));
        expect(A.getUnsafe(projected.mentions, 0).anchor.anchor.quote).toBe("supra");
      }
      for (const [text, partyName] of [
        Tuple.make("Alpha, supra", "Beta"),
        Tuple.make("Alpha Alpha, supra", "Alpha"),
        Tuple.make("Alpha", "Alpha"),
        Tuple.make("supra supra", null),
      ]) {
        const source = yield* citationFixtureSourceProof(text);
        const token = { type: "supra", range: { start: 0, end: Str.length(text) }, components: [], partyName };
        const failure = yield* projection.project(source, artifact, output([token])).pipe(Effect.flip);
        expect(failure._tag).toBe("CitationInputError");
      }
    })
  );

  it.effect("counts excluded observations toward candidates without counting them as supported mentions", () =>
    Effect.gen(function* () {
      const { limits } = yield* fixture;
      const source = yield* citationFixtureSourceProof("Id. Id.");
      const candidates = yield* makeCitationSixFormProjection({ ...limits, candidates: 1 });
      const failure = yield* candidates
        .project(source, artifact, output([id(0, 3)], [{ start: 4, end: 7 }]))
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "candidates" });
      const mentions = yield* makeCitationSixFormProjection({ ...limits, mentions: 1 });
      const mentionFailure = yield* mentions.project(source, artifact, output([id(0, 3), id(4, 7)])).pipe(Effect.flip);
      expect(mentionFailure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "mentions" });
      const excludedOnly = yield* mentions.project(
        source,
        artifact,
        output(
          [],
          [
            { start: 0, end: 3 },
            { start: 4, end: 7 },
          ]
        )
      );
      expect(excludedOnly.mentions).toHaveLength(0);
      expect(excludedOnly.excludedAnchors).toHaveLength(2);
    })
  );

  it.effect("charges excluded quotes in the same aggregate evidence budget before retaining them", () =>
    Effect.gen(function* () {
      const { limits } = yield* fixture;
      const source = yield* citationFixtureSourceProof("Id. xyz");
      const raw = output([id(0, 3)], [{ start: 4, end: 7 }]);
      const small = yield* makeCitationSixFormProjection({ ...limits, producedTextUtf16: 6 });
      const failure = yield* small.project(source, artifact, raw).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const exact = yield* makeCitationSixFormProjection({ ...limits, producedTextUtf16: 9 });
      const projected = yield* exact.project(source, artifact, raw);
      expect(projected.mentions).toHaveLength(1);
      expect(projected.excludedAnchors).toHaveLength(1);
    })
  );
});
