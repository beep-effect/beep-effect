import { Effect } from "effect";
import * as R from "effect/Record";
import {
  type ActorLogicValidator,
  type AnyActorRef,
  type AnySetupConfig,
  type AnyStateMachine,
  type EventObject,
  type MachineContext,
  type SetupConfig,
  type SetupReturn,
  type SetupSchemas,
  type SetupStateSchema,
  type Sources,
  type SystemRegistry,
  type SystemRuntime,
  setup,
} from "xstate";
import { effectActionBrand } from "./brands.ts";
import { runHostedEffect } from "./internal.ts";
import {
  type EffectSetupSchemas,
  type EffectSetupStateSchema,
  type ToStandardSetupSchemas,
  type ToStandardSetupStates,
  toStandardSetupSchemas,
  toStandardSetupStates,
  type ValidateEffectSetupSchemas,
  type ValidateEffectSetupStates,
} from "./schema.ts";
import type { EffectRequirements } from "./types.ts";

/**
 * Argument an Effect action receives. It mirrors the v6 action argument
 * object: the machine's `context` and the `event` that caused the transition,
 * the actor itself and its family (`self`, `parent`, `children`), the
 * registered `actions`, `actors`, `guards` and `delays`, the actor `system`,
 * and the `params` and `output` the transition passed along.
 */
export type EffectActionArgs<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject,
> = {
  readonly context: TContext;
  readonly event: TEvent;
  readonly self: AnyActorRef;
  readonly parent: AnyActorRef | undefined;
  readonly children: Record<string, AnyActorRef | undefined>;
  readonly actions: Record<string, unknown>;
  readonly actors: Record<string, unknown>;
  readonly guards: Record<string, unknown>;
  readonly delays: Record<string, unknown>;
  readonly system: SystemRuntime<SystemRegistry>;
  readonly params?: unknown;
  readonly output?: unknown;
};

/**
 * An action registered with `setupEffect({ actions })`. It is called
 * synchronously during the transition with the arguments the transition
 * enqueued, and returns an Effect that runs afterwards in the actor's Effect
 * context. The Effect is interrupted when the actor stops; its failures and
 * defects route to the state's `onError`. The optional second parameter is the
 * transition's enqueue object, typed with the base `EventObject`.
 */
export type EffectAction<
  TContext extends MachineContext = MachineContext,
  TEvent extends EventObject = EventObject,
  TError = unknown,
  TRequirements = never,
> = (args: EffectActionArgs<TContext, TEvent>) => Effect.Effect<void, TError, TRequirements>;

type AnyEffectAction = EffectAction<MachineContext, EventObject, unknown, unknown>;

type EffectActionRequirements<TAction> = TAction extends (...args: never[]) => infer TResult
  ? EffectRequirements<TResult>
  : never;

type CoreEffectAction<TAction> = TAction extends (...args: infer TArgs) => unknown
  ? ((...args: TArgs) => void) & {
      readonly [effectActionBrand]?: EffectActionRequirements<TAction>;
    }
  : never;

type CoreEffectActionMap<TActionMap> = {
  [K in keyof TActionMap]: CoreEffectAction<TActionMap[K]>;
};

type EffectSetupConfig<
  TSchemas extends EffectSetupSchemas,
  TStates extends Record<string, EffectSetupStateSchema>,
  TActionMap extends Record<string, AnyEffectAction>,
  TActorMap extends Sources["actors"],
  TGuardMap extends Sources["guards"],
  TDelayMap extends Sources["delays"],
  TValidator extends ActorLogicValidator | undefined,
  TSourceSchemas extends SetupSchemas = ToStandardSetupSchemas<TSchemas>,
> = {
  validator?: TValidator;
  actions?: TActionMap & Record<string, AnyEffectAction>;
  actors?: TActorMap;
  guards?: NonNullable<
    SetupConfig<
      TSourceSchemas,
      ToStandardSetupStates<TStates>,
      CoreEffectActionMap<TActionMap>,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TValidator
    >["guards"]
  >;
  delays?: NonNullable<
    SetupConfig<
      TSourceSchemas,
      ToStandardSetupStates<TStates>,
      CoreEffectActionMap<TActionMap>,
      TActorMap,
      TGuardMap,
      TDelayMap,
      TValidator
    >["delays"]
  >;
  schemas?: TSchemas & ([TValidator] extends [ActorLogicValidator] ? ValidateEffectSetupSchemas<TSchemas> : unknown);
  states?: TStates & ([TValidator] extends [ActorLogicValidator] ? ValidateEffectSetupStates<TStates> : unknown);
};

type MergeRecord<TBase, TExtension> = Omit<TBase, keyof TExtension> & TExtension;

type MergeSetupSchemas<TBaseSchemas extends SetupSchemas, TExtensionSchemas extends SetupSchemas> = {
  [K in keyof TBaseSchemas | keyof TExtensionSchemas]: K extends
    | "events"
    | "internalEvents"
    | "emitted"
    | "children"
    | "actions"
    | "guards"
    ? MergeRecord<
        K extends keyof TBaseSchemas ? NonNullable<TBaseSchemas[K]> : Record<never, never>,
        K extends keyof TExtensionSchemas ? NonNullable<TExtensionSchemas[K]> : Record<never, never>
      >
    : K extends keyof TExtensionSchemas
      ? TExtensionSchemas[K]
      : K extends keyof TBaseSchemas
        ? TBaseSchemas[K]
        : never;
} extends infer TMergedSchemas extends SetupSchemas
  ? TMergedSchemas
  : never;

interface RuntimeValidationDoesNotSupportTransformingSchemas {
  readonly __xstate_effect_error: "Runtime validation does not support schemas with different encoded and decoded types";
}

type RuntimeValidationCompatibility<TSchemas, TStates, TValidator> = [TValidator] extends [ActorLogicValidator]
  ? [TSchemas] extends [ValidateEffectSetupSchemas<TSchemas>]
    ? [TStates] extends [ValidateEffectSetupStates<TStates>]
      ? unknown
      : RuntimeValidationDoesNotSupportTransformingSchemas
    : RuntimeValidationDoesNotSupportTransformingSchemas
  : unknown;

declare const inheritedEffectValidator: unique symbol;
type InheritedEffectValidator = typeof inheritedEffectValidator;

type ResolveExtendedValidator<TBase, TExtension> = [TExtension] extends [InheritedEffectValidator]
  ? TBase
  : Exclude<TExtension, InheritedEffectValidator>;

type ExtendValidatorConfig<TExtension> = [TExtension] extends [InheritedEffectValidator]
  ? { validator?: never }
  : { validator: TExtension };

type EffectSetupExtensionConfig<
  TBaseSchemas extends SetupSchemas,
  TBaseStates extends Record<string, SetupStateSchema>,
  TBaseValidator extends ActorLogicValidator | undefined,
  TExtensionSchemas extends EffectSetupSchemas,
  TExtensionStates extends Record<string, EffectSetupStateSchema>,
  TExtensionActionMap extends Record<string, AnyEffectAction>,
  TExtensionActorMap extends Sources["actors"],
  TExtensionGuardMap extends Sources["guards"],
  TExtensionDelayMap extends Sources["delays"],
  TExtensionValidator extends ActorLogicValidator | undefined | InheritedEffectValidator,
> = EffectSetupConfig<
  TExtensionSchemas,
  TExtensionStates,
  TExtensionActionMap,
  TExtensionActorMap,
  TExtensionGuardMap,
  TExtensionDelayMap,
  ResolveExtendedValidator<TBaseValidator, TExtensionValidator>,
  MergeSetupSchemas<TBaseSchemas, ToStandardSetupSchemas<TExtensionSchemas>>
> &
  ExtendValidatorConfig<TExtensionValidator> &
  RuntimeValidationCompatibility<
    NoInfer<TBaseSchemas>,
    NoInfer<TBaseStates>,
    ResolveExtendedValidator<TBaseValidator, TExtensionValidator>
  >;

/**
 * What `setupEffect` returns: the XState `SetupReturn` with an `extend` method
 * that also accepts Effect schemas and Effect-returning actions. Call
 * `createMachine` on it to build a machine whose registered actions and actors
 * contribute to `RequirementsFrom`.
 */
export type EffectSetupReturn<
  TStates extends Record<string, SetupStateSchema> = Record<string, SetupStateSchema>,
  TSchemas extends SetupSchemas = Record<never, never>,
  TSetupActionMap extends Sources["actions"] = Record<never, never>,
  TSetupActorMap extends Sources["actors"] = Record<never, never>,
  TSetupGuardMap extends Sources["guards"] = Record<never, never>,
  TSetupDelayMap extends Sources["delays"] = Record<never, never>,
  TSetupDelays extends string = Extract<keyof TSetupDelayMap, string>,
  TValidator extends ActorLogicValidator | undefined = undefined,
> = Omit<
  SetupReturn<
    TStates,
    TSchemas,
    TSetupActionMap,
    TSetupActorMap,
    TSetupGuardMap,
    TSetupDelayMap,
    TSetupDelays,
    SystemRegistry,
    TValidator
  >,
  "extend"
> & {
  extend<
    const TExtensionSchemas extends EffectSetupSchemas = Record<never, never>,
    const TExtensionStates extends Record<string, EffectSetupStateSchema> = Record<never, never>,
    TExtensionActionMap extends Record<string, AnyEffectAction> = Record<never, never>,
    TExtensionActorMap extends Sources["actors"] = Record<never, never>,
    TExtensionGuardMap extends Sources["guards"] = Record<never, never>,
    TExtensionDelayMap extends Sources["delays"] = Record<never, never>,
    const TExtensionValidator extends
      | ActorLogicValidator
      | undefined
      | InheritedEffectValidator = InheritedEffectValidator,
  >(
    config: EffectSetupExtensionConfig<
      TSchemas,
      TStates,
      TValidator,
      TExtensionSchemas,
      TExtensionStates,
      TExtensionActionMap,
      TExtensionActorMap,
      TExtensionGuardMap,
      TExtensionDelayMap,
      TExtensionValidator
    >
  ): EffectSetupReturn<
    MergeRecord<TStates, ToStandardSetupStates<TExtensionStates>>,
    MergeSetupSchemas<TSchemas, ToStandardSetupSchemas<TExtensionSchemas>>,
    MergeRecord<TSetupActionMap, CoreEffectActionMap<TExtensionActionMap>>,
    MergeRecord<TSetupActorMap, TExtensionActorMap>,
    MergeRecord<TSetupGuardMap, TExtensionGuardMap>,
    MergeRecord<TSetupDelayMap, TExtensionDelayMap>,
    TSetupDelays | Extract<keyof TExtensionDelayMap, string>,
    ResolveExtendedValidator<TValidator, TExtensionValidator>
  >;
};

type AnyEffectSetupConfig = Omit<AnySetupConfig, "actions" | "schemas" | "states"> & {
  actions?: Record<string, AnyEffectAction>;
  schemas?: EffectSetupSchemas;
  states?: Record<string, EffectSetupStateSchema>;
};

function wrapActions<TContext extends MachineContext, TEvent extends EventObject, E, R>(
  actions:
    | Record<string, (args: EffectActionArgs<TContext, TEvent>) => Effect.Effect<void, E, R> | void | PromiseLike<void>>
    | undefined
): Record<string, (args: EffectActionArgs<TContext, TEvent>) => void | PromiseLike<void>> | undefined {
  if (actions === undefined) return undefined;
  return R.map(actions, (action, key) => (args: EffectActionArgs<TContext, TEvent>) => {
    const result = action(args);
    return Effect.isEffect(result) ? runHostedEffect(args.self, result, `action.${key}`) : result;
  });
}

/**
 * Makes `machine.provide` host Effect-returning action overrides the same way
 * `setupEffect` hosts declared actions.
 */
function decorateMachine<TMachine extends AnyStateMachine>(machine: TMachine): TMachine {
  const provide = machine.provide.bind(machine) as (sources: Record<string, unknown>) => AnyStateMachine;
  machine.provide = ((sources: Record<string, unknown>) =>
    decorateMachine(
      provide({
        ...sources,
        actions: wrapActions(sources.actions as Record<string, AnyEffectAction> | undefined),
      })
    )) as TMachine["provide"];
  return machine;
}

function decorateEffectSetup(effectSetup: SetupReturn): SetupReturn {
  const createMachine = effectSetup.createMachine.bind(effectSetup) as (config: unknown) => AnyStateMachine;
  effectSetup.createMachine = ((config: unknown) =>
    decorateMachine(createMachine(config))) as typeof effectSetup.createMachine;
  const extend = effectSetup.extend;
  const extendAny = extend as (extension: object) => SetupReturn;
  effectSetup.extend = ((extension: AnySetupConfig) =>
    decorateEffectSetup(
      extendAny({
        ...extension,
        schemas: toStandardSetupSchemas(extension.schemas),
        states: toStandardSetupStates(extension.states),
        actions: wrapActions(extension.actions as Record<string, AnyEffectAction> | undefined),
      })
    )) as typeof effectSetup.extend;
  return effectSetup;
}

/**
 * The Effect-aware form of XState's `setup`. It accepts Effect `Schema` values
 * wherever `setup` accepts Standard Schemas, and actions that return an
 * Effect, which it wraps so the transition stays synchronous while the Effect
 * runs in the actor's Effect context. Everything else, including `actors`,
 * `guards`, `delays` and `extend`, behaves as in `setup`. Machines built from
 * it must be started with `createEffectActor`.
 */
export function setupEffect(): EffectSetupReturn;
export function setupEffect<
  const TSchemas extends EffectSetupSchemas = Record<never, never>,
  const TStates extends Record<string, EffectSetupStateSchema> = Record<string, EffectSetupStateSchema>,
  TActionMap extends Record<string, AnyEffectAction> = Record<never, never>,
  TActorMap extends Sources["actors"] = Record<never, never>,
  TGuardMap extends Sources["guards"] = Record<never, never>,
  TDelayMap extends Sources["delays"] = Record<never, never>,
  const TValidator extends ActorLogicValidator | undefined = undefined,
>(
  config: EffectSetupConfig<TSchemas, TStates, TActionMap, TActorMap, TGuardMap, TDelayMap, TValidator>
): EffectSetupReturn<
  ToStandardSetupStates<TStates>,
  ToStandardSetupSchemas<TSchemas>,
  CoreEffectActionMap<TActionMap>,
  TActorMap,
  TGuardMap,
  TDelayMap,
  Extract<keyof TDelayMap, string>,
  TValidator
>;
export function setupEffect(config: AnyEffectSetupConfig = {}): unknown {
  return decorateEffectSetup(
    setup({
      ...config,
      schemas: toStandardSetupSchemas(config.schemas),
      states: toStandardSetupStates(config.states),
      actions: wrapActions(config.actions),
    } as AnySetupConfig) as SetupReturn
  ) as EffectSetupReturn;
}
