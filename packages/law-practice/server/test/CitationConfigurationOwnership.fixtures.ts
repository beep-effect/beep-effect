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
 * configuration: valid fixture configuration is owned through the real boundary
 * first. An invalid fixture is a boundary test, not a stage test, so the adapter
 * dies on it instead of mapping it to a stage reason.
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
  <Schema extends S.Codec<unknown, unknown>, A, E, R>(stage: {
    readonly schema: Schema;
    readonly install: (
      limits: CitationEngineLimits,
      runtime: CitationNativeProcessRuntime,
      configuration: CitationOwned<Schema["Type"]>
    ) => Effect.Effect<A, E, R>;
  }) =>
  (limits: CitationEngineLimits, runtime: CitationNativeProcessRuntime, raw: unknown) =>
    Effect.flatMap(ownCitationTestConfiguration(stage.schema, raw), (owned) => stage.install(limits, runtime, owned));
