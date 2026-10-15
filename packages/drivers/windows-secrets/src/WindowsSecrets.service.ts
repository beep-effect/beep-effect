/**
 * Effect service for Windows Credential Manager and DPAPI secret storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WindowsSecretsId } from "@beep/identity";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Redacted from "effect/Redacted";
import { credentialBlob } from "./internal/WindowsSecretsLayout.ts";
import { SecretStoreUnsupported } from "./WindowsSecrets.errors.ts";
import type * as O from "effect/Option";
import type { SecretStoreFailure, SecretTooLarge } from "./WindowsSecrets.errors.ts";
import type { SecretTarget } from "./WindowsSecrets.models.ts";

const $I = $WindowsSecretsId.create("WindowsSecrets.service");

/**
 * Operations exposed by {@link WindowsSecretStore}.
 *
 * **Details**
 *
 * - `get` returns `Option.none()` for a missing credential.
 * - `set` stores the value as a UTF-16LE generic credential persisted for the
 *   local machine; values above 2,560 encoded bytes fail with `SecretTooLarge`.
 * - `remove` succeeds when the credential is already gone.
 * - `protect`/`unprotect` run DPAPI in current-user scope without UI, for blobs
 *   too large for Credential Manager.
 *
 * **Example** (Implement a stub shape)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import type { WindowsSecretStoreShape } from "@beep/windows-secrets/WindowsSecrets.service"
 *
 * const shape: WindowsSecretStoreShape = {
 *   get: () => Effect.succeed(O.none()),
 *   set: () => Effect.void,
 *   remove: () => Effect.void,
 *   protect: Effect.succeed,
 *   unprotect: Effect.succeed,
 * }
 *
 * console.log(Object.keys(shape))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface WindowsSecretStoreShape {
  readonly get: (target: SecretTarget) => Effect.Effect<O.Option<Redacted.Redacted<string>>, SecretStoreFailure>;
  readonly protect: (bytes: Uint8Array) => Effect.Effect<Uint8Array, SecretStoreFailure>;
  readonly remove: (target: SecretTarget) => Effect.Effect<void, SecretStoreFailure>;
  readonly set: (
    target: SecretTarget,
    value: Redacted.Redacted<string>
  ) => Effect.Effect<void, SecretStoreFailure | SecretTooLarge>;
  readonly unprotect: (bytes: Uint8Array) => Effect.Effect<Uint8Array, SecretStoreFailure>;
}

const instrument = (shape: WindowsSecretStoreShape): WindowsSecretStoreShape => ({
  get: (target) => shape.get(target).pipe(Effect.withSpan("WindowsSecretStore.get", { attributes: { target } })),
  set: (target, value) =>
    shape.set(target, value).pipe(Effect.withSpan("WindowsSecretStore.set", { attributes: { target } })),
  remove: (target) =>
    shape.remove(target).pipe(Effect.withSpan("WindowsSecretStore.remove", { attributes: { target } })),
  protect: (bytes) =>
    shape
      .protect(bytes)
      .pipe(Effect.withSpan("WindowsSecretStore.protect", { attributes: { bytes: bytes.byteLength } })),
  unprotect: (bytes) =>
    shape
      .unprotect(bytes)
      .pipe(Effect.withSpan("WindowsSecretStore.unprotect", { attributes: { bytes: bytes.byteLength } })),
});

const makeMemoryStore = (): WindowsSecretStoreShape => {
  const credentials = MutableHashMap.empty<SecretTarget, Redacted.Redacted<string>>();
  return {
    get: (target) => Effect.sync(() => MutableHashMap.get(credentials, target)),
    set: (target, value) =>
      credentialBlob(target, Redacted.value(value)).pipe(
        Effect.andThen(
          Effect.sync(() => {
            MutableHashMap.set(credentials, target, value);
          })
        )
      ),
    remove: (target) =>
      Effect.sync(() => {
        MutableHashMap.remove(credentials, target);
      }),
    // Test double: identity "protection" that only copies the bytes.
    protect: (bytes) => Effect.sync(() => Uint8Array.from(bytes)),
    unprotect: (bytes) => Effect.sync(() => Uint8Array.from(bytes)),
  };
};

const acquireWindowsStore = Effect.gen(function* () {
  const platform = yield* Effect.sync(() => process.platform);
  if (platform !== "win32") {
    return yield* SecretStoreUnsupported.make({ platform });
  }
  // Loaded lazily so non-Windows hosts never evaluate `bun:ffi` bindings.
  const native = yield* Effect.promise(() => import("./internal/WindowsSecretsNative.ts"));
  return yield* native.acquireNativeSecretStore;
});

/**
 * Windows secret store: Credential Manager for small secrets, DPAPI for blobs.
 *
 * **Details**
 *
 * Secret values travel as `Redacted<string>` and never reach logs, spans or
 * error text. Spans carry the target name, which is not secret.
 *
 * **Example** (Round-trip a secret in memory)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Redacted from "effect/Redacted"
 * import { SecretTarget, WindowsSecretStore } from "@beep/windows-secrets"
 *
 * const target = SecretTarget.make("beep/m365/refresh-token")
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* WindowsSecretStore
 *   yield* store.set(target, Redacted.make("example-token"))
 *   const stored = yield* store.get(target)
 *   return O.isSome(stored)
 * }).pipe(Effect.provide(WindowsSecretStore.layerMemory))
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WindowsSecretStore extends Context.Service<WindowsSecretStore, WindowsSecretStoreShape>()(
  $I`WindowsSecretStore`
) {
  /**
   * Live layer over `advapi32.dll`, `crypt32.dll` and `kernel32.dll` through
   * `bun:ffi`.
   *
   * **Details**
   *
   * Fails with `SecretStoreUnsupported` off Windows before any native code
   * loads. The DLL handles close when the layer's scope closes.
   *
   * **Example** (Provide the live store)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { SecretTarget, WindowsSecretStore } from "@beep/windows-secrets"
   *
   * const program = WindowsSecretStore.use((store) => store.get(SecretTarget.make("beep/box/access-token"))).pipe(
   *   Effect.provide(WindowsSecretStore.layerWindows)
   * )
   *
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerWindows: Layer.Layer<WindowsSecretStore, SecretStoreUnsupported> = Layer.effect(
    WindowsSecretStore,
    Effect.map(acquireWindowsStore, (shape) => WindowsSecretStore.of(instrument(shape)))
  );

  /**
   * In-memory store over `effect/MutableHashMap` for tests and non-Windows
   * development.
   *
   * **Gotchas**
   *
   * `protect`/`unprotect` are an identity copy: this layer is a test double and
   * gives no confidentiality. Each build starts empty.
   *
   * **Example** (Provide the memory store)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { SecretTarget, WindowsSecretStore } from "@beep/windows-secrets"
   *
   * const program = WindowsSecretStore.use((store) => store.get(SecretTarget.make("beep/box/access-token"))).pipe(
   *   Effect.provide(WindowsSecretStore.layerMemory)
   * )
   *
   * Effect.runPromise(program).then(console.log) // { _id: 'Option', _tag: 'None' }
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerMemory: Layer.Layer<WindowsSecretStore> = Layer.sync(WindowsSecretStore, () =>
    WindowsSecretStore.of(instrument(makeMemoryStore()))
  );
}
