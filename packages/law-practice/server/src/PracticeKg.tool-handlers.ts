/**
 * Injected read handlers for the practice knowledge-graph MCP toolkit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  PracticeKgCandidateClaimsNotLoadedResult,
  PracticeKgCorrespondentAddressError,
  PracticeKgCorrespondentLookupRequest,
  PracticeKgCorrespondentToolRow,
  PracticeKgGraphToolRow,
  PracticeKgMatterLookupRequest,
  PracticeKgMatterToolRow,
  PracticeKgToolError,
  PracticeKgToolkit,
  PracticeKgToolResult,
  practiceKgCandidateClaimFieldTiers,
  practiceKgCorrespondentFieldTiers,
  practiceKgDocumentFieldTiers,
  practiceKgEmailFieldTiers,
  practiceKgFamilyFieldTiers,
  practiceKgGraphFieldTiers,
  practiceKgMatterFieldTiers,
} from "@beep/law-practice-use-cases/server";
import { estimateJsonSize, FieldTierName, projectFieldTier, toColumnarEnvelope } from "@beep/mcp-kit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { SqlClient as SqlClientService } from "effect/sql/SqlClient";
import { lookupPracticeKgCorrespondents } from "./PracticeKg.correspondents.ts";
import { PracticeKgBundle } from "./PracticeKg.host.ts";
import { lookupPracticeKgMatters } from "./PracticeKg.matters.ts";
import { PracticeKgQueries } from "./PracticeKg.queries.ts";
import {
  addPracticeKgCorpusPointers,
  decodePracticeKgCandidateClaimRows,
  decodePracticeKgDocumentRows,
  decodePracticeKgEmailRows,
  decodePracticeKgFamilyRows,
  decodePracticeKgGraphRows,
  toToolRecord,
} from "./PracticeKg.rows.ts";
import type {
  PracticeKgCorrespondentLink,
  PracticeKgCorrespondentLookupResult,
  PracticeKgCorrespondentRowResolution,
  PracticeKgToolFailureReason,
} from "@beep/law-practice-use-cases/server";
import type { FieldTierSet } from "@beep/mcp-kit";
import type * as Tool from "effect/ai/Tool";
import type * as Layer from "effect/Layer";
import type * as SqlClient from "effect/sql/SqlClient";

const spineStatus = PracticeKgEpistemicStatus.Enum["derived-from-official-records"];
const candidateStatus = PracticeKgEpistemicStatus.Enum["candidate-unreviewed"];
const emailLinkageNote =
  "Matter linkage is archive-level confidence only; a matching message header is not message-level matter proof.";
const nodeProvenanceNote =
  "A node's provenance names the catalog row or USPTO record it was projected from. attributionSource says why it sits in its family: filename and restored-name come from file names alone, docket-register from the attorney's docket register, folder-path from his own folder names, text-reference and family-consensus from the documents' own client references, mention means the number is only cited there. recycled-unverified rows rest on recycle-bin restore stubs.";
const provenanceNotFoundNote =
  "No graph node or document in this bundle has that identity. Check the key with kg_find or kg_matter_lookup; application and patent numbers are stored as digits only.";
const matterLookupNote =
  "Only resolution unique is safe to act on. ambiguous means several matters share the reference; none means the bundle does not know it. A matter with no client, or with recycled-unverified status, needs a person to confirm it.";
const correspondentLookupNote =
  "Only resolution unique is safe to act on, and it comes only from the attorney's own links for the contact. Message counts and inferred links (org-name-match, email-subject-ref) rank candidates for a person; role mailboxes and the practice's own addresses never resolve uniquely.";
const tierOrder = A.reverse(FieldTierName.literals);

type CorrespondentCounts = Pick<
  PracticeKgCorrespondentToolRow,
  "ccCount" | "clientName" | "firstAt" | "fromCount" | "lastAt" | "messageCount" | "toCount"
>;

const noCounts: CorrespondentCounts = {
  ccCount: 0,
  clientName: null,
  firstAt: null,
  fromCount: 0,
  lastAt: null,
  messageCount: 0,
  toCount: 0,
};

// A link names a matter, or only a client when its family key is null.
const linksFor =
  (links: ReadonlyArray<PracticeKgCorrespondentLink>) => (familyKey: string | null, clientNumber: string | null) =>
    A.filter(links, (link) =>
      familyKey === null ? link.familyKey === null && link.clientNumber === clientNumber : link.familyKey === familyKey
    );

// Only the decided row of a unique lookup may say unique; its siblings are
// candidates, so no row read alone looks actionable.
const rowResolution = (
  result: PracticeKgCorrespondentLookupResult,
  decided: boolean
): PracticeKgCorrespondentRowResolution =>
  decided ? "unique" : result.resolution === "unique" ? "candidate" : result.resolution;

// One row per matter the address is tied to: the filed-mail candidates first,
// in their rank order, then matters and clients named only by contact links.
const correspondentRows = (
  result: PracticeKgCorrespondentLookupResult
): ReadonlyArray<PracticeKgCorrespondentToolRow> => {
  const contact = A.length(result.contacts) === 1 ? A.head(result.contacts) : O.none();
  const linked = linksFor(result.links);
  const shared = {
    address: result.address,
    contactId: O.getOrNull(O.map(contact, (owner) => owner.contactId)),
    displayName: O.getOrNull(O.map(contact, (owner) => owner.displayName)),
    practiceAddress: result.practiceAddress,
    roleAddress: A.some(result.contacts, (owner) => owner.roleAddress),
  };
  const row = (familyKey: string | null, clientNumber: string | null, counts: CorrespondentCounts) => {
    const links = linked(familyKey, clientNumber);
    const decided = familyKey !== null && familyKey === result.familyKey;
    return PracticeKgCorrespondentToolRow.make({
      ...shared,
      ...counts,
      clientNumber,
      decided,
      resolution: rowResolution(result, decided),
      familyKey,
      linkEvidence: A.join(
        A.map(links, (link) => link.evidence),
        " | "
      ),
      linkSources: A.join(A.dedupe(A.map(links, (link) => link.source)), " | "),
    });
  };
  const candidateKeys = A.map(result.candidates, (candidate) => candidate.familyKey);
  const linkOnly = A.dedupeWith(
    A.filter(result.links, (link) => link.familyKey === null || !A.contains(candidateKeys, link.familyKey)),
    (left: PracticeKgCorrespondentLink, right: PracticeKgCorrespondentLink) =>
      left.familyKey === right.familyKey && left.clientNumber === right.clientNumber
  );
  // The decided row leads so a budget that keeps one row keeps that one.
  const [decided, undecided] = A.partition(
    A.appendAll(
      A.map(result.candidates, (candidate) => row(candidate.familyKey, candidate.client, candidate)),
      A.map(linkOnly, (link) => row(link.familyKey, link.clientNumber, noCounts))
    ),
    (entry) => (entry.decided ? Result.succeed(entry) : Result.fail(entry))
  );
  return A.appendAll(decided, undecided);
};

const withheldColumnsFor = (
  tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>,
  tier: FieldTierName
): ReadonlyArray<string> => A.difference(R.keys(tiers.complete.fields), R.keys(tiers[tier].fields));

const likePattern = (value: string | undefined): string | null =>
  O.map(O.fromUndefinedOr(value), (fragment) => `%${fragment}%`).pipe(O.getOrNull);

const projectRows = (
  rows: ReadonlyArray<Record<string, unknown>>,
  tiers: FieldTierSet<S.Struct.Fields, S.Struct.Fields, S.Struct.Fields>,
  budgetBytes: number,
  bundleVersion: string,
  note?: string | undefined,
  epistemicStatus: PracticeKgEpistemicStatus = spineStatus
): PracticeKgToolResult => {
  const shared = {
    bundle_version: bundleVersion,
    epistemic_status: epistemicStatus,
    ...O.getSomesStruct({ note: O.fromUndefinedOr(note) }),
    total: S.Natural.make(A.length(rows)),
  };
  return A.findFirst(tierOrder, (tier) => {
    const data = toColumnarEnvelope(A.map(rows, projectFieldTier(tier, tiers)));
    return estimateJsonSize(data) <= budgetBytes
      ? O.some({
          data,
          tier,
        })
      : O.none();
  }).pipe(
    O.match({
      onNone: () => {
        const minimalRows = A.map(rows, projectFieldTier("minimal", tiers));
        const fitting = A.findFirst(
          A.reverse(A.range(0, A.length(minimalRows))),
          (count) => estimateJsonSize(toColumnarEnvelope(A.take(minimalRows, count))) <= budgetBytes
        ).pipe(O.getOrElse(() => 0));
        return PracticeKgToolResult.make({
          ...shared,
          data: toColumnarEnvelope(A.take(minimalRows, fitting)),
          tier: "minimal",
          truncated: fitting < A.length(rows),
          withheld_columns: withheldColumnsFor(tiers, "minimal"),
        });
      },
      onSome: ({ data, tier }) =>
        PracticeKgToolResult.make({
          ...shared,
          data,
          tier,
          truncated: false,
          ...(tier === "complete" ? {} : { withheld_columns: withheldColumnsFor(tiers, tier) }),
        }),
    })
  );
};

const isToolError = S.is(PracticeKgToolError);
const isAddressError = S.is(PracticeKgCorrespondentAddressError);

const failureMessages: Readonly<Record<PracticeKgToolFailureReason, string>> = {
  "row-decode-failed":
    "The bundle returned rows this server version does not understand; the bundle and server were probably built from different versions.",
  "invalid-input": "The request cannot be answered as given; check the tool's parameter description.",
  "store-query-failed": "The bundle store rejected the query; the bundle is damaged or does not match this server.",
};

const failureOf =
  (reason: PracticeKgToolFailureReason) =>
  (_cause: unknown): PracticeKgToolError =>
    PracticeKgToolError.make({ message: failureMessages[reason], reason, tool: "bundle" });

/*
 * Stamps the tool name on a failure. A failure that already carries a reason
 * keeps it, so a caller can tell a store fault from a version mismatch; anything
 * else is reported as a store fault.
 */
const toolFailure =
  (tool: string) =>
  (cause: unknown): PracticeKgToolError =>
    isToolError(cause)
      ? PracticeKgToolError.make({
          message: cause.message,
          tool,
          ...O.getSomesStruct({ reason: O.fromUndefinedOr(cause.reason) }),
        })
      : PracticeKgToolError.make({
          message: failureMessages["store-query-failed"],
          reason: "store-query-failed",
          tool,
        });

const decodeRows =
  <A>(decode: (input: unknown) => Effect.Effect<ReadonlyArray<A>, S.SchemaError>) =>
  (rows: unknown): Effect.Effect<ReadonlyArray<A>, PracticeKgToolError> =>
    decode(rows).pipe(Effect.mapError(failureOf("row-decode-failed")));

const queryPglite = <A>(
  sql: SqlClient.SqlClient,
  statement: string,
  parameters: ReadonlyArray<unknown>,
  decode: (input: unknown) => Effect.Effect<ReadonlyArray<A>, S.SchemaError>
): Effect.Effect<ReadonlyArray<A>, PracticeKgToolError> =>
  sql
    .unsafe(statement, parameters)
    .pipe(Effect.mapError(failureOf("store-query-failed")), Effect.flatMap(decodeRows(decode)));

/**
 * Live toolkit handlers over injected PGlite SQL, DuckDB, and bundle metadata.
 *
 * **Details**
 *
 * This layer never constructs either database. The app owns both long-lived
 * resource layers and supplies them once for the stdio host lifetime.
 *
 * **Example** (Usage)
 * ```ts
 * import { PracticeKgToolkitHandlersLive } from "@beep/law-practice-server"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(PracticeKgToolkitHandlersLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgToolkitHandlersLive: Layer.Layer<
  Tool.HandlersFor<typeof PracticeKgToolkit.tools>,
  never,
  DuckDb | Path.Path | PracticeKgBundle | SqlClientService
> = PracticeKgToolkit.toLayer(
  Effect.gen(function* () {
    const bundle = yield* PracticeKgBundle;
    const duckdb = yield* DuckDb;
    const sql = (yield* SqlClientService).withoutTransforms();
    const path = yield* Path.Path;
    const version = bundle.manifest.bundleVersion;

    return PracticeKgToolkit.of({
      kg_clients: Effect.fn("PracticeKgTools.kg_clients")(function* (request) {
        const rows = yield* queryPglite(sql, PracticeKgQueries.clients, [], decodePracticeKgGraphRows).pipe(
          Effect.mapError(toolFailure("kg_clients"))
        );
        return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }),
      kg_docket_family: Effect.fn("PracticeKgTools.kg_docket_family")(function* (request) {
        const rows = yield* queryPglite(
          sql,
          PracticeKgQueries.family,
          [request.family],
          decodePracticeKgFamilyRows
        ).pipe(Effect.mapError(toolFailure("kg_docket_family")));
        return projectRows(A.map(rows, toToolRecord), practiceKgFamilyFieldTiers, request.budgetBytes, version);
      }),
      kg_application_lookup: Effect.fn("PracticeKgTools.kg_application_lookup")(function* (request) {
        const rows = yield* queryPglite(
          sql,
          PracticeKgQueries.application,
          [request.application_number ?? null, request.patent_number ?? null, request.docket ?? null],
          decodePracticeKgGraphRows
        ).pipe(Effect.mapError(toolFailure("kg_application_lookup")));
        return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }),
      kg_find: Effect.fn("PracticeKgTools.kg_find")(function* (request) {
        const rows = yield* queryPglite(
          sql,
          PracticeKgQueries.find,
          [likePattern(request.query)],
          decodePracticeKgGraphRows
        ).pipe(Effect.mapError(toolFailure("kg_find")));
        return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }),
      corpus_search_text: Effect.fn("PracticeKgTools.corpus_search_text")(function* (request) {
        const rows = yield* duckdb
          .query(PracticeKgQueries.searchText, [request.query, request.family ?? null, request.limit])
          .pipe(
            Effect.mapError(failureOf("store-query-failed")),
            Effect.flatMap(decodeRows(decodePracticeKgDocumentRows)),
            Effect.map(addPracticeKgCorpusPointers(bundle.corpusRoot, path)),
            Effect.mapError(toolFailure("corpus_search_text"))
          );
        return projectRows(A.map(rows, toToolRecord), practiceKgDocumentFieldTiers, request.budgetBytes, version);
      }),
      corpus_get_document: Effect.fn("PracticeKgTools.corpus_get_document")(function* (request) {
        const rows = yield* duckdb
          .query(PracticeKgQueries.getDocument, [
            request.digest ?? null,
            request.organized_path ?? null,
            request.range.start,
            request.range.length,
          ])
          .pipe(
            Effect.mapError(failureOf("store-query-failed")),
            Effect.flatMap(decodeRows(decodePracticeKgDocumentRows)),
            Effect.map(addPracticeKgCorpusPointers(bundle.corpusRoot, path)),
            Effect.mapError(toolFailure("corpus_get_document"))
          );
        return projectRows(A.map(rows, toToolRecord), practiceKgDocumentFieldTiers, request.budgetBytes, version);
      }),
      email_search: Effect.fn("PracticeKgTools.email_search")(function* (request) {
        const rows = yield* duckdb
          .query(PracticeKgQueries.email, [
            likePattern(request.query),
            likePattern(request.sender),
            request.after ?? null,
            request.before ?? null,
            likePattern(request.family),
          ])
          .pipe(
            Effect.mapError(failureOf("store-query-failed")),
            Effect.flatMap(decodeRows(decodePracticeKgEmailRows)),
            Effect.mapError(toolFailure("email_search"))
          );
        return projectRows(
          A.map(rows, toToolRecord),
          practiceKgEmailFieldTiers,
          request.budgetBytes,
          version,
          emailLinkageNote
        );
      }),
      kg_candidate_claims: Effect.fn("PracticeKgTools.kg_candidate_claims")(
        function* (request) {
          const tables = yield* sql.unsafe(PracticeKgQueries.claimsTableProbe);
          if (A.length(tables) < 2) {
            return PracticeKgCandidateClaimsNotLoadedResult.make({
              available: false,
              bundle_version: version,
              epistemic_status: candidateStatus,
              reason: "claims batch not yet loaded",
            });
          }
          const rows = yield* queryPglite(
            sql,
            PracticeKgQueries.candidateClaims,
            [request.docket ?? null, request.family ?? null, request.digest ?? null],
            decodePracticeKgCandidateClaimRows
          );
          return projectRows(
            A.map(rows, toToolRecord),
            practiceKgCandidateClaimFieldTiers,
            request.budgetBytes,
            version,
            undefined,
            candidateStatus
          );
        },
        Effect.mapError(toolFailure("kg_candidate_claims"))
      ),
      kg_matter_lookup: Effect.fn("PracticeKgTools.kg_matter_lookup")(
        function* (request) {
          const result = yield* lookupPracticeKgMatters(
            PracticeKgMatterLookupRequest.make({ reference: request.reference })
          ).pipe(Effect.provideService(DuckDb, duckdb), Effect.provideService(PracticeKgBundle, bundle));
          const rows = A.flatMap(result.matters, (matter) => {
            const shared = {
              attributionSource: matter.attributionSource,
              client: matter.client,
              clientName: matter.clientName,
              family: matter.family,
              familyKey: matter.familyKey,
              matchedOn: matter.matchedOn,
              resolution: result.resolution,
            };
            return A.isReadonlyArrayNonEmpty(matter.dockets)
              ? A.map(matter.dockets, (docket) =>
                  PracticeKgMatterToolRow.make({
                    ...shared,
                    applications: A.join(docket.applicationNumbers, " | "),
                    docket: docket.docket,
                    docketKey: docket.docketKey,
                    docketMatched: docket.matched,
                    documentCount: docket.documentCount,
                    epistemicStatus: docket.epistemicStatus,
                    patents: A.join(docket.patentNumbers, " | "),
                  })
                )
              : [
                  PracticeKgMatterToolRow.make({
                    ...shared,
                    applications: "",
                    docket: null,
                    docketKey: null,
                    docketMatched: false,
                    documentCount: matter.documentCount,
                    epistemicStatus: matter.epistemicStatus,
                    patents: "",
                  }),
                ];
          });
          return projectRows(
            A.map(rows, toToolRecord),
            practiceKgMatterFieldTiers,
            request.budgetBytes,
            version,
            `${matterLookupNote} resolution: ${result.resolution}.`
          );
        },
        Effect.mapError(toolFailure("kg_matter_lookup"))
      ),
      kg_correspondent_lookup: Effect.fn("PracticeKgTools.kg_correspondent_lookup")(
        function* (request) {
          const result = yield* lookupPracticeKgCorrespondents(
            PracticeKgCorrespondentLookupRequest.make({ address: request.address })
          ).pipe(Effect.provideService(DuckDb, duckdb), Effect.provideService(PracticeKgBundle, bundle));
          return projectRows(
            A.map(correspondentRows(result), toToolRecord),
            practiceKgCorrespondentFieldTiers,
            request.budgetBytes,
            version,
            `${correspondentLookupNote} resolution: ${result.resolution}.${
              result.familyKey === null ? "" : ` decided matter: ${result.familyKey}.`
            }`
          );
        },
        Effect.mapError(
          (cause): PracticeKgToolError =>
            isAddressError(cause)
              ? PracticeKgToolError.make({
                  message: cause.message,
                  reason: "invalid-input",
                  tool: "kg_correspondent_lookup",
                })
              : toolFailure("kg_correspondent_lookup")(cause)
        )
      ),
      kg_provenance: Effect.fn("PracticeKgTools.kg_provenance")(
        function* (request) {
          const hasKey = request.iri !== undefined || request.natural_key !== undefined || request.digest !== undefined;
          if (!hasKey) {
            const statusRow = PracticeKgGraphToolRow.make({
              attributionSource: null,
              client: null,
              count: bundle.manifest.counts.nodes,
              docketFamily: null,
              epistemicStatus: spineStatus,
              iri: "",
              kind: "bundle",
              label: bundle.manifest.builtAt,
              naturalKey: version,
              provenanceKind: "bundle-manifest",
              provenanceRef: version,
            });
            return projectRows([toToolRecord(statusRow)], practiceKgGraphFieldTiers, request.budgetBytes, version);
          }
          if (request.digest !== undefined) {
            const documents = yield* duckdb
              .query(PracticeKgQueries.provenanceDocument, [request.digest])
              .pipe(
                Effect.mapError(failureOf("store-query-failed")),
                Effect.flatMap(decodeRows(decodePracticeKgDocumentRows)),
                Effect.map(addPracticeKgCorpusPointers(bundle.corpusRoot, path))
              );
            return projectRows(
              A.map(documents, toToolRecord),
              practiceKgDocumentFieldTiers,
              request.budgetBytes,
              version,
              A.isReadonlyArrayNonEmpty(documents) ? undefined : provenanceNotFoundNote
            );
          }
          const rows = yield* queryPglite(
            sql,
            PracticeKgQueries.provenance,
            [request.iri ?? null, request.natural_key ?? null, null],
            decodePracticeKgGraphRows
          );
          return projectRows(
            A.map(rows, toToolRecord),
            practiceKgGraphFieldTiers,
            request.budgetBytes,
            version,
            A.isReadonlyArrayNonEmpty(rows) ? nodeProvenanceNote : provenanceNotFoundNote
          );
        },
        Effect.mapError(toolFailure("kg_provenance"))
      ),
    });
  })
);
