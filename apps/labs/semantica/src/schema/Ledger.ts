import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import { $SemanticaId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SourceDocument } from "@/schema/Document";
import { ExtractOutcome } from "@/schema/Evidence";
import { RunId } from "@/schema/Ids";
import { LegacyConfidenceImport } from "@/schema/LedgerEvidence";
import { ProvenanceEvent } from "@/schema/Provenance";
import { Chunk, ParseOutcome } from "@/schema/Text";

const $I = $SemanticaId.create("schema/Ledger");

/**
 * Persisted parse-stage state for one source document.
 *
 * **Example** (Inspect snapshot fields)
 *
 * ```ts
 * import { LedgerDocumentSnapshot } from "@/schema/Ledger"
 *
 * console.log(LedgerDocumentSnapshot.fields.chunks !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerDocumentSnapshot extends S.Opaque<LedgerDocumentSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    canonical: S.OptionFromNullOr(ResolvedSourceText),
    chunks: S.Array(Chunk),
    document: SourceDocument,
    outcome: ParseOutcome,
  }).pipe(
    $I.annoteSchema("LedgerDocumentSnapshot", {
      description: "One ledger document with its parse outcome, optional canonical text, and verified chunks.",
    })
  )
) {}

/**
 * Minimal append-only C0 read model consumed by the evaluator.
 *
 * **Details**
 *
 * Extracted batches retain claims and degraded claims per lane; document rows
 * retain every parse outcome, including expected malformed F1 fixtures.
 * `legacyConfidence` keeps the stored scalar of every claim read from a
 * `ledger-evidence/v1` row, whose projected signal is absent `legacy-unknown`.
 *
 * **Example** (Inspect the run field)
 *
 * ```ts
 * import { LedgerSnapshot } from "@/schema/Ledger"
 *
 * console.log(LedgerSnapshot.fields.run !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerSnapshot extends S.Opaque<LedgerSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    batches: S.Array(ExtractOutcome),
    documents: S.Array(LedgerDocumentSnapshot),
    events: S.Array(ProvenanceEvent),
    legacyConfidence: S.Array(LegacyConfidenceImport).pipe(S.withConstructorDefault(Effect.succeed([]))),
    run: RunId,
  }).pipe(
    $I.annoteSchema("LedgerSnapshot", {
      description: "Evaluator read model containing document outcomes, chunks, lane batches, claims, and events.",
    })
  )
) {}
