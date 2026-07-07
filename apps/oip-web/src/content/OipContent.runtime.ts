/**
 * Runtime OIP content loading with Sanity and checked-in content fallback.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OipWebId } from "@beep/identity/packages";
import { Sanity, SanityConfigInput, SanityQueryRequest } from "@beep/sanity";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O } from "@beep/utils";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import { makeRedactedConfigOptionReader, makeTextConfigOptionReader } from "../runtime/OipRuntimeConfig.ts";
import { oipSiteContent } from "./OipContent.data.ts";
import { decodeOipSiteContent } from "./OipContent.model.ts";
import type { SanityError } from "@beep/sanity";
import type { OipSiteContent } from "./OipContent.model.ts";

const $I = $OipWebId.create("content/OipContent.runtime");
const query = '*[_type == "oipSiteContent" && slug.current == "home"][0]';

const OipContentProviderHttpStatus = S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("OipContentProviderHttpStatus", {
    description: "Integer HTTP status code recorded for OIP content provider errors.",
  })
);

const OipContentLoadErrorReason = LiteralKit(["config", "decode", "provider"]).pipe(
  $I.annoteSchema("OipContentLoadErrorReason", {
    description: "Sanitized OIP content loading failure reason.",
  })
);

type OipContentLoadErrorReason = typeof OipContentLoadErrorReason.Type;

type OipContentLoadErrorOptions = {
  readonly provider?: string;
  readonly providerReason?: string;
  readonly status?: number;
};

class OipContentLoadError extends TaggedErrorClass<OipContentLoadError>($I`OipContentLoadError`)(
  "OipContentLoadError",
  {
    provider: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    providerReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    reason: OipContentLoadErrorReason,
    status: S.OptionFromOptionalKey(OipContentProviderHttpStatus).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OipContentLoadError", {
    description: "Typed server-side OIP content loading failure.",
  })
) {
  static readonly fromReason = (
    reason: OipContentLoadErrorReason,
    options: OipContentLoadErrorOptions = {}
  ): OipContentLoadError =>
    OipContentLoadError.make({
      reason,
      provider: O.fromUndefinedOr(options.provider),
      providerReason: O.fromUndefinedOr(options.providerReason),
      status: O.fromUndefinedOr(options.status),
    });
}

const readTextConfigOption = makeTextConfigOptionReader("OipContent.readTextConfigOption", () =>
  OipContentLoadError.fromReason("config")
);
const readRedactedConfigOption = makeRedactedConfigOptionReader("OipContent.readRedactedConfigOption", () =>
  OipContentLoadError.fromReason("config")
);

const sanityConfig = Effect.fn("OipContent.sanityConfig")(function* () {
  const projectId = yield* readTextConfigOption("SANITY_PROJECT_ID");
  const dataset = yield* readTextConfigOption("SANITY_DATASET");

  if (O.isNone(projectId) || O.isNone(dataset)) {
    return O.none();
  }

  return O.some(
    SanityConfigInput.make({
      ...O.getSomesStruct({
        projectId,
        dataset,
        apiHost: yield* readTextConfigOption("SANITY_API_HOST"),
        apiVersion: yield* readTextConfigOption("SANITY_API_VERSION"),
        apiToken: yield* readRedactedConfigOption("SANITY_API_TOKEN"),
      }),
    })
  );
});

const loadFromSanity = (config: SanityConfigInput): Effect.Effect<OipSiteContent, OipContentLoadError> =>
  Effect.scoped(
    Layer.build(Sanity.makeLayer(config).pipe(Layer.provide(FetchHttpClient.layer))).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const sanity = yield* Sanity;
          const response = yield* sanity.fetch(SanityQueryRequest.make({ query }));
          return yield* decodeOipSiteContent(response.result).pipe(
            Effect.mapError(() => OipContentLoadError.fromReason("decode", { provider: "sanity" }))
          );
        }).pipe(Effect.provide(context))
      )
    )
  ).pipe(
    Effect.catchTag("SanityError", (error: SanityError) =>
      Effect.fail(
        OipContentLoadError.fromReason("provider", {
          provider: "sanity",
          providerReason: error.reason,
          ...O.getSomesStruct({ status: O.fromUndefinedOr(error.status) }),
        })
      )
    )
  );

const fallbackToStaticContent = (error: OipContentLoadError): Effect.Effect<OipSiteContent> =>
  Effect.logWarning("OIP content loader fell back to checked-in content.").pipe(
    Effect.annotateLogs({
      operation: "oip.content.load",
      outcome: "fallback",
      reason: error.reason,
      ...O.getSomesStruct({
        provider: error.provider,
        providerReason: error.providerReason,
        status: error.status,
      }),
    }),
    Effect.as(oipSiteContent)
  );

const loadOipSiteContent = Effect.gen(function* () {
  const config = yield* sanityConfig();

  if (O.isNone(config)) {
    return oipSiteContent;
  }

  return yield* loadFromSanity(config.value);
}).pipe(Effect.catchTag("OipContentLoadError", fallbackToStaticContent));

/**
 * Promise boundary for Next.js server components.
 *
 * @example
 * ```ts
 * import { getOipSiteContent } from "@beep/oip-web/content"
 *
 * getOipSiteContent().then((content) => console.log(content.metadata.siteName))
 * ```
 *
 * @effects Runs {@link loadOipSiteContent} as the Promise boundary consumed by
 * Next.js server components.
 * @category utilities
 * @since 0.0.0
 */
export const getOipSiteContent = (): Promise<OipSiteContent> => Effect.runPromise(loadOipSiteContent);
