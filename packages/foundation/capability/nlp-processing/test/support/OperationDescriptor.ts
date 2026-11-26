import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { appendEvent } from "./OperationObservation.ts";
import type { Operation } from "@beep/nlp-processing/Operation";
import type { Trace } from "./OperationObservation.ts";

const SmallInt = S.Int.check(S.isBetween({ minimum: -1_000, maximum: 1_000 }));

const Succeed = S.TaggedStruct("Succeed", { scale: SmallInt, shift: SmallInt });

const Fail = S.TaggedStruct("Fail", { code: SmallInt });

export const OperationDescriptor = S.Struct({ event: SmallInt, outcome: S.Union([Succeed, Fail]) });

export type OperationDescriptor = typeof OperationDescriptor.Type;

export const DistinctPair = S.Tuple([OperationDescriptor, OperationDescriptor]).check(
  S.makeFilter(([left, right]) => left.event !== right.event)
);

export const OperationFailure = S.TaggedStruct("OperationFailure", { code: SmallInt });

export type OperationFailure = typeof OperationFailure.Type;

export const SmallInput = SmallInt;

export const lawTerm = TermIri.make(iri("operation:Extract"));

export const interpret = (descriptor: OperationDescriptor): Operation<number, number, OperationFailure, Trace> => ({
  name: lawTerm,
  run: (input) =>
    appendEvent(descriptor.event).pipe(
      Effect.andThen(
        Match.valueTags(descriptor.outcome, {
          Fail: ({ code }): Effect.Effect<number, OperationFailure> => Effect.fail(OperationFailure.make({ code })),
          Succeed: ({ scale, shift }): Effect.Effect<number, OperationFailure> => Effect.succeed(scale * input + shift),
        })
      )
    ),
});
