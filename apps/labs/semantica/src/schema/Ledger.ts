import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import { $SemanticaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { SourceDocument } from "@/schema/Document";
import { ExtractOutcome } from "@/schema/Evidence";
import { RunId } from "@/schema/Ids";
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
export class LedgerDocumentSnapshot extends S.Class<LedgerDocumentSnapshot>($I`LedgerDocumentSnapshot`)(
  {
    canonical: S.OptionFromNullOr(ResolvedSourceText),
    chunks: S.Array(Chunk),
    document: SourceDocument,
    outcome: ParseOutcome,
  },
  $I.annote("LedgerDocumentSnapshot", {
    description: "One ledger document with its parse outcome, optional canonical text, and verified chunks.",
  })
) {}

/**
 * Minimal append-only C0 read model consumed by the evaluator.
 *
 * **Details**
 *
 * Extracted batches retain claims and degraded claims per lane; document rows
 * retain every parse outcome, including expected malformed F1 fixtures.
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
export class LedgerSnapshot extends S.Class<LedgerSnapshot>($I`LedgerSnapshot`)(
  {
    batches: S.Array(ExtractOutcome),
    documents: S.Array(LedgerDocumentSnapshot),
    events: S.Array(ProvenanceEvent),
    run: RunId,
  },
  $I.annote("LedgerSnapshot", {
    description: "Evaluator read model containing document outcomes, chunks, lane batches, claims, and events.",
  })
) {}
