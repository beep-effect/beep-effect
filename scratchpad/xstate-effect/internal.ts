import { Effect } from "effect";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Exit from "effect/Exit";
import type * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Scope from "effect/Scope";
import type { AnyActor, AnyActorRef } from "xstate";

export interface EffectHost {
  /** The Effect context captured by `createEffectActor`, including the actor scope. */
  readonly context: Context.Context<unknown>;
  /** A scope that closes when the root actor stops. */
  readonly scope: Scope.Closeable;
  /** The fiber running the scope's finalizers once the scope has closed. */
  closing?: Fiber.Fiber<void>;
  readonly interruptors: Map<AnyActorRef, Set<() => void>>;
  readonly subscriptions: Map<AnyActorRef, { unsubscribe(): void }>;
}

const effectHosts = new WeakMap<object, EffectHost>();
let ambientHost: EffectHost | undefined;

/**
 * Runs `fn` with `host` as the ambient host, so Effects started synchronously
 * inside it (declared actions executed by an execution loop) resolve their
 * host without an identity binding.
 */
export const withEffectHost: { <T>(fn: () => T): (host: EffectHost) => T; <T>(host: EffectHost, fn: () => T): T } =
  dual(2, <T>(host: EffectHost, fn: () => T): T => {
    const previous = ambientHost;
    ambientHost = host;
    try {
      return fn();
    } finally {
      ambientHost = previous;
    }
  });

export const createEffectHost: {
  <R>(scope: Scope.Closeable): (context: Context.Context<R>) => EffectHost;
  <R>(context: Context.Context<R>, scope: Scope.Closeable): EffectHost;
} = dual(
  2,
  <R>(context: Context.Context<R>, scope: Scope.Closeable): EffectHost => ({
    context: Context.makeUnsafe<unknown>(context.mapUnsafe),
    scope,
    interruptors: new Map(),
    subscriptions: new Map(),
  })
);

export const bindEffectHost: {
  (host: EffectHost): (target: object) => void;
  (target: object, host: EffectHost): void;
} = dual(2, (target: object, host: EffectHost): void => {
  effectHosts.set(target, host);
});

function findEffectHost(actor: AnyActorRef): EffectHost | undefined {
  let current: (AnyActorRef & { _parent?: AnyActorRef }) | undefined = actor as AnyActorRef & {
    _parent?: AnyActorRef;
  };

  while (current !== undefined) {
    const host = effectHosts.get(current);
    if (host !== undefined) {
      return host;
    }
    current = current._parent as (AnyActorRef & { _parent?: AnyActorRef }) | undefined;
  }

  return ambientHost;
}

type DeclaringMachine = {
  sources?: { actors?: Record<string, unknown> };
  idMap?: Map<string, { invoke?: Array<{ id?: string }> }>;
};

/**
 * Rejects Effect logic that a machine spawned inline. Only declared actors
 * (`setup({ actors })`) and `invoke` sources are visible to
 * `RequirementsFrom`, so anything else would infer `R = never` and fail
 * later with a missing service.
 *
 * A spawned declared actor carries its registered key as `src`; an invoked
 * child carries the id of the `invoke` entry that created it.
 */
function assertDeclaredLogic(actor: AnyActorRef): void {
  const self = actor as AnyActor & { logic?: unknown };
  const parent = self._parent;
  const machine = parent?.logic as DeclaringMachine | undefined;
  if (machine?.sources === undefined || machine.idMap === undefined || P.isString(self.src)) {
    return;
  }

  if (A.contains(R.values(machine.sources.actors ?? {}), self.logic)) {
    return;
  }
  for (const stateNode of machine.idMap.values()) {
    for (const definition of stateNode.invoke ?? []) {
      if (definition.id === self.id) {
        return;
      }
    }
  }

  throw new Cause.IllegalArgumentError(
    `Effect logic spawned by "${O.getOrThrow(O.fromNullishOr(parent)).id}" must be declared in setup({ actors }). Spawn a declared actor instead, for example enq.spawn(args.actors.name).`
  );
}

function requireEffectHost(actor: AnyActorRef): EffectHost {
  assertDeclaredLogic(actor);
  const host = findEffectHost(actor);
  if (host === undefined) {
    throw new Cause.IllegalArgumentError("Effect-backed actor logic must be created with createEffectActor().");
  }
  return host;
}

function untrackEffect(actor: AnyActorRef, host: EffectHost, interrupt: () => void): void {
  const interruptors = host.interruptors.get(actor);
  if (interruptors === undefined) {
    return;
  }

  interruptors.delete(interrupt);
  if (interruptors.size === 0) {
    host.interruptors.delete(actor);
    host.subscriptions.get(actor)?.unsubscribe();
    host.subscriptions.delete(actor);
  }
}

function cleanupActorEffects(actor: AnyActorRef, host: EffectHost): void {
  const interruptors = host.interruptors.get(actor);
  if (interruptors !== undefined) {
    host.interruptors.delete(actor);
    for (const interrupt of interruptors) {
      interrupt();
    }
  }

  host.subscriptions.get(actor)?.unsubscribe();
  host.subscriptions.delete(actor);
}

function trackEffect(actor: AnyActorRef, host: EffectHost, interrupt: () => void): void {
  let interruptors = host.interruptors.get(actor);
  if (interruptors === undefined) {
    interruptors = new Set();
    host.interruptors.set(actor, interruptors);
    host.subscriptions.set(
      actor,
      actor.subscribe({
        error: () => cleanupActorEffects(actor, host),
        complete: () => cleanupActorEffects(actor, host),
      })
    );
  }
  interruptors.add(interrupt);
}

/**
 * Runs an Effect in the actor's host context. The Effect is interrupted when
 * the actor stops or when the returned function is called; `onExit` is not
 * called after that.
 *
 * This mirrors how Effect's own `unstable/reactivity` bridges callback code:
 * `Effect.runCallbackWith` with the captured services, and a synchronous
 * interruptor kept per actor.
 */
export const startHostedEffect: {
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    spanName: string,
    onExit: (exit: Exit.Exit<A, E>) => void
  ): (actor: AnyActorRef) => () => void;
  <A, E, R>(
    actor: AnyActorRef,
    effect: Effect.Effect<A, E, R>,
    spanName: string,
    onExit: (exit: Exit.Exit<A, E>) => void
  ): () => void;
} = dual(
  4,
  <A, E, R>(
    actor: AnyActorRef,
    effect: Effect.Effect<A, E, R>,
    spanName: string,
    onExit: (exit: Exit.Exit<A, E>) => void
  ): (() => void) => {
    const host = requireEffectHost(actor);
    let active = true;
    const traced = Effect.withSpan(
      spanName,
      {
        attributes: {
          "xstate.actor.id": (actor as AnyActor).id,
          "xstate.actor.address": (actor as AnyActor).address,
        },
      },
      { captureStackTrace: false }
    )(effect);
    const cancel = () => {
      if (!active) {
        return;
      }
      active = false;
      untrackEffect(actor, host, cancel);
      interrupt();
    };
    const interrupt = Effect.runCallbackWith(host.context)(traced, {
      onExit: (exit) => {
        if (!active) {
          return;
        }
        active = false;
        untrackEffect(actor, host, cancel);
        onExit(exit);
      },
    });
    if (active) {
      trackEffect(actor, host, cancel);
    }

    return cancel;
  }
);

/**
 * Runs an Effect in the actor's host context and settles when it exits.
 * Interruption settles without error; failures and defects reject with the
 * squashed cause so the actor's error handling can observe them.
 */
export const runHostedEffect: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, spanName: string): (actor: AnyActorRef) => PromiseLike<void>;
  <A, E, R>(actor: AnyActorRef, effect: Effect.Effect<A, E, R>, spanName: string): PromiseLike<void>;
} = dual(3, <A, E, R>(actor: AnyActorRef, effect: Effect.Effect<A, E, R>, spanName: string): PromiseLike<void> => {
  const host = requireEffectHost(actor);
  return Effect.runPromiseExitWith(host.context)(
    Effect.callback<void, E>((resume) => {
      const cancel = startHostedEffect(actor, effect, spanName, (exit) => {
        resume(
          Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause) ? Effect.void : Effect.failCause(exit.cause)
        );
      });
      return Effect.sync(cancel);
    })
  ).then((exit) => {
    if (Exit.isFailure(exit)) {
      return Promise.reject(Cause.squash(exit.cause));
    }
  });
});

/**
 * Closes the host scope immediately and runs its finalizers, with the host's
 * services, on a fiber that `createEffectActor`'s release can await.
 */
export function closeEffectHost(host: EffectHost): void {
  for (const [actor, interruptors] of host.interruptors) {
    host.interruptors.delete(actor);
    for (const interrupt of interruptors) {
      interrupt();
    }
    host.subscriptions.get(actor)?.unsubscribe();
    host.subscriptions.delete(actor);
  }
  const finalizers = Scope.closeUnsafe(host.scope, Exit.void);
  if (finalizers !== undefined) {
    host.closing = Effect.runForkWith(host.context)(finalizers);
  }
}

/**
 * Delivers a stream item to the parent as an event. This runs outside a
 * transition, so it uses the system relay like core's observable logic does.
 */
export const relayToParent: {
  (event: { type: string; [key: string]: unknown }): (actor: AnyActorRef) => void;
  (actor: AnyActorRef, event: { type: string; [key: string]: unknown }): void;
} = dual(2, (actor: AnyActorRef, event: { type: string; [key: string]: unknown }): void => {
  const actorWithParent = actor as AnyActor & { _parent?: AnyActor };
  if (actorWithParent._parent !== undefined) {
    (actor as AnyActor).system._relay(actorWithParent, actorWithParent._parent, event);
  }
});
