import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect, HashMap, HashSet, Layer, Number as N } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { digestOmitting } from "@/schema/Digest";
import { Origin } from "@/schema/Document";
import { ReportInvalid } from "@/schema/Errors";
import { DocumentOutcome, EvalReport, MetricScore, RequiredMetrics } from "@/schema/Eval";
import { ClaimBody, ExtractOutcome } from "@/schema/Evidence";
import { Evaluator } from "@/services/Evaluator";
import { GoldSource } from "@/services/GoldSource";
import type { CorpusPaperId } from "@/corpus/Manifest";
import type { DegradedKind } from "@/schema/Degraded";
import type { DocumentOutcome as DocumentOutcomeValue, EvalRun, MetricName, MetricSubset } from "@/schema/Eval";
import type {
  CoreferenceCluster,
  EvidenceClaim,
  ExtractionLane,
  ExtractOutcome as ExtractOutcomeValue,
} from "@/schema/Evidence";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";
import type { LedgerDocumentSnapshot, LedgerSnapshot } from "@/schema/Ledger";

type Coverage = readonly [document: LedgerDocumentSnapshot, gold: GoldFileValue];

/**
 * Mention key and normalized entity-cluster key consumed by coreference metrics.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityClusterAssignment = readonly [mention: string, cluster: string];

const reportInvalid = (message: string): ReportInvalid => ReportInvalid.make({ message });

const safeRatio = (numerator: number, denominator: number): number =>
  N.Equivalence(denominator, 0) ? 0 : N.divideUnsafe(numerator, denominator);

const f1FromCounts = (truePositive: number, predicted: number, gold: number): number => {
  if (N.Equivalence(predicted, 0) && N.Equivalence(gold, 0)) {
    return 1;
  }
  const precision = safeRatio(truePositive, predicted);
  const recall = safeRatio(truePositive, gold);
  return N.Equivalence(N.sum(precision, recall), 0)
    ? 0
    : N.divideUnsafe(N.multiply(2, N.multiply(precision, recall)), N.sum(precision, recall));
};

/**
 * Exact set F1 used by span, triple, and pairwise metrics.
 *
 * **Example** (Score two exact sets)
 *
 * ```ts
 * import { exactF1 } from "@/layers/EvaluatorLive"
 *
 * console.log(exactF1(["a", "b"], ["a", "c"])) // 0.5
 * ```
 *
 * @category evaluation
 * @since 0.0.0
 */
export const exactF1: {
  (gold: ReadonlyArray<string>): (predicted: ReadonlyArray<string>) => number;
  (predicted: ReadonlyArray<string>, gold: ReadonlyArray<string>): number;
} = dual(2, (predicted: ReadonlyArray<string>, gold: ReadonlyArray<string>): number => {
  const predictedSet = HashSet.fromIterable(predicted);
  const goldSet = HashSet.fromIterable(gold);
  return f1FromCounts(
    HashSet.size(HashSet.intersection(predictedSet, goldSet)),
    HashSet.size(predictedSet),
    HashSet.size(goldSet)
  );
});

const assignmentFor = (assignments: ReadonlyArray<EntityClusterAssignment>, mention: string, side: string): string =>
  A.findFirst(assignments, ([candidate]) => Str.Equivalence(candidate, mention)).pipe(
    O.map(([, cluster]) => cluster),
    O.getOrElse(() => `${side}:missing:${mention}`)
  );

const membersOf = (assignments: ReadonlyArray<EntityClusterAssignment>, cluster: string): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.map(
      A.filter(assignments, ([, candidate]) => Str.Equivalence(candidate, cluster)),
      ([mention]) => mention
    )
  );

/**
 * B-Cubed F1 over mention-to-cluster assignments.
 *
 * **Example** (Score identical clusters)
 *
 * ```ts
 * import { bCubedF1 } from "@/layers/EvaluatorLive"
 *
 * console.log(bCubedF1([["a", "one"]], [["a", "one"]])) // 1
 * ```
 *
 * @category evaluation
 * @since 0.0.0
 */
export const bCubedF1: {
  (gold: ReadonlyArray<EntityClusterAssignment>): (predicted: ReadonlyArray<EntityClusterAssignment>) => number;
  (predicted: ReadonlyArray<EntityClusterAssignment>, gold: ReadonlyArray<EntityClusterAssignment>): number;
} = dual(
  2,
  (predicted: ReadonlyArray<EntityClusterAssignment>, gold: ReadonlyArray<EntityClusterAssignment>): number => {
    const mentions = HashSet.union(
      HashSet.fromIterable(A.map(predicted, ([mention]) => mention)),
      HashSet.fromIterable(A.map(gold, ([mention]) => mention))
    );
    if (HashSet.size(mentions) === 0) {
      return 1;
    }
    const initialTotals: readonly [number, number] = [0, 0];
    const totals = A.reduce(A.fromIterable(mentions), initialTotals, ([precision, recall], mention) => {
      const predictedCluster = assignmentFor(predicted, mention, "predicted");
      const goldCluster = assignmentFor(gold, mention, "gold");
      const predictedMembers = membersOf(A.append(predicted, [mention, predictedCluster]), predictedCluster);
      const goldMembers = membersOf(A.append(gold, [mention, goldCluster]), goldCluster);
      const overlap = HashSet.size(HashSet.intersection(predictedMembers, goldMembers));
      return [
        N.sum(precision, safeRatio(overlap, HashSet.size(predictedMembers))),
        N.sum(recall, safeRatio(overlap, HashSet.size(goldMembers))),
      ] as const;
    });
    const precision = safeRatio(totals[0], HashSet.size(mentions));
    const recall = safeRatio(totals[1], HashSet.size(mentions));
    return N.Equivalence(N.sum(precision, recall), 0)
      ? 0
      : N.divideUnsafe(N.multiply(2, N.multiply(precision, recall)), N.sum(precision, recall));
  }
);

const pairKeys = (assignments: ReadonlyArray<EntityClusterAssignment>): ReadonlyArray<string> => {
  const pairs: Array<string> = [];
  const unique = A.dedupeWith(assignments, ([left], [right]) => Str.Equivalence(left, right));
  for (let left = 0; left < A.length(unique); left += 1) {
    for (let right = left + 1; right < A.length(unique); right += 1) {
      const first = A.get(unique, left);
      const second = A.get(unique, right);
      if (O.isSome(first) && O.isSome(second) && Str.Equivalence(first.value[1], second.value[1])) {
        pairs.push(A.join(A.sort([first.value[0], second.value[0]], Str.Order), "\u0000"));
      }
    }
  }
  return pairs;
};

/**
 * Pairwise cluster F1 over mention-to-cluster assignments.
 *
 * **Example** (Score one shared pair)
 *
 * ```ts
 * import { pairwiseF1 } from "@/layers/EvaluatorLive"
 *
 * const assignments = [["a", "one"], ["b", "one"]] as const
 * console.log(pairwiseF1(assignments, assignments)) // 1
 * ```
 *
 * @category evaluation
 * @since 0.0.0
 */
export const pairwiseF1: {
  (gold: ReadonlyArray<EntityClusterAssignment>): (predicted: ReadonlyArray<EntityClusterAssignment>) => number;
  (predicted: ReadonlyArray<EntityClusterAssignment>, gold: ReadonlyArray<EntityClusterAssignment>): number;
} = dual(2, (predicted: ReadonlyArray<EntityClusterAssignment>, gold: ReadonlyArray<EntityClusterAssignment>): number =>
  exactF1(pairKeys(predicted), pairKeys(gold))
);

const outcomeKey = (outcome: ExtractOutcomeValue): string =>
  ExtractOutcome.match(outcome, {
    Extracted: ({ batch }) => batch.id,
    Degraded: (degraded) => `${degraded.document}:${degraded.lane}`,
  });

const mergeOutcomes = (
  snapshot: LedgerSnapshot,
  outcomes: ReadonlyArray<ExtractOutcomeValue>
): ReadonlyArray<ExtractOutcomeValue> =>
  A.dedupeWith(A.appendAll(snapshot.batches, outcomes), (left, right) =>
    Str.Equivalence(outcomeKey(left), outcomeKey(right))
  );

const laneOutcome = (
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  document: string,
  lane: ExtractionLane
): O.Option<ExtractOutcomeValue> =>
  A.findFirst(outcomes, (outcome) =>
    ExtractOutcome.match(outcome, {
      Extracted: ({ batch }) =>
        Str.Equivalence(batch.document, document) &&
        Str.Equivalence(lane, Str.Equivalence(batch.method, "hosted-langextract") ? "hosted" : "pattern"),
      Degraded: (degraded) => Str.Equivalence(degraded.document, document) && Str.Equivalence(degraded.lane, lane),
    })
  );

const claimsFor = (
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  document: string,
  lane: ExtractionLane
): ReadonlyArray<EvidenceClaim> =>
  laneOutcome(outcomes, document, lane).pipe(
    O.map((outcome) => ExtractOutcome.match(outcome, { Extracted: ({ batch }) => batch.claims, Degraded: () => [] })),
    O.getOrElse(() => [])
  );

const claimKindCount = (claims: ReadonlyArray<EvidenceClaim>, kind: "Entity" | "Relation" | "Structure"): number =>
  A.length(A.filter(claims, (claim) => Str.Equivalence(claim.body.kind, kind)));

const extractionStatus = (
  parse: "parsed" | DegradedKind,
  outcome: O.Option<ExtractOutcomeValue>
): "extracted" | DegradedKind =>
  O.match(outcome, {
    onNone: (): "extracted" | DegradedKind => (parse === "parsed" ? "extraction-failed" : parse),
    onSome: (value): "extracted" | DegradedKind =>
      ExtractOutcome.match(value, { Extracted: () => "extracted" as const, Degraded: ({ kind }) => kind }),
  });

const documentOutcome = (
  document: LedgerDocumentSnapshot,
  outcomes: ReadonlyArray<ExtractOutcomeValue>
): DocumentOutcomeValue => {
  const parse = document.outcome.outcome === "Parsed" ? "parsed" : document.outcome.kind;
  const hostedOutcome = laneOutcome(outcomes, document.document.id, "hosted");
  const patternOutcome = laneOutcome(outcomes, document.document.id, "pattern");
  const hosted = claimsFor(outcomes, document.document.id, "hosted");
  const pattern = claimsFor(outcomes, document.document.id, "pattern");
  const degradedClaims = A.reduce(
    [hostedOutcome, patternOutcome],
    0,
    (count, candidate) =>
      count +
      candidate.pipe(
        O.map((outcome) =>
          ExtractOutcome.match(outcome, { Extracted: ({ batch }) => A.length(batch.degraded), Degraded: () => 0 })
        ),
        O.getOrElse(() => 0)
      )
  );
  const cacheKeys = A.dedupe(A.getSomes(A.map(A.appendAll(hosted, pattern), (claim) => claim.cacheKey)));
  return DocumentOutcome.make({
    anchorsFailed: NonNegativeInt.make(0),
    anchorsVerified: NonNegativeInt.make(A.length(document.chunks) + A.length(hosted) + A.length(pattern)),
    cacheKeys,
    chunks: NonNegativeInt.make(A.length(document.chunks)),
    claims: {
      hosted: {
        entity: NonNegativeInt.make(claimKindCount(hosted, "Entity")),
        relation: NonNegativeInt.make(claimKindCount(hosted, "Relation")),
        structure: NonNegativeInt.make(claimKindCount(hosted, "Structure")),
      },
      pattern: {
        entity: NonNegativeInt.make(claimKindCount(pattern, "Entity")),
        relation: NonNegativeInt.make(claimKindCount(pattern, "Relation")),
        structure: NonNegativeInt.make(claimKindCount(pattern, "Structure")),
      },
    },
    degradedClaims: NonNegativeInt.make(degradedClaims),
    document: document.document.id,
    extraction: {
      hosted: extractionStatus(parse, hostedOutcome),
      pattern: extractionStatus(parse, patternOutcome),
    },
    origin: document.document.origin,
    parse,
  });
};

const requestedGoldIds = (run: EvalRun): ReadonlyArray<CorpusPaperId> => {
  const selected = HashSet.fromIterable(run.selection.w1);
  const requested = HashSet.fromIterable([
    ...run.gold.subsets.structure,
    ...run.gold.subsets.entity,
    ...run.gold.subsets.relation,
  ]);
  return A.fromIterable(HashSet.intersection(selected, requested));
};

const coverageFor = (
  run: EvalRun,
  snapshot: LedgerSnapshot,
  files: ReadonlyArray<GoldFileValue>,
  subset: MetricSubset
): ReadonlyArray<Coverage> => {
  const subsetFiles = A.filter(files, (file) => Str.Equivalence(file.subset, subset));
  const covered = A.getSomes(
    A.map(snapshot.documents, (document) =>
      Origin.match(document.document.origin, {
        Fixture: () => O.none<Coverage>(),
        W1Paper: (origin) =>
          A.findFirst(subsetFiles, (file) => Str.Equivalence(file.paperId, origin.paperId)).pipe(
            O.map((file): Coverage => [document, file])
          ),
      })
    )
  );
  if (A.isReadonlyArrayNonEmpty(covered) || A.isReadonlyArrayNonEmpty(run.selection.w1)) {
    return covered;
  }
  const firstDocument = A.findFirst(snapshot.documents, (document) => document.outcome.outcome === "Parsed");
  const firstFile = A.head(subsetFiles);
  return O.all([firstDocument, firstFile]).pipe(
    O.map(([document, file]) => [[document, file] as Coverage]),
    O.getOrElse(() => [])
  );
};

const spanKey = (document: string, anchor: { readonly startChar: number; readonly endChar: number }): string =>
  `${document}:${anchor.startChar}:${anchor.endChar}`;

const predictedValues = <Value>(
  coverage: ReadonlyArray<Coverage>,
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  lane: ExtractionLane,
  valueFor: (document: LedgerDocumentSnapshot, claim: EvidenceClaim) => O.Option<Value>
): ReadonlyArray<Value> =>
  A.flatMap(coverage, ([document]) =>
    A.getSomes(A.map(claimsFor(outcomes, document.document.id, lane), (claim) => valueFor(document, claim)))
  );

const predictedSpans = (
  coverage: ReadonlyArray<Coverage>,
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  lane: ExtractionLane,
  kind: "Entity" | "Structure"
): ReadonlyArray<string> =>
  predictedValues(coverage, outcomes, lane, (document, claim) =>
    ClaimBody.match(claim.body, {
      Entity: (body) => (kind === "Entity" ? O.some(spanKey(document.document.id, body)) : O.none<string>()),
      Relation: () => O.none<string>(),
      Structure: (body) => (kind === "Structure" ? O.some(spanKey(document.document.id, body)) : O.none<string>()),
    })
  );

const goldSpans = (coverage: ReadonlyArray<Coverage>): ReadonlyArray<string> =>
  A.flatMap(coverage, ([document, file]) => {
    if (file.subset === "relation") {
      return [];
    }
    return A.map(file.labels, (label) => spanKey(document.document.id, label));
  });

const entityQuote = (claims: ReadonlyArray<EvidenceClaim>, id: string): O.Option<string> =>
  A.findFirst(claims, (claim) => Str.Equivalence(claim.id, id)).pipe(
    O.flatMap((claim) =>
      ClaimBody.match(claim.body, {
        Entity: (body) => O.some(body.quote),
        Relation: () => O.none(),
        Structure: () => O.none(),
      })
    )
  );

const predictedTriples = (
  coverage: ReadonlyArray<Coverage>,
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  lane: ExtractionLane
): ReadonlyArray<string> =>
  A.flatMap(coverage, ([document]) => {
    const claims = claimsFor(outcomes, document.document.id, lane);
    return A.getSomes(
      A.map(claims, (claim) =>
        ClaimBody.match(claim.body, {
          Entity: () => O.none<string>(),
          Structure: () => O.none<string>(),
          Relation: (body) =>
            O.all([entityQuote(claims, body.subject), entityQuote(claims, body.object)]).pipe(
              O.map(
                ([subject, object]) => `${document.document.id}\u0000${body.predicate}\u0000${subject}\u0000${object}`
              )
            ),
        })
      )
    );
  });

const goldTriples = (coverage: ReadonlyArray<Coverage>): ReadonlyArray<string> =>
  A.flatMap(coverage, ([document, file]) => {
    if (file.subset !== "relation") {
      return [];
    }
    return A.map(
      file.labels,
      (label) => `${document.document.id}\u0000${label.predicate}\u0000${label.subject}\u0000${label.object}`
    );
  });

const entityAssignments = (
  coverage: ReadonlyArray<Coverage>,
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  lane: ExtractionLane
): readonly [predicted: ReadonlyArray<EntityClusterAssignment>, gold: ReadonlyArray<EntityClusterAssignment>] => {
  const predicted = predictedValues(coverage, outcomes, lane, (document, claim) =>
    ClaimBody.match(claim.body, {
      Entity: (body) =>
        body.cluster.pipe(
          O.map(
            (cluster: CoreferenceCluster): EntityClusterAssignment => [
              spanKey(document.document.id, body),
              `${document.document.id}:${cluster}`,
            ]
          )
        ),
      Relation: () => O.none<EntityClusterAssignment>(),
      Structure: () => O.none<EntityClusterAssignment>(),
    })
  );
  const gold = A.flatMap(coverage, ([document, file]): ReadonlyArray<EntityClusterAssignment> => {
    if (file.subset !== "entity") {
      return [];
    }
    return A.map(
      file.labels,
      (label): EntityClusterAssignment => [
        spanKey(document.document.id, label),
        `${document.document.id}:${label.cluster}`,
      ]
    );
  });
  return [predicted, gold];
};

const metricValue = (
  name: MetricName,
  coverage: ReadonlyArray<Coverage>,
  outcomes: ReadonlyArray<ExtractOutcomeValue>,
  lane: ExtractionLane
): number => {
  if (Str.Equivalence(name, "structure-span-f1")) {
    return exactF1(predictedSpans(coverage, outcomes, lane, "Structure"), goldSpans(coverage));
  }
  if (Str.Equivalence(name, "entity-span-f1")) {
    return exactF1(predictedSpans(coverage, outcomes, lane, "Entity"), goldSpans(coverage));
  }
  if (Str.Equivalence(name, "rebel-end-to-end-triple-f1")) {
    return exactF1(predictedTriples(coverage, outcomes, lane), goldTriples(coverage));
  }
  const [predicted, gold] = entityAssignments(coverage, outcomes, lane);
  return Str.Equivalence(name, "pairwise-f1") ? pairwiseF1(predicted, gold) : bCubedF1(predicted, gold);
};

const fixtureParseExpected = (document: DocumentOutcomeValue): boolean =>
  Origin.match(document.origin, {
    W1Paper: () => true,
    Fixture: (origin) =>
      origin.declared.expectation === "parses"
        ? document.parse === "parsed"
        : origin.declared.degradedKind.pipe(O.exists((kind) => Str.Equivalence(kind, document.parse))),
  });

const unexpectedlyDegraded = (document: DocumentOutcomeValue): boolean =>
  Origin.match(document.origin, {
    Fixture: () =>
      !fixtureParseExpected(document) || (document.parse === "parsed" && document.extraction.hosted !== "extracted"),
    W1Paper: () => document.parse !== "parsed" || document.extraction.hosted !== "extracted",
  });

const makeEvaluator = Effect.gen(function* () {
  const goldSource = yield* GoldSource;

  return Evaluator.of({
    score: Effect.fn("Evaluator.score")(function* (run, snapshot, suppliedOutcomes) {
      if (!Str.Equivalence(run.id, snapshot.run)) {
        return yield* reportInvalid("The ledger snapshot belongs to a different evaluation run.");
      }
      const files = yield* goldSource.load(requestedGoldIds(run));
      const outcomes = mergeOutcomes(snapshot, suppliedOutcomes);
      const required = HashMap.get(RequiredMetrics, run.stage).pipe(O.getOrElse(() => []));
      const metrics = yield* Effect.forEach(required, (metric) => {
        const unsupported =
          metric.lane === "pattern" && (metric.subset === "structure" || metric.subset === "relation");
        if (unsupported) {
          return Effect.succeed(
            MetricScore.make({
              ...metric,
              status: "unsupported",
              support: NonNegativeInt.make(0),
              value: UnitInterval.make(0),
            })
          );
        }
        const coverage = coverageFor(run, snapshot, files, metric.subset);
        if (A.isReadonlyArrayEmpty(coverage)) {
          return Effect.fail(reportInvalid(`No covered document supports ${metric.name}:${metric.lane}.`));
        }
        return Effect.succeed(
          MetricScore.make({
            ...metric,
            status: "scored",
            support: NonNegativeInt.make(A.length(coverage)),
            value: UnitInterval.make(metricValue(metric.name, coverage, outcomes, metric.lane)),
          })
        );
      });
      const documents = A.map(snapshot.documents, (document) => documentOutcome(document, outcomes));
      const nonEmptyDocuments = yield* A.match(documents, {
        onEmpty: () => Effect.fail(reportInvalid("The ledger snapshot contains no selected documents.")),
        onNonEmpty: Effect.succeed,
      });
      const nonEmptyMetrics = yield* A.match(metrics, {
        onEmpty: () => Effect.fail(reportInvalid("The stage has no required metric coordinates.")),
        onNonEmpty: Effect.succeed,
      });
      const provisional = {
        documents: nonEmptyDocuments,
        metrics: nonEmptyMetrics,
        reportDigest: Sha256Hex.make(Str.repeat(64)("0")),
        run,
        schemaVersion: "eval-report/v1" as const,
        unexpectedDegraded: NonNegativeInt.make(A.length(A.filter(nonEmptyDocuments, unexpectedlyDegraded))),
      };
      const reportDigest = yield* digestOmitting(
        S.Struct(EvalReport.fields),
        "reportDigest"
      )(provisional).pipe(
        Effect.mapError(() => reportInvalid("The evaluation report digest preimage did not encode."))
      );
      return yield* EvalReport.makeEffect({ ...provisional, reportDigest }).pipe(
        Effect.mapError((issue) =>
          reportInvalid(
            `The completed evaluation report violates its schema contract: ${new S.SchemaError(issue).message}`
          )
        )
      );
    }),
  });
});

/**
 * Evaluator implementation over an injected gold source.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { EvaluatorLive } from "@/layers/EvaluatorLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(EvaluatorLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EvaluatorLive = Layer.effect(Evaluator, makeEvaluator);
