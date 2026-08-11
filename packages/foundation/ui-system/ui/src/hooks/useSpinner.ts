/**
 * Spinner hook: press-and-hold repeat firing for increment/decrement controls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $UiId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { useAtomMount, useAtomSet } from "@effect/atom-react";
import { Match } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { useId } from "react";

const $I = $UiId.create("hooks/useSpinner");

class SpinnerSchedule extends S.Class<SpinnerSchedule>($I`SpinnerSchedule`)(
  {
    continuousChangeInterval: NonNegativeInt,
    continuousChangeDelay: NonNegativeInt,
  },
  $I.annote("SpinnerSchedule", {
    description: "Timing configuration used while a spinner button is held down.",
  })
) {
  static readonly is = S.is(SpinnerSchedule);
  static readonly fromUnknown = S.decodeUnknownSync(SpinnerSchedule);
  static readonly decodeOption = S.decodeUnknownOption(SpinnerSchedule);
}

const spinnerSchedule = SpinnerSchedule.fromUnknown({
  continuousChangeInterval: 50,
  continuousChangeDelay: 300,
});

type SpinnerState = {
  readonly interval: number | undefined;
  readonly runOnce: boolean;
  readonly timeout: number | undefined;
};

type SpinnerCommand =
  | {
      readonly _tag: "start";
      readonly run: () => void;
    }
  | {
      readonly _tag: "stop";
    };

const emptySpinnerState: SpinnerState = {
  interval: undefined,
  runOnce: true,
  timeout: undefined,
};

const clearSpinnerTimers = (state: SpinnerState): void => {
  if (state.timeout !== undefined) {
    window.clearTimeout(state.timeout);
  }
  if (state.interval !== undefined) {
    window.clearInterval(state.interval);
  }
};

const spinnerStateAtom = Atom.family((_scope: string) => Atom.make<SpinnerState>(emptySpinnerState));

const spinnerCommandAtom = Atom.family((scope: string) =>
  Atom.writable(
    () => undefined,
    (ctx, command: SpinnerCommand) => {
      const stateAtom = spinnerStateAtom(scope);
      const state = ctx.get(stateAtom);

      Match.type<SpinnerCommand>().pipe(
        Match.tagsExhaustive({
          stop: () => {
            clearSpinnerTimers(state);
            ctx.set(stateAtom, emptySpinnerState);
          },
          start: ({ run }) => {
            clearSpinnerTimers(state);

            if (state.runOnce) {
              run();
            }

            const timeout = window.setTimeout(() => {
              const interval = window.setInterval(run, spinnerSchedule.continuousChangeInterval);
              ctx.set(stateAtom, {
                interval,
                runOnce: false,
                timeout: undefined,
              });
            }, spinnerSchedule.continuousChangeDelay);

            ctx.set(stateAtom, {
              interval: undefined,
              runOnce: state.runOnce,
              timeout,
            });
          },
        })
      )(command);
    }
  )
);

const spinnerCleanupAtom = Atom.family((scope: string) =>
  Atom.make((get) => {
    get.addFinalizer(() => clearSpinnerTimers(get.once(spinnerStateAtom(scope))));
  })
);

/**
 * React hook used by spinner buttons to repeatedly increment or decrement a value
 * while the button remains pressed.
 *
 * The hook performs one immediate step on press, waits for the configured hold delay,
 * and then repeats the selected action at a fixed interval until `stop` is called.
 *
 * The two callbacks are co-equal, so there is no honest data-last argument to
 * curry on — and a React hook must never be applied in pipe position anyway.
 * They travel together in a single `actions` bag instead of as two positional
 * parameters.
 *
 * **Example** (Import useSpinner in a component)
 *
 * ```tsx
 * import React from "react"
 * import { useSpinner } from "@beep/ui/hooks/useSpinner"
 *
 * function Example() {}
 *
 * console.log(Example)
 * ```
 *
 * **Example** (Import useSpinner hook)
 *
 * ```ts
 * import { useSpinner } from "@beep/ui/hooks/useSpinner"
 *
 * console.log(useSpinner)
 * ```
 *
 * @category components
 * @param actions - Upward and downward spinner callbacks.
 * @returns Spinner controls for starting and stopping repeated actions.
 * @since 0.0.0
 */
/**
 * Use spinner hook.
 *
 * **Example** (Import useSpinner export)
 *
 * ```ts
 * import { useSpinner } from "@beep/ui/hooks/useSpinner"
 *
 * console.log(useSpinner)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function useSpinner<T>(actions: {
  readonly increment: (params?: T) => void;
  readonly decrement: (params?: T) => void;
}) {
  const scope = useId();
  const dispatch = useAtomSet(spinnerCommandAtom(scope));

  // The spinner's live `setTimeout`/`setInterval` handles live in this atom, and
  // nothing subscribed to it: it was only ever written on press and read again on
  // release. A registry with an idle TTL (the desktop sets one) sweeps a node with
  // no listeners, so a button held past the TTL lost its handles — `stop` then read
  // the default, cleared nothing, and the interval went on firing forever, spinning
  // the value with no way to stop it short of a reload. Mount it so the handles
  // live exactly as long as the spinner that owns them.
  useAtomMount(spinnerStateAtom(scope));
  useAtomMount(spinnerCleanupAtom(scope));

  return {
    up: (params?: T) =>
      dispatch({
        _tag: "start",
        run: () => actions.increment(params),
      }),
    down: (params?: T) =>
      dispatch({
        _tag: "start",
        run: () => actions.decrement(params),
      }),
    stop: () => dispatch({ _tag: "stop" }),
  };
}
