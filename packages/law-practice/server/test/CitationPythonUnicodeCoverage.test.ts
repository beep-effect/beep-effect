import {
  CitationPythonSliceBounds,
  citationPythonPointAt,
  findCitationPythonLiteral,
  makeCitationPythonUnicode,
} from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, flow } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const latin1 = (text: string) =>
  CitationPythonUnicodeStorage.make({
    width: 1,
    bytes: Uint8Array.from(A.map(Str.split(text, ""), flow(Str.charCodeAt(0), O.getOrElse(constant(0))))),
  });

it.effect("reads native little-endian points through both dual forms and zero-fills a borrowed overrun", () =>
  Effect.sync(() => {
    const source = CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x41, 0x00, 0x3d, 0xd8]) });
    strictEqual(citationPythonPointAt(source, 0), 0x41);
    strictEqual(citationPythonPointAt(1)(source), 0xd83d);
    strictEqual(citationPythonPointAt(source, 2), 0);
  })
);

it.effect("finds a literal longer than one scan quantum after yielding mid-comparison", () =>
  Effect.gen(function* () {
    const source = latin1(`${Str.repeat(4102)("A")}B`);
    const needle = latin1(`${Str.repeat(4100)("A")}B`);
    const first = yield* findCitationPythonLiteral(source, needle, 0, 4103);
    assertSome(first, CitationPythonSliceBounds.make({ start: 2, end: 4103 }));
    const last = yield* findCitationPythonLiteral(source, needle, 0, 4103, true);
    assertSome(last, CitationPythonSliceBounds.make({ start: 2, end: 4103 }));
    const missing = yield* findCitationPythonLiteral(source, latin1(`${Str.repeat(4100)("A")}C`), 0, 4103);
    assertNone(missing);
  })
);

it.effect("refuses oversized reserved text before reservation and reserves exact units otherwise", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const unicode = yield* makeCitationPythonUnicode({ ...limits, producedTextUtf16: 2 });
    let reserved = A.empty<number>();
    const reserve = (units: number) =>
      Effect.sync(() => {
        reserved = A.append(reserved, units);
      });
    const refused = yield* unicode.fromTextReserved("abc", reserve).pipe(Effect.flip);
    strictEqual(refused.reason, "limit-exceeded");
    deepStrictEqual(reserved, []);
    const accepted = yield* unicode.fromTextReserved("ab", reserve);
    strictEqual(accepted.text, "ab");
    strictEqual(accepted.utf16Units, 2);
    deepStrictEqual(reserved, [2]);
  })
);
