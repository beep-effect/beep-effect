/**
 * Test-only law-practice domain fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Web Crypto layer that provides the digest and secure-random services the
 * office-action fixtures need to hash source text.
 *
 * **Example** (Provide fixture crypto to a hashing program)
 *
 * ```ts
 * import { fixtureSource, TestCrypto } from "@beep/law-practice-domain/test"
 * import * as Effect from "effect/Effect"
 *
 * const program = fixtureSource("Claims 1-3 are rejected.").pipe(Effect.provide(TestCrypto))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
/**
 * Builds a source-text identity for a fixture text, with its verification
 * input and verified source, all keyed to one fixed fixture locator.
 *
 * **Example** (Verify a fixture source text)
 *
 * ```ts
 * import { fixtureSource, TestCrypto } from "@beep/law-practice-domain/test"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const { source } = yield* fixtureSource("Claims 1-3 are rejected.")
 *   console.log(source.scopeRef) // "matter:fixture"
 * }).pipe(Effect.provide(TestCrypto))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { fixtureSource, TestCrypto } from "./internal/officeActionFixture.ts";
