import { makeCitationAnnotationEntry } from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import { CitationAnnotationReplacement, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { installCitationAnnotationEntryFixture } from "./CitationAnnotationEntry.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
// A width-4 point beyond U+10FFFF passes the structural schema but not native validation.
const beyondUnicode = CitationPythonUnicodeStorage.make({ width: 4, bytes: new Uint8Array([0, 0, 17, 0]) });
const replacement = (before = word("["), after = word("]")) =>
  CitationAnnotationReplacement.make({ start: 0, end: 1, before, after });
const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});
const install = Effect.fnUntraced(function* (narrow: Partial<CitationEngineLimits> = {}) {
  const setup = yield* installCitationAnnotationEntryFixture();
  return yield* makeCitationAnnotationEntry({ ...setup.limits, ...narrow }, setup.runtime, setup.configuration).pipe(
    Effect.provideContext(setup.provided)
  );
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("annotation entry refusals", (it) => {
  it.effect("refuses an installation configuration outside the entry schema", () =>
    Effect.gen(function* () {
      const setup = yield* installCitationAnnotationEntryFixture();
      const failure = yield* makeCitationAnnotationEntry(setup.limits, setup.runtime, {}).pipe(
        Effect.provideContext(setup.provided),
        Effect.flip
      );
      deepStrictEqual(refusal(failure), { _tag: "CitationAnnotationEntryFailure", detail: "invalid-configuration" });
    })
  );
  it.effect("maps invalid native plain text and replacement words to closed invalid input", () =>
    Effect.gen(function* () {
      const entry = yield* install();
      for (const request of [
        { plain: beyondUnicode, replacements: [] },
        { plain: word("abc"), replacements: [replacement(beyondUnicode)] },
        { plain: word("abc"), replacements: [replacement(word("["), beyondUnicode)] },
      ]) {
        const failure = yield* entry.annotate(request).pipe(Effect.flip);
        deepStrictEqual(refusal(failure), { _tag: "CitationAnnotationEntryFailure", detail: "invalid-input" });
      }
    })
  );
  it.effect("refuses replacement counts and source words beyond the effective annotate limits", () =>
    Effect.gen(function* () {
      const replacements = yield* install({ annotationReplacements: 1 });
      const tooMany = yield* replacements
        .annotate({ plain: word("abc"), replacements: [replacement(), replacement()] })
        .pipe(Effect.flip);
      deepStrictEqual(refusal(tooMany), { _tag: "CitationSafetyLimitExceeded", detail: "annotationReplacements" });
      const source = yield* install({ sourceUtf16: 2 });
      const tooLong = yield* source.annotate({ plain: word("abc"), replacements: [] }).pipe(Effect.flip);
      deepStrictEqual(refusal(tooLong), { _tag: "CitationSafetyLimitExceeded", detail: "sourceUtf16" });
    })
  );
});
