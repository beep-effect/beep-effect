/**
 * Deterministic family attribution for the practice knowledge graph: which
 * client a docket document belongs to, how families are keyed, and which family
 * (if any) a USPTO anchor is a member of.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { KgAttributionSource } from "@beep/law-practice-domain/values";
import * as O from "@beep/utils/Option";
import { HashSet, MutableHashMap, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeKgCatalogRow, PracticeKgDocketReferenceRow, PracticeKgNumberMentionRow } from "./PracticeKg.rows.ts";
import type { PracticeKgEnrichmentRow } from "./PracticeKg.rows.ts";

const $I = $LawPracticeServerId.create("PracticeKg.families");

/**
 * Where one catalogued document sits in the spine after attribution.
 *
 * **Details**
 *
 * `family` and `docket` are the organizer's bare values; `familyKey` and
 * `docketKey` carry the client prefix (`<client>.<family>`) once a client is
 * known, and stay bare otherwise. `recycled` flags a recycle-bin `$R` stub whose
 * placement must not be presented as verified.
 *
 * **Example** (Make an attributed document)
 *
 * ```ts
 * import { PracticeKgDocumentAttribution } from "../../src/PracticeKg.families.ts"
 *
 * const attribution = PracticeKgDocumentAttribution.make({
 *   attributionSource: "text-reference",
 *   client: "12345",
 *   digest: "sha256:9f2c",
 *   docket: "10008US01",
 *   docketKey: "12345.10008US01",
 *   family: "10008",
 *   familyKey: "12345.10008",
 *   recycled: false
 * })
 *
 * console.log(attribution.familyKey) // "12345.10008"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgDocumentAttribution extends S.Class<PracticeKgDocumentAttribution>(
  $I`PracticeKgDocumentAttribution`
)(
  {
    attributionSource: KgAttributionSource,
    client: S.NullOr(S.String),
    digest: S.NonEmptyString,
    docket: S.NullOr(S.String),
    docketKey: S.NullOr(S.String),
    family: S.NullOr(S.String),
    familyKey: S.NullOr(S.String),
    recycled: S.Boolean,
  },
  $I.annote("PracticeKgDocumentAttribution", {
    description: "Client, family key, docket key, and attribution source resolved for one catalogued document.",
  })
) {}

/**
 * One USPTO anchor after dual-key reconciliation.
 *
 * **Details**
 *
 * The enrichment table can carry the same matter twice — once keyed by the
 * application number it was looked up from and once by the patent number — and
 * the two rows need not agree. Reconciliation merges them on the application
 * number, keeps the first non-null metadata, unions parents, and remembers every
 * candidate number so mentions of either form count.
 *
 * **Example** (Make a reconciled anchor)
 *
 * ```ts
 * import { PracticeKgAnchorRecord } from "../../src/PracticeKg.families.ts"
 *
 * const anchor = PracticeKgAnchorRecord.make({
 *   applicationNumber: "14783547",
 *   candidates: ["10252356", "14783547"],
 *   firstApplicantName: null,
 *   firstInventorName: null,
 *   inventionTitle: "Fixture sensor",
 *   numbers: ["10252356", "14783547"],
 *   parentApplicationNumbers: [],
 *   patentNumber: "10252356"
 * })
 *
 * console.log(anchor.numbers.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgAnchorRecord extends S.Class<PracticeKgAnchorRecord>($I`PracticeKgAnchorRecord`)(
  {
    applicationNumber: S.NullOr(S.String),
    candidates: S.Array(S.String),
    firstApplicantName: S.NullOr(S.String),
    firstInventorName: S.NullOr(S.String),
    inventionTitle: S.NullOr(S.String),
    numbers: S.Array(S.String),
    parentApplicationNumbers: S.Array(S.String),
    patentNumber: S.NullOr(S.String),
  },
  $I.annote("PracticeKgAnchorRecord", {
    description: "USPTO anchor merged across its application-keyed and patent-keyed enrichment rows.",
  })
) {}

/**
 * Family placement decided for one USPTO anchor.
 *
 * **Details**
 *
 * `memberFamilyKey` is set only when the anchor's number appears in exactly one
 * keyed family's docket documents (or in a document file name, the strongest
 * signal); every other family whose documents mention the number is listed in
 * `mentionedFamilyKeys` and projected as a `mentioned_in_family` edge, never as
 * membership. `attributionSource` is `filename` or `text-reference` for a
 * member and `mention` otherwise.
 *
 * **Example** (Make a mention-only resolution)
 *
 * ```ts
 * import { PracticeKgAnchorRecord, PracticeKgAnchorResolution } from "../../src/PracticeKg.families.ts"
 *
 * const resolution = PracticeKgAnchorResolution.make({
 *   anchor: PracticeKgAnchorRecord.make({
 *     applicationNumber: "13572982",
 *     candidates: ["8789482"],
 *     firstApplicantName: null,
 *     firstInventorName: null,
 *     inventionTitle: null,
 *     numbers: ["13572982", "8789482"],
 *     parentApplicationNumbers: [],
 *     patentNumber: "8789482"
 *   }),
 *   attributionSource: "mention",
 *   memberClient: null,
 *   memberDocketKeys: [],
 *   memberFamily: null,
 *   memberFamilyKey: null,
 *   mentionedFamilyKeys: ["12345.10008", "12345.10073"]
 * })
 *
 * console.log(resolution.memberFamilyKey) // null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgAnchorResolution extends S.Class<PracticeKgAnchorResolution>($I`PracticeKgAnchorResolution`)(
  {
    anchor: PracticeKgAnchorRecord,
    attributionSource: KgAttributionSource,
    memberClient: S.NullOr(S.String),
    memberDocketKeys: S.Array(S.String),
    memberFamily: S.NullOr(S.String),
    memberFamilyKey: S.NullOr(S.String),
    mentionedFamilyKeys: S.Array(S.String),
  },
  $I.annote("PracticeKgAnchorResolution", {
    description: "Membership-or-mention placement of one USPTO anchor across keyed docket families.",
  })
) {}

const recycleStubPattern = /^\$R/u;

const basenameOf = (relativePath: string): string => pipe(Str.split(relativePath, /[\\/]/u), A.lastNonEmpty);

/**
 * Whether a catalogued path names a recycle-bin restore stub (`$R…`).
 *
 * **Example** (Detect a recycle stub)
 *
 * ```ts
 * import { isRecycleStubPath } from "../../src/PracticeKg.families.ts"
 *
 * console.log(isRecycleStubPath("recycle/$RX7K2P1.docx")) // true
 * console.log(isRecycleStubPath("dockets/10008/response.docx")) // false
 * ```
 *
 * @param relativePath - Source-relative path from the catalog.
 * @returns True when the file name carries the Windows recycle-bin restore prefix.
 * @category predicates
 * @since 0.0.0
 */
export const isRecycleStubPath = (relativePath: string): boolean => recycleStubPattern.test(basenameOf(relativePath));

const keyedWithClient = (client: string | null, bare: string): string => (client === null ? bare : `${client}.${bare}`);

const uniqueMember = (values: HashSet.HashSet<string>): O.Option<string> =>
  pipe(values, A.fromIterable, (members) => (A.length(members) === 1 ? A.head(members) : O.none()));

const sortedUnique = (values: Iterable<string>): ReadonlyArray<string> =>
  A.sort(A.dedupe(A.fromIterable(values)), Order.String);

// Exact match only: `20001US01` and `20001US010` are different matters. A
// national-stage docket such as `10109WO02-US1` also answers to its base code.
const sameDocket = (reference: string, docket: string): boolean =>
  reference === docket ||
  pipe(
    Str.split(docket, "-"),
    A.head,
    O.exists((base) => base === reference)
  );

/*
 * A document may cite another client's matter that shares its bare family
 * number. When the document has a docket code, only references naming that
 * docket are evidence; every other reference is a citation, and a document
 * with citations alone falls through to the client map, family consensus, or
 * the bare family. Family-level documents have no docket code, so all of their
 * family references count.
 */
const ownReferences = (
  row: PracticeKgCatalogRow,
  references: ReadonlyArray<PracticeKgDocketReferenceRow>
): ReadonlyArray<PracticeKgDocketReferenceRow> => {
  const { docket } = row;
  if (docket === null) {
    return references;
  }
  return A.filter(references, (reference) => sameDocket(reference.docket, Str.toUpperCase(docket)));
};

const clientsByDigestFor = (
  rowsByDigest: MutableHashMap.MutableHashMap<string, PracticeKgCatalogRow>,
  docketReferences: ReadonlyArray<PracticeKgDocketReferenceRow>
): MutableHashMap.MutableHashMap<string, HashSet.HashSet<string>> => {
  const referencesByDigest = MutableHashMap.empty<string, ReadonlyArray<PracticeKgDocketReferenceRow>>();
  A.forEach(docketReferences, (reference) => {
    const row = MutableHashMap.get(rowsByDigest, reference.digest);
    if (O.isSome(row) && row.value.docketFamily === reference.family) {
      MutableHashMap.set(
        referencesByDigest,
        reference.digest,
        A.append(
          pipe(
            MutableHashMap.get(referencesByDigest, reference.digest),
            O.getOrElse(A.empty<PracticeKgDocketReferenceRow>)
          ),
          reference
        )
      );
    }
  });
  const clients = MutableHashMap.empty<string, HashSet.HashSet<string>>();
  MutableHashMap.forEach(referencesByDigest, (references, digest) => {
    const row = MutableHashMap.get(rowsByDigest, digest);
    if (O.isSome(row)) {
      MutableHashMap.set(
        clients,
        digest,
        HashSet.fromIterable(A.map(ownReferences(row.value, references), (reference) => reference.client))
      );
    }
  });
  return clients;
};

/**
 * Input to {@link attributeDocuments}: the catalog rows and the client-prefixed
 * references scanned from them.
 *
 * **Example** (Make an empty attribution input)
 *
 * ```ts
 * import { PracticeKgAttributeDocumentsInput } from "../../src/PracticeKg.families.ts"
 *
 * const input = PracticeKgAttributeDocumentsInput.make({ catalogRows: [], docketReferences: [] })
 *
 * console.log(input.catalogRows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgAttributeDocumentsInput extends S.Class<PracticeKgAttributeDocumentsInput>(
  $I`PracticeKgAttributeDocumentsInput`
)(
  {
    catalogRows: S.Array(PracticeKgCatalogRow),
    docketReferences: S.Array(PracticeKgDocketReferenceRow),
  },
  $I.annote("PracticeKgAttributeDocumentsInput", {
    description: "Catalog rows plus the client-prefixed docket references scanned from their text.",
  })
) {}

/**
 * Input to {@link resolveAnchors}: reconciled anchors, number mentions, and the
 * document attributions they resolve against.
 *
 * **Example** (Make an empty resolution input)
 *
 * ```ts
 * import { PracticeKgResolveAnchorsInput } from "../../src/PracticeKg.families.ts"
 *
 * const input = PracticeKgResolveAnchorsInput.make({ anchors: [], attributions: [], numberMentions: [] })
 *
 * console.log(input.anchors.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgResolveAnchorsInput extends S.Class<PracticeKgResolveAnchorsInput>(
  $I`PracticeKgResolveAnchorsInput`
)(
  {
    anchors: S.Array(PracticeKgAnchorRecord),
    attributions: S.Array(PracticeKgDocumentAttribution),
    numberMentions: S.Array(PracticeKgNumberMentionRow),
  },
  $I.annote("PracticeKgResolveAnchorsInput", {
    description: "Reconciled anchors, scanned number mentions, and document attributions for anchor placement.",
  })
) {}

/**
 * Attribute every catalogued document to a client-keyed family and docket.
 *
 * **Details**
 *
 * The organizer keys families on the bare docket number parsed from file names,
 * which collapses two clients sharing a docket number into one family. This pass
 * restores the client dimension deterministically, with no model in the loop:
 *
 * 1. a document whose own text names exactly one `<client>.<family>` for its
 *    family takes that client (`text-reference`); for a document with a
 *    docket code only references naming that exact docket count, so citing
 *    another client's matter under the same family number never moves it;
 * 2. otherwise an organizer client-map value is used (`client-map`);
 * 3. otherwise, when every text-attributed, non-recycled document of the bare
 *    family agrees on one client, the document inherits it
 *    (`family-consensus`);
 * 4. otherwise the document stays in the bare, unattributed family with its
 *    file-name source (`filename` or `restored-name`).
 *
 * Recycle-bin `$R` stubs never vote in step 3. Output is ordered by digest.
 *
 * **Example** (Attribute an empty catalog)
 *
 * ```ts
 * import { attributeDocuments } from "../../src/PracticeKg.families.ts"
 *
 * import { PracticeKgAttributeDocumentsInput } from "../../src/PracticeKg.families.ts"
 *
 * console.log(attributeDocuments(PracticeKgAttributeDocumentsInput.make({ catalogRows: [], docketReferences: [] })).length) // 0
 * ```
 *
 * @param input - Digest-deduplicated catalog rows and the client-prefixed references scanned from them.
 * @returns One attribution per catalog row, ordered by digest.
 * @category use-cases
 * @since 0.0.0
 */
export const attributeDocuments = (
  input: PracticeKgAttributeDocumentsInput
): ReadonlyArray<PracticeKgDocumentAttribution> => {
  const { catalogRows, docketReferences } = input;
  const rowsByDigest = MutableHashMap.fromIterable(A.map(catalogRows, (row) => [row.digest, row] as const));
  const clientsByDigest = clientsByDigestFor(rowsByDigest, docketReferences);
  const ownClient = (row: PracticeKgCatalogRow): O.Option<string> =>
    pipe(MutableHashMap.get(clientsByDigest, row.digest), O.flatMap(uniqueMember));

  const votesByFamily = MutableHashMap.empty<string, HashSet.HashSet<string>>();
  A.forEach(catalogRows, (row) => {
    const own = ownClient(row);
    if (row.docketFamily !== null && O.isSome(own) && !isRecycleStubPath(row.sourceRelativePath)) {
      MutableHashMap.set(
        votesByFamily,
        row.docketFamily,
        HashSet.add(
          pipe(
            MutableHashMap.get(votesByFamily, row.docketFamily),
            O.getOrElse(() => HashSet.empty<string>())
          ),
          own.value
        )
      );
    }
  });
  const consensusFor = (family: string): O.Option<string> =>
    pipe(MutableHashMap.get(votesByFamily, family), O.flatMap(uniqueMember));

  const attributeRow = (row: PracticeKgCatalogRow): PracticeKgDocumentAttribution => {
    const fallbackSource: KgAttributionSource = row.restored ? "restored-name" : "filename";
    const own = ownClient(row);
    const resolved: { readonly client: string | null; readonly source: KgAttributionSource } = O.isSome(own)
      ? { client: own.value, source: "text-reference" }
      : row.client !== null
        ? { client: row.client, source: "client-map" }
        : pipe(
            O.fromNullishOr(row.docketFamily),
            O.flatMap(consensusFor),
            O.match({
              onNone: () => ({ client: null, source: fallbackSource }),
              onSome: (client) => ({ client, source: "family-consensus" as const }),
            })
          );
    return PracticeKgDocumentAttribution.make({
      attributionSource: resolved.source,
      client: resolved.client,
      digest: row.digest,
      docket: row.docket,
      docketKey: row.docket === null ? null : keyedWithClient(resolved.client, row.docket),
      family: row.docketFamily,
      familyKey: row.docketFamily === null ? null : keyedWithClient(resolved.client, row.docketFamily),
      recycled: isRecycleStubPath(row.sourceRelativePath),
    });
  };

  return A.sort(
    A.map(catalogRows, attributeRow),
    Order.mapInput(Order.String, (attribution: PracticeKgDocumentAttribution) => attribution.digest)
  );
};

const splitList = (value: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split(value, " | "), Str.trim), Str.isNonEmpty);

const firstNonNull = (left: string | null, right: string | null): string | null => left ?? right;

/**
 * Merge resolved enrichment rows into one anchor per matter.
 *
 * **Details**
 *
 * Rows sharing an application number collapse into one record; a patent-only
 * row with no application number stands alone. The mention-derived
 * `docketFamilies` column is deliberately dropped here — family placement is
 * decided by {@link resolveAnchors} from the bundle's own documents, never from
 * the enrichment fan-out that produced the cartesian joins.
 *
 * **Example** (Reconcile no rows)
 *
 * ```ts
 * import { reconcileAnchors } from "../../src/PracticeKg.families.ts"
 *
 * console.log(reconcileAnchors([]).length) // 0
 * ```
 *
 * @param enrichmentRows - Enrichment rows as read from the catalog.
 * @returns Reconciled anchors ordered by application number then patent number.
 * @category use-cases
 * @since 0.0.0
 */
export const reconcileAnchors = (
  enrichmentRows: ReadonlyArray<PracticeKgEnrichmentRow>
): ReadonlyArray<PracticeKgAnchorRecord> => {
  const anchors = MutableHashMap.empty<string, PracticeKgAnchorRecord>();
  A.forEach(
    A.filter(enrichmentRows, (row) => row.status === "resolved"),
    (row) => {
      const key = row.applicationNumber ?? `patent:${row.patentNumber ?? row.candidate}`;
      const numbers = A.getSomes([
        O.fromNullishOr(row.applicationNumber),
        O.fromNullishOr(row.patentNumber),
        O.some(row.candidate),
      ]);
      const existing = MutableHashMap.get(anchors, key);
      MutableHashMap.set(
        anchors,
        key,
        O.match(existing, {
          onNone: () =>
            PracticeKgAnchorRecord.make({
              applicationNumber: row.applicationNumber,
              candidates: [row.candidate],
              firstApplicantName: row.firstApplicantName,
              firstInventorName: row.firstInventorName,
              inventionTitle: row.inventionTitle,
              numbers: sortedUnique(numbers),
              parentApplicationNumbers: sortedUnique(splitList(row.parentApplicationNumbers)),
              patentNumber: row.patentNumber,
            }),
          onSome: (anchor) =>
            PracticeKgAnchorRecord.make({
              applicationNumber: firstNonNull(anchor.applicationNumber, row.applicationNumber),
              candidates: sortedUnique(A.append(anchor.candidates, row.candidate)),
              firstApplicantName: firstNonNull(anchor.firstApplicantName, row.firstApplicantName),
              firstInventorName: firstNonNull(anchor.firstInventorName, row.firstInventorName),
              inventionTitle: firstNonNull(anchor.inventionTitle, row.inventionTitle),
              numbers: sortedUnique(A.appendAll(anchor.numbers, numbers)),
              parentApplicationNumbers: sortedUnique(
                A.appendAll(anchor.parentApplicationNumbers, splitList(row.parentApplicationNumbers))
              ),
              patentNumber: firstNonNull(anchor.patentNumber, row.patentNumber),
            }),
        })
      );
    }
  );
  return A.sort(
    A.fromIterable(MutableHashMap.values(anchors)),
    Order.mapInput(
      Order.String,
      (anchor: PracticeKgAnchorRecord) => `${anchor.applicationNumber ?? ""}\u0000${anchor.patentNumber ?? ""}`
    )
  );
};

/**
 * Decide membership or mention-only placement for every reconciled anchor.
 *
 * **Details**
 *
 * For each anchor the number mentions of non-recycled docket documents are
 * grouped by the document's keyed family, file-name and text mentions together.
 * The anchor is a member only when exactly one family mentions it and that
 * family is client-keyed; the source is `filename` when a file name carries the
 * number and `text-reference` otherwise. Any other shape — no mention, mentions
 * spread over several families (what prior-art citations produce), or a sole
 * mention by an unattributed bare family — yields no membership and `mention`
 * as the source. Member dockets are the dockets of the member family's
 * mentioning documents.
 *
 * **Example** (Resolve nothing)
 *
 * ```ts
 * import { resolveAnchors } from "../../src/PracticeKg.families.ts"
 *
 * import { PracticeKgResolveAnchorsInput } from "../../src/PracticeKg.families.ts"
 *
 * console.log(resolveAnchors(PracticeKgResolveAnchorsInput.make({ anchors: [], attributions: [], numberMentions: [] })).length) // 0
 * ```
 *
 * @param input - Reconciled anchors, the number mentions scanned from docket documents, and the document attributions from {@link attributeDocuments}.
 * @returns One resolution per anchor, in anchor order.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveAnchors = (input: PracticeKgResolveAnchorsInput): ReadonlyArray<PracticeKgAnchorResolution> => {
  const { anchors, attributions, numberMentions } = input;
  const attributionByDigest = MutableHashMap.fromIterable(
    A.map(attributions, (attribution) => [attribution.digest, attribution] as const)
  );
  const mentionsByNumber = MutableHashMap.empty<string, ReadonlyArray<PracticeKgNumberMentionRow>>();
  A.forEach(numberMentions, (mention) => {
    MutableHashMap.set(
      mentionsByNumber,
      mention.number,
      A.append(
        pipe(MutableHashMap.get(mentionsByNumber, mention.number), O.getOrElse(A.empty<PracticeKgNumberMentionRow>)),
        mention
      )
    );
  });

  return A.map(anchors, (anchor) => {
    const mentions = A.getSomes(
      A.map(
        A.flatMap(anchor.numbers, (number) =>
          pipe(MutableHashMap.get(mentionsByNumber, number), O.getOrElse(A.empty<PracticeKgNumberMentionRow>))
        ),
        (mention) =>
          pipe(
            MutableHashMap.get(attributionByDigest, mention.digest),
            O.filter((attribution) => attribution.familyKey !== null && !attribution.recycled),
            O.map((attribution) => ({ attribution, source: mention.source }))
          )
      )
    );
    const familyKeysBySource = (source: PracticeKgNumberMentionRow["source"]): HashSet.HashSet<string> =>
      HashSet.fromIterable(
        A.getSomes(
          A.map(mentions, (mention) =>
            mention.source === source ? O.fromNullishOr(mention.attribution.familyKey) : O.none()
          )
        )
      );
    const filenameFamilies = familyKeysBySource("filename");
    // Membership needs one mentioning family across file names and text alike,
    // and that family must be client-keyed: an unattributed remainder cannot own
    // an anchor.
    const clientKeyedFamilies = HashSet.fromIterable(
      A.getSomes(
        A.map(mentions, (mention) =>
          mention.attribution.client === null ? O.none() : O.fromNullishOr(mention.attribution.familyKey)
        )
      )
    );
    const allFamilies = HashSet.union(filenameFamilies, familyKeysBySource("text"));
    const member: O.Option<{ readonly familyKey: string; readonly source: KgAttributionSource }> = pipe(
      uniqueMember(allFamilies),
      O.filter((familyKey) => HashSet.has(clientKeyedFamilies, familyKey)),
      O.map((familyKey) => ({
        familyKey,
        source: HashSet.has(filenameFamilies, familyKey) ? ("filename" as const) : ("text-reference" as const),
      }))
    );
    const memberAttributions = O.match(member, {
      onNone: A.empty<PracticeKgDocumentAttribution>,
      onSome: ({ familyKey }) =>
        A.getSomes(
          A.map(mentions, (mention) =>
            mention.attribution.familyKey === familyKey ? O.some(mention.attribution) : O.none()
          )
        ),
    });
    const memberHead = A.head(memberAttributions);
    return PracticeKgAnchorResolution.make({
      anchor,
      attributionSource: O.match(member, { onNone: () => "mention" as const, onSome: ({ source }) => source }),
      memberClient: O.match(memberHead, { onNone: () => null, onSome: (attribution) => attribution.client }),
      memberDocketKeys: sortedUnique(
        A.getSomes(A.map(memberAttributions, (attribution) => O.fromNullishOr(attribution.docketKey)))
      ),
      memberFamily: O.match(memberHead, { onNone: () => null, onSome: (attribution) => attribution.family }),
      memberFamilyKey: O.match(member, { onNone: () => null, onSome: ({ familyKey }) => familyKey }),
      mentionedFamilyKeys: sortedUnique(
        A.getSomes(A.map(mentions, (mention) => O.fromNullishOr(mention.attribution.familyKey)))
      ),
    });
  });
};
