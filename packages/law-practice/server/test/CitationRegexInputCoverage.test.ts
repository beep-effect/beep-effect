import {
  CitationRegexInputLayout,
  citationUnaccountedText,
  makeCitationRegexInput,
} from "@beep/law-practice-server/internal/Citation/RegexInput";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

// Native storage is borrowed and must stay immutable through preparation. These
// cases break that contract between measurement and capture to prove the second
// scan refuses the changed bytes instead of publishing a mismatched map.
const overwrite = (bytes: Uint8Array, offset: number, replacement: ReadonlyArray<number>) =>
  Effect.sync(() => {
    bytes.set(replacement, offset);
  });

it.effect("re-attributes a capture-time overflow of mutated native storage to the produced-text budget", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const input = yield* makeCitationRegexInput({ ...limits, producedTextUtf16: 3 }, citationUnaccountedText);
    const bytes = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x41, 0x00, 0x00, 0x00]);
    let measured = A.empty<CitationRegexInputLayout>();
    const failure = yield* input
      .prepareUnicode({ width: 4, bytes }, (layout) =>
        Effect.sync(() => {
          measured = A.append(measured, layout);
        }).pipe(Effect.andThen(overwrite(bytes, 4, [0x01, 0x00, 0x01, 0x00])))
      )
      .pipe(Effect.flip);
    deepStrictEqual(measured, [
      CitationRegexInputLayout.make({
        width: 4,
        byteLength: 8,
        pythonLength: 2,
        utf16Units: 3,
        mapBytes: 12,
        projectionAmbiguous: false,
      }),
    ]);
    deepStrictEqual(
      { _tag: failure._tag, limit: "limit" in failure ? failure.limit : undefined },
      { _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" }
    );
  })
);

it.effect("refuses native storage whose capture no longer matches its measured layout", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const input = yield* makeCitationRegexInput(limits, citationUnaccountedText);
    const cases = [
      // A point beyond U+10FFFF fails the Unicode capture itself.
      { width: 4 as const, bytes: [0x00, 0x00, 0x01, 0x00, 0x41, 0x00, 0x00, 0x00], at: 4, next: [0x00, 0x00, 0x11] },
      // A BMP point widened to astral changes the measured UTF-16 size.
      { width: 4 as const, bytes: [0x00, 0x00, 0x01, 0x00, 0x41, 0x00, 0x00, 0x00], at: 4, next: [0x01, 0x00, 0x01] },
      // A lone high surrogate gains a low partner, changing only projection ambiguity.
      { width: 2 as const, bytes: [0x00, 0xd8, 0x41, 0x00], at: 2, next: [0x00, 0xdc] },
    ];
    for (const { width, bytes: initial, at, next } of cases) {
      const bytes = Uint8Array.from(initial);
      const failure = yield* input
        .prepareUnicode({ width, bytes }, () => Effect.void, overwrite(bytes, at, next))
        .pipe(Effect.flip);
      deepStrictEqual(
        { _tag: failure._tag, reason: "reason" in failure ? failure.reason : undefined },
        { _tag: "CitationRegexInputFailure", reason: "invalid-input" }
      );
    }
  })
);
