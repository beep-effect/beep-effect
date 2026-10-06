/**
 * Deterministic content hold-out and counts-only metrics.
 * @packageDocumentation
 * @since 0.0.0
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { fitTokenFilter, resolve } from "./Identification.resolver.ts";
import {
  ConfidenceTier,
  EvaluationCase,
  EvaluationReport,
  HoldOutSplit,
  IdentificationDocument,
  TierEvaluation,
} from "./Identification.schemas.ts";
import type { ResolverContext, TrainingDocument } from "./Identification.schemas.ts";

/**
 * Keeps all copies of each hash in one deterministic partition, with twenty percent hash buckets held out.
 * A document is held out when sha256 of `<salt>|<content hash>` is divisible by five; a fixed salt
 * reproduces an earlier split, a new salt draws a fresh one.
 * **Example** (Split no documents)
 *
 * ```ts
 * import { holdOutSplit } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(holdOutSplit([], "holdout").test.length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const holdOutSplit: {
  (salt: string): (documents: ReadonlyArray<TrainingDocument>) => HoldOutSplit;
  (documents: ReadonlyArray<TrainingDocument>, salt: string): HoldOutSplit;
} = dual(2, (documents: ReadonlyArray<TrainingDocument>, salt: string): HoldOutSplit => {
  const isTest = (d: TrainingDocument) =>
    BigInt(`0x${bytesToHex(sha256(utf8ToBytes(`${salt}|${d.document.contentHash}`)))}`) % BigInt(5) === BigInt(0);
  return HoldOutSplit.make({ train: A.filter(documents, (d) => !isTest(d)), test: A.filter(documents, isTest) });
});

/**
 * Counts held-out predictions per tier; a specified ground-truth docket must also match.
 * Undefined precision is represented by None when the tier resolved no documents.
 * **Example** (Evaluate no predictions)
 *
 * ```ts
 * import { evaluate } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(evaluate([], 0).tiers.length) // 5
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const evaluate: {
  (trainSize: number): (cases: ReadonlyArray<EvaluationCase>) => EvaluationReport;
  (cases: ReadonlyArray<EvaluationCase>, trainSize: number): EvaluationReport;
} = dual(
  2,
  (cases: ReadonlyArray<EvaluationCase>, trainSize: number): EvaluationReport =>
    EvaluationReport.make({
      trainSize,
      testSize: cases.length,
      tiers: A.map(ConfidenceTier.literals, (tier) => {
        const rows = A.filter(cases, (c) => c.resolution.tier === tier && O.isSome(c.resolution.clientNumber));
        const right = A.filter(
          rows,
          (c) =>
            O.exists(c.resolution.clientNumber, (client) => client === c.truth.clientNumber) &&
            O.match(c.truth.docket, { onNone: () => true, onSome: (d) => O.contains(d)(c.resolution.docket) })
        ).length;
        return TierEvaluation.make({
          tier,
          resolved: rows.length,
          right,
          wrong: rows.length - right,
          precision: rows.length === 0 ? O.none() : O.some(right / rows.length),
          coverage: cases.length === 0 ? 0 : rows.length / cases.length,
        });
      }),
    })
);

/**
 * Runs an honest hold-out: fits on train only and removes copy and folder signals before scoring test.
 * **Example** (Measure an empty collection)
 *
 * ```ts
 * import { evaluateHoldOut, ResolverContext } from "@beep/law-practice-use-cases/DocumentIdentification"
 * const context = ResolverContext.make({ clients: [], pairs: [], contacts: [], aliases: [], pseudoClients: [], excludedDomains: [] })
 * console.log(evaluateHoldOut([], context, "holdout").testSize) // 0
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateHoldOut: {
  (context: ResolverContext, salt: string): (documents: ReadonlyArray<TrainingDocument>) => EvaluationReport;
  (documents: ReadonlyArray<TrainingDocument>, context: ResolverContext, salt: string): EvaluationReport;
} = dual(3, (documents: ReadonlyArray<TrainingDocument>, context: ResolverContext, salt: string): EvaluationReport => {
  const split = holdOutSplit(documents, salt);
  const filter = fitTokenFilter(split.train, context);
  return evaluate(
    A.map(split.test, (truth) =>
      EvaluationCase.make({
        truth,
        resolution: resolve(
          IdentificationDocument.make({ ...truth.document, copies: [], sourcePath: "" }),
          context,
          filter
        ),
      })
    ),
    split.train.length
  );
});
