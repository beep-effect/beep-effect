import { Effect } from "effect";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as R from "effect/Record";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import {
  type AnyActor,
  type AnyActorLogic,
  type AnyEventObject,
  deliverEvent,
  type EventFromLogic,
  type ExecutableActionObjectFromLogic,
  type InputFrom,
  type InspectionEvent,
  type Snapshot,
  type SnapshotFrom,
  stopActor,
  terminateActor,
} from "xstate";
import { createDurable, type DurableEffect } from "xstate/durable";
import { actionFailure, EffectActor, isActionFailure, type MailboxItem } from "./effectActor.ts";
import { bindEffectHost, closeEffectHost, createEffectHost, type EffectHost, withEffectHost } from "./internal.ts";
import type { RequirementsFrom } from "./types.ts";

const XSTATE_TIMER = "xstate.timer";

/** Options for {@link createEffectActor}. */
export interface EffectActorOptions<TLogic extends AnyActorLogic> {
  /** The actor's input. */
  readonly input?: InputFrom<TLogic>;
}

type RequiredInput<TLogic extends AnyActorLogic> =
  undefined extends InputFrom<TLogic> ? { input?: InputFrom<TLogic> } : { input: InputFrom<TLogic> };

/**
 * Creates and starts an actor as an Effect interpreter over pure transitions.
 *
 * Each step is `transition(snapshot, event)`, a pure function that returns
 * the next snapshot and the actions to run. An Effect fiber owns the loop:
 * the mailbox is a `Queue`, timers are `Effect.sleep` fibers on the Effect
 * `Clock`, and declared Effect actions run as forked Effects in the actor's
 * `Scope` with the services captured here. Child actors are started as live
 * XState actors whose Effects run in the same host.
 *
 * The actor is a scoped resource: it stops, and every Effect it hosts is
 * interrupted, when the enclosing `Scope` closes. The returned Effect never
 * fails; the actor's own outcome is its snapshot status, read with `join`.
 */
export function createEffectActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  ...[options]: undefined extends InputFrom<TLogic>
    ? [options?: EffectActorOptions<TLogic>]
    : [options: EffectActorOptions<TLogic> & RequiredInput<TLogic>]
): Effect.Effect<EffectActor<TLogic>, never, RequirementsFrom<TLogic> | Scope.Scope> {
  return Effect.acquireRelease(
    Effect.gen(function* () {
      const parentScope = yield* Effect.scope;
      const actorScope = yield* Scope.fork(parentScope);
      const baseContext = yield* Effect.context<RequirementsFrom<TLogic>>();
      const context = Context.add(baseContext, Scope.Scope, actorScope);
      const host = createEffectHost(context, actorScope);
      const runFork = Effect.runForkWith(context);
      const runPromise = Effect.runPromiseWith(context);

      const mailbox = yield* Queue.unbounded<MailboxItem<EventFromLogic<TLogic>>>();
      const timers = new Map<string, Fiber.Fiber<void>>();
      // `root` and `actor` are declared after the adapter below; its
      // callbacks only run once they are initialized.
      let stopped = false;
      const isRoot = (candidate: AnyActor) => candidate.address === durable.rootAddress;

      const offer = (item: MailboxItem<EventFromLogic<TLogic>>) => {
        if (!stopped) {
          Queue.offerUnsafe(mailbox, item);
        }
      };
      const timerKey = (source: AnyActor, id: string) => `${source.sessionId}:${id}`;

      const inspectors = new Set<(event: InspectionEvent) => void>();
      let rootAnnounced = false;
      const durable = createDurable(
        logic,
        {
          executeAction: (action, _metadata, runtime) => {
            // Fire-and-forget: the action starts now and the loop continues.
            // A rejection reaches the machine as an execution error.
            try {
              const result = withEffectHost(host, () => action.exec(runtime));
              if (result !== undefined) {
                void Promise.resolve(result).catch((error: unknown) => {
                  offer({ [actionFailure]: true, error });
                });
              }
            } catch (error) {
              offer({ [actionFailure]: true, error });
            }
          },
          spawnActor: (_source, child) => {
            // Every actor of this execution hosts its Effects here.
            bindEffectHost(child, host);
          },
          startActor: (child) => {
            child.start();
          },
          stopActor: (child) => {
            if (!isRoot(child)) {
              stopActor(child);
            }
          },
          terminateActor: (child, termination) => {
            if (!isRoot(child)) {
              terminateActor(child, termination);
            }
          },
          sendEvent: (source, target, event) => {
            if (isRoot(target)) {
              offer(event as EventFromLogic<TLogic>);
              return;
            }
            deliverEvent(source, target, event);
          },
          emitEvent: (source, event) => {
            if (isRoot(source)) {
              actor._emit(event as never);
              return;
            }
            (source as AnyActor & { _emit(value: unknown): void })._emit(event);
          },
          scheduleTimer: (source, id, delay) => {
            const key = timerKey(source, id);
            timers.get(key)?.interruptUnsafe();
            const fiber = Fiber.runIn(
              runFork(
                Effect.andThen(
                  Effect.sleep(Duration.millis(delay)),
                  Effect.sync(() => {
                    timers.delete(key);
                    const timerEvent: AnyEventObject = {
                      type: XSTATE_TIMER,
                      id,
                    };
                    if (isRoot(source)) {
                      offer(timerEvent as EventFromLogic<TLogic>);
                    } else {
                      deliverEvent(source, source, timerEvent);
                    }
                  })
                )
              ),
              actorScope
            );
            timers.set(key, fiber);
          },
          cancelTimer: (source, id) => {
            const key = timerKey(source, id);
            timers.get(key)?.interruptUnsafe();
            timers.delete(key);
          },
          cancelAllTimers: (source) => {
            for (const [key, fiber] of timers) {
              if (Str.startsWith(`${source.sessionId}:`)(key)) {
                fiber.interruptUnsafe();
                timers.delete(key);
              }
            }
          },
          waitForEvent: () => runPromise(Queue.take(mailbox)) as Promise<EventFromLogic<TLogic>>,
        },
        {
          inspect: (event) => {
            // The pure step scope re-materializes the root ref per step and
            // announces it again; observers should see the root once.
            if (event.type === "@xstate.actor" && (event.actorRef as AnyActor).address === durable.rootAddress) {
              if (rootAnnounced) {
                return;
              }
              rootAnnounced = true;
            }
            for (const inspector of inspectors) {
              inspector(event);
            }
          },
        }
      );

      const errorSnapshot = (snapshot: SnapshotFrom<TLogic>, error: unknown): SnapshotFrom<TLogic> =>
        ({
          ...(snapshot as Snapshot<unknown>),
          status: "error",
          error,
        }) as SnapshotFrom<TLogic>;

      const stopChildren = (snapshot: SnapshotFrom<TLogic>) => {
        const children = (snapshot as { children?: Record<string, AnyActor | undefined> }).children;
        for (const child of R.values(children ?? {})) {
          if (child !== undefined && !isRoot(child)) {
            stopActor(child);
          }
        }
      };

      const stop = () => {
        if (stopped) {
          return;
        }
        stopped = true;
        for (const fiber of timers.values()) {
          fiber.interruptUnsafe();
        }
        timers.clear();
        const current = actor.getSnapshot();
        stopChildren(current);
        runFork(Queue.shutdown(mailbox));
        if (!actor._isSettled) {
          actor._settle({
            ...(actor.getSnapshot() as Snapshot<unknown>),
            status: "stopped",
          } as SnapshotFrom<TLogic>);
        }
        closeEffectHost(host);
      };

      // The first transition runs here so the handle is ready when this
      // Effect succeeds, and the initial actions start before any send.
      let [snapshot, effects] = durable.initialTransition(options?.input as never);
      const root = O.getOrThrow(O.fromNullishOr(durable.getActorRef(snapshot)));
      // The root exists from here on; later announcements are step
      // re-materializations, not new actors.
      rootAnnounced = true;
      const actor = new EffectActor(logic, O.getOrThrow(O.fromNullishOr(root)), snapshot, mailbox, stop, inspectors);
      bindEffectHost(actor, host);

      const executeEffects = (batch: DurableEffect<ExecutableActionObjectFromLogic<TLogic>>[]): Effect.Effect<void> =>
        Effect.promise(() =>
          durable.executeEffects(batch).then(
            () => undefined,
            (error: unknown) => {
              offer({ [actionFailure]: true, error });
            }
          )
        );

      const loop = Effect.gen(function* () {
        yield* executeEffects(effects);
        while ((snapshot as Snapshot<unknown>).status === "active" && !stopped) {
          const item = yield* Effect.promise(() =>
            durable.waitForEvent().then(
              (event) => event as MailboxItem<EventFromLogic<TLogic>>,
              () => undefined
            )
          );
          if (item === undefined || stopped) {
            break;
          }
          let event: EventFromLogic<TLogic>;
          if (isActionFailure(item)) {
            const errorEvent = (
              logic as {
                getExecutionErrorEvent?: (
                  snapshot: SnapshotFrom<TLogic>,
                  error: unknown
                ) => EventFromLogic<TLogic> | undefined;
              }
            ).getExecutionErrorEvent?.(snapshot, item.error);
            if (errorEvent === undefined) {
              snapshot = errorSnapshot(snapshot, item.error);
              break;
            }
            event = errorEvent;
          } else {
            event = item;
          }
          const transition = yield* Effect.sync(() => durable.transition(snapshot, event)).pipe(Effect.exit);
          if (Exit.isFailure(transition)) {
            snapshot = errorSnapshot(snapshot, Cause.squash(transition.cause));
            break;
          }
          [snapshot, effects] = transition.value;
          actor._publish(snapshot);
          yield* executeEffects(effects);
        }
        if (!stopped) {
          actor._publish(snapshot);
          if ((snapshot as Snapshot<unknown>).status !== "active") {
            stopChildren(snapshot);
            closeEffectHost(host);
          }
        }
      });

      yield* Effect.forkIn(loop, actorScope);
      return { actor, host };
    }),
    ({ actor, host }: { actor: EffectActor<TLogic>; host: EffectHost }) =>
      Effect.gen(function* () {
        actor.stop();
        if (host.closing !== undefined) {
          yield* Fiber.join(host.closing);
        } else {
          yield* Scope.close(host.scope, Exit.void);
        }
      })
  ).pipe(Effect.map(({ actor }) => actor));
}
