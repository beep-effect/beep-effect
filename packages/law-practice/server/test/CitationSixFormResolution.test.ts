import { Citation } from "@beep/law-practice-domain/values";
import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import {
  resolveCitationMentions,
  resolveSixFormCitationMentions,
} from "@beep/law-practice-server/internal/Citation/Resolve";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationResolutionContext, prepareCitationResolutionContext } from "./CitationResolve.fixtures.ts";

const publication = {
  vocabularyVersion: Result.getOrThrow(CourtReporterArtifact).artifactVersion,
  editions: [],
  selectedEdition: null,
};
const locator = { pinCite: null, parenthetical: null };
const full = Effect.fnUntraced(function* (plaintiff: string, page = "100") {
  return yield* S.decodeEffect(Citation)({
    type: "case",
    components: { volume: "123", reporter: "U.S.", page },
    publication,
    metadata: {
      ...locator,
      year: null,
      month: null,
      day: null,
      court: null,
      plaintiff,
      defendant: "Defendant",
      additionalText: null,
      antecedentGuess: null,
      shortCaseName: null,
      caseName: null,
    },
  });
});
const supra = (antecedentGuess: string) =>
  S.decodeEffect(Citation)({ type: "supra", components: {}, metadata: { ...locator, antecedentGuess, volume: null } });
const id = S.decodeEffect(Citation)({ type: "id", components: {}, metadata: locator });
const short = S.decodeEffect(Citation)({
  type: "shortFormCase",
  components: { volume: "123", reporter: "U.S." },
  publication,
  metadata: {
    ...locator,
    year: null,
    month: null,
    day: null,
    court: null,
    plaintiff: null,
    antecedentGuess: null,
  },
});
// These independent verified labels exercise linking supplied semantic mentions;
// they intentionally make no parser/discovery claim.
const context = Effect.fnUntraced(function* (citations: ReadonlyArray<Citation>) {
  const quotes = A.map(citations, (_, index) => `mention ${index}`);
  let start = 0;
  const mentions = A.map(citations, (citation, index) => {
    const quote = A.getUnsafe(quotes, index);
    const end = start + Str.length(quote);
    const mention = { citation, start, end, quote };
    start = end + 2;
    return mention;
  });
  const row = yield* S.decodeUnknownEffect(S.toType(CitationResolutionContext))({
    name: "strict-six-form-links",
    text: A.join(quotes, "; "),
    editions: [],
    mentions,
    outcome: { status: "value", groups: [] },
  });
  return yield* prepareCitationResolutionContext(row);
});

it.layer(BunCrypto.layer)("six-form local linking", (it) => {
  it.effect("requires literal Unicode party-token edges without fuzzy or substring matches", () =>
    Effect.gen(function* () {
      for (const [party, guess, expected] of [
        Tuple.make("Alpha Corporation", "Alpha", "Resolved"),
        Tuple.make("Alphabet Corporation", "Alpha", "Unresolved"),
        Tuple.make("SuperAlpha", "Alpha", "Unresolved"),
        Tuple.make("Alphaβ", "Alpha", "Unresolved"),
        Tuple.make("Alpha\u0301", "Alpha", "Unresolved"),
        Tuple.make("Alpha_2", "Alpha", "Unresolved"),
        Tuple.make("Alpha-Company", "Alpha", "Resolved"),
        Tuple.make("United States", "United States", "Resolved"),
        Tuple.make("A+B Corporation", "A+B", "Resolved"),
        Tuple.make("AAAB Corporation", "A+B", "Unresolved"),
        Tuple.make("alpha Corporation", "Alpha", "Unresolved"),
        Tuple.make("Alpha", "!!!", "Unresolved"),
      ]) {
        const first = yield* full(party);
        const reference = yield* supra(guess);
        const input = yield* context([first, reference]);
        const document = yield* resolveSixFormCitationMentions(input);
        expect(A.getUnsafe(document.resolutions, 1).status, `${party} / ${guess}`).toBe(expected);
      }
    })
  );
  it.effect("retains all same-publication short candidates even with a supplied party guess", () =>
    Effect.gen(function* () {
      const first = yield* full("Alpha");
      const second = yield* full("Beta", "200");
      const short = yield* S.decodeEffect(Citation)({
        type: "shortFormCase",
        components: { volume: "123", reporter: "U.S." },
        publication,
        metadata: {
          ...locator,
          year: null,
          month: null,
          day: null,
          court: null,
          plaintiff: null,
          antecedentGuess: "Alpha",
        },
      });
      const input = yield* context([first, second, short]);
      const document = yield* resolveSixFormCitationMentions(input);
      expect(A.getUnsafe(document.resolutions, 2).status).toBe("Ambiguous");
      const retained = yield* resolveCitationMentions(input);
      expect(A.getUnsafe(retained.resolutions, 2).status).toBe("Resolved");
    })
  );
  it.effect("propagates ambiguity through successive Id. mentions and counts every candidate edge", () =>
    Effect.gen(function* () {
      const first = yield* full("Alpha");
      const second = yield* full("Alpha", "200");
      const reference = yield* supra("Alpha");
      const next = yield* id;
      const input = yield* context([first, second, reference, next, next]);
      const document = yield* resolveSixFormCitationMentions({
        ...input,
        limits: { ...input.limits, resolutionEdges: 8 },
      });
      const ambiguous = A.drop(document.resolutions, 2);
      expect(A.map(ambiguous, (resolution) => resolution.status)).toEqual(["Ambiguous", "Ambiguous", "Ambiguous"]);
      for (const resolution of ambiguous) {
        expect(resolution.status).toBe("Ambiguous");
        if (resolution.status === "Ambiguous") expect(resolution.candidateAuthorityIds).toHaveLength(2);
      }
      const failure = yield* resolveSixFormCitationMentions({
        ...input,
        limits: { ...input.limits, resolutionEdges: 7 },
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "limit-exceeded", limit: "resolutionEdges" });
    })
  );
  it.effect("excluded predecessors block Id chains while later supported links reestablish them", () =>
    Effect.gen(function* () {
      const first = yield* full("Alpha");
      const omitted = yield* full("Outside", "300");
      const next = yield* id;
      const reference = yield* supra("Alpha");
      const shortForm = yield* short;
      const input = yield* context([first, omitted, next, next, reference, next, shortForm, next]);
      const document = yield* resolveSixFormCitationMentions({
        ...input,
        mentions: A.filter(input.mentions, (_, index) => index !== 1),
        excludedAnchors: [A.getUnsafe(input.mentions, 1).anchor],
      });
      expect(A.map(document.resolutions, (resolution) => resolution.status)).toEqual([
        "Resolved",
        "Unresolved",
        "Unresolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
      ]);
      expect(document.mentions).toHaveLength(7);
      const retained = yield* resolveCitationMentions({
        ...input,
        mentions: A.filter(input.mentions, (_, index) => index !== 1),
      });
      expect(A.getUnsafe(retained.resolutions, 1).status).toBe("Resolved");
    })
  );
  it.effect("exclusions before a full or after Id do not invalidate that Id and trailing barriers cost work", () =>
    Effect.gen(function* () {
      const first = yield* full("Alpha");
      const next = yield* id;
      const input = yield* context([first, first, next, first]);
      const request = {
        ...input,
        mentions: A.filter(input.mentions, (_, index) => index === 1 || index === 2),
        excludedAnchors: [A.getUnsafe(input.mentions, 0).anchor, A.getUnsafe(input.mentions, 3).anchor],
      };
      const document = yield* resolveSixFormCitationMentions(request);
      expect(A.map(document.resolutions, (resolution) => resolution.status)).toEqual(["Resolved", "Resolved"]);
      const failure = yield* resolveSixFormCitationMentions({
        ...request,
        limits: { ...input.limits, resolutionIterations: 3 },
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "limit-exceeded", limit: "resolutionIterations" });
    })
  );
  it.effect("clears inherited ambiguity but preserves full history for a later short form", () =>
    Effect.gen(function* () {
      const first = yield* full("Alpha");
      const second = yield* full("Alpha", "200");
      const reference = yield* supra("Alpha");
      const next = yield* id;
      const shortForm = yield* short;
      const input = yield* context([first, second, reference, first, next, shortForm, next]);
      const document = yield* resolveSixFormCitationMentions({
        ...input,
        mentions: A.filter(input.mentions, (_, index) => index !== 3),
        excludedAnchors: [A.getUnsafe(input.mentions, 3).anchor],
      });
      expect(A.map(document.resolutions, (resolution) => resolution.status)).toEqual([
        "Resolved",
        "Resolved",
        "Ambiguous",
        "Unresolved",
        "Ambiguous",
        "Ambiguous",
      ]);
    })
  );
  it.effect("refuses reordered, overlapping or cross-source excluded proofs", () =>
    Effect.gen(function* () {
      const citation = yield* full("Alpha");
      const input = yield* context([citation, citation, citation]);
      const other = yield* context([citation]);
      const first = A.getUnsafe(input.mentions, 0);
      const last = A.getUnsafe(input.mentions, 2);
      for (const excludedAnchors of [
        [last.anchor, first.anchor],
        [first.anchor, first.anchor],
        [A.getUnsafe(input.mentions, 1).anchor],
        [A.getUnsafe(other.mentions, 0).anchor],
        [{}],
      ]) {
        const failure = yield* resolveSixFormCitationMentions({
          ...input,
          mentions: [A.getUnsafe(input.mentions, 1)],
          excludedAnchors,
        }).pipe(Effect.flip);
        expect(failure.reason === "invalid-input" || failure.reason === "evidence-failed").toBe(true);
      }
    })
  );
  it.effect("charges excluded candidates without adding a candidates gate to legacy inputs", () =>
    Effect.gen(function* () {
      const citation = yield* full("Alpha");
      const input = yield* context([citation, citation]);
      const legacy = yield* resolveCitationMentions({ ...input, limits: { ...input.limits, candidates: 1 } });
      expect(legacy.mentions).toHaveLength(2);
      const failure = yield* resolveSixFormCitationMentions({
        ...input,
        limits: { ...input.limits, candidates: 1 },
        mentions: [A.getUnsafe(input.mentions, 0)],
        excludedAnchors: [A.getUnsafe(input.mentions, 1).anchor],
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "limit-exceeded", limit: "candidates" });
    })
  );
});
