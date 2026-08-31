import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type * as A from "effect/Array";
import type * as O from "effect/Option";
import type { SourceDocument } from "@/schema/Document";
import type { LedgerFailed } from "@/schema/Errors";
import type { ExtractOutcome } from "@/schema/Evidence";
import type { RunId } from "@/schema/Ids";
import type { LedgerSnapshot } from "@/schema/Ledger";
import type { ProvenanceEvent } from "@/schema/Provenance";
import type { CanonicalText, Chunk, ParseOutcome } from "@/schema/Text";

const $I = $SemanticaId.create("services/Ledger");

/**
 * Append-only document, extraction, and evaluator read contract.
 *
 * @category services
 * @since 0.0.0
 */
interface LedgerShape {
  readonly appendBatch: (
    outcome: ExtractOutcome,
    events: A.NonEmptyReadonlyArray<ProvenanceEvent>
  ) => Effect.Effect<void, LedgerFailed>;
  readonly appendDocument: (
    document: SourceDocument,
    outcome: ParseOutcome,
    canonical: O.Option<CanonicalText>,
    chunks: ReadonlyArray<Chunk>,
    events: A.NonEmptyReadonlyArray<ProvenanceEvent>
  ) => Effect.Effect<void, LedgerFailed>;
  readonly read: (run: RunId) => Effect.Effect<LedgerSnapshot, LedgerFailed>;
}

/**
 * App-local append-only C0 ledger.
 *
 * **Example** (Access the ledger)
 *
 * ```ts
 * import { Ledger } from "@/services/Ledger"
 * import { Effect } from "effect"
 *
 * const program = Ledger.pipe(Effect.map((service) => typeof service.read))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Ledger extends Context.Service<Ledger, LedgerShape>()($I`Ledger`) {}
