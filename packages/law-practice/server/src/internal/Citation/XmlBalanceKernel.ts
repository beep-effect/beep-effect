/** Authenticated XML well-formedness query for original annotation handling.
 * Free Law Project eyecite 2.7.6 utils.py, BSD-2-Clause; unchanged libxml2 2.12.3.
 * Synchronous evaluation runs inside the shared owned markup worker. This
 * kernel module alone supplies no parent-side deadline or retirement barrier.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import {
  CitationNativeWasmAsset,
  CitationNativeWasmFn0,
  CitationNativeWasmFn1,
  CitationNativeWasmFn3,
  CitationNativeWasmMemory,
  CitationNativeWasmVoid0,
  CitationNativeWasmVoid1,
  compileCitationNativeWasm,
} from "./NativeWasm.ts";
import { validateCitationPythonStorage } from "./PythonHash.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/XmlBalanceKernel");
/** @internal @category models @since 0.0.0 */
export const citationXmlKernelAsset = CitationNativeWasmAsset.make({
  byteLength: 1622787,
  sha256: Sha256Hex.make("10a71415bb305b1cac194ef9cc577253a35d40b5b22dc0b81ee2079e3c918b48"),
});
const Reason = LiteralKit(["invalid-asset", "invalid-input", "native-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed source-free native XML query failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationXmlKernelFailure extends S.TaggedError<
  CitationXmlKernelFailure,
  { readonly brand: unique symbol }
>($I`CitationXmlKernelFailure`)(
  "CitationXmlKernelFailure",
  { reason: Reason },
  $I.annoteError<CitationXmlKernelFailure>("CitationXmlKernelFailure", {
    description: "Native XML query refused without source text or parser diagnostics.",
  })
) {}
const fail = (reason: CitationXmlKernelFailure["reason"]) => CitationXmlKernelFailure.make({ reason });
const Exports = S.Struct({
  memory: CitationNativeWasmMemory,
  _initialize: CitationNativeWasmVoid0,
  xml_version: CitationNativeWasmFn0,
  xml_balance: CitationNativeWasmFn3,
  malloc: CitationNativeWasmFn1,
  free: CitationNativeWasmVoid1,
}).pipe(
  $I.annoteSchema("Exports", {
    description: "Authenticated closed XML query ABI, using the existing restricted WASI host.",
  })
);
const natural = S.is(S.Natural);
const maximum = CitationEngineAbsoluteMaxima.sourceUtf16;
/** Capture an authenticated module; every query creates an independent instance.
 * The existing closed WASI host denies all filesystem, I/O and environment calls.
 * Input points retain literal surrogate distinctions and exact source fast-path
 * behavior. No diagnostic message or parsed tree is published.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationXmlBalanceKernel = Effect.fn("Citation.makeXmlBalanceKernel")(function* (input: unknown) {
  const compiled = yield* compileCitationNativeWasm(input, citationXmlKernelAsset, () => fail("invalid-asset"));
  const balance = Effect.fn("Citation.queryXmlBalance")(function* (raw: unknown) {
    const decoded = yield* S.decodeUnknownEffect(CitationPythonUnicodeStorage)(raw).pipe(
      Effect.mapError(() => fail("invalid-input"))
    );
    if (decoded.bytes.length % decoded.width !== 0) return yield* fail("invalid-input");
    const count = decoded.bytes.length / decoded.width;
    if (count > maximum)
      return yield* CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "sourceUtf16" });
    const source = CitationPythonUnicodeStorage.make({ width: decoded.width, bytes: new Uint8Array(decoded.bytes) });
    yield* validateCitationPythonStorage<CitationXmlKernelFailure | CitationSafetyLimitExceeded>(
      source.bytes,
      source.width,
      maximum,
      () => fail("invalid-input"),
      () => CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "sourceUtf16" })
    );
    const abi = yield* compiled.initialize(Exports, () => fail("native-failed"));
    if (abi.xml_version() !== 21203) return yield* fail("invalid-asset");
    return yield* Effect.acquireUseRelease(
      Effect.try({ try: () => abi.malloc(Num.max(4, count * 4)), catch: () => fail("native-failed") }).pipe(
        Effect.filterOrFail(
          (address) => natural(address) && address !== 0,
          () => fail("native-failed")
        )
      ),
      (address) =>
        Effect.try({
          try: () => {
            const memory = new DataView(abi.memory.buffer);
            for (let index = 0; index < count; index++)
              memory.setUint32(address + index * 4, citationPythonPointAt(source, index), true);
            return abi.xml_balance(address, count, source.width);
          },
          catch: () => fail("native-failed"),
        }).pipe(
          Effect.flatMap((result) =>
            result === 0 || result === 1 ? Effect.succeed(result === 1) : Effect.fail(fail("native-failed"))
          )
        ),
      (address) => Effect.sync(() => abi.free(address))
    );
  });
  return { balance };
});
