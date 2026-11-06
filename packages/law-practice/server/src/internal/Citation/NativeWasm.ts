/** Shared restricted WASM ABI and WASI environment for authenticated kernels.
 * No OS clock, filesystem, standard I/O or environment is exposed.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("internal/Citation/NativeWasm");
/** Authenticated ABI callable; shape is checked only after asset authentication.
 * @internal @category models @since 0.0.0
 */
export const CitationNativeWasmFn0 = S.declare<() => number>((value): value is () => number =>
  P.isFunction(value)
).pipe($I.annoteSchema("CitationNativeWasmFn0", { description: "Authenticated zero-argument numeric ABI function." }));
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmFn0 = typeof CitationNativeWasmFn0.Type;
/** @internal @category models @since 0.0.0 */
export const CitationNativeWasmFn1 = S.declare<(value: number) => number>((value): value is (value: number) => number =>
  P.isFunction(value)
).pipe($I.annoteSchema("CitationNativeWasmFn1", { description: "Authenticated one-integer numeric ABI function." }));
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmFn1 = typeof CitationNativeWasmFn1.Type;
/** @internal @category models @since 0.0.0 */
export const CitationNativeWasmFn5 = S.declare<(a: number, b: number, c: number, d: number, e: number) => number>(
  (value): value is (a: number, b: number, c: number, d: number, e: number) => number => P.isFunction(value)
).pipe($I.annoteSchema("CitationNativeWasmFn5", { description: "Authenticated five-integer numeric ABI entrypoint." }));
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmFn5 = typeof CitationNativeWasmFn5.Type;
/** @internal @category models @since 0.0.0 */
export const CitationNativeWasmVoid0 = S.declare<() => void>((value): value is () => void => P.isFunction(value)).pipe(
  $I.annoteSchema("CitationNativeWasmVoid0", { description: "Authenticated zero-argument void ABI function." })
);
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmVoid0 = typeof CitationNativeWasmVoid0.Type;
/** @internal @category models @since 0.0.0 */
export const CitationNativeWasmVoid1 = S.declare<(value: number) => void>((value): value is (value: number) => void =>
  P.isFunction(value)
).pipe($I.annoteSchema("CitationNativeWasmVoid1", { description: "Authenticated one-integer void ABI function." }));
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmVoid1 = typeof CitationNativeWasmVoid1.Type;
const MemoryFields = S.Struct({ buffer: S.instanceOf(ArrayBuffer) }).pipe(
  $I.annoteSchema("MemoryFields", { description: "Unshared native memory buffer exposed by the authenticated module." })
);
/** Preserve the live memory object so growth is observed on each access.
 * @internal @category models @since 0.0.0
 */
export const CitationNativeWasmMemory = MemoryFields.pipe(
  S.is,
  S.declare<typeof MemoryFields.Type>,
  $I.annoteSchema("CitationNativeWasmMemory", { description: "Live unshared authenticated kernel memory." })
);
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmMemory = typeof CitationNativeWasmMemory.Type;
/** @internal @category models @since 0.0.0 */
export const CitationNativeWasmRuntime = S.Struct({
  WebAssembly: S.Struct({
    Module: S.declare<new (bytes: Uint8Array<ArrayBuffer>) => unknown>(
      (value): value is new (bytes: Uint8Array<ArrayBuffer>) => unknown => P.isFunction(value)
    ),
    Instance: S.declare<new (module: unknown, imports: unknown) => unknown>(
      (value): value is new (module: unknown, imports: unknown) => unknown => P.isFunction(value)
    ),
  }),
}).pipe(
  $I.annoteSchema("CitationNativeWasmRuntime", {
    description: "Server WebAssembly constructors without requiring DOM globals in the package.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmRuntime = typeof CitationNativeWasmRuntime.Type;
/** @internal @category models @since 0.0.0 */
export const CitationNativeWasmInstance = S.Struct({ exports: S.Unknown }).pipe(
  $I.annoteSchema("CitationNativeWasmInstance", { description: "Runtime instance before pinned export decoding." })
);
/** @internal @category models @since 0.0.0 */
export type CitationNativeWasmInstance = typeof CitationNativeWasmInstance.Type;
/** Static authenticated asset identity supplied by a trusted kernel adapter.
 * @internal @category models @since 0.0.0
 */
export class CitationNativeWasmAsset extends S.Opaque<CitationNativeWasmAsset, { readonly brand: unique symbol }>()(
  S.Struct({ byteLength: S.Natural, sha256: Sha256Hex }).pipe(
    $I.annoteSchema("CitationNativeWasmAsset", {
      description: "Pinned binary length and digest, never caller-selected kernel code.",
    })
  )
) {}
/** Authenticate a copied asset and compile once. Each instantiate call creates
 * a fresh restricted environment; its caller decodes the pinned ABI and binds
 * memory before initialization. Functions are trusted local adapters, not wire data.
 * @internal @category operations @since 0.0.0
 */
export const compileCitationNativeWasm = Effect.fn("Citation.compileNativeWasm")(function* <E>(
  input: unknown,
  expected: CitationNativeWasmAsset,
  invalid: () => E
) {
  const asset = yield* S.decodeUnknownEffect(
    S.Uint8Array.check(S.isMinLength(expected.byteLength), S.isMaxLength(expected.byteLength))
  )(input).pipe(Effect.mapError(invalid));
  const snapshot = new Uint8Array(asset);
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(snapshot).pipe(
    Effect.mapError(invalid),
    Effect.catchDefect(() => Effect.fail(invalid()))
  );
  if (digest !== expected.sha256) return yield* Effect.fail(invalid());
  const runtime = yield* S.decodeUnknownEffect(CitationNativeWasmRuntime)(globalThis).pipe(Effect.mapError(invalid));
  const module = yield* Effect.try({
    try: () => new runtime.WebAssembly.Module(snapshot),
    catch: invalid,
  });
  return {
    instantiate: Effect.fn("Citation.instantiateNativeWasm")(function* <F>(failed: () => F) {
      const host = yield* makeCitationClosedNativeWasi();
      const instance = yield* Effect.try({
        try: () => new runtime.WebAssembly.Instance(module, { wasi_snapshot_preview1: host.imports }),
        catch: failed,
      });
      const created = yield* S.decodeUnknownEffect(CitationNativeWasmInstance)(instance).pipe(Effect.mapError(failed));
      return { exports: created.exports, bindMemory: host.bindMemory };
    }),
  };
});
/** Closed synchronous WASI callbacks for one instance. Memory is bound before
 * initialization. Descriptor/path calls return EBADF without inspecting host
 * resources. The empty environment and fixed clock preserve the existing HTML
 * host contract; parent Effect Clock owns worker deadlines.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationClosedNativeWasi = Effect.fn("Citation.makeClosedNativeWasi")(() =>
  Effect.sync(() => {
    let memory = O.none<CitationNativeWasmMemory>();
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
      bindMemory: Effect.fn("Citation.bindNativeMemory")((value: CitationNativeWasmMemory) =>
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
