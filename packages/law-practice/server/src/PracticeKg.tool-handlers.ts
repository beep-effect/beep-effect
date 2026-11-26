/**
 * Injected read handlers for the practice knowledge-graph MCP toolkit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import {
  ClaimInspection,
  ClaimInspectionPageRequest,
  ClaimSelfCheck,
  ClaimSelfCheckLive,
  UsptoClaimInputs,
  UsptoClaims,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { LawPrincipal, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import {
  ClaimSelfCheckReviewRequest,
  claimInspectInput,
  claimSelfCheckReview,
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
import { thunkEffectVoid } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { SqlClient as SqlClientService } from "effect/sql/SqlClient";
import { ClaimInspectionWithLexicalEvidenceLive } from "./ClaimInspection/ClaimInspection.layer.ts";
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
import { practiceKgReadScopeOf } from "./PracticeKg.wall.ts";
import type {
  PracticeKgCorrespondentLink,
  PracticeKgCorrespondentLookupResult,
  PracticeKgCorrespondentRowResolution,
  PracticeKgToolFailureReason,
} from "@beep/law-practice-use-cases/server";
import type { FieldTierSet } from "@beep/mcp-kit";
import type { WinkIntrinsicNounActivationError } from "@beep/wink";
import type * as Tool from "effect/ai/Tool";
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

const linksNamingMatterElseClientOnlyWhenFamilyKeyNull =
  (links: ReadonlyArray<PracticeKgCorrespondentLink>) => (familyKey: string | null, clientNumber: string | null) =>
    A.filter(links, (link) =>
      familyKey === null ? link.familyKey === null && link.clientNumber === clientNumber : link.familyKey === familyKey
    );

const onlyDecidedRowSaysUniqueSiblingsAreCandidates = (
  result: PracticeKgCorrespondentLookupResult,
  decided: boolean
): PracticeKgCorrespondentRowResolution =>
  decided ? "unique" : result.resolution === "unique" ? "candidate" : result.resolution;

const rowPerTiedMatterCandidatesInRankThenLinkOnly = (
  result: PracticeKgCorrespondentLookupResult
): ReadonlyArray<PracticeKgCorrespondentToolRow> => {
  const contact = A.length(result.contacts) === 1 ? A.head(result.contacts) : O.none();
  const linked = linksNamingMatterElseClientOnlyWhenFamilyKeyNull(result.links);
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
      resolution: onlyDecidedRowSaysUniqueSiblingsAreCandidates(result, decided),
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
  const [decided, undecided] = A.partition(
    A.appendAll(
      A.map(result.candidates, (candidate) => row(candidate.familyKey, candidate.client, candidate)),
      A.map(linkOnly, (link) => row(link.familyKey, link.clientNumber, noCounts))
    ),
    (entry) => (entry.decided ? Result.succeed(entry) : Result.fail(entry))
  );
  const decidedRowLeadsSoAOneRowBudgetKeepsIt = A.appendAll(decided, undecided);
  return decidedRowLeadsSoAOneRowBudgetKeepsIt;
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

/**
 * Span attribute key that carries a failed tool call's
 * {@link PracticeKgToolFailureReason} on the `PracticeKgTools.<tool>` span.
 *
 * **Details**
 *
 * Tools return their failures as results, so a failed call would otherwise
 * look like a success to telemetry. The value is always a literal reason,
 * never the failure message.
 *
 * **Example** (Read the failure reason key)
 *
 * ```ts
 * import { PracticeKgFailureReasonKey } from "@beep/law-practice-server"
 *
 * console.log(PracticeKgFailureReasonKey) // "beep.practice_kg.failure_reason"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgFailureReasonKey = "beep.practice_kg.failure_reason";

const stampFailureReasonOnHandlerSpan = <A, R>(
  self: Effect.Effect<A, PracticeKgToolError, R>
): Effect.Effect<A, PracticeKgToolError, R> =>
  Effect.tapError(self, (error) =>
    O.match(O.fromUndefinedOr(error.reason), {
      onNone: thunkEffectVoid,
      onSome: (reason) => Effect.annotateCurrentSpan(PracticeKgFailureReasonKey, reason),
    })
  );

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

const stampToolNameKeepingCauseReasonElseStoreFault =
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
 * Local claim checks with public-document acquisition explicitly unavailable.
 *
 * **Details**
 * The read-only toolkit uses this composition for caller-supplied claims and
 * source ledgers. Both published-source methods fail through their typed port
 * errors; this layer requires no HTTP client or external credentials.
 *
 * **Example** (Compose local claim checks)
 * ```ts
 * import { PracticeKgLocalClaimChecksLive } from "@beep/law-practice-server"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(PracticeKgLocalClaimChecksLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgLocalClaimChecksLive: Layer.Layer<
  ClaimSelfCheck | ClaimInspection,
  WinkIntrinsicNounActivationError
> = Layer.merge(
  ClaimSelfCheckLive.pipe(
    Layer.provide(
      Layer.succeed(UsptoClaims, {
        claims: Effect.fn("ClaimSelfCheckLocal.publicClaimsUnavailable")(() =>
          Effect.fail(
            UsptoClaimsError.make({
              reason: "unavailable",
              message: "This local review tool accepts supplied claims and does not fetch USPTO documents.",
            })
          )
        ),
      })
    )
  ),
  ClaimInspectionWithLexicalEvidenceLive.pipe(
    Layer.provide(
      Layer.succeed(UsptoClaimInputs, {
        inputs: Effect.fn("ClaimInspectionLocal.publicInputsUnavailable")(() =>
          Effect.fail(
            UsptoClaimsError.make({
              reason: "unavailable",
              message: "This local inspection tool accepts supplied source records and does not fetch USPTO documents.",
            })
          )
        ),
      })
    )
  )
);

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
  WinkIntrinsicNounActivationError,
  DuckDb | LawPrincipal | MatterAuthority | Path.Path | PracticeKgBundle | SqlClientService
> = PracticeKgToolkit.toLayer(
  Effect.gen(function* () {
    const selfCheck = yield* ClaimSelfCheck;
    const inspection = yield* ClaimInspection;
    const bundle = yield* PracticeKgBundle;
    const duckdb = yield* DuckDb;
    const sql = (yield* SqlClientService).withoutTransforms();
    const path = yield* Path.Path;
    const version = bundle.manifest.bundleVersion;
    const { principal } = yield* LawPrincipal;
    const authority = yield* MatterAuthority;
    const readScope = Effect.map(authority.grantedScopes(principal), practiceKgReadScopeOf);

    return PracticeKgToolkit.of({
      kg_clients: Effect.fn("PracticeKgTools.kg_clients")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* queryPglite(sql, PracticeKgQueries.clients(scope), [], decodePracticeKgGraphRows).pipe(
          Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_clients"))
        );
        return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }, stampFailureReasonOnHandlerSpan),
      kg_docket_family: Effect.fn("PracticeKgTools.kg_docket_family")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* queryPglite(
          sql,
          PracticeKgQueries.family(scope),
          [request.family],
          decodePracticeKgFamilyRows
        ).pipe(Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_docket_family")));
        return projectRows(A.map(rows, toToolRecord), practiceKgFamilyFieldTiers, request.budgetBytes, version);
      }, stampFailureReasonOnHandlerSpan),
      kg_application_lookup: Effect.fn("PracticeKgTools.kg_application_lookup")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* queryPglite(
          sql,
          PracticeKgQueries.application(scope),
          [request.application_number ?? null, request.patent_number ?? null, request.docket ?? null],
          decodePracticeKgGraphRows
        ).pipe(Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_application_lookup")));
        return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }, stampFailureReasonOnHandlerSpan),
      kg_find: Effect.fn("PracticeKgTools.kg_find")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* queryPglite(
          sql,
          PracticeKgQueries.find(scope),
          [likePattern(request.query)],
          decodePracticeKgGraphRows
        ).pipe(Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_find")));
        return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
      }, stampFailureReasonOnHandlerSpan),
      corpus_search_text: Effect.fn("PracticeKgTools.corpus_search_text")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* duckdb
          .query(PracticeKgQueries.searchText(scope), [request.query, request.family ?? null, request.limit])
          .pipe(
            Effect.mapError(failureOf("store-query-failed")),
            Effect.flatMap(decodeRows(decodePracticeKgDocumentRows)),
            Effect.mapBoth({
              onFailure: stampToolNameKeepingCauseReasonElseStoreFault("corpus_search_text"),
              onSuccess: addPracticeKgCorpusPointers(bundle.corpusRoot, path),
            })
          );
        return projectRows(A.map(rows, toToolRecord), practiceKgDocumentFieldTiers, request.budgetBytes, version);
      }, stampFailureReasonOnHandlerSpan),
      corpus_get_document: Effect.fn("PracticeKgTools.corpus_get_document")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* duckdb
          .query(PracticeKgQueries.getDocument(scope), [
            request.digest ?? null,
            request.organized_path ?? null,
            request.range.start,
            request.range.length,
          ])
          .pipe(
            Effect.mapError(failureOf("store-query-failed")),
            Effect.flatMap(decodeRows(decodePracticeKgDocumentRows)),
            Effect.mapBoth({
              onFailure: stampToolNameKeepingCauseReasonElseStoreFault("corpus_get_document"),
              onSuccess: addPracticeKgCorpusPointers(bundle.corpusRoot, path),
            })
          );
        return projectRows(A.map(rows, toToolRecord), practiceKgDocumentFieldTiers, request.budgetBytes, version);
      }, stampFailureReasonOnHandlerSpan),
      email_search: Effect.fn("PracticeKgTools.email_search")(function* (request) {
        const scope = yield* readScope;
        const rows = yield* duckdb
          .query(PracticeKgQueries.email(scope), [
            likePattern(request.query),
            likePattern(request.sender),
            request.after ?? null,
            request.before ?? null,
            likePattern(request.family),
          ])
          .pipe(
            Effect.mapError(failureOf("store-query-failed")),
            Effect.flatMap(decodeRows(decodePracticeKgEmailRows)),
            Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("email_search"))
          );
        return projectRows(
          A.map(rows, toToolRecord),
          practiceKgEmailFieldTiers,
          request.budgetBytes,
          version,
          emailLinkageNote
        );
      }, stampFailureReasonOnHandlerSpan),
      claim_self_check: Effect.fn("PracticeKgTools.claim_self_check")((request) =>
        claimSelfCheckReview(ClaimSelfCheckReviewRequest.make(request)).pipe(
          Effect.provideService(ClaimSelfCheck, selfCheck)
        )
      ),
      claim_inspect_input: Effect.fn("PracticeKgTools.claim_inspect_input")((request) =>
        claimInspectInput(ClaimInspectionPageRequest.make(request)).pipe(
          Effect.provideService(ClaimInspection, inspection)
        )
      ),
      kg_candidate_claims: Effect.fn("PracticeKgTools.kg_candidate_claims")(
        function* (request) {
          const scope = yield* readScope;
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
            PracticeKgQueries.candidateClaims(scope),
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
        Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_candidate_claims")),
        stampFailureReasonOnHandlerSpan
      ),
      kg_matter_lookup: Effect.fn("PracticeKgTools.kg_matter_lookup")(
        function* (request) {
          const scope = yield* readScope;
          const result = yield* lookupPracticeKgMatters(
            PracticeKgMatterLookupRequest.make({ reference: request.reference }),
            scope
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
        Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_matter_lookup")),
        stampFailureReasonOnHandlerSpan
      ),
      kg_correspondent_lookup: Effect.fn("PracticeKgTools.kg_correspondent_lookup")(
        function* (request) {
          const scope = yield* readScope;
          const result = yield* lookupPracticeKgCorrespondents(
            PracticeKgCorrespondentLookupRequest.make({ address: request.address }),
            scope
          ).pipe(Effect.provideService(DuckDb, duckdb), Effect.provideService(PracticeKgBundle, bundle));
          return projectRows(
            A.map(rowPerTiedMatterCandidatesInRankThenLinkOnly(result), toToolRecord),
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
              : stampToolNameKeepingCauseReasonElseStoreFault("kg_correspondent_lookup")(cause)
        ),
        stampFailureReasonOnHandlerSpan
      ),
      kg_provenance: Effect.fn("PracticeKgTools.kg_provenance")(
        function* (request) {
          const scope = yield* readScope;
          const hasKey = request.iri !== undefined || request.natural_key !== undefined || request.digest !== undefined;
          if (!hasKey) {
            const statusRow = PracticeKgGraphToolRow.make({
              attributionSource: null,
              client: null,
              count: null,
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
              .query(PracticeKgQueries.provenanceDocument(scope), [request.digest])
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
            PracticeKgQueries.provenance(scope),
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
        Effect.mapError(stampToolNameKeepingCauseReasonElseStoreFault("kg_provenance")),
        stampFailureReasonOnHandlerSpan
      ),
    });
  })
).pipe(Layer.provide(PracticeKgLocalClaimChecksLive));
