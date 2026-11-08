import {
  CitationTokenExtractionInput,
  normalizeCitationModelPage,
  validateCitationTokenWord,
} from "@beep/law-practice-server/internal/Citation/ExtractionContext";
import { CitationPythonUnicodeStorage, CitationTokenSeed } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const native = (bytes: Iterable<number>) =>
  CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(bytes) });
const tokenWithGroups = (groups: CitationTokenSeed["groups"]) =>
  CitationTokenSeed.make({
    kind: "CitationToken",
    data: native([49, 32, 85, 46, 83, 46, 32, 95]),
    start: 0,
    end: 8,
    groups,
    exact: [],
    variation: [],
    short: false,
  });

describe("citation constructor token coherence", () => {
  it.effect("normalizes only an entirely missing page while preserving the original spelling and other groups", () =>
    Effect.gen(function* () {
      const reporter = native([85, 46, 83, 46]);
      for (const groups of [{ reporter }, { reporter, page: null }]) {
        const original = tokenWithGroups(groups);
        const normalized = yield* normalizeCitationModelPage(original);
        assert.strictEqual(normalized, original);
      }
      for (const bytes of [[], [10], [95, 49], [95, 10, 95], [49]]) {
        const original = tokenWithGroups({ reporter, page: native(bytes) });
        const normalized = yield* normalizeCitationModelPage(original);
        assert.strictEqual(normalized, original);
      }
      for (const page of [native([95]), native([95, 95, 10]), native(new Uint8Array(4096).fill(95))]) {
        const original = tokenWithGroups({ reporter, page });
        const normalized = yield* normalizeCitationModelPage(original);
        assert.isNull(normalized.groups.page);
        assert.deepStrictEqual(normalized.groups.reporter, reporter);
        assert.deepStrictEqual(normalized.data, original.data);
        assert.deepStrictEqual(original.groups.page, page);
        assert.strictEqual(normalized.start, original.start);
        assert.strictEqual(normalized.end, original.end);
      }
    })
  );
  it.effect("admits equivalent owned bytes and rejects each conflicting word representation", () =>
    Effect.gen(function* () {
      const token = tokenWithGroups({ page: native([95]) });
      const word = {
        kind: token.kind,
        data: native([49, 32, 85, 46, 83, 46, 32, 95]),
        start: token.start,
        groups: token.groups,
      };
      const request = CitationTokenExtractionInput.make({ words: [word], index: 0, token, geometry: O.none() });
      const invalid = "incoherent-constructor-token";
      const failure = () => invalid;
      yield* validateCitationTokenWord(request, failure);
      yield* validateCitationTokenWord(
        {
          ...request,
          words: [{ ...word, data: native([49, 32, 85, 46, 83, 46, 32, 95]), groups: { page: native([95]) } }],
        },
        failure
      );
      const conflicts: ReadonlyArray<CitationTokenExtractionInput["words"]> = [
        [],
        [{ ...word, kind: "Token" }],
        [{ ...word, data: native([50]) }],
        [{ ...word, data: null }],
        [{ ...word, start: 1 }],
        [{ ...word, groups: { page: null } }],
        [{ ...word, groups: {} }],
      ];
      for (const words of conflicts) {
        const rejected = yield* validateCitationTokenWord({ ...request, words }, failure).pipe(Effect.flip);
        assert.strictEqual(rejected, invalid);
      }
    })
  );
});
