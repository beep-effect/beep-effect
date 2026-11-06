/**
 * Source-bound published inspection result, separate from the strict self-check.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ClaimInputCollection, ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";
import * as S from "effect/Schema";
import { UsptoClaimInputSet } from "./ClaimSelfCheck.schemas.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimInspection.schemas");
const sameInput = S.toEquivalence(ClaimInputCollection);

/**
 * Inspection paired with its exact acquired source identity, bytes digest and complete input ledger.
 *
 * **Example** (Inspect provenance fields)
 * ```ts
 * import { PublishedClaimInspectionReport } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(Object.keys(PublishedClaimInspectionReport.fields)) // ["source", "report"]
 * ```
 * @category models
 * @since 0.0.0
 */
export class PublishedClaimInspectionReport extends S.Opaque<
  PublishedClaimInspectionReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({ source: UsptoClaimInputSet, report: ClaimInputInspectionReport })
    .check(
      S.makeFilter(
        ({ source, report }) => sameInput(source.input, report.input),
        $I.annote("PublishedClaimInspectionSourceCheck", {
          title: "Exact acquired inspection input",
          description:
            "The inspection ledger is exactly the source ledger bound to the acquired document and byte digest.",
          message: "Published inspection must retain the acquired source input without substitutions.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("PublishedClaimInspectionReport", {
        description: "Complete public-source provenance alongside advisory findings and explicit per-record coverage.",
      })
    )
) {}
