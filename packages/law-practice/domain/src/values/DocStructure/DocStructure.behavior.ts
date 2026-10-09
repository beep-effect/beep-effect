/**
 * Clean-room v1 paired OA recognition using raw UTF-16 regex indices.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DocStructureAbstention, OfficeActionRawPair, officeActionRuleV1 } from "./DocStructure.model.ts";
import type {
  DocStructureAbstentionCode,
  DocStructureRuleFamily,
  DocStructureSourceModality,
  OfficeActionRawOutcome,
} from "./DocStructure.model.ts";

const $I = $LawPracticeDomainId.create("values/DocStructure/DocStructure.behavior");
const FinalityPattern = /(?:THIS\s+ACTION\s+IS\s+MADE\s+FINAL\b|This\s+action\s+is\s+(?:FINAL|NON-FINAL)\.)/dg;
const PeriodPattern =
  /A\s+(?:shortened\s+statutory\s+period\s+for\s+reply\s+to\s+this\s+(?:final|ﬁnal)\s+action\s+is\s+set\s+to\s+expire\s+THREE\s+MONTHS\s+from\s+the\s+mailing\s+date\s+of\s+this\s+action|SHORTENED\s+STATUTORY\s+PERIOD\s+FOR\s+REPLY\s+IS\s+SET\s+TO\s+EXPIRE\s+THREE\s+MONTHS\s+FROM\s+THE\s+MAILING\s+DATE\s+OF\s+THIS\s+COMMUNICATION)\./dg;
const Unsupported = S.String.check(
  S.isPattern(/^(?:Notice of Allowance|Restriction Requirement|Advisory Action)/u, {
    identifier: $I`UnsupportedCheck`,
    title: "Unsupported form",
    description: "Unsupported notice instead of an action pair.",
  })
);
const NonOperative = S.String.check(
  S.isPattern(/(?:^|\n)(?:Footer \(historical\):|Quoted history:|Attachment:)/u, {
    identifier: $I`NonOperativeCheck`,
    title: "NonOperative form",
    description: "A historical footer or attachment cannot authorize current evidence.",
  })
);
const Uncovered = S.String.check(
  S.isPattern(/Unknown procedural|FI\u200bNAL|SHORTENED STATUTORY PERIOD[^.]*?(?:ELEVEN|\[period\])/u, {
    identifier: $I`UncoveredCheck`,
    title: "Uncovered form",
    description: "Procedural or damaged text outside the covered v1 forms.",
  })
);
const MissingCheckbox = S.String.check(
  S.isPattern(/\[ \] FINAL \[ \] NON-FINAL/u, {
    identifier: $I`MissingCheckboxCheck`,
    title: "MissingCheckbox form",
    description: "Flattened empty checkboxes do not preserve selection.",
  })
);
const isUnsupported = S.is(Unsupported);
const isNonOperative = S.is(NonOperative);
const isUncovered = S.is(Uncovered);
const isMissingCheckbox = S.is(MissingCheckbox);

const anchorFromMatch = (text: string, match: RegExpMatchArray): O.Option<TextAnchor> =>
  O.fromUndefinedOr(match.indices).pipe(
    O.flatMap(A.head),
    O.flatMap(O.fromUndefinedOr),
    O.map(([startChar, endChar]) =>
      TextAnchor.make({
        startChar: S.Natural.make(startChar),
        endChar: S.Natural.make(endChar),
        quote: Str.slice(startChar, endChar)(text),
      })
    )
  );

/**
 * Recognizes only the covered v1 pair using raw half-open UTF-16 regex match indices.
 *
 * **Example** (Inspect recognizeOfficeActionPair)
 *
 * ```ts
 * import { recognizeOfficeActionPair } from "@beep/law-practice-domain"
 * console.log(recognizeOfficeActionPair("No action pair.", "direct-text").status) // "abstained"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const recognizeOfficeActionPair: {
  (text: string, modality: DocStructureSourceModality, rule?: DocStructureRuleFamily): OfficeActionRawOutcome;
  (modality: DocStructureSourceModality, rule?: DocStructureRuleFamily): (text: string) => OfficeActionRawOutcome;
} = dual(
  (args) => args.length >= 2 && P.isString(args[1]),
  (
    text: string,
    modality: DocStructureSourceModality,
    rule: DocStructureRuleFamily = officeActionRuleV1
  ): OfficeActionRawOutcome => {
    const abstain = (code: DocStructureAbstentionCode) => DocStructureAbstention.make({ code, rule });
    if (modality === "ocr-derived" || modality === "layout-derived") return abstain("low-quality-source");
    if (rule.version !== 1) return abstain("rule-not-covered");
    if (isUnsupported(text)) return abstain("unsupported");
    if (isNonOperative(text)) return abstain("absent");
    if (isMissingCheckbox(text)) return abstain("ambiguous");
    const finalities = A.fromIterable(Str.matchAll(FinalityPattern)(text));
    const periods = A.fromIterable(Str.matchAll(PeriodPattern)(text));
    if (A.length(finalities) > 1 || A.length(periods) > 1) return abstain("ambiguous");
    if (isUncovered(text)) return abstain("rule-not-covered");
    const pair = O.all({ finality: A.head(finalities), period: A.head(periods) }).pipe(
      O.flatMap(({ finality, period }) =>
        O.all({ finalityAnchor: anchorFromMatch(text, finality), periodAnchor: anchorFromMatch(text, period) })
      ),
      O.map(({ finalityAnchor, periodAnchor }) =>
        OfficeActionRawPair.make({
          finality: Str.includes("NON-FINAL")(finalityAnchor.quote) ? "NON-FINAL" : "FINAL",
          finalityAnchor,
          periodAnchor,
          rule,
        })
      )
    );
    return O.getOrElse(pair, () => abstain("absent"));
  }
);
