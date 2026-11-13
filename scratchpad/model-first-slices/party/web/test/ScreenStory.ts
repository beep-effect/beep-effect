import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as P from "effect/Predicate";

/** A nested partial: what a `state` step expects of the screen. */
export type Expected<T> = T extends ReadonlyArray<unknown>
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: Expected<T[K]> }
    : T;

/** One step of a screen story. */
export type Step<Screen, Message, Intent> =
  | { readonly _tag: "Send"; readonly message: Message }
  | { readonly _tag: "Intents"; readonly expected: ReadonlyArray<Intent> }
  | { readonly _tag: "State"; readonly check: (screen: Screen) => void };

/**
 * A screen-story kit for one machine: from a given screen state, `send`
 * messages through the pure `update`, and assert the `intents` the last
 * message produced (exactly; none when empty) and the `state` reached. No
 * React, no Effect runtime, no clock.
 */
export const screenStory = <Screen, Message, Intent>(
  update: (screen: Screen, message: Message) => readonly [Screen, ReadonlyArray<Intent>],
) => ({
  send: (message: Message): Step<Screen, Message, Intent> => ({ _tag: "Send", message }),
  intents: (...expected: ReadonlyArray<Intent>): Step<Screen, Message, Intent> => ({ _tag: "Intents", expected }),
  state: (expected: Expected<Screen> | ((screen: Screen) => void)): Step<Screen, Message, Intent> => ({
    _tag: "State",
    check: (screen) =>
      P.isFunction(expected)
        ? (expected as (screen: Screen) => void)(screen)
        : expect(screen).toMatchObject(expected as object),
  }),
  run: (given: Screen, ...steps: ReadonlyArray<Step<Screen, Message, Intent>>): Screen =>
    A.reduce(steps, [given, [] as ReadonlyArray<Intent>] as const, ([screen, last], step) => {
      switch (step._tag) {
        case "Send":
          return update(screen, step.message);
        case "Intents":
          expect(last).toEqual(step.expected);
          return [screen, last] as const;
        case "State":
          step.check(screen);
          return [screen, last] as const;
      }
    })[0],
});
