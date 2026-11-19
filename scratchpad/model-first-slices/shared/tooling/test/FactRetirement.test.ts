import { expect, it } from "@effect/vitest";
import { DeploymentDescriptor, type FactVersion } from "@proto/kernel/Deployment";
import { Count, Name, Sequence } from "@proto/kernel/Measure";
import { checkFactRetirement, ledgerOf } from "@proto/tooling/FactRetirement";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// D34, D40: the fact ledger of composed descriptors. A version some consumer needs that nobody
// publishes is missing; a version published that nobody consumes and a newer version of its
// contract supersedes is retirable, so a producer's newest version never is.
// Every value below is generated from a schema. A scene draws every fact version from a few
// contracts and a few versions, so descriptors publish and consume the same ones often.

/** A fact contract: its producer and name. */
const Contract = S.Struct({ producer: Name, contract: Name });
/** A fact version, by its contract's index in the scene and a version among the first few. */
const Pick = S.Struct({ contract: Count, version: Sequence.check(S.isLessThanOrEqualTo(4)) });
/** A context's descriptor: what the platform needs of it, the facts it publishes and the facts it consumes. */
const Composed = S.Struct({ base: DeploymentDescriptor, context: Name, publishes: S.Array(Pick), consumes: S.Array(Pick) });
const Scene = S.Struct({ contracts: S.NonEmptyArray(Contract), descriptors: S.Array(Composed) });
type Scene = typeof Scene.Type;

const descriptorsOf = ({ contracts, descriptors }: Scene): ReadonlyArray<DeploymentDescriptor> => {
  const factOf = ({ contract, version }: typeof Pick.Type): FactVersion => ({ ...(contracts[contract % contracts.length] ?? contracts[0]), version });
  return A.map(descriptors, ({ base, context, publishes, consumes }) =>
    DeploymentDescriptor.make({ ...base, context, publishes: A.map(publishes, factOf), consumes: A.map(consumes, factOf) }),
  );
};

const publishedOf = (descriptors: ReadonlyArray<DeploymentDescriptor>) =>
  A.flatMap(descriptors, (descriptor) => A.map(descriptor.publishes, (fact) => ({ publisher: descriptor.context, fact })));
const consumedOf = (descriptors: ReadonlyArray<DeploymentDescriptor>) =>
  A.flatMap(descriptors, (descriptor) => A.map(descriptor.consumes, (fact) => ({ consumer: descriptor.context, fact })));
const isPublished = (descriptors: ReadonlyArray<DeploymentDescriptor>) => (fact: FactVersion) =>
  A.some(publishedOf(descriptors), (entry) => Eq.equals(entry.fact, fact));
const isConsumed = (descriptors: ReadonlyArray<DeploymentDescriptor>) => (fact: FactVersion) =>
  A.some(consumedOf(descriptors), (entry) => Eq.equals(entry.fact, fact));
const isSuperseded = (descriptors: ReadonlyArray<DeploymentDescriptor>) => (fact: FactVersion) =>
  A.some(publishedOf(descriptors), ({ fact: other }) => other.producer === fact.producer && other.contract === fact.contract && other.version > fact.version);

/** The same entries, whatever their order. */
const sameEntries = (actual: ReadonlyArray<unknown>, expected: ReadonlyArray<unknown>) => {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining([...expected]));
};

it.prop("a version is missing exactly when someone consumes it and nobody publishes it", [Scene], ([scene]) => {
  const descriptors = descriptorsOf(scene);
  const { missing } = ledgerOf(descriptors);
  sameEntries(missing, A.filter(consumedOf(descriptors), ({ fact }) => !isPublished(descriptors)(fact)));
  expect(A.every(missing, ({ fact }) => isConsumed(descriptors)(fact) && !isPublished(descriptors)(fact))).toBe(true);
});

it.prop("a version is retirable exactly when it is published, nobody consumes it and a newer version supersedes it", [Scene], ([scene]) => {
  const descriptors = descriptorsOf(scene);
  const { retirable } = ledgerOf(descriptors);
  sameEntries(
    retirable,
    A.filter(publishedOf(descriptors), ({ fact }) => !isConsumed(descriptors)(fact) && isSuperseded(descriptors)(fact)),
  );
});

it.prop("a producer's newest version of a contract is never retirable", [Scene], ([scene]) => {
  const descriptors = descriptorsOf(scene);
  const newest = (fact: FactVersion) =>
    A.every(publishedOf(descriptors), ({ fact: other }) => other.producer !== fact.producer || other.contract !== fact.contract || other.version <= fact.version);
  expect(A.some(ledgerOf(descriptors).retirable, ({ fact }) => newest(fact))).toBe(false);
});

it.prop("descriptors that consume only versions some descriptor publishes miss nothing, and retire nothing they consume", [Scene, Count], ([scene, skip]) => {
  // Each descriptor consumes the versions published by every descriptor after the first `skip`.
  const published = A.flatMap(A.drop(scene.descriptors, skip % (A.length(scene.descriptors) + 1)), (descriptor) => descriptor.publishes);
  const descriptors = descriptorsOf({ ...scene, descriptors: A.map(scene.descriptors, (descriptor) => ({ ...descriptor, consumes: published })) });
  const ledger = ledgerOf(descriptors);
  expect(ledger.missing).toEqual([]);
  expect(A.some(ledger.retirable, ({ fact }) => isConsumed(descriptors)(fact))).toBe(false);
});

it.prop("a publisher of every missing version clears what is missing", [Scene, DeploymentDescriptor, Name], ([scene, base, context]) => {
  const descriptors = descriptorsOf(scene);
  const repair = DeploymentDescriptor.make({ ...base, context, publishes: A.map(ledgerOf(descriptors).missing, ({ fact }) => fact), consumes: [] });
  expect(ledgerOf([...descriptors, repair]).missing).toEqual([]);
});

it.prop("the order of the descriptors only orders the ledger", [Scene], ([scene]) => {
  const descriptors = descriptorsOf(scene);
  const ledger = ledgerOf(descriptors);
  const reversed = ledgerOf(A.reverse(descriptors));
  sameEntries(reversed.missing, ledger.missing);
  sameEntries(reversed.retirable, ledger.retirable);
});

it.effect.prop("the check fails exactly when a version is missing, naming every one, and otherwise returns the retirable versions", [Scene], ([scene]) =>
  Effect.gen(function* () {
    const descriptors = descriptorsOf(scene);
    const ledger = ledgerOf(descriptors);
    const outcome = yield* Effect.result(checkFactRetirement(descriptors));
    expect(Result.mapError(outcome, (failure) => failure.missing)).toEqual(
      A.isReadonlyArrayEmpty(ledger.missing) ? Result.succeed(ledger.retirable) : Result.fail(ledger.missing),
    );
  }),
);
