import { commute, compose, map, product, pure, traverse } from "@beep/nlp-processing/Operation";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { identity } from "effect/Function";
import * as Ref from "effect/Ref";
import {
  DistinctPair,
  interpret,
  lawTerm,
  OperationDescriptor,
  OperationFailure,
  SmallInput,
} from "./support/OperationDescriptor.ts";
import { appendEvent, observe, Trace } from "./support/OperationObservation.ts";
import type { Operation, Pure } from "@beep/nlp-processing/Operation";

type LawOperation = Operation<number, number, OperationFailure, Trace>;

const descriptors = Arbitrary.schema(OperationDescriptor);

const inputs = Arbitrary.schema(SmallInput);

const id = pure({ name: lawTerm, f: identity<number> });

const succeeding = (event: number, scale: number): LawOperation =>
  interpret(OperationDescriptor.make({ event, outcome: { _tag: "Succeed", scale, shift: 0 } }));

const failing = (event: number): LawOperation =>
  interpret(OperationDescriptor.make({ event, outcome: { _tag: "Fail", code: event } }));

const throwing: LawOperation = {
  name: lawTerm,
  run: () => {
    throw new Error("run threw when called");
  },
};

const swap = <L, R>([left, right]: readonly [L, R]): readonly [R, L] => [right, left];

const reorderedCompose = (self: LawOperation, that: LawOperation): LawOperation => ({
  name: lawTerm,
  run: (input) => Effect.flatMap(that.run(input), () => self.run(input)),
});

const effectDroppingCompose = (self: LawOperation, that: LawOperation): LawOperation => ({
  name: lawTerm,
  run: (input) =>
    Effect.flatMap(Ref.make<ReadonlyArray<number>>([]), (discarded) =>
      Effect.flatMap(Effect.provideService(self.run(input), Trace, discarded), that.run)
    ),
});

describe("Operation", () => {
  it.effect.prop(
    "L5-1 Kleisli identity and associativity under the declared observation",
    [descriptors, descriptors, descriptors, inputs],
    ([f, g, h, x]) =>
      Effect.gen(function* () {
        const [opF, opG, opH] = [interpret(f), interpret(g), interpret(h)];
        const plain = yield* observe(opF, x);
        const leftUnit = yield* observe(compose(id, opF, lawTerm), x);
        const rightUnit = yield* observe(compose(opF, id, lawTerm), x);
        const leftNested = yield* observe(compose(compose(opF, opG, lawTerm), opH, lawTerm), x);
        const rightNested = yield* observe(compose(opF, compose(opG, opH, lawTerm), lawTerm), x);
        expect(Equal.equals(leftUnit, plain)).toBe(true);
        expect(Equal.equals(rightUnit, plain)).toBe(true);
        expect(Equal.equals(leftNested, rightNested)).toBe(true);
      }),
    { arbitrary: fcRuns() }
  );

  it.effect.prop(
    "L5-1 the observation sees a reordering and a dropped effect",
    [Arbitrary.schema(DistinctPair), inputs],
    ([[left, right], x]) =>
      Effect.gen(function* () {
        const opF = succeeding(left.event, 2);
        const opG = succeeding(right.event, 3);
        const lawful = yield* observe(compose(opF, opG, lawTerm), x);
        const reordered = yield* observe(reorderedCompose(opF, opG), x);
        const dropped = yield* observe(effectDroppingCompose(opF, opG), x);
        expect(lawful.trace).toEqual([left.event, right.event]);
        expect(Equal.equals(lawful, reordered)).toBe(false);
        expect(Equal.equals(lawful, dropped)).toBe(false);
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("L5-1 combinators suspend a component whose run throws when called", () =>
    Effect.gen(function* () {
      const composite = compose(throwing, succeeding(1, 1), lawTerm);
      const observed = yield* observe(composite, 4);
      expect(observed).toEqual({ exit: { _tag: "Died" }, trace: [] });
    })
  );

  it.effect.prop(
    "L5-2 Pure commutes with every operation and a throwing sync is not central",
    [inputs, inputs, descriptors, inputs],
    ([a, b, q, x]) =>
      Effect.gen(function* () {
        const p = pure({ name: lawTerm, f: (value: number) => a * value + b });
        const opQ = interpret(q);
        const ordered = yield* observe(product(p, opQ, lawTerm), x);
        const commuted = yield* observe(commute(p, opQ, lawTerm), x);
        const swapped = yield* observe(map(product(opQ, p, lawTerm), swap), x);
        expect(Equal.equals(ordered, commuted)).toBe(true);
        expect(Equal.equals(ordered, swapped)).toBe(true);
      }),
    { arbitrary: fcRuns() }
  );

  it.effect("L5-2 a throwing sync observes differently in the two orders", () =>
    Effect.gen(function* () {
      const s: LawOperation = {
        name: lawTerm,
        run: () =>
          Effect.sync(() => {
            throw new Error("sync threw");
          }),
      };
      const q = succeeding(7, 1);
      const sFirst = yield* observe(product(s, q, lawTerm), 1);
      const qFirst = yield* observe(map(product(q, s, lawTerm), swap), 1);
      const qFails = yield* observe(map(product(failing(7), s, lawTerm), swap), 1);
      expect(sFirst).toEqual({ exit: { _tag: "Died" }, trace: [] });
      expect(qFirst).toEqual({ exit: { _tag: "Died" }, trace: [7] });
      expect(qFails).toEqual({ exit: { _tag: "Failed", error: OperationFailure.make({ code: 7 }) }, trace: [7] });
      expectTypeOf(s).not.toExtend<Pure<number, number>>();
      expectTypeOf(id).toExtend<Pure<number, number>>();
    })
  );

  it.effect("L5-2 a trace-writing sync that returns normally is not central", () =>
    Effect.gen(function* () {
      const writer: LawOperation = { name: lawTerm, run: (input) => Effect.as(appendEvent(9), input) };
      const q = succeeding(7, 1);
      const writerFirst = yield* observe(product(writer, q, lawTerm), 1);
      const qFirst = yield* observe(map(product(q, writer, lawTerm), swap), 1);
      expect(writerFirst.trace).toEqual([9, 7]);
      expect(qFirst.trace).toEqual([7, 9]);
      expect(Equal.equals(writerFirst, qFirst)).toBe(false);
    })
  );

  it.effect("L5-2 pure over a throwing function is observed as a defect", () =>
    Effect.gen(function* () {
      const p = pure({
        name: lawTerm,
        f: (): number => {
          throw new Error("f threw");
        },
      });
      const observed = yield* observe(p, 1);
      expect(observed).toEqual({ exit: { _tag: "Died" }, trace: [] });
    })
  );

  it.effect("traverse runs the operation left to right and stops at the first failure", () =>
    Effect.gen(function* () {
      const tracing: Operation<number, number, OperationFailure, Trace> = {
        name: lawTerm,
        run: (input) => Effect.as(appendEvent(input), input * 10),
      };
      const succeeded = yield* observe(traverse(tracing, lawTerm), [1, 2, 3]);
      const failed = yield* observe(traverse(compose(tracing, failing(5), lawTerm), lawTerm), [1, 2]);
      expect(succeeded).toEqual({ exit: { _tag: "Succeeded", value: [10, 20, 30] }, trace: [1, 2, 3] });
      expect(failed).toEqual({ exit: { _tag: "Failed", error: OperationFailure.make({ code: 5 }) }, trace: [1, 5] });
    })
  );
});
