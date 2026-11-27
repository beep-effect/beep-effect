/**
 * Effect service wrapper for Playwright WebAuthn credential operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { useHelper } from "./internal/use.ts";
import type { Credentials as CoreCredentials } from "playwright";
import type { PlaywrightError } from "./PlaywrightError.ts";

const $I = $PlaywrightId.create("Credentials");

/**
 * The virtual WebAuthn authenticator of a browser context, with every credential operation as an Effect.
 *
 * @category models
 * @since 0.0.0
 */
export interface CredentialsShape {
  /**
   * Seeds a virtual WebAuthn credential and returns it.
   *
   * @see {@link CoreCredentials.create} for the wrapped Playwright method.
   */
  readonly create: (
    rpId: Parameters<CoreCredentials["create"]>[0],
    options?: Parameters<CoreCredentials["create"]>[1]
  ) => Effect.Effect<Awaited<ReturnType<CoreCredentials["create"]>>, PlaywrightError>;
  /**
   * Removes a credential from the virtual authenticator.
   *
   * @see {@link CoreCredentials.delete} for the wrapped Playwright method.
   */
  readonly delete: (
    id: Parameters<CoreCredentials["delete"]>[0]
  ) => Effect.Effect<Awaited<ReturnType<CoreCredentials["delete"]>>, PlaywrightError>;
  /**
   * Returns credentials currently held by the virtual authenticator.
   *
   * @see {@link CoreCredentials.get} for the wrapped Playwright method.
   */
  readonly get: (
    options?: Parameters<CoreCredentials["get"]>[0]
  ) => Effect.Effect<Awaited<ReturnType<CoreCredentials["get"]>>, PlaywrightError>;
  /**
   * Installs the virtual WebAuthn authenticator into the browser context.
   *
   * @see {@link CoreCredentials.install} for the wrapped Playwright method.
   */
  readonly install: Effect.Effect<Awaited<ReturnType<CoreCredentials["install"]>>, PlaywrightError>;
}

/**
 * Service for a {@link CredentialsShape}.
 *
 * **Example** (Seed and remove a credential)
 *
 * ```ts
 * import { Credentials } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const seeded = Effect.gen(function* () {
 *   const credentials = yield* Credentials
 *   yield* credentials.install
 *   const credential = yield* credentials.create("example.com")
 *   const held = yield* credentials.get({ id: credential.id })
 *   yield* credentials.delete(credential.id)
 *   return held
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Credentials extends Context.Service<Credentials, CredentialsShape>()($I`Credentials`) {}

/**
 * Creates `Credentials` from a Playwright `Credentials` instance.
 *
 * **Example** (Wrap a context's credentials)
 *
 * ```ts
 * import { makeCredentials } from "@beep/playwright"
 * import type { BrowserContext } from "playwright"
 *
 * const install = (context: BrowserContext) => makeCredentials(context.credentials).install
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCredentials = (credentials: CoreCredentials): CredentialsShape => {
  const use = useHelper(credentials);

  return Credentials.of({
    install: use((c) => c.install()),
    create: Effect.fn("Credentials.create")((rpId, options) => use((c) => c.create(rpId, options))),
    get: Effect.fn("Credentials.get")((options) => use((c) => c.get(options))),
    delete: Effect.fn("Credentials.delete")((id) => use((c) => c.delete(id))),
  });
};
