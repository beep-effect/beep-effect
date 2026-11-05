/** Pinned Python lowercase semantics for native source words.
 * CPython 3.11.15, PSF-2.0; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { citationPythonCaseData } from "./PythonCaseData.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationPythonUnicodeFailure, makeCitationPythonUnicode } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PythonCase");
const Limits = S.toType(CitationEngineLimits);
const mappings = HashMap.fromIterable(citationPythonCaseData.lowerMappings);
const points = (ranges: ReadonlyArray<readonly [number, number]>) =>
  HashSet.fromIterable(A.flatMap(ranges, ([start, end]) => A.range(start, end)));
const cased = points(citationPythonCaseData.casedRanges);
const ignored = points(citationPythonCaseData.caseIgnorableRanges);
const fail = (reason: CitationPythonUnicodeFailure["reason"]) => CitationPythonUnicodeFailure.make({ reason });
const widthOf = (point: number): 1 | 2 | 4 => (point <= 255 ? 1 : point <= 65535 ? 2 : 4);
const units = (point: number) => (point > 65535 ? 2 : 1);

/** Capture policy and Clock. Lowercase is based on frozen Python facts rather
 * than the host runtime's Unicode version; literal surrogate words stay distinct.
 * Preflight the complete output before allocation and never return partial data.
 * The caller owns operation-level produced-text reservations. Methods have R = never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPythonLower = Effect.fn("Citation.makePythonLower")(function* (policy: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(() => fail("invalid-input")));
  const unicode = yield* makeCitationPythonUnicode(limits);
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.cleanDeadline, limits.operationDeadline).pipe(
    Duration.toMillis,
    Duration.millis
  );
  const lowerImpl = Effect.fn($I`lower`)(
    function* <E = never>(input: unknown, beforeAllocate?: (units: number) => Effect.Effect<void, E>) {
      const source = yield* beforeAllocate === undefined
        ? unicode.fromStorage(input)
        : unicode.fromStorageReserved(input, beforeAllocate);
      const { bytes, width } = source.storage;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const read = (index: number) =>
        width === 1
          ? view.getUint8(index)
          : width === 2
            ? view.getUint16(index * 2, true)
            : view.getUint32(index * 4, true);
      const neighbourCased = Effect.fn("Citation.lowerNeighbour")(function* (index: number, step: number) {
        while (index >= 0 && index < source.pythonLength) {
          if (index % 4096 === 0) yield* Effect.yieldNow;
          const point = read(index);
          if (!HashSet.has(ignored, point)) return HashSet.has(cased, point);
          index += step;
        }
        return false;
      });
      const mapped = Effect.fn("Citation.lowerPoint")(function* (index: number) {
        const point = read(index);
        if (point === 0x3a3 && (yield* neighbourCased(index - 1, -1)) && !(yield* neighbourCased(index + 1, 1)))
          return [0x3c2];
        return O.getOrElse(HashMap.get(mappings, point), () => [point]);
      });
      const measure = Effect.gen(function* () {
        let length = 0;
        let utf16 = 0;
        let largest = 0;
        for (let index = 0; index < source.pythonLength; index++) {
          if (index % 4096 === 0) yield* Effect.yieldNow;
          for (const point of yield* mapped(index)) {
            length++;
            utf16 += units(point);
            if (utf16 > limits.producedTextUtf16) return yield* fail("limit-exceeded");
            largest = Num.max(largest, point);
          }
        }
        return { length, largest, utf16 };
      });
      const { length, largest, utf16 } = yield* measure;
      if (beforeAllocate !== undefined) yield* beforeAllocate(utf16);
      const outputWidth = widthOf(largest);
      const output = new Uint8Array(length * outputWidth);
      const target = new DataView(output.buffer);
      let offset = 0;
      const writePoint = (point: number) => {
        if (outputWidth === 1) target.setUint8(offset, point);
        else if (outputWidth === 2) target.setUint16(offset, point, true);
        else target.setUint32(offset, point, true);
        offset += outputWidth;
      };
      const encode = Effect.gen(function* () {
        for (let index = 0; index < source.pythonLength; index++) {
          if (index % 4096 === 0) yield* Effect.yieldNow;
          for (const point of yield* mapped(index)) writePoint(point);
        }
      });
      yield* encode;
      return CitationPythonUnicodeStorage.make({ width: outputWidth, bytes: output });
    },
    Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(fail("deadline-exceeded")) }),
    Effect.provideService(Clock.Clock, clock)
  );
  const lower = Effect.fn("Citation.lowerNativeWord")((input: unknown) => lowerImpl(input));
  const lowerReserved = Effect.fn("Citation.lowerReservedNativeWord")(function* <E>(
    input: unknown,
    beforeAllocate: (units: number) => Effect.Effect<void, E>
  ) {
    return yield* lowerImpl(input, beforeAllocate);
  });
  return { lower, lowerReserved };
});
