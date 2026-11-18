import * as Domain from "@alchemy.run/domain";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// A slot that records labelled writes, each decided after a hold: the in-process two-runner cases'
// model (the fenced commit, the frozen runner).

/** A write was recorded. */
export class Written extends Domain.Event("Written", { label: S.String }) {}

/** Record a label once `decide` has held for `holdMs`. */
export class Write extends Domain.Command("Write", {
  target: S.String,
  input: { label: S.String, holdMs: S.Finite },
  events: [Written],
}) {}

/** The labels written, in order. */
export class Slot extends Domain.Aggregate("Slot", {
  id: S.String,
  state: S.Struct({ labels: S.Array(S.String) }),
  initial: { labels: [] },
  commands: [Write],
  decide: {
    Write: Effect.fn(function* (_, command) {
      yield* Effect.sleep(command.holdMs);
      return [Written.make({ label: command.label })];
    }),
  },
  evolve: { Written: (state, event) => ({ labels: A.append(state.labels, event.label) }) },
}) {}

/** The model of one aggregate. */
export class Slots extends Domain.Model("Slots", { aggregates: [Slot] }) {}

/** The id of the slot `s` as the in-process host stores it. */
export const SLOT = "Slots.SlotAggregate/s";
