/** Owned configuration for tests that install a citation stage directly.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { ownCitationConfiguration } from "@beep/law-practice-server/internal/Citation/ConfigurationOwnership";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { CitationOwned } from "@beep/law-practice-server/internal/Citation/ConfigurationOwnership";
import type { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationConfigurationOwnership");
/** The engine boundary refused a fixture configuration.
 * @internal @category errors @since 0.0.0
 */
export class CitationTestConfigurationRefused extends S.TaggedError<
  CitationTestConfigurationRefused,
  { readonly brand: unique symbol }
>($I`CitationTestConfigurationRefused`)(
  "CitationTestConfigurationRefused",
  {},
  $I.annoteError<CitationTestConfigurationRefused>("CitationTestConfigurationRefused", {
    description: "A fixture configuration did not pass the engine's configuration ownership boundary.",
  })
) {}

/** Mint owned configuration through the real engine boundary.
 *
 * **Details**
 *
 * Direct-stage tests install a stage below the engine boundary, so they need an
 * owned value. This runs the production `ownCitationConfiguration` (decode and
 * one JSON-codec detach); a fixture that does not decode dies, because a
 * direct-stage test is not the place that asserts boundary refusals.
 *
 * **Example** (Own a stage configuration)
 * ```ts
 * import { CitationStopWordsConfiguration } from "@beep/law-practice-server/internal/Citation/StopWords";
 * import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
 * declare const raw: unknown;
 * const owned = ownCitationTestConfiguration(CitationStopWordsConfiguration, raw);
 * ```
 * @internal @category testing @since 0.0.0
 */
export const ownCitationTestConfiguration = Effect.fn("ConfigurationOwnershipTest.own")(function* <
  Schema extends S.Codec<unknown, unknown>,
>(schema: Schema, raw: unknown) {
  return yield* ownCitationConfiguration(schema, raw, () => CitationTestConfigurationRefused.make({})).pipe(
    Effect.orDie
  );
});

/** Adapt a direct-stage installer so a test can keep passing fixture
 * configuration: the configuration is owned through the real boundary first.
 *
 * **Details**
 *
 * With `invalid`, a configuration the boundary refuses fails with that closed
 * error, so a test that used to assert a stage's own configuration refusal now
 * asserts the same refusal where configuration crosses into the engine. Without
 * it, a fixture configuration that does not decode dies.
 *
 * **Example** (Install a stage from fixture configuration)
 * ```ts
 * import {
 *   CitationStopWordsConfiguration,
 *   makeCitationStopWords,
 * } from "@beep/law-practice-server/internal/Citation/StopWords";
 * import { installCitationOwnedTestStage } from "./CitationConfigurationOwnership.fixtures.ts";
 * const install = installCitationOwnedTestStage({
 *   schema: CitationStopWordsConfiguration,
 *   install: makeCitationStopWords,
 * });
 * ```
 * @internal @category testing @since 0.0.0
 */
export const installCitationOwnedTestStage =
  <Schema extends S.Codec<unknown, unknown>, A, E, R, Invalid = never>(stage: {
    readonly schema: Schema;
    readonly install: (
      limits: CitationEngineLimits,
      runtime: CitationNativeProcessRuntime,
      configuration: CitationOwned<Schema["Type"]>
    ) => Effect.Effect<A, E, R>;
    readonly invalid?: () => Invalid;
  }) =>
  (limits: CitationEngineLimits, runtime: CitationNativeProcessRuntime, raw: unknown) =>
    Effect.flatMap(
      stage.invalid === undefined
        ? ownCitationTestConfiguration(stage.schema, raw)
        : ownCitationConfiguration(stage.schema, raw, stage.invalid),
      (owned) => stage.install(limits, runtime, owned)
    );

/** Run the real engine boundary over malformed fixture configuration and return
 * each refusal, mapped to the caller's closed failure.
 *
 * **Details**
 *
 * Stages below the boundary no longer decode configuration, so a refusal that a
 * stage used to raise for a malformed policy, runtime or configuration is now
 * raised where the configuration is owned.
 *
 * **Example** (Refuse malformed limits)
 * ```ts
 * import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
 * import { refuseCitationTestConfigurations } from "./CitationConfigurationOwnership.fixtures.ts";
 * const refusals = refuseCitationTestConfigurations(() => "invalid-configuration", [[CitationEngineLimits, {}]]);
 * ```
 * @internal @category testing @since 0.0.0
 */
export const refuseCitationTestConfigurations = Effect.fn("ConfigurationOwnershipTest.refuse")(function* <E>(
  invalid: () => E,
  cases: ReadonlyArray<readonly [S.Codec<unknown, unknown>, unknown]>
) {
  return yield* Effect.forEach(cases, ([schema, raw]) => Effect.flip(ownCitationConfiguration(schema, raw, invalid)));
});

/** Run the real engine boundary over one malformed fixture value and return its
 * refusal, mapped to the caller's closed failure.
 *
 * **Example** (Refuse a malformed policy)
 * ```ts
 * import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
 * import { refuseCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
 * const refusal = refuseCitationTestConfiguration(() => "invalid-policy", CitationEngineLimits, null);
 * ```
 * @internal @category testing @since 0.0.0
 */
export const refuseCitationTestConfiguration = Effect.fn("ConfigurationOwnershipTest.refuseOne")(function* <E>(
  invalid: () => E,
  schema: S.Codec<unknown, unknown>,
  raw: unknown
) {
  return yield* Effect.flip(ownCitationConfiguration(schema, raw, invalid));
});
