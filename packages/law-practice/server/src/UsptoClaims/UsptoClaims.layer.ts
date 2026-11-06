/**
 * Server adapter of the `UsptoClaims` port over the `@beep/uspto` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContentDigest } from "@beep/file-processing/Artifact";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { ClaimInputCollection, ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import {
  UsptoClaimInputSet,
  UsptoClaimInputs,
  UsptoClaimSet,
  UsptoClaimSource,
  UsptoClaims,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { Sha256HexFromBytes } from "@beep/schema";
import { decodeXmlTextAs } from "@beep/schema/Xml";
import { Uspto } from "@beep/uspto";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { UsptoClaimsFailureReason } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import type { UsptoDocumentReference, UsptoError, UsptoShape } from "@beep/uspto";

const $I = $LawPracticeServerId.create("UsptoClaims/UsptoClaims.layer");

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

const applicationDocument = Effect.fn("UsptoClaims.applicationDocument")(function* (
  uspto: UsptoShape,
  source: ApplicationSource
) {
  const documents = yield* uspto.getDocuments(source.applicationNumber).pipe(Effect.mapError(fromDriver));
  const document = yield* Effect.fromOption(
    claimsDocumentOf(documents, O.fromUndefinedOr(source.documentIdentifier)),
    () => portError("not-found")(`Application ${source.applicationNumber} has no matching claims document.`)
  );
  const downloadUrl = yield* Effect.fromOption(xmlDownloadUrl(document), () =>
    portError("no-full-text-claims")(`Claims document ${document.documentIdentifier} has no XML download.`)
  );
  const bytes = yield* uspto.downloadDocument(downloadUrl).pipe(Effect.mapError(fromDriver));
  return { bytes, documentIdentifier: document.documentIdentifier };
});

const applicationClaims = Effect.fn("UsptoClaims.applicationClaims")(function* (
  uspto: UsptoShape,
  source: ApplicationSource
): Effect.fn.Return<UsptoClaimSet, UsptoClaimsError> {
  const document = yield* applicationDocument(uspto, source);
  const text = yield* utf8Text(document.bytes);
  const claims = yield* claimsFromXml(text);
  return UsptoClaimSet.make({ claims, documentIdentifier: document.documentIdentifier, source });
});

const publicationDocument = Effect.fn("UsptoClaims.publicationDocument")(function* (
  uspto: UsptoShape,
  source: PublicationSource
) {
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
  return { bytes, documentIdentifier: publication.xmlFileName };
});

const publicationClaims = Effect.fn("UsptoClaims.publicationClaims")(function* (
  uspto: UsptoShape,
  source: PublicationSource
): Effect.fn.Return<UsptoClaimSet, UsptoClaimsError> {
  const document = yield* publicationDocument(uspto, source);
  const xml = yield* utf8Text(document.bytes);
  if (Str.includes("OCRConfidenceData")(xml)) {
    return yield* portError("no-full-text-claims")(
      "OCR-derived claims are excluded from the native publication source."
    );
  }
  const claims = yield* claimsFromXml(xml);
  return UsptoClaimSet.make({ claims, documentIdentifier: document.documentIdentifier, source });
});

const inputAttributePattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
const protectedXmlBlockPattern =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!(?:"[^"]*"|'[^']*'|[^'">])*>/gu;
// Empty USPTO subsets carry no declarations; nonempty or incomplete subsets
// still cannot establish an unambiguous lexical inventory.
const internalSubsetPattern = /<!DOCTYPE(?:"[^"]*"|'[^']*'|[^'">])*\[(?!\s*\]\s*>)/u;
const claimMarkupPattern = /<\/?claims?(?=[\s/>])/u;
const decodeSourceDigest = S.decodeEffect(Sha256HexFromBytes);
const validateInputNode = decodeXmlTextAs(S.Unknown);
const inputMarkupTokenPattern =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(?:"[^"]*"|'[^']*'|[^'">])*>/gu;
const inputTextBoundaryPattern = /^<\/?claim-text(?=[\s>])/u;
const escapeInputText = (text: string): string =>
  pipe(text, Str.replace(/&/gu, "&amp;"), Str.replace(/</gu, "&lt;"), Str.replace(/>/gu, "&gt;"));
const inputTokenStart = (token: RegExpMatchArray): number => O.getOrThrow(O.fromUndefinedOr(token.index));
const inputTokenEnd = (token: RegExpMatchArray): number => Num.sum(inputTokenStart(token), Str.length(token[0]));
const renderInputToken = (token: string): string =>
  Str.startsWith("<![CDATA[")(token)
    ? escapeInputText(Str.slice(9, -3)(token))
    : O.isSome(Str.match(inputTextBoundaryPattern)(token))
      ? " "
      : "";
const flattenInputMarkup = (markup: string): string => {
  const tokens = A.fromIterable(Str.matchAll(inputMarkupTokenPattern)(markup));
  const rendered = A.flatMap(tokens, (token, index) => {
    const previousEnd = O.getOrElse(O.map(A.get(tokens, Num.decrement(index)), inputTokenEnd), () => 0);
    return [Str.slice(previousEnd, inputTokenStart(token))(markup), renderInputToken(token[0])];
  });
  const lastEnd = O.getOrElse(O.map(A.last(tokens), inputTokenEnd), () => 0);
  return `${A.join(rendered, "")}${Str.slice(lastEnd)(markup)}`;
};

class ClaimXmlRecord extends S.Opaque<ClaimXmlRecord, { readonly brand: unique symbol }>()(
  S.Struct({ attributes: S.String, markup: S.String, sourceText: S.NonEmptyString }).pipe(
    $I.annoteSchema("ClaimXmlRecord", {
      description: "Exact claim element boundaries established by document-level XML lexical context.",
    })
  )
) {}
const inputElementNamePattern = /^<(\/?)([\p{L}_:][\p{L}\p{N}_.:-]*)(?=[\s/>])/u;
const initialSourceInventory = () => ({
  containers: 0,
  cursor: 0,
  inside: false,
  open: O.none<RegExpMatchArray>(),
  records: A.empty<ClaimXmlRecord>(),
});
type SourceInventory = ReturnType<typeof initialSourceInventory>;
const xmlRecordFrom = (open: RegExpMatchArray, close: O.Option<RegExpMatchArray>, xml: string): ClaimXmlRecord =>
  ClaimXmlRecord.make({
    attributes: pipe(open[0], Str.replace(/^<claim/u, ""), Str.replace(/\/?>$/u, "")),
    markup: O.match(close, {
      onNone: () => "",
      onSome: (close) => Str.slice(inputTokenEnd(open), inputTokenStart(close))(xml),
    }),
    sourceText: Str.slice(
      inputTokenStart(open),
      O.match(close, { onNone: () => inputTokenEnd(open), onSome: inputTokenEnd })
    )(xml),
  });
const containerBoundary = Effect.fn("UsptoClaims.containerBoundary")(function* (
  state: SourceInventory,
  token: RegExpMatchArray,
  closing: boolean
): Effect.fn.Return<SourceInventory, UsptoClaimsError> {
  if (O.isSome(state.open))
    return yield* portError("malformed-claims")("A claims container cannot interrupt an open claim record.");
  if (closing) {
    if (!state.inside)
      return yield* portError("malformed-claims")("A claims container closes without its opening element.");
    return { ...state, inside: false };
  }
  if (state.inside || state.containers > 0)
    return yield* portError("malformed-claims")("Exactly one source claims container is required.");
  return { ...state, containers: 1, inside: !Str.endsWith("/>")(token[0]) };
});
const claimBoundary = Effect.fn("UsptoClaims.claimBoundary")(function* (
  state: SourceInventory,
  token: RegExpMatchArray,
  closing: boolean,
  xml: string
): Effect.fn.Return<SourceInventory, UsptoClaimsError> {
  if (!state.inside)
    return yield* portError("malformed-claims")("A claim record lies outside its source claims container.");
  if (closing) {
    const open = yield* Effect.fromOption(state.open, () =>
      portError("malformed-claims")("A claim closes without its opening element.")
    );
    return { ...state, open: O.none(), records: A.append(state.records, xmlRecordFrom(open, O.some(token), xml)) };
  }
  if (O.isSome(state.open)) return yield* portError("malformed-claims")("Nested claim boundaries are ambiguous.");
  return Str.endsWith("/>")(token[0])
    ? { ...state, records: A.append(state.records, xmlRecordFrom(token, O.none(), xml)) }
    : { ...state, open: O.some(token) };
});
const inventoryStep = Effect.fn("UsptoClaims.inventoryStep")(function* (
  state: SourceInventory,
  token: RegExpMatchArray,
  xml: string
): Effect.fn.Return<SourceInventory, UsptoClaimsError> {
  if (O.isNone(state.open) && Str.includes("<")(Str.slice(state.cursor, inputTokenStart(token))(xml))) {
    return yield* portError("malformed-claims")("Unterminated XML metadata leaves source claim boundaries ambiguous.");
  }
  state = { ...state, cursor: inputTokenEnd(token) };
  const name = Str.match(inputElementNamePattern)(token[0]);
  if (O.isNone(name)) return state;
  const closing = name.value[1] === "/";
  if (name.value[2] === "claims") return yield* containerBoundary(state, token, closing);
  if (name.value[2] === "claim") return yield* claimBoundary(state, token, closing, xml);
  if (state.inside && O.isNone(state.open))
    return yield* portError("malformed-claims")("Unsupported element between source claim records.");
  return state;
});

const inputRecord = Effect.fn("UsptoClaims.inputRecord")(function* (
  xmlRecord: ClaimXmlRecord,
  index: number
): Effect.fn.Return<ClaimInputRecord> {
  const { attributes, markup } = xmlRecord;
  const numberAttributes = A.filter(
    A.fromIterable(Str.matchAll(inputAttributePattern)(attributes)),
    (attribute) => attribute[1] === "num"
  );
  const numberText =
    A.length(numberAttributes) === 1
      ? O.flatMap(A.head(numberAttributes), (attribute) =>
          O.orElse(O.fromUndefinedOr(attribute[2]), () => O.fromUndefinedOr(attribute[3]))
        )
      : O.none();
  const record = { sourceOrdinal: index + 1, numberText, sourceText: xmlRecord.sourceText };
  if (A.length(numberAttributes) > 1)
    return ClaimInputRecord.cases.unavailable.make({ ...record, reason: "invalid-text" });
  return yield* validateInputNode(xmlRecord.sourceText).pipe(
    Effect.flatMap(() => decodeClaimText(`<claim-text>${flattenInputMarkup(markup)}</claim-text>`)),
    Effect.map((decoded): ClaimInputRecord => {
      const canonicalText = Str.replace(leadingClaimNumberPattern, "")(decoded["claim-text"]);
      return Str.isEmpty(Str.trim(canonicalText))
        ? ClaimInputRecord.cases.unavailable.make({ ...record, reason: "empty-text" })
        : ClaimInputRecord.cases.text.make({ ...record, canonicalText });
    }),
    Effect.catchTag("SchemaError", () =>
      Effect.succeed(ClaimInputRecord.cases.unavailable.make({ ...record, reason: "invalid-text" }))
    )
  );
});

const sourceRecords = Effect.fn("UsptoClaims.sourceRecords")(function* (xml: string) {
  if (Str.includes("OCRConfidenceData")(xml))
    return yield* portError("no-full-text-claims")("OCR-derived claims are excluded from source inspection.");
  if (O.isSome(Str.match(internalSubsetPattern)(xml))) {
    return yield* portError("malformed-claims")(
      "Internal XML declaration subsets cannot establish an unambiguous source record inventory."
    );
  }
  if (
    A.some(A.fromIterable(Str.matchAll(protectedXmlBlockPattern)(xml)), (block) =>
      O.isSome(Str.match(claimMarkupPattern)(block[0]))
    )
  ) {
    return yield* portError("malformed-claims")(
      "Claim-like markup in XML metadata cannot establish a source record inventory."
    );
  }
  const tokens = A.fromIterable(Str.matchAll(inputMarkupTokenPattern)(xml));
  const inventory = yield* Effect.reduce(tokens, initialSourceInventory, (state, token) =>
    inventoryStep(state, token, xml)
  );
  if (inventory.inside || O.isSome(inventory.open))
    return yield* portError("malformed-claims")("Incomplete source claim boundaries cannot be silently dropped.");
  if (Str.includes("<")(Str.slice(inventory.cursor)(xml))) {
    return yield* portError("malformed-claims")(
      "Unterminated trailing XML metadata cannot establish a complete source inventory."
    );
  }
  return yield* A.match(inventory.records, {
    onEmpty: () =>
      Effect.fail(
        portError("no-full-text-claims")("The claims document has no XML claim records; OCR text is not read.")
      ),
    onNonEmpty: (matches) => Effect.all(A.map(matches, inputRecord)),
  });
});

const sourceInputs = Effect.fn("UsptoClaims.sourceInputs")(function* (
  uspto: UsptoShape,
  source: UsptoClaimSource
): Effect.fn.Return<UsptoClaimInputSet, UsptoClaimsError, Digest.Digest> {
  const document = yield* UsptoClaimSource.match(source, {
    application: (application) => applicationDocument(uspto, application),
    publication: (publication) => publicationDocument(uspto, publication),
  });
  const xml = yield* utf8Text(document.bytes);
  const records = yield* sourceRecords(xml);
  const hex = yield* decodeSourceDigest(document.bytes).pipe(
    Effect.mapError(() => portError("malformed-claims")("The acquired document digest could not be established."))
  );
  const sourceDocumentDigest = ContentDigest.make(`sha256:${hex}`);
  const input = ClaimInputCollection.make({
    sourceKey: `${document.documentIdentifier}:${sourceDocumentDigest}`,
    records,
  });
  return UsptoClaimInputSet.make({
    input,
    documentIdentifier: document.documentIdentifier,
    sourceDocumentDigest,
    source,
  });
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

/**
 * Failure-preserving public source acquisition over the same USPTO driver.
 *
 * **Details**
 * Retains every XML claim record with its original number text and fragment,
 * including malformed or empty text. The exact acquired bytes determine the
 * content digest. It performs no normalization, decomposition or findings.
 * Document-level acquisition, format and OCR failures remain typed failures.
 *
 * **Example** (Inspect the source-input adapter layer)
 *
 * ```ts
 * import { UsptoClaimInputsLive } from "@beep/law-practice-server/UsptoClaims"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(UsptoClaimInputsLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsptoClaimInputsLive: Layer.Layer<UsptoClaimInputs, never, Uspto | Digest.Digest> = Layer.effect(
  UsptoClaimInputs,
  Effect.gen(function* () {
    const uspto = yield* Uspto;
    const digest = yield* Digest.Digest;
    return UsptoClaimInputs.of({
      inputs: Effect.fn("UsptoClaimInputs.inputs")((source: UsptoClaimSource) =>
        sourceInputs(uspto, source).pipe(Effect.provideService(Digest.Digest, digest))
      ),
    });
  })
);
