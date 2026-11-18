import * as Domain from "@alchemy.run/domain";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/**
 * The fact: a write landed on the slot, with the runner that decided it.
 *
 * @category events
 * @since 0.0.0
 */
export class Written extends Domain.Event("Written", { label: S.String, runner: S.String }) {}

/**
 * Write a label, holding `decide` for `holdMs` first: the slow command of the
 * two-runners case (D38). Conformance-only.
 *
 * @category commands
 * @since 0.0.0
 */
export class Write extends Domain.Command("Write", {
  target: S.String,
  input: { label: S.String, holdMs: S.Int },
  events: [Written],
}) {}

/**
 * A slot: the list of labels written, in the order they committed.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Slot extends Domain.Aggregate("Slot", {
  id: S.String,
  state: S.Struct({ labels: S.Array(S.String) }),
  initial: { labels: [] },
  commands: [Write],
  decide: {
    Write: Effect.fn(function* (_, command) {
      // The runner's container name, which the two-runners case reads back.
      const runner = yield* Config.String("HOSTNAME").pipe(Config.withDefault("unknown"), Effect.orDie);
      yield* Effect.log(`Slot.Write deciding ${command.label} on ${runner}, holding ${command.holdMs} ms`);
      yield* Effect.sleep(command.holdMs);
      yield* Effect.log(`Slot.Write committing ${command.label} on ${runner}`);
      return [Written.make({ label: command.label, runner })];
    }),
  },
  evolve: { Written: (state, event) => ({ labels: A.append(state.labels, event.label) }) },
}) {}

/**
 * Every write to every slot, counted under one key (phase 10, D46). It is new
 * in phase 10, so restoring phase 9's data under this code adds it over
 * existing slots: its backfill must bring them, through the directory.
 *
 * @category views
 * @since 0.0.0
 */
export class SlotTally extends Domain.View("SlotTally", {
  from: [Slot],
  key: S.Literal("all"),
  keyOf: { Slot: () => "all" as const },
  state: S.Struct({ writes: S.Int }),
  initial: { writes: 0 },
  evolve: { Written: (tally) => ({ writes: tally.writes + 1 }) },
}) {}

/**
 * The conformance-only model of the two-runners case.
 *
 * @category models
 * @since 0.0.0
 */
export class TwoRunnersModel extends Domain.Model("TwoRunners", { aggregates: [Slot], views: [SlotTally] }) {}
