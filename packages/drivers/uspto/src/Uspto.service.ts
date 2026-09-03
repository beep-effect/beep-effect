/**
 * Effect service for USPTO Open Data Portal endpoints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoId } from "@beep/identity";
import { assertAllowedRemoteUrl, NonNegativeInt, SchemaUtils, URLStr } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Context, Effect, Layer, Match, Redacted } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { USPTO_API_URL, UsptoConfigInput } from "./Uspto.config.ts";
import { UsptoError } from "./Uspto.errors.ts";
import {
  UsptoApplicationMetadata,
  UsptoApplicationNumber,
  UsptoContinuity,
  UsptoDocumentReference,
} from "./Uspto.models.ts";
import type { HttpClientResponse } from "effect/unstable/http/HttpClientResponse";

const $I = $UsptoId.create("Uspto.service");

/**
 * Runtime shape exposed by the {@link Uspto} service.
 *
 * **Example** (Stub UsptoShape service object)
 *
 * ```ts
 * import type { UsptoShape } from "@beep/uspto"
 * import { Effect } from "effect"
 *
 * const service: UsptoShape = {
 *   downloadDocument: () => Effect.die("not implemented"),
 *   getApplication: () => Effect.die("not implemented"),
 *   getContinuity: () => Effect.die("not implemented"),
 *   getDocuments: () => Effect.die("not implemented"),
 *   searchApplications: () => Effect.die("not implemented")
 * }
 * console.log(typeof service.getApplication)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface UsptoShape {
  /**
   * Download one published file-wrapper document.
   *
   * @since 0.0.0
   */
  readonly downloadDocument: (downloadUrl: string) => Effect.Effect<Uint8Array, UsptoError>;
  /**
   * Resolve official metadata for one application number.
   *
   * @since 0.0.0
   */
  readonly getApplication: (applicationNumber: string) => Effect.Effect<UsptoApplicationMetadata, UsptoError>;
  /**
   * Resolve parent and child continuity for one application number.
   *
   * @since 0.0.0
   */
  readonly getContinuity: (applicationNumber: string) => Effect.Effect<UsptoContinuity, UsptoError>;
  /**
   * List file-wrapper documents for one application number.
   *
   * @since 0.0.0
   */
  readonly getDocuments: (
    applicationNumber: string
  ) => Effect.Effect<ReadonlyArray<UsptoDocumentReference>, UsptoError>;
  /**
   * Search applications with an Open Data Portal query expression.
   *
   * @since 0.0.0
   */
  readonly searchApplications: (query: string) => Effect.Effect<ReadonlyArray<UsptoApplicationMetadata>, UsptoError>;
}

class MetadataEnvelopeWrapper extends S.Class<MetadataEnvelopeWrapper>($I`MetadataEnvelopeWrapper`)(
  {
    applicationMetaData: S.Record(S.String, S.Unknown).pipe(S.optionalKey),
    applicationNumberText: S.optionalKey(S.String),
  },
  $I.annote("MetadataEnvelopeWrapper", {
    description: "USPTO file-wrapper metadata row carried inside an application response envelope.",
  })
) {}

class MetadataEnvelope extends S.Class<MetadataEnvelope>($I`MetadataEnvelope`)(
  {
    patentFileWrapperDataBag: S.Array(MetadataEnvelopeWrapper).pipe(SchemaUtils.withEmptyArrayDefaults()),
  },
  $I.annote("MetadataEnvelope", {
    description: "USPTO file-wrapper response envelope containing application metadata records.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(this));
}

class ContinuityEnvelopeWrapper extends S.Class<ContinuityEnvelopeWrapper>($I`ContinuityEnvelopeWrapper`)(
  {
    childContinuityBag: S.Array(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withEmptyArrayDefaults()),
    parentContinuityBag: S.Array(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withEmptyArrayDefaults()),
  },
  $I.annote("ContinuityEnvelopeWrapper", {
    description: "USPTO continuity row carried inside a continuity response envelope.",
  })
) {}

class ContinuityEnvelope extends S.Class<ContinuityEnvelope>($I`ContinuityEnvelope`)(
  {
    patentFileWrapperDataBag: S.Array(ContinuityEnvelopeWrapper).pipe(SchemaUtils.withEmptyArrayDefaults()),
  },
  $I.annote("ContinuityEnvelope", {
    description: "USPTO continuity response envelope containing parent and child continuity records.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(this));
}

class DocumentsEnvelope extends S.Class<DocumentsEnvelope>($I`DocumentsEnvelope`)(
  {
    documentBag: S.Array(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withEmptyArrayDefaults()),
  },
  $I.annote("DocumentsEnvelope", {
    description: "USPTO file-wrapper response envelope containing document records.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(this));
}

const stringField = (record: Readonly<Record<string, unknown>>, key: string): O.Option<string> =>
  O.fromUndefinedOr(record[key]).pipe(O.filter(P.isString));

const optionalField = (record: Readonly<Record<string, unknown>>, key: string): Record<string, string> =>
  O.getSomesStruct({
    [key]: stringField(record, key),
  } as Record<string, O.Option<string>>) as Record<string, string>;

type DownloadOptionRecord = Readonly<Record<string, unknown>> & {
  readonly downloadUrl: string;
};

const isDownloadOptionRecord = (value: unknown): value is DownloadOptionRecord =>
  P.isObject(value) && P.hasProperty(value, "downloadUrl") && P.isString(value.downloadUrl);

const metadataFromWrapper = (
  wrapper: {
    readonly applicationMetaData?: Readonly<Record<string, unknown>>;
    readonly applicationNumberText?: string;
  },
  fallbackApplicationNumber: string
): Effect.Effect<UsptoApplicationMetadata, UsptoError> => {
  const meta = wrapper.applicationMetaData ?? {};
  return UsptoApplicationMetadata.decodeEffect({
    applicationNumberText: wrapper.applicationNumberText ?? fallbackApplicationNumber,
    ...optionalField(meta, "applicationStatusDescriptionText"),
    ...optionalField(meta, "applicationTypeLabelName"),
    ...optionalField(meta, "docketNumber"),
    ...optionalField(meta, "earliestPublicationNumber"),
    ...optionalField(meta, "filingDate"),
    ...optionalField(meta, "firstApplicantName"),
    ...optionalField(meta, "firstInventorName"),
    ...optionalField(meta, "grantDate"),
    ...optionalField(meta, "inventionTitle"),
    ...optionalField(meta, "patentNumber"),
  }).pipe(Effect.mapError(() => UsptoError.fromReason("response-decoding")));
};

const continuityNumbers = (records: ReadonlyArray<Readonly<Record<string, unknown>>>): Array<UsptoApplicationNumber> =>
  A.flatMap(records, (record) =>
    O.toArray(
      stringField(record, "applicationNumberText").pipe(
        O.orElse(() => stringField(record, "parentApplicationNumberText")),
        O.orElse(() => stringField(record, "childApplicationNumberText")),
        O.flatMap(UsptoApplicationNumber.decodeUnknownOption)
      )
    )
  );

const documentFromRecord = (
  record: Readonly<Record<string, unknown>>
): Effect.Effect<O.Option<UsptoDocumentReference>, UsptoError> => {
  const identifier = stringField(record, "documentIdentifier");
  if (O.isNone(identifier)) {
    return Effect.succeedNone;
  }
  const downloadOptions = O.fromUndefinedOr(record.downloadOptionBag).pipe(
    O.filter(Array.isArray),
    O.flatMap((options) => A.findFirst(options, isDownloadOptionRecord)),
    O.map((option) => option.downloadUrl)
  );
  return UsptoDocumentReference.decodeEffect({
    documentIdentifier: identifier.value,
    ...optionalField(record, "documentCode"),
    ...optionalField(record, "documentCodeDescriptionText"),
    ...optionalField(record, "officialDate"),
    ...O.getSomesStruct({ downloadUrl: downloadOptions }),
  }).pipe(
    Effect.asSome,
    Effect.mapError(() => UsptoError.fromReason("response-decoding"))
  );
};

interface ResolvedUsptoConfig {
  readonly apiKey: O.Option<Redacted.Redacted<string>>;
  readonly apiUrl: URLStr;
}

/**
 * Extract the lowercased hostname of an absolute URL, failing closed to `none`
 * for any value that does not parse into a host.
 */
const hostOf: (url: string) => O.Option<string> = O.liftThrowable((url: string) =>
  Str.toLowerCase(new URL(url).hostname)
);

/**
 * Report whether a target URL resolves to the same host as the configured USPTO
 * API origin. Used to scope the `X-API-KEY` credential and to reject
 * cross-origin document downloads before any request is issued.
 */
const isSameUsptoHost = (url: string, usptoHost: O.Option<string>): boolean =>
  O.match(
    O.zipWith(hostOf(url), usptoHost, (target, expected) => target === expected),
    {
      onNone: () => false,
      onSome: (matches) => matches,
    }
  );

const resolveConfig = (input: UsptoConfigInput): ResolvedUsptoConfig => ({
  apiKey: O.fromUndefinedOr(input.apiKey),
  apiUrl: URLStr.make(input.apiUrl),
});

const statusError = (status: number): UsptoError =>
  Match.value(status).pipe(
    Match.when(404, () => UsptoError.fromReason("not-found", { status: NonNegativeInt.make(status) })),
    Match.when(429, () => UsptoError.fromReason("rate-limited", { status: NonNegativeInt.make(status) })),
    Match.orElse(() => UsptoError.fromReason("response-status", { status: NonNegativeInt.make(status) }))
  );

const makeService = (client: HttpClient.HttpClient, config: ResolvedUsptoConfig): UsptoShape => {
  // Host of the configured USPTO API origin. The `X-API-KEY` credential is only
  // ever attached to requests targeting this host, and the configured host is
  // the single trusted destination for document downloads.
  const usptoHost = hostOf(config.apiUrl);

  const requestFor = (url: string): HttpClientRequest.HttpClientRequest =>
    HttpClientRequest.get(url).pipe(HttpClientRequest.accept("application/json"), (request) =>
      // Scope the credential: never forward `X-API-KEY` cross-origin, so an
      // attacker-influenced URL cannot capture the configured secret.
      O.match(config.apiKey, {
        onNone: () => request,
        onSome: (key) =>
          isSameUsptoHost(url, usptoHost)
            ? HttpClientRequest.setHeader(request, "X-API-KEY", Redacted.value(key))
            : request,
      })
    );

  const executeForResponse = Effect.fn("Uspto.executeForResponse")(function* (
    url: string
  ): Effect.fn.Return<HttpClientResponse, UsptoError> {
    const response = yield* client
      .execute(requestFor(url))
      .pipe(Effect.mapError(() => UsptoError.fromReason("transport")));
    if (response.status < 200 || response.status >= 300) {
      return yield* statusError(response.status);
    }
    return response;
  });

  const executeForText = Effect.fn("Uspto.executeForText")(function* (
    url: string
  ): Effect.fn.Return<string, UsptoError> {
    const response = yield* executeForResponse(url);
    return yield* response.text.pipe(Effect.mapError(() => UsptoError.fromReason("response-decoding")));
  });

  const applicationsUrl = (applicationNumber: string): string =>
    `${config.apiUrl}/api/v1/patent/applications/${encodeURIComponent(applicationNumber)}`;

  return {
    downloadDocument: Effect.fn("Uspto.downloadDocument")(function* (downloadUrl: string) {
      // Fail closed before any request: reject loopback, link-local, private,
      // and cloud-metadata destinations, allowlisting only the configured USPTO
      // origin so a legitimate API host is never blocked.
      yield* assertAllowedRemoteUrl(downloadUrl, {
        allowlist: O.match(usptoHost, { onNone: A.empty<string>, onSome: A.of }),
      }).pipe(Effect.mapError(() => UsptoError.fromReason("transport")));
      // Enforce same-origin: a document download may only target the configured
      // USPTO host, so the credential can never leak and the process cannot be
      // turned into a readback SSRF client for arbitrary hosts.
      if (!isSameUsptoHost(downloadUrl, usptoHost)) {
        return yield* UsptoError.fromReason("transport");
      }
      const response = yield* executeForResponse(downloadUrl);
      const buffer = yield* response.arrayBuffer.pipe(
        Effect.mapError(() => UsptoError.fromReason("response-decoding"))
      );
      return new Uint8Array(buffer);
    }),
    getApplication: Effect.fn("Uspto.getApplication")(function* (applicationNumber: string) {
      const text = yield* executeForText(applicationsUrl(applicationNumber));
      const envelope = yield* MetadataEnvelope.decodeJsonEffect(text).pipe(
        Effect.mapError(() => UsptoError.fromReason("response-decoding"))
      );
      const wrapper = A.head(envelope.patentFileWrapperDataBag);
      if (O.isNone(wrapper)) {
        return yield* UsptoError.fromReason("not-found");
      }
      return yield* metadataFromWrapper(wrapper.value, applicationNumber);
    }),
    getContinuity: Effect.fn("Uspto.getContinuity")(function* (applicationNumber: string) {
      const text = yield* executeForText(`${applicationsUrl(applicationNumber)}/continuity`);
      const envelope = yield* ContinuityEnvelope.decodeJsonEffect(text).pipe(
        Effect.mapError(() => UsptoError.fromReason("response-decoding"))
      );
      const wrapper = A.head(envelope.patentFileWrapperDataBag);
      return UsptoContinuity.make({
        childApplicationNumbers: O.isNone(wrapper) ? [] : continuityNumbers(wrapper.value.childContinuityBag),
        parentApplicationNumbers: O.isNone(wrapper) ? [] : continuityNumbers(wrapper.value.parentContinuityBag),
      });
    }),
    getDocuments: Effect.fn("Uspto.getDocuments")(function* (applicationNumber: string) {
      const text = yield* executeForText(`${applicationsUrl(applicationNumber)}/documents`);
      const envelope = yield* DocumentsEnvelope.decodeJsonEffect(text).pipe(
        Effect.mapError(() => UsptoError.fromReason("response-decoding"))
      );
      const references = yield* Effect.forEach(envelope.documentBag, documentFromRecord);
      return A.flatMap(references, O.toArray);
    }),
    searchApplications: Effect.fn("Uspto.searchApplications")(function* (query: string) {
      const text = yield* executeForText(
        `${config.apiUrl}/api/v1/patent/applications/search?q=${encodeURIComponent(query)}`
      );
      const envelope = yield* MetadataEnvelope.decodeJsonEffect(text).pipe(
        Effect.mapError(() => UsptoError.fromReason("response-decoding"))
      );
      return yield* Effect.forEach(envelope.patentFileWrapperDataBag, (wrapper) =>
        metadataFromWrapper(wrapper, wrapper.applicationNumberText ?? "unknown")
      );
    }),
  };
};

/**
 * Effect service for product-neutral USPTO Open Data Portal access.
 *
 * **Example** (Import Uspto service tag)
 *
 * ```ts
 * import { Uspto } from "@beep/uspto"
 *
 * console.log(Uspto)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Uspto extends Context.Service<Uspto, UsptoShape>()($I`Uspto`) {
  /**
   * Build a layer from explicit configuration.
   *
   * **Example** (Layer from explicit config)
   *
   * ```ts
   * import { Uspto, UsptoConfigInput } from "@beep/uspto"
   *
   * const layer = Uspto.makeLayer(UsptoConfigInput.make({ apiKey: "test-key" }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (config: UsptoConfigInput): Layer.Layer<Uspto, never, HttpClient.HttpClient> =>
    Layer.effect(
      Uspto,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return Uspto.of(makeService(client, resolveConfig(config)));
      })
    );

  /**
   * Live layer backed by `USPTO_API_KEY` and `USPTO_API_URL` configuration.
   *
   * **Example** (Access live Uspto layer)
   *
   * ```ts
   * import { Uspto } from "@beep/uspto"
   *
   * const layer = Uspto.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Uspto, UsptoError> = Layer.effect(
    Uspto,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("USPTO_API_KEY").pipe(Config.option);
      const apiUrl = yield* Config.string("USPTO_API_URL").pipe(Config.withDefault(USPTO_API_URL));
      const client = yield* HttpClient.HttpClient;
      return Uspto.of(
        makeService(
          client,
          resolveConfig(
            UsptoConfigInput.make({
              ...O.getSomesStruct({ apiKey }),
              apiUrl,
            })
          )
        )
      );
    }).pipe(Effect.mapError(() => UsptoError.fromReason("config")))
  ).pipe(Layer.provide(FetchHttpClient.layer));
}
