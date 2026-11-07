/** CPython 3.11.15 difflib SequenceMatcher with isjunk=None, autojunk=False,
 * adapted to native Unicode points and Effect-owned worker execution.
 * PSF-2.0; eyecite opcode projection BSD-2-Clause. See THIRD_PARTY_NOTICES.md.
 * Upstream stdlib SHA-256: 0c6afc23568d55b3e9ac914f9c5361e3033e778aa5b58d3cc82835fc5c638679.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { CitationDiffKernelFailure, CitationDiffKernelRequest } from "./DiffKernel.ts";
import { validateCitationPythonStorage } from "./PythonHash.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { CitationSpanDiffStep } from "./SpanOffsets.ts";

const $I = $LawPracticeServerId.create("internal/Citation/BuiltinDiff");
const Request = S.toType(CitationDiffKernelRequest);
const Block = S.Tuple([S.Natural, S.Natural, S.Natural]).pipe(
  $I.annoteSchema("Block", { description: "Original (a, b, length) matching block in source point coordinates." })
);
const Range = S.Tuple([S.Natural, S.Natural, S.Natural, S.Natural]).pipe(
  $I.annoteSchema("Range", {
    description: "Bounded pending source matching region (beforeStart, beforeEnd, afterStart, afterEnd).",
  })
);
const blockOrder = Order.mapInput(Order.Number, (block: typeof Block.Type) => block[0]);
const invalid = () => CitationDiffKernelFailure.make({ reason: "invalid-input" });
const safety = (limit: "diffInputUtf16" | "diffSteps" | "processMessageBytes") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });

const extendMatch = (
  before: CitationDiffKernelRequest["before"],
  after: CitationDiffKernelRequest["after"],
  range: typeof Range.Type,
  block: typeof Block.Type
) => {
  const [beforeStart, beforeEnd, afterStart, afterEnd] = range;
  let [bestA, bestB, size] = block;
  const pointA = (index: number) => citationPythonPointAt(before, index);
  const pointB = (index: number) => citationPythonPointAt(after, index);
  // No junk or popular-element filtering is installed in this source profile.
  while (bestA > beforeStart && bestB > afterStart && pointA(bestA - 1) === pointB(bestB - 1)) {
    bestA--;
    bestB--;
    size++;
  }
  while (bestA + size < beforeEnd && bestB + size < afterEnd && pointA(bestA + size) === pointB(bestB + size)) size++;
  return [bestA, bestB, size] satisfies typeof Block.Type;
};
const joinMatchingBlocks = (matches: ReadonlyArray<typeof Block.Type>, aLength: number, bLength: number) => {
  const ordered = A.sort(matches, blockOrder);
  const joined = A.empty<typeof Block.Type>();
  let a = 0;
  let b = 0;
  let size = 0;
  for (const [i, j, length] of ordered) {
    if (a + size === i && b + size === j) {
      size += length;
      continue;
    }
    if (size > 0) joined.push([a, b, size]);
    a = i;
    b = j;
    size = length;
  }
  if (size > 0) joined.push([a, b, size]);
  joined.push([aLength, bLength, 0]);
  return joined;
};
const emitBuiltinOpcodes = Effect.fnUntraced(function* (
  request: CitationDiffKernelRequest,
  joined: ReadonlyArray<typeof Block.Type>
) {
  const steps = A.empty<CitationSpanDiffStep>();
  const append = Effect.fnUntraced(function* (operation: CitationSpanDiffStep["operation"], amount: number) {
    if (steps.length >= request.maximumSteps) return yield* safety("diffSteps");
    if (8 * (steps.length + 1) > request.maximumOutputBytes) return yield* safety("processMessageBytes");
    steps.push(CitationSpanDiffStep.make({ operation, amount }));
  });
  let a = 0;
  let b = 0;
  for (const [i, j, length] of joined) {
    yield* Effect.yieldNow;
    // CPython get_opcodes emits replace as deletion followed by insertion.
    if (a < i) yield* append("-", i - a);
    if (b < j) yield* append("+", j - b);
    if (length > 0) yield* append("=", length);
    a = i + length;
    b = j + length;
  }
  return steps;
});

const scanMatchingRow = (
  i: number,
  range: typeof Range.Type,
  candidates: ReadonlyArray<number>,
  previous: MutableHashMap.MutableHashMap<number, number>,
  initial: typeof Block.Type
) => {
  const [, , afterStart, afterEnd] = range;
  const next = MutableHashMap.empty<number, number>();
  let best = initial;
  for (const j of candidates) {
    if (j < afterStart) continue;
    if (j >= afterEnd) break;
    const length = O.getOrElse(MutableHashMap.get(previous, j - 1), () => 0) + 1;
    MutableHashMap.set(next, j, length);
    if (length > best[2]) best = [i - length + 1, j - length + 1, length];
  }
  return { next, best };
};
const queueSubranges = (pending: Array<typeof Range.Type>, range: typeof Range.Type, block: typeof Block.Type) => {
  const [beforeStart, beforeEnd, afterStart, afterEnd] = range;
  const [i, j, size] = block;
  if (beforeStart < i && afterStart < j) pending.push([beforeStart, i, afterStart, j]);
  if (i + size < beforeEnd && j + size < afterEnd) pending.push([i + size, beforeEnd, j + size, afterEnd]);
};
const prepareBuiltinRequest = Effect.fnUntraced(function* (input: unknown) {
  const request = yield* S.decodeUnknownEffect(Request)(input).pipe(Effect.mapError(invalid));
  const { before, after } = request;
  if (before.bytes.byteLength % before.width !== 0 || after.bytes.byteLength % after.width !== 0)
    return yield* invalid();
  const beforeUnits = yield* validateCitationPythonStorage<CitationDiffKernelFailure | CitationSafetyLimitExceeded>(
    before.bytes,
    before.width,
    request.maximumInputUtf16,
    invalid,
    () => safety("diffInputUtf16")
  );
  const afterUnits = yield* validateCitationPythonStorage<CitationDiffKernelFailure | CitationSafetyLimitExceeded>(
    after.bytes,
    after.width,
    request.maximumInputUtf16,
    invalid,
    () => safety("diffInputUtf16")
  );
  if (beforeUnits + afterUnits > request.maximumInputUtf16) return yield* safety("diffInputUtf16");
  return request;
});
const indexSequence = Effect.fnUntraced(function* (after: CitationDiffKernelRequest["after"]) {
  const bLength = after.bytes.byteLength / after.width;
  const pointB = (index: number) => citationPythonPointAt(after, index);
  const positions = MutableHashMap.empty<number, Array<number>>();
  for (let j = 0; j < bLength; j++) {
    if (j % 256 === 0) yield* Effect.yieldNow;
    const point = pointB(j);
    const found = MutableHashMap.get(positions, point);
    if (O.isSome(found)) found.value.push(j);
    else MutableHashMap.set(positions, point, [j]);
  }
  return positions;
});
const matchingBlocks = Effect.fnUntraced(function* (request: CitationDiffKernelRequest) {
  const { before, after } = request;
  const aLength = before.bytes.byteLength / before.width;
  const bLength = after.bytes.byteLength / after.width;
  const positions = yield* indexSequence(after);
  const empty = A.empty<number>();
  const longest = Effect.fnUntraced(function* (range: typeof Range.Type) {
    const [beforeStart, beforeEnd, afterStart] = range;
    let best: typeof Block.Type = [beforeStart, afterStart, 0];
    let previous = MutableHashMap.empty<number, number>();
    for (let i = beforeStart; i < beforeEnd; i++) {
      if (i % 128 === 0) yield* Effect.yieldNow;
      const candidates = O.getOrElse(MutableHashMap.get(positions, citationPythonPointAt(before, i)), () => empty);
      const row = scanMatchingRow(i, range, candidates, previous, best);
      previous = row.next;
      best = row.best;
    }
    return extendMatch(before, after, range, best);
  });
  const pending: Array<typeof Range.Type> = [[0, aLength, 0, bLength]];
  const matches = A.empty<typeof Block.Type>();
  while (pending.length > 0) {
    const range = A.getUnsafe(pending, pending.length - 1);
    pending.pop();
    const block = yield* longest(range);
    const size = block[2];
    if (size === 0) continue;
    matches.push(block);
    queueSubranges(pending, range, block);
  }
  return joinMatchingBlocks(matches, aLength, bLength);
});

/** Exact builtin edit steps for already isolated execution. This function must
 * run only in the parent's admitted diff child, never on the caller's fiber.
 * Sparse matching retains O(input points) state, not a quadratic matrix. Output
 * steps and packed capacity are checked before appending. The parent owns the
 * independent deadline and confirmed physical retirement of this computation.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const runCitationBuiltinDiff = Effect.fn("Citation.runBuiltinDiff")(function* (input: unknown) {
  const request = yield* prepareBuiltinRequest(input);
  const blocks = yield* matchingBlocks(request);
  return yield* emitBuiltinOpcodes(request, blocks);
});
