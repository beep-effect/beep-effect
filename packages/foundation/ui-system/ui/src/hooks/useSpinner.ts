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
 * @example
 * ```tsx
 * import React from "react"
 * import { useSpinner } from "@beep/ui/hooks/useSpinner"
 *
 * function Example() {}
 *
 * console.log(Example)
 * ```
 *
 * @example
 * ```ts
 * import { useSpinner } from "@beep/ui/hooks/useSpinner"
 *
 * console.log(useSpinner)
 * ```
 *
 * @category components
 * @param increment - Callback invoked for upward spinner movement.
 * @param decrement - Callback invoked for downward spinner movement.
 * @returns Spinner controls for starting and stopping repeated actions.
 * @since 0.0.0
 */
/**
 * Use spinner hook.
 *
 * @example
 * ```ts
 * import { useSpinner } from "@beep/ui/hooks/useSpinner"
 *
 * console.log(useSpinner)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function useSpinner<T>(increment: (params?: T) => void, decrement: (params?: T) => void) {
  const scope = useId();
  const dispatch = useAtomSet(spinnerCommandAtom(scope));

  useAtomMount(spinnerCleanupAtom(scope));

  return {
    up: (params?: T) =>
      dispatch({
        _tag: "start",
        run: () => increment(params),
      }),
    down: (params?: T) =>
      dispatch({
        _tag: "start",
        run: () => decrement(params),
      }),
    stop: () => dispatch({ _tag: "stop" }),
  };
}
