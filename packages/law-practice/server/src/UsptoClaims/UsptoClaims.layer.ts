/**
 * Server adapter of the `UsptoClaims` port over the `@beep/uspto` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import {
  UsptoClaimSet,
  UsptoClaimSource,
  UsptoClaims,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { decodeXmlTextAs } from "@beep/schema/Xml";
import { Uspto } from "@beep/uspto";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { UsptoClaimsFailureReason } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import type { UsptoDocumentReference, UsptoError, UsptoShape } from "@beep/uspto";

type ApplicationSource = Extract<UsptoClaimSource, { readonly kind: "application" }>;
type PublicationSource = Extract<UsptoClaimSource, { readonly kind: "publication" }>;

const CLAIMS_DOCUMENT_CODE = "CLM";

// Only explicitly labelled XML representations qualify; PDF/OCR is never a fallback.
const xmlDownloadUrl = (document: UsptoDocumentReference): O.Option<string> =>
  O.fromUndefinedOr(document.downloadOptions).pipe(
    O.flatMap((options) =>
      A.findFirst(options, ({ mimeTypeIdentifier }) =>
        O.fromUndefinedOr(mimeTypeIdentifier).pipe(
          O.map(Str.toLowerCase),
          O.exists((format) => format === "xml" || format === "application/xml" || format === "text/xml")
        )
      )
    ),
    O.map(({ downloadUrl }) => downloadUrl)
  );

// A `<claim>` element (not `<claims>` or `<claim-text>`), its attributes and its markup.
const claimElementPattern = /<claim(?=[\s>])([^>]*)>([\s\S]*?)<\/claim>/gu;
const claimNumberAttributePattern = /\bnum="([0-9]+)"/u;
const claimTextTagPattern = /<\/?claim-text\b[^>]*>/gu;
const anyTagPattern = /<[^>]*>/gu;
const leadingClaimNumberPattern = /^\s*[0-9]+\s*[.:]\s*/u;

// The flattened claim text is wrapped in one element so the shared XML decoder resolves its entities.
const decodeClaimText = decodeXmlTextAs(S.Struct({ "claim-text": S.String }));

const portError =
  (reason: UsptoClaimsFailureReason) =>
  (message: string): UsptoClaimsError =>
    UsptoClaimsError.make({ message, reason });

const fromDriver = (error: UsptoError): UsptoClaimsError =>
  portError(error.reason === "not-found" ? "not-found" : "unavailable")(
    `The USPTO request failed with ${error.reason}.`
  );

const latestFirst = Order.flip(
  Order.combine(
    Order.mapInput(Order.String, ({ officialDate }: UsptoDocumentReference) => officialDate ?? ""),
    Order.mapInput(Order.String, ({ documentIdentifier }: UsptoDocumentReference) => documentIdentifier)
  )
);

// The named claims document, or the latest one by official date.
const claimsDocumentOf = (
  documents: ReadonlyArray<UsptoDocumentReference>,
  documentIdentifier: O.Option<string>
): O.Option<UsptoDocumentReference> => {
  const claimsDocuments = A.filter(documents, ({ documentCode }) => documentCode === CLAIMS_DOCUMENT_CODE);
  return O.match(documentIdentifier, {
    onNone: () => A.head(A.sort(claimsDocuments, latestFirst)),
    onSome: (identifier) => A.findFirst(claimsDocuments, (document) => document.documentIdentifier === identifier),
  });
};

const utf8Text = (bytes: Uint8Array): Effect.Effect<string, UsptoClaimsError> =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () =>
      portError("no-full-text-claims")("The claims document is not UTF-8 text, so it has no full-text claims."),
  });

// Nested `<claim-text>` boundaries become spaces; inline markup such as `<claim-ref>` is dropped.
const numberedClaim = Effect.fnUntraced(function* ([
  ,
  attributes = "",
  markup = "",
]: RegExpMatchArray): Effect.fn.Return<readonly [claimNumber: string, claimText: string], UsptoClaimsError> {
  const claimNumber = yield* Effect.fromOption(
    O.flatMap(Str.match(claimNumberAttributePattern)(attributes), A.get(1)),
    () => portError("malformed-claims")("A claim element has no numeric num attribute.")
  );
  const flattened = pipe(markup, Str.replace(claimTextTagPattern, " "), Str.replace(anyTagPattern, ""));
  const decoded = yield* decodeClaimText(`<claim-text>${flattened}</claim-text>`).pipe(
    Effect.mapError(() => portError("malformed-claims")(`Claim ${claimNumber} is not well-formed XML text.`))
  );
  return [claimNumber, Str.replace(leadingClaimNumberPattern, "")(decoded["claim-text"])];
});

const claimsFromXml = Effect.fn("UsptoClaims.claimsFromXml")(function* (xml: string) {
  const numbered = yield* Effect.forEach(A.fromIterable(Str.matchAll(claimElementPattern)(xml)), numberedClaim);
  if (A.isReadonlyArrayEmpty(numbered)) {
    return yield* portError("no-full-text-claims")(
      "The claims document has no XML claim elements; OCR text is not read."
    );
  }
  return yield* normalizePatentClaims(numbered).pipe(
    Effect.mapError((error) => portError("malformed-claims")(`The full-text claims do not normalize: ${error.message}`))
  );
});

const applicationClaims = Effect.fn("UsptoClaims.applicationClaims")(function* (
  uspto: UsptoShape,
  source: ApplicationSource
): Effect.fn.Return<UsptoClaimSet, UsptoClaimsError> {
  const documents = yield* uspto.getDocuments(source.applicationNumber).pipe(Effect.mapError(fromDriver));
  const document = yield* Effect.fromOption(
    claimsDocumentOf(documents, O.fromUndefinedOr(source.documentIdentifier)),
    () => portError("not-found")(`Application ${source.applicationNumber} has no matching claims document.`)
  );
  const downloadUrl = yield* Effect.fromOption(xmlDownloadUrl(document), () =>
    portError("no-full-text-claims")(`Claims document ${document.documentIdentifier} has no XML download.`)
  );
  const bytes = yield* uspto.downloadDocument(downloadUrl).pipe(Effect.mapError(fromDriver));
  const claims = yield* claimsFromXml(yield* utf8Text(bytes));
  return UsptoClaimSet.make({ claims, documentIdentifier: document.documentIdentifier, source });
});

const publicationClaims = Effect.fn("UsptoClaims.publicationClaims")(function* (
  uspto: UsptoShape,
  source: PublicationSource
): Effect.fn.Return<UsptoClaimSet, UsptoClaimsError> {
  const number = source.publicationNumber;
  const pregrant = Str.length(number) === 11;
  const metadata = yield* uspto
    .searchApplications(
      pregrant
        ? `applicationMetaData.earliestPublicationNumber:US${number}A*`
        : `applicationMetaData.patentNumber:${number}`
    )
    .pipe(Effect.mapError(fromDriver));
  const matches = A.filter(metadata, (row) =>
    pregrant
      ? O.exists(row.earliestPublicationNumber, Str.startsWith(`US${number}A`))
      : O.contains(row.patentNumber, number)
  );
  if (matches.length !== 1) {
    return yield* portError("not-found")("The publication did not resolve to one matching USPTO application.");
  }
  const publication = yield* Effect.fromOption(
    A.head(matches).pipe(
      O.flatMap((row) => O.fromUndefinedOr(pregrant ? row.pgpubDocumentMetaData : row.grantDocumentMetaData))
    ),
    () => portError("no-full-text-claims")("The publication has no native XML reference.")
  );
  const bytes = yield* uspto.downloadDocument(publication.fileLocationURI).pipe(Effect.mapError(fromDriver));
  const xml = yield* utf8Text(bytes);
  if (Str.includes("OCRConfidenceData")(xml)) {
    return yield* portError("no-full-text-claims")(
      "OCR-derived claims are excluded from the native publication source."
    );
  }
  const claims = yield* claimsFromXml(xml);
  return UsptoClaimSet.make({ claims, documentIdentifier: publication.xmlFileName, source });
});

/**
 * `UsptoClaims` adapter over the `@beep/uspto` file-wrapper document listing and download.
 *
 * **Details**
 *
 * - `application`: lists the file wrapper's documents, takes the `CLM`
 *   document named by `documentIdentifier` (or, without one, the latest by
 *   official date), selects its explicitly labelled XML download, and reads
 *   its `<claim num>` elements.
 *   Nested `<claim-text>` boundaries become spaces and inline markup is
 *   dropped; the texts then go through the domain claim normalizer.
 * - `publication`: resolves an exact grant number or pre-grant publication
 *   number through ODP metadata, downloads the individual native bulk XML
 *   reference, and reads its claims. This is the published version, which
 *   can differ from later amended file-wrapper claims.
 *
 * A download that is not UTF-8 or has no XML claim elements fails with
 * `no-full-text-claims`: OCR text is never read or repaired. Claims that do
 * not normalize fail with `malformed-claims`. Driver failures become
 * `not-found` for a missing record and `unavailable` otherwise.
 *
 * **Gotchas**
 *
 * A document without an explicitly labelled XML option fails with
 * `no-full-text-claims` before any download, even if a PDF is available.
 *
 * **Example** (Provide the adapter over the driver)
 *
 * ```ts
 * import { UsptoClaimsLive } from "@beep/law-practice-server/UsptoClaims"
 * import { Uspto } from "@beep/uspto"
 * import * as Layer from "effect/Layer"
 *
 * const layer = UsptoClaimsLive.pipe(Layer.provide(Uspto.layer))
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsptoClaimsLive: Layer.Layer<UsptoClaims, never, Uspto> = Layer.effect(
  UsptoClaims,
  Effect.map(Uspto, (uspto) =>
    UsptoClaims.of({
      claims: Effect.fn("UsptoClaims.claims")((source: UsptoClaimSource) =>
        UsptoClaimSource.match(source, {
          application: (application) => applicationClaims(uspto, application),
          publication: (publication) => publicationClaims(uspto, publication),
        })
      ),
    })
  )
);
