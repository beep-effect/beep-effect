/** Authenticated pinned default-diff host. Native evaluation must run only in
 * an independently stoppable parent-owned child; this is not a parent timer.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  CitationNativeWasmAsset,
  CitationNativeWasmFn0,
  CitationNativeWasmFn1,
  CitationNativeWasmFn5,
  CitationNativeWasmMemory,
  CitationNativeWasmVoid0,
  CitationNativeWasmVoid1,
  compileCitationNativeWasm,
} from "./NativeWasm.ts";
import { CitationPythonUnicodeStorage, validateCitationPythonStorage } from "./PythonHash.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { CitationSpanDiffStep, measureCitationSpanDiffSteps } from "./SpanOffsets.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DiffKernel");
const max = CitationEngineAbsoluteMaxima;
const Reason = LiteralKit(["invalid-asset", "invalid-input", "kernel-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed diff host failures without source text, bytes or native causes." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationDiffKernelFailure extends S.TaggedError<
  CitationDiffKernelFailure,
  { readonly brand: unique symbol }
>($I`CitationDiffKernelFailure`)(
  "CitationDiffKernelFailure",
  { reason: Reason },
  $I.annoteError<CitationDiffKernelFailure>("CitationDiffKernelFailure", {
    description: "Authenticated default-diff evaluation failed without publishing source or a partial result.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationDiffKernelFailure.make({ reason });
const safety = (limit: "diffSteps" | "diffInputUtf16") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
/** Child-owned native inputs and parent-preflighted effective bounds. This data
 * carries no ownership capability; only the enclosing worker can establish it.
 * @internal @category models @since 0.0.0
 */
export class CitationDiffKernelRequest extends S.Opaque<CitationDiffKernelRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    before: CitationPythonUnicodeStorage,
    after: CitationPythonUnicodeStorage,
    maximumSteps: S.Natural.check(S.isLessThanOrEqualTo(max.diffSteps)),
    maximumInputUtf16: S.Natural.check(S.isLessThanOrEqualTo(max.diffInputUtf16)),
  }).pipe(
    $I.annoteSchema("CitationDiffKernelRequest", {
      description: "Already-owned native inputs with combined UTF-16 and complete edit-step ceilings.",
    })
  )
) {}
const Exports = S.Struct({
  memory: CitationNativeWasmMemory,
  _initialize: CitationNativeWasmVoid0,
  citation_diff_version: CitationNativeWasmFn0,
  citation_diff_run: CitationNativeWasmFn5,
  citation_diff_output: CitationNativeWasmFn0,
  citation_diff_steps: CitationNativeWasmFn0,
  citation_diff_release: CitationNativeWasmVoid0,
  malloc: CitationNativeWasmFn1,
  free: CitationNativeWasmVoid1,
}).pipe($I.annoteSchema("Exports", { description: "Pinned default-diff ABI after complete asset authentication." }));
const natural = S.is(S.Natural);
const operations = ["-", "+", "="];
const validate = Effect.fn("Citation.validateDiffKernelInput")(function* (request: CitationDiffKernelRequest) {
  const { before, after, maximumInputUtf16 } = request;
  if (before.bytes.byteLength % before.width !== 0 || after.bytes.byteLength % after.width !== 0)
    return yield* fail("invalid-input");
  if (before.bytes.byteLength / before.width + after.bytes.byteLength / after.width > maximumInputUtf16)
    return yield* safety("diffInputUtf16");
  const invalid = () => fail("invalid-input");
  const overflow = () => safety("diffInputUtf16");
  const beforeUnits = yield* validateCitationPythonStorage<CitationDiffKernelFailure | CitationSafetyLimitExceeded>(
    before.bytes,
    before.width,
    maximumInputUtf16,
    invalid,
    overflow
  );
  yield* validateCitationPythonStorage<CitationDiffKernelFailure | CitationSafetyLimitExceeded>(
    after.bytes,
    after.width,
    maximumInputUtf16 - beforeUnits,
    invalid,
    overflow
  );
});
const decodeSteps = Effect.fn("Citation.decodeDiffKernelSteps")(function* (view: DataView, count: number) {
  const steps = A.empty<CitationSpanDiffStep>();
  for (let index = 0; index < count; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const operation = yield* A.get(operations, view.getUint32(index * 8, true)).pipe(
      Effect.fromOption,
      Effect.mapError(() => fail("kernel-failed"))
    );
    const amount = view.getUint32(index * 8 + 4, true);
    const step = yield* S.decodeUnknownEffect(CitationSpanDiffStep)({ operation, amount }).pipe(
      Effect.mapError(() => fail("kernel-failed"))
    );
    steps.push(step);
  }
  return steps;
});
const receive = Effect.fn("Citation.receiveDiffKernelSteps")(function* (
  abi: typeof Exports.Type,
  request: CitationDiffKernelRequest
) {
  const count = abi.citation_diff_steps();
  const pointer = abi.citation_diff_output();
  if (!natural(count) || count > request.maximumSteps || !natural(pointer)) return yield* fail("kernel-failed");
  const view = yield* Effect.try({
    try: () => new DataView(abi.memory.buffer, pointer, count * 8),
    catch: () => fail("kernel-failed"),
  });
  const steps = yield* decodeSteps(view, count);
  const { consumed, emitted } = yield* measureCitationSpanDiffSteps(steps);
  if (
    consumed !== request.before.bytes.byteLength / request.before.width ||
    emitted !== request.after.bytes.byteLength / request.after.width
  )
    return yield* fail("kernel-failed");
  return steps;
});
const put = (abi: typeof Exports.Type, address: number, source: CitationPythonUnicodeStorage) => {
  const view = new DataView(abi.memory.buffer);
  for (let index = 0; index < source.bytes.byteLength / source.width; index++)
    view.setUint32(address + index * 4, citationPythonPointAt(source, index), true);
};
/** Compile an authenticated snapshot and capture Digest. Returned methods have
 * R=never. Inputs are borrowed immutable child-owned storage. Validation checks
 * combined effective UTF-16 before any native input allocation. Each run owns a
 * fresh instance and releases both inputs and its complete result on exit.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDiffKernel = Effect.fn("Citation.makeDiffKernel")(function* (input: unknown) {
  const compiled = yield* compileCitationNativeWasm(
    input,
    CitationNativeWasmAsset.make({
      byteLength: 874110,
      sha256: Sha256Hex.make("186b72b1410982b2b384e74c84fc448bddc16aa479fdcf85c01f493a5d8359ec"),
    }),
    () => fail("invalid-asset")
  );
  return {
    run: Effect.fn("Citation.runDiffKernel")(function* (raw: unknown) {
      const request = yield* S.decodeUnknownEffect(S.toType(CitationDiffKernelRequest))(raw).pipe(
        Effect.mapError(() => fail("invalid-input"))
      );
      yield* validate(request);
      const created = yield* compiled.instantiate(() => fail("kernel-failed"));
      const abi = yield* S.decodeUnknownEffect(Exports)(created.exports).pipe(
        Effect.mapError(() => fail("kernel-failed"))
      );
      yield* created.bindMemory(abi.memory);
      yield* Effect.try({ try: () => abi._initialize(), catch: () => fail("kernel-failed") });
      if (abi.citation_diff_version() !== 20001) return yield* fail("invalid-asset");
      const allocate = Effect.fnUntraced(function* (source: CitationPythonUnicodeStorage) {
        const address = yield* Effect.try({
          try: () => abi.malloc(4 * (source.bytes.byteLength / source.width + 1)),
          catch: () => fail("kernel-failed"),
        });
        if (!natural(address) || address === 0) return yield* fail("kernel-failed");
        return address;
      });
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const before = yield* Effect.acquireRelease(allocate(request.before), (address) =>
            Effect.sync(() => abi.free(address))
          );
          const after = yield* Effect.acquireRelease(allocate(request.after), (address) =>
            Effect.sync(() => abi.free(address))
          );
          yield* Effect.addFinalizer(() => Effect.sync(() => abi.citation_diff_release()));
          const status = yield* Effect.try({
            try: () => {
              put(abi, before, request.before);
              put(abi, after, request.after);
              return abi.citation_diff_run(
                before,
                request.before.bytes.byteLength / request.before.width,
                after,
                request.after.bytes.byteLength / request.after.width,
                request.maximumSteps
              );
            },
            catch: () => fail("kernel-failed"),
          });
          if (status === 1) return yield* safety("diffSteps");
          if (status !== 0) return yield* fail("kernel-failed");
          return yield* receive(abi, request);
        })
      );
    }),
  };
});
