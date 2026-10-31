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
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { completeCitationHtml } from "./HtmlCompletion.ts";
import { CitationHtmlInput } from "./HtmlInput.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlKernel");
const Reason = LiteralKit(["invalid-asset", "invalid-input", "parse-error", "kernel-failed"]).pipe(
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
const Fn0 = S.declare<() => number>((value): value is () => number => P.isFunction(value)).pipe(
  $I.annoteSchema("Fn0", { description: "Authenticated zero-argument WASM ABI function." })
);
const Fn1 = S.declare<(value: number) => number>((value): value is (value: number) => number =>
  P.isFunction(value)
).pipe($I.annoteSchema("Fn1", { description: "Authenticated one-argument WASM ABI function." }));
const Fn5 = S.declare<(address: number, length: number, kind: number, ceiling: number, full: number) => number>(
  (value): value is (address: number, length: number, kind: number, ceiling: number, full: number) => number =>
    P.isFunction(value)
).pipe($I.annoteSchema("Fn5", { description: "Authenticated five-integer HTML ABI entrypoint." }));
const Void0 = S.declare<() => void>((value): value is () => void => P.isFunction(value)).pipe(
  $I.annoteSchema("Void0", { description: "Authenticated zero-argument void WASM ABI function." })
);
const Void1 = S.declare<(value: number) => void>((value): value is (value: number) => void => P.isFunction(value)).pipe(
  $I.annoteSchema("Void1", { description: "Authenticated one-argument void WASM ABI function." })
);
const MemoryFields = S.Struct({ buffer: S.instanceOf(ArrayBuffer) }).pipe(
  $I.annoteSchema("MemoryFields", { description: "Unshared native memory buffer exposed by the authenticated module." })
);
const Memory = MemoryFields.pipe(
  S.is,
  S.declare<typeof MemoryFields.Type>,
  $I.annoteSchema("Memory", {
    description: "Preserve the live memory object so buffer growth is observed on each access.",
  })
);
const Runtime = S.Struct({
  WebAssembly: S.Struct({
    Module: S.declare<new (bytes: Uint8Array<ArrayBuffer>) => unknown>(
      (value): value is new (bytes: Uint8Array<ArrayBuffer>) => unknown => P.isFunction(value)
    ),
    Instance: S.declare<new (module: unknown, imports: unknown) => unknown>(
      (value): value is new (module: unknown, imports: unknown) => unknown => P.isFunction(value)
    ),
  }),
}).pipe(
  $I.annoteSchema("Runtime", {
    description: "Decode the server runtime's WebAssembly constructors without adding DOM globals to the package.",
  })
);
const Instance = S.Struct({ exports: S.Unknown }).pipe(
  $I.annoteSchema("Instance", { description: "Runtime instance before its pinned exports are decoded." })
);
const Exports = S.Struct({
  memory: Memory,
  _initialize: Void0,
  html_version: Fn0,
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
const Asset = S.Uint8Array.check(S.isMinLength(980822), S.isMaxLength(980822));
const boundedBytes = S.is(S.Uint8Array.check(S.isMaxLength(4 * CitationEngineAbsoluteMaxima.producedTextUtf16)));
const natural = S.is(S.Natural);
const decodeText = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const nativeResource = () =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" });
/**
 * Closed synchronous WASI callbacks for one native instance. Denied descriptor
 * and path calls return EBADF without inspecting arguments or host resources.
 * Memory must be bound before initialization. No OS clock or environment is read.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationClosedHtmlWasi = Effect.fn("Citation.makeClosedHtmlWasi")(() =>
  Effect.sync(() => {
    let memory = O.none<typeof Memory.Type>();
    const write = (apply: (view: DataView) => void) =>
      O.match(memory, {
        onNone: () => 21,
        onSome: (value) => {
          apply(new DataView(value.buffer));
          return 0;
        },
      });
    const deny = (..._args: ReadonlyArray<unknown>) => 8;
    return {
      bindMemory: Effect.fn("Citation.bindHtmlMemory")((value: typeof Memory.Type) =>
        Effect.sync(() => {
          memory = O.some(value);
        })
      ),
      imports: {
        environ_get: () => 0,
        environ_sizes_get: (count: number, size: number) =>
          write((view) => {
            view.setUint32(count, 0, true);
            view.setUint32(size, 0, true);
          }),
        clock_time_get: (_clock: number, _precision: bigint, address: number) =>
          write((view) => {
            view.setBigUint64(address, BigInt(0), true);
          }),
        fd_close: deny,
        fd_fdstat_get: deny,
        fd_fdstat_set_flags: deny,
        fd_prestat_get: deny,
        fd_prestat_dir_name: deny,
        fd_read: deny,
        fd_seek: deny,
        fd_write: deny,
        path_filestat_get: deny,
        path_open: deny,
        // libc's noreturn exit path traps after this import returns.
        proc_exit: () => {},
      },
    };
  })
);
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
  const asset = yield* S.decodeUnknownEffect(Asset)(input).pipe(Effect.mapError(() => fail("invalid-asset")));
  const snapshot = new Uint8Array(asset);
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(snapshot).pipe(Effect.mapError(() => fail("invalid-asset")));
  if (digest !== "33773ce285d42dd42f7147f595bd45e97d621c0bba3c3b1e8207cf6b9216e76d")
    return yield* fail("invalid-asset");
  const runtime = yield* S.decodeUnknownEffect(Runtime)(globalThis).pipe(Effect.mapError(() => fail("invalid-asset")));
  const module = yield* Effect.try({
    try: () => new runtime.WebAssembly.Module(snapshot),
    catch: () => fail("invalid-asset"),
  });
  return {
    run: Effect.fn("Citation.runHtmlKernel")(function* (request: unknown) {
      const { input, outputUtf16 } = yield* S.decodeUnknownEffect(Request)(request).pipe(
        Effect.mapError(() => fail("invalid-input"))
      );
      if (!boundedBytes(input.bytes)) return yield* fail("invalid-input");
      const host = yield* makeCitationClosedHtmlWasi();
      const instance = yield* Effect.try({
        try: () => new runtime.WebAssembly.Instance(module, { wasi_snapshot_preview1: host.imports }),
        catch: () => fail("kernel-failed"),
      });
      const created = yield* S.decodeUnknownEffect(Instance)(instance).pipe(
        Effect.mapError(() => fail("kernel-failed"))
      );
      const abi = yield* S.decodeUnknownEffect(Exports)(created.exports).pipe(
        Effect.mapError(() => fail("kernel-failed"))
      );
      yield* host.bindMemory(abi.memory);
      yield* Effect.try({ try: () => abi._initialize(), catch: () => fail("kernel-failed") });
      if (abi.html_version() !== 21203) return yield* fail("invalid-asset");
      return yield* Effect.acquireUseRelease(
        Effect.gen(function* () {
          const address = yield* Effect.try({
            try: () => abi.malloc(input.bytes.byteLength + 4),
            catch: () => fail("kernel-failed"),
          });
          if (!natural(address) || address === 0) return yield* nativeResource();
          return address;
        }),
        (address) =>
          Effect.gen(function* () {
            const status = yield* Effect.try({
              try: () => {
                new Uint8Array(abi.memory.buffer, address, input.bytes.byteLength + 4).fill(0);
                new Uint8Array(abi.memory.buffer, address, input.bytes.byteLength).set(input.bytes);
                const kind = Match.value(input.encoding).pipe(
                  Match.when("UTF-8", () => 0),
                  Match.when("ISO-8859-1", () => 1),
                  Match.when("UTF-16LE", () => 2),
                  Match.when("UTF-32LE", () => 3),
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
    }),
  };
});
