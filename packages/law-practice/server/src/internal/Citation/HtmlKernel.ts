/**
 * Authenticated private HTML kernel host. Synchronous evaluation belongs only
 * inside the future owned worker; this module supplies no parent-side deadline.
 * The closed WASI imports grant no filesystem, standard I/O or environment.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { completeCitationHtml } from "./HtmlCompletion.ts";
import { CitationHtmlInput } from "./HtmlInput.ts";
import {
  CitationNativeWasmAsset,
  compileCitationNativeWasm,
  CitationNativeWasmFn0 as Fn0,
  CitationNativeWasmFn1 as Fn1,
  CitationNativeWasmFn5 as Fn5,
  CitationNativeWasmMemory as Memory,
  CitationNativeWasmVoid0 as Void0,
  CitationNativeWasmVoid1 as Void1,
} from "./NativeWasm.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlKernel");
const Reason = LiteralKit([
  "invalid-asset",
  "invalid-input",
  "parse-error",
  "unicode-decode-error",
  "kernel-failed",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed private HTML kernel failures without source content or nested causes.",
  })
);
/**
 * Sanitized native adapter failure; the enclosing engine translator is pending.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationHtmlKernelFailure extends S.TaggedError<
  CitationHtmlKernelFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlKernelFailure`)(
  "CitationHtmlKernelFailure",
  { reason: Reason },
  $I.annoteError<CitationHtmlKernelFailure>("CitationHtmlKernelFailure", {
    description: "Authenticated private HTML kernel failed without publishing native diagnostics.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationHtmlKernelFailure.make({ reason });
const Exports = S.Struct({
  memory: Memory,
  _initialize: Void0,
  html_version: Fn0,
  html_iconv_version: Fn0,
  html_iconv_inventory: Fn0,
  html_iconv_inventory_length: Fn0,
  html_clean: Fn5,
  html_output: Fn0,
  html_output_length: Fn0,
  html_output_units: Fn0,
  html_release: Void0,
  malloc: Fn1,
  free: Void1,
}).pipe($I.annoteSchema("Exports", { description: "ABI verified after authenticating the complete pinned binary." }));
const Request = S.Struct({
  input: CitationHtmlInput,
  outputUtf16: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)),
}).pipe($I.annoteSchema("Request", { description: "Private prepared input plus effective produced-text ceiling." }));
const boundedBytes = S.is(S.Uint8Array.check(S.isMaxLength(4 * CitationEngineAbsoluteMaxima.producedTextUtf16)));
const natural = S.is(S.Natural);
const decodeText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const nativeResource = () =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" });
/**
 * Authenticate and compile an asset snapshot. Each run owns a new instance and
 * releases input/result allocations. R = never methods are synchronous inside
 * their evaluation blocks and must run in a parent-owned stoppable worker.
 * This is not the live Layer or its interruption/lifecycle qualification.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationHtmlKernel = Effect.fn("Citation.makeHtmlKernel")(function* (input: unknown) {
  const crypto = yield* Digest.Digest;
  const compiled = yield* compileCitationNativeWasm(
    input,
    CitationNativeWasmAsset.make({
      byteLength: 1753104,
      sha256: Sha256Hex.make("99e76b7cdfe01e574886d7b93b685174cbe7cb5944f8ba964c97019d8f53156a"),
    }),
    () => fail("invalid-asset")
  );
  return {
    run: Effect.fn("Citation.runHtmlKernel")(
      function* (request: unknown) {
        const { input, outputUtf16 } = yield* S.decodeUnknownEffect(Request)(request).pipe(
          Effect.mapError(() => fail("invalid-input"))
        );
        if (!boundedBytes(input.bytes)) return yield* fail("invalid-input");
        const created = yield* compiled.instantiate(() => fail("kernel-failed"));
        const abi = yield* S.decodeUnknownEffect(Exports)(created.exports).pipe(
          Effect.mapError(() => fail("kernel-failed"))
        );
        yield* created.bindMemory(abi.memory);
        yield* Effect.try({ try: () => abi._initialize(), catch: () => fail("kernel-failed") });
        if (abi.html_version() !== 21203 || abi.html_iconv_version() !== 0x111) return yield* fail("invalid-asset");
        const inventory = yield* Effect.try({
          try: () => {
            const pointer = abi.html_iconv_inventory();
            const length = abi.html_iconv_inventory_length();
            if (!natural(pointer) || !natural(length) || length > 32768) return O.none<Uint8Array>();
            return O.some(new Uint8Array(abi.memory.buffer, pointer, length));
          },
          catch: () => fail("invalid-asset"),
        });
        const bytes = yield* Effect.fromOption(inventory).pipe(Effect.mapError(() => fail("invalid-asset")));
        const inventorySha = yield* S.decodeEffect(Sha256HexFromBytes)(bytes).pipe(
          Effect.mapError(() => fail("invalid-asset")),
          Effect.catchDefect(() => Effect.fail(fail("invalid-asset")))
        );
        if (inventorySha !== "51b99795eaf46526e228b70aa2f109b7a12bff156681d25d60bb02f51092b5bc")
          return yield* fail("invalid-asset");
        return yield* Effect.acquireUseRelease(
          Effect.gen(function* () {
            const address = yield* Effect.try({
              try: () => abi.malloc(input.bytes.byteLength + 4),
              catch: () => fail("kernel-failed"),
            });
            if (!natural(address) || address === 0) return yield* nativeResource();
            return address;
          }),
          Effect.fnUntraced(function* (address) {
            const status = yield* Effect.try({
              try: () => {
                new Uint8Array(abi.memory.buffer, address, input.bytes.byteLength + 4).fill(0);
                new Uint8Array(abi.memory.buffer, address, input.bytes.byteLength).set(input.bytes);
                const kind = Match.value(input.encoding).pipe(
                  Match.when("UTF-8", () => 0),
                  Match.when("ISO-8859-1", () => 1),
                  Match.when("UTF-16LE", () => 2),
                  Match.when("UTF-32LE", () => 3),
                  Match.when("AUTO", () => 4),
                  Match.exhaustive
                );
                return abi.html_clean(address, input.bytes.byteLength, kind, outputUtf16, input.fullHtml ? 1 : 0);
              },
              catch: () => fail("kernel-failed"),
            });
            if (status === 3 || status === 6) return yield* nativeResource();
            if (status === 4)
              return yield* CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" });
            if (status === 1) return yield* fail("parse-error");
            if (status === 7) return yield* fail("unicode-decode-error");
            if (status !== 0) return yield* fail("kernel-failed");
            const text = yield* Effect.try({
              try: () => {
                const length = abi.html_output_length();
                const units = abi.html_output_units();
                const pointer = abi.html_output();
                if (
                  !natural(length) ||
                  !natural(units) ||
                  !natural(pointer) ||
                  units > outputUtf16 ||
                  length > 4 * units
                )
                  return O.none<string>();
                const value = decodeText.decode(new Uint8Array(abi.memory.buffer, pointer, length));
                return Str.length(value) === units ? O.some(value) : O.none<string>();
              },
              catch: () => fail("kernel-failed"),
            });
            const value = yield* Effect.fromOption(text).pipe(Effect.mapError(() => fail("kernel-failed")));
            return yield* completeCitationHtml({ text: value, diagnostics: [] });
          }),
          (address) =>
            Effect.sync(() => {
              abi.html_release();
              abi.free(address);
            })
        );
      },
      Effect.provideService(Digest.Digest, crypto)
    ),
  };
});
