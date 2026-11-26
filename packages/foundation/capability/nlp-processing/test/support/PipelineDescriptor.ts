import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { mintContentHash } from "@beep/jsonc/Mint";
import { ActivityFacts, composeLogged, withActivity } from "@beep/nlp-processing/Activity";
import { DomainTag } from "@beep/schema/ContentHash";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import type { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { Logged, LoggedFailure } from "@beep/nlp-processing/Activity";
import type { Operation } from "@beep/nlp-processing/Operation";
import type { ContentHash } from "@beep/schema/ContentHash";
import type * as Clock from "effect/Clock";
import type * as Digest from "effect/crypto/Digest";

const Step = S.Struct({
  fanOut: S.Int.check(S.isBetween({ minimum: 1, maximum: 3 })),
  fail: S.Boolean,
});

export type Step = typeof Step.Type;

export const PipelineDescriptor = S.Struct({
  steps: S.NonEmptyArray(Step).check(S.isMaxLength(5)),
  inputs: S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 50 }))).check(S.isMaxLength(3)),
});

export type PipelineDescriptor = typeof PipelineDescriptor.Type;

export const ClockScript = S.NonEmptyArray(S.Int.check(S.isBetween({ minimum: 0, maximum: 10_000 }))).check(
  S.isMaxLength(8)
);

export type ClockScript = typeof ClockScript.Type;

export const StepFailure = S.TaggedStruct("StepFailure", { step: S.Int });

export type StepFailure = typeof StepFailure.Type;

export type StepError = StepFailure | JsoncCanonicalizeError | PreimageMintError;

export type Entities = HashSet.HashSet<ContentHash>;

export type LoggedStep = Operation<Entities, Logged<Entities>, LoggedFailure<StepError>, Digest.Digest>;

const testDomain = DomainTag.make("l5-3-test/v1");

export const stepTerm = TermIri.make(iri("operation:Extract"));

export const stepEdition = (index: number): string => `step-${index}`;

export const mintInputs = (inputs: ReadonlyArray<number>) =>
  Effect.map(
    Effect.forEach(inputs, (input) => mintContentHash(testDomain, ["input", input]), { concurrency: 1 }),
    HashSet.fromIterable
  );

const sortedIds = (ids: Entities): ReadonlyArray<string> => A.sort(A.fromIterable(ids), Order.String);

const stepOperation = (
  index: number,
  step: Step
): Operation<Entities, Entities, StepFailure | JsoncCanonicalizeError, Digest.Digest> => ({
  name: stepTerm,
  run: Effect.fnUntraced(function* (used: Entities) {
    if (step.fail) return yield* Effect.fail(StepFailure.make({ step: index }));
    const minted = yield* Effect.forEach(
      A.range(0, step.fanOut - 1),
      (fan) => mintContentHash(testDomain, ["output", index, fan, ...sortedIds(used)]),
      { concurrency: 1 }
    );
    return HashSet.fromIterable(minted);
  }),
});

export const loggedStep =
  (index: number) =>
  (step: Step): LoggedStep =>
    withActivity<Entities, Entities>({
      facts: (used) =>
        Effect.succeed(
          ActivityFacts.make({
            pin: ActivityPin.cases.Engine.make({ engine: "l5-3-pipeline", edition: stepEdition(index) }),
            promptDigest: O.none(),
            used,
          })
        ),
      generated: (output) => output,
    })(stepOperation(index, step));

const composeAtStepTerm = (f: LoggedStep, g: LoggedStep): LoggedStep => composeLogged(f, g, stepTerm);

export const foldPipeline = (pipeline: {
  readonly steps: PipelineDescriptor["steps"];
  readonly compose?: (f: LoggedStep, g: LoggedStep) => LoggedStep;
}): LoggedStep => {
  const compose = pipeline.compose ?? composeAtStepTerm;
  return A.reduce(
    A.tailNonEmpty(pipeline.steps),
    loggedStep(0)(A.headNonEmpty(pipeline.steps)),
    (folded, step, offset) => compose(folded, loggedStep(offset + 1)(step))
  );
};

export const scriptedClock = (script: ClockScript): Clock.Clock => {
  const cursor = MutableRef.make(0);
  const next = (): number => {
    const position = MutableRef.get(cursor);
    MutableRef.set(cursor, position + 1);
    return O.getOrElse(A.get(script, position % A.length(script)), () => A.headNonEmpty(script));
  };
  const nanos = (): bigint => BigInt(next()) * 1_000_000n;
  return {
    currentTimeMillisUnsafe: next,
    currentTimeMillis: Effect.sync(next),
    currentTimeNanosUnsafe: nanos,
    currentTimeNanos: Effect.sync(nanos),
    monotonicTimeNanosUnsafe: nanos,
    monotonicTimeNanos: Effect.sync(nanos),
    sleep: () => Effect.void,
  };
};
