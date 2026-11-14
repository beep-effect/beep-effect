import { DeploymentDescriptor, FactVersion } from "@proto/kernel/Deployment";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/**
 * A composed descriptor consumes a fact version no composed descriptor
 * publishes.
 *
 * @category errors
 * @since 0.0.0
 */
export class UnpublishedFact extends S.TaggedError<UnpublishedFact>()("UnpublishedFact", {
  missing: S.Array(S.Struct({ consumer: S.String, fact: FactVersion })),
}) {}

/**
 * What the composed descriptors say about published facts: versions some
 * consumer needs that nobody publishes, and versions published that nobody
 * consumes (retirable, D34), except each producer's newest version (D40).
 *
 * @category models
 * @since 0.0.0
 */
export const FactLedger = S.Struct({
  missing: S.Array(S.Struct({ consumer: S.String, fact: FactVersion })),
  retirable: S.Array(S.Struct({ publisher: S.String, fact: FactVersion })),
});
/**
 * @category models
 * @since 0.0.0
 */
export type FactLedger = typeof FactLedger.Type;

const sameFact = (a: FactVersion) => (b: FactVersion) =>
  a.producer === b.producer && a.contract === b.contract && a.version === b.version;

/**
 * The fact ledger of a set of composed descriptors.
 *
 * @category getters
 * @since 0.0.0
 */
export const ledgerOf = (descriptors: ReadonlyArray<DeploymentDescriptor>): FactLedger => {
  const published = A.flatMap(descriptors, (d) => A.map(d.publishes, (fact) => ({ publisher: d.context, fact })));
  const consumed = A.flatMap(descriptors, (d) => A.map(d.consumes, (fact) => ({ consumer: d.context, fact })));
  return {
    missing: A.filter(consumed, ({ fact }) => !A.some(published, (p) => sameFact(fact)(p.fact))),
    // A producer's newest version is never retirable: with no consumer yet it is being introduced (D40).
    retirable: A.filter(
      published,
      ({ fact }) =>
        !A.some(consumed, (c) => sameFact(fact)(c.fact)) &&
        A.some(published, (p) => p.fact.producer === fact.producer && p.fact.contract === fact.contract && p.fact.version > fact.version),
    ),
  };
};

/**
 * The D34 check: fails when a composed descriptor consumes a fact version
 * that no composed descriptor publishes (a producer dropped a version still
 * in use); otherwise returns the versions nobody consumes, which their
 * producer may retire.
 *
 * **Example** (Checking an app's descriptors)
 * ```ts
 * import { checkFactRetirement } from "@proto/tooling/FactRetirement";
 *
 * const retirable = checkFactRetirement([]);
 * ```
 *
 * @category checks
 * @since 0.0.0
 */
export const checkFactRetirement = (
  descriptors: ReadonlyArray<DeploymentDescriptor>,
): Effect.Effect<FactLedger["retirable"], UnpublishedFact> => {
  const ledger = ledgerOf(descriptors);
  return A.isReadonlyArrayEmpty(ledger.missing)
    ? Effect.succeed(ledger.retirable)
    : Effect.fail(new UnpublishedFact({ missing: ledger.missing }));
};
