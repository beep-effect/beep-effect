import * as Domain from "@alchemy.run/domain";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// A slot that records labelled writes, each decided after a hold: the in-process two-runner cases'
// model (the fenced commit, the frozen runner).

/** A write was recorded. */
export class Written extends Domain.Event("Written", { label: Schema.String }) {}

/** Record a label once `decide` has held for `holdMs`. */
export class Write extends Domain.Command("Write", {
  target: Schema.String,
  input: { label: Schema.String, holdMs: Schema.Finite },
  events: [Written],
}) {}

/** The labels written, in order. */
export class Slot extends Domain.Aggregate("Slot", {
  id: Schema.String,
  state: Schema.Struct({ labels: Schema.Array(Schema.String) }),
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
