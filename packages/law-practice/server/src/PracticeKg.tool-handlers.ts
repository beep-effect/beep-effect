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
  PracticeKgGraphToolRow,
  PracticeKgToolError,
  PracticeKgToolkit,
  PracticeKgToolResult,
  practiceKgCandidateClaimFieldTiers,
  practiceKgDocumentFieldTiers,
  practiceKgEmailFieldTiers,
  practiceKgFamilyFieldTiers,
  practiceKgGraphFieldTiers,
} from "@beep/law-practice-use-cases/server";
import { estimateJsonSize, FieldTierName, projectFieldTier, toColumnarEnvelope } from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import * as OptionUtils from "@beep/utils/Option";
import { Effect, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { SqlClient as SqlClientService } from "effect/unstable/sql/SqlClient";
import { PracticeKgBundle } from "./PracticeKg.host.ts";
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
import type { FieldTierSet } from "@beep/mcp-kit";
import type { Layer } from "effect";
import type * as S from "effect/Schema";
import type * as Tool from "effect/unstable/ai/Tool";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

const spineStatus = PracticeKgEpistemicStatus.Enum["derived-from-official-records"];
const candidateStatus = PracticeKgEpistemicStatus.Enum["candidate-unreviewed"];
const emailLinkageNote =
  "Matter linkage is archive-level confidence only; a matching message header is not message-level matter proof.";
const tierOrder = A.reverse(FieldTierName.Options);

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
    ...OptionUtils.getSomesStruct({ note: O.fromUndefinedOr(note) }),
    total: NonNegativeInt.make(A.length(rows)),
  };
  return A.findFirst(tierOrder, (tier) => {
    const data = toColumnarEnvelope(A.map(rows, projectFieldTier(tier, tiers)));
    return estimateJsonSize(data) <= budgetBytes ? O.some({ data, tier }) : O.none();
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
        });
      },
      onSome: ({ data, tier }) => PracticeKgToolResult.make({ ...shared, data, tier, truncated: false }),
    })
  );
};

const toolFailure =
  (tool: string) =>
  (_cause: unknown): PracticeKgToolError =>
    PracticeKgToolError.make({ message: "Practice knowledge-graph bundle query failed.", tool });

const queryPglite = <A>(
  sql: SqlClient.SqlClient,
  statement: string,
  parameters: ReadonlyArray<unknown>,
  decode: (input: unknown) => Effect.Effect<ReadonlyArray<A>, unknown>
): Effect.Effect<ReadonlyArray<A>, PracticeKgToolError> =>
  sql.unsafe(statement, parameters).pipe(Effect.flatMap(decode), Effect.mapError(toolFailure("pglite")));

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
 * import { Layer } from "effect"
 *
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
            Effect.flatMap(decodePracticeKgDocumentRows),
            Effect.map((rows) => addPracticeKgCorpusPointers(rows, bundle.corpusRoot, path)),
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
            Effect.flatMap(decodePracticeKgDocumentRows),
            Effect.map((rows) => addPracticeKgCorpusPointers(rows, bundle.corpusRoot, path)),
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
          .pipe(Effect.flatMap(decodePracticeKgEmailRows), Effect.mapError(toolFailure("email_search")));
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
      kg_provenance: Effect.fn("PracticeKgTools.kg_provenance")(
        function* (request) {
          const hasKey = request.iri !== undefined || request.natural_key !== undefined || request.digest !== undefined;
          if (!hasKey) {
            const statusRow = PracticeKgGraphToolRow.make({
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
            const documents = yield* duckdb.query(PracticeKgQueries.provenanceDocument, [request.digest]).pipe(
              Effect.flatMap(decodePracticeKgDocumentRows),
              Effect.map((rows) => addPracticeKgCorpusPointers(rows, bundle.corpusRoot, path))
            );
            return projectRows(
              A.map(documents, toToolRecord),
              practiceKgDocumentFieldTiers,
              request.budgetBytes,
              version
            );
          }
          const rows = yield* queryPglite(
            sql,
            PracticeKgQueries.provenance,
            [request.iri ?? null, request.natural_key ?? null, null],
            decodePracticeKgGraphRows
          );
          return projectRows(A.map(rows, toToolRecord), practiceKgGraphFieldTiers, request.budgetBytes, version);
        },
        Effect.mapError(toolFailure("kg_provenance"))
      ),
    });
  })
);
