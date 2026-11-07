/**
 * Per-hop denominators for `library status`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { libraryEffectiveCaptures, libraryEffectiveCategory } from "./Library.evidence.ts";
import { LibraryHopPolicy } from "./Library.hopPolicy.ts";
import { LibraryHopGateInput, libraryHopGate, libraryHopTwoOnly, libraryLiveConcepts } from "./Library.hops.ts";
import type { LibraryCatalog } from "./Library.schemas.ts";

/**
 * Per-hop totals: hop-0 documents, then identities and readable sources at hops 1 and 2.
 *
 * **Details**
 *
 * Hop 2 also reports how many identities are catalogued only and how the gate under the default
 * policy splits them into admitted and refused, with refusal reasons.
 *
 * **Example** (Prepare hop totals)
 *
 * ```ts
 * import { libraryHopTotals, LibraryCatalog } from "@beep/repo-cli/commands/Research"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(libraryHopTotals("/library", catalog).pipe !== undefined)
 * ```
 *
 * @param root - Directory holding the library catalog and objects.
 * @param catalog - Catalog whose derivations and captures are counted.
 * @param policy - Hop policy used for the gate preview.
 * @returns Printable status lines.
 * @category use-cases
 * @since 0.0.0
 */
export const libraryHopTotals = Effect.fn("Library.hopTotals")(function* (
  root: string,
  catalog: LibraryCatalog,
  policy: LibraryHopPolicy = LibraryHopPolicy.make({})
) {
  const at = (depth: number) =>
    A.dedupe(
      A.map(
        A.filter(catalog.derivations, (derivation) => derivation.hopDepth === depth),
        (derivation) => derivation.derivedId
      )
    );
  const readable = Effect.fnUntraced(function* (ids: ReadonlyArray<string>) {
    let count = 0;
    for (const id of ids) {
      const source = A.findFirst(catalog.sources, (item) => item.id === id);
      if (O.isNone(source)) continue;
      const current = yield* libraryEffectiveCaptures(root, catalog, source.value).pipe(Effect.orElseSucceed(A.empty));
      if (libraryEffectiveCategory(A.map(current, (claim) => claim.category)) === "readable") count++;
    }
    return count;
  });
  const hopOne = at(1);
  const hopTwo = at(2);
  const cataloguedOnly = A.filter(
    hopTwo,
    (id) => libraryHopTwoOnly(catalog, id) && !A.some(catalog.captures, (capture) => capture.sourceId === id)
  );
  const concepts = yield* libraryLiveConcepts(policy);
  const decisions = libraryHopGate(catalog, LibraryHopGateInput.make({ concepts, policy }));
  const refused = A.filter(decisions, (decision) => !decision.admitted);
  const reasons = A.join(
    A.map(
      A.dedupe(A.map(refused, (decision) => decision.reason)),
      (reason) => `${reason}=${A.filter(refused, (decision) => decision.reason === reason).length}`
    ),
    " "
  );
  return [
    `hop 0: documents=${catalog.documents.length} citations=${catalog.occurrences.length}`,
    `hop 1: identities=${hopOne.length} readable=${yield* readable(hopOne)}`,
    `hop 2: identities=${hopTwo.length} readable=${yield* readable(hopTwo)} cataloguedOnly=${cataloguedOnly.length} gateAdmitted=${decisions.length - refused.length} gateRefused=${refused.length}${reasons === "" ? "" : ` (${reasons})`}`,
  ];
});
