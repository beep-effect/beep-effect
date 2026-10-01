/**
 * Statechart for workspace vault onboarding and document intake.
 *
 * **Details**
 *
 * Two parallel regions share one actor:
 *
 * - `vault` follows the workspace vault configuration. It is fed by an invoked
 *   Effect stream, retries a failed read on a Clock-driven backoff, and walks
 *   the operator through the native picker or the manual path form.
 * - `batches` owns the batch actors spawned for each drop and reports whether
 *   any are still filing.
 *
 * Every invoked actor is an Effect, so the RPC client and `Reactivity` arrive
 * through the actor's Layer and `TestClock` drives the retry delay in tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { SetWorkspaceVaultInput } from "@beep/workspace-use-cases/public";
import { invoke } from "@tauri-apps/api/core";
import { fromEffect, fromEffectStream, setupEffect } from "@xstate/effect";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { Reactivity } from "effect/reactivity";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { failureMessageOr } from "@/lib/failureMessage";
import { DesktopIntakeClient, workspaceVaultKey } from "./DesktopIntake.client.ts";
import {
  batchIdFor,
  DocumentIntakeContext,
  DocumentIntakeEmitted,
  DocumentIntakeInput,
  DocumentIntakeState,
  IntakeBatchRelayPayloads,
  IntakeEventPayloads,
  IntakeInternalEventPayloads,
  IntakeLogRequest,
  ManualOutcome,
  PersistVaultRootInput,
  PickerOutcome,
  VaultConfigFeedInput,
  VaultDirectoryPickerInvocationError,
  VaultFailureContext,
  VaultFailureStateInput,
  VaultSavingStateInput,
  VaultSelectionState,
} from "./DocumentIntake.models.ts";
import { logIntakeCause } from "./Intake.telemetry.ts";
import { intakeBatchMachine } from "./IntakeBatch.machine.ts";
import type { EffectSourceArgs } from "@xstate/effect";
import type { SnapshotFrom } from "xstate";
import type { DocumentIntakeVaultStatus, VaultSelectionOutcome } from "./DocumentIntake.models.ts";
import type { IntakeBatchEmittedEvent } from "./IntakeBatch.machine.ts";

const MAX_CONFIG_RETRY_MILLIS = 30_000;

const PICKER_FAILURE_MESSAGE = "The folder picker could not be opened.";

const EMPTY_MANUAL_PATH_MESSAGE = "Enter the absolute path of a local folder.";

const vaultConfigurationFailureMessage = failureMessageOr("Unable to save workspace vault.");

const decodeSetWorkspaceVaultInput = S.decodeUnknownEffect(SetWorkspaceVaultInput);

const selectedVaultPath = (selected: O.Option<string>): O.Option<string> =>
  selected.pipe(O.map(Str.trim), O.filter(Str.isNonEmpty));

const outcome = (value: VaultSelectionOutcome) => ({ type: "vault.outcome" as const, outcome: value });

// Re-reads the vault configuration whenever a mutation invalidates its key, so
// saving a vault root or filing a document reaches the machine as an event.
const vaultConfigFeed = fromEffectStream({
  schemas: { input: VaultConfigFeedInput },
  stream: ({ input }: EffectSourceArgs<VaultConfigFeedInput>) =>
    Stream.unwrap(
      DesktopIntakeClient.pipe(
        Effect.map((client) =>
          Reactivity.stream(client("GetWorkspaceVault", { workspaceId: input.workspaceId }), [
            workspaceVaultKey(input.workspaceId),
          ]).pipe(Stream.map((config) => config.vaultRootPath))
        )
      )
    ),
});

const pickNative = fromEffect(
  Effect.tryPromise({
    try: () => invoke<string | null>("select_vault_directory"),
    catch: (cause) => VaultDirectoryPickerInvocationError.make({ cause }),
  }).pipe(Effect.map(O.fromNullishOr))
);

const pickSidecar = fromEffect(
  DesktopIntakeClient.pipe(Effect.flatMap((client) => client("PickVaultDirectory", void 0)))
);

const persistVaultRoot = fromEffect({
  schemas: { input: PersistVaultRootInput },
  effect: Effect.fn("professional_desktop.intake.persist_vault_root")(function* ({
    input,
  }: EffectSourceArgs<PersistVaultRootInput>) {
    const client = yield* DesktopIntakeClient;
    const payload = yield* decodeSetWorkspaceVaultInput(input);
    return yield* Reactivity.mutation(client("SetWorkspaceVault", payload), [workspaceVaultKey(input.workspaceId)]);
  }),
});

/**
 * Actor logic for workspace vault onboarding and document intake.
 *
 * **Details**
 *
 * - `vault.watching` invokes the configuration feed. When the feed fails,
 *   `vault.loadFailed` waits for `configRetry`, which doubles per attempt up to
 *   thirty seconds, and re-enters `watching`; `RETRY_CONFIG` retries at once.
 * - `picker` and `manual` are compound states that finish in final states with
 *   typed output. Their parent routes on `onDone`, so neither flow names a
 *   state outside itself.
 * - `picker.routing` is a choice state that picks the Tauri dialog or the
 *   sidecar dialog.
 * - The `saving` states receive the path to persist as state input.
 * - `awaitingConfig` holds the saving view until the feed reports the new
 *   vault root, so the onboarding card does not flash back to idle.
 * - `batches` spawns one `intakeBatch` actor per drop. Batches are spawned, not
 *   invoked, so they keep filing while the vault region moves.
 *
 * **Example** (Start an intake actor)
 *
 * ```ts
 * import { documentIntakeMachine } from "@/intake/DocumentIntake.machine"
 * import { DocumentIntakeInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { createEffectActor } from "@xstate/effect"
 *
 * const program = createEffectActor(documentIntakeMachine, {
 *   input: DocumentIntakeInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID })
 * })
 * console.log(program)
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const documentIntakeMachine = setupEffect({
  schemas: {
    input: DocumentIntakeInput,
    context: DocumentIntakeContext,
    events: { ...IntakeEventPayloads, ...IntakeBatchRelayPayloads },
    internalEvents: IntakeInternalEventPayloads,
    emitted: DocumentIntakeEmitted,
  },
  // Declaring the whole tree types every transition target against real state paths.
  states: {
    vault: {
      states: {
        watching: {
          states: {
            loading: {},
            unconfigured: {
              states: {
                idle: {},
                picker: {
                  schemas: { output: PickerOutcome },
                  states: {
                    routing: {},
                    native: {},
                    sidecar: {},
                    saving: { schemas: { input: VaultSavingStateInput } },
                    cancelled: {},
                    saved: {},
                    pickerFailed: {},
                    saveFailed: { schemas: { input: VaultFailureStateInput } },
                    manualRequested: {},
                  },
                },
                manual: {
                  schemas: { output: ManualOutcome },
                  states: {
                    editing: {},
                    saving: { schemas: { input: VaultSavingStateInput } },
                    cancelled: {},
                    saved: {},
                  },
                },
                awaitingConfig: {},
                failed: { schemas: { context: VaultFailureContext } },
              },
            },
            configured: { states: { idle: {}, dragging: {} } },
          },
        },
        loadFailed: {},
      },
    },
    batches: { states: { idle: {}, busy: {} } },
  },
  actors: { vaultConfigFeed, pickNative, pickSidecar, persistVaultRoot, intakeBatch: intakeBatchMachine },
  actions: { logIntakeCause },
  guards: {
    hasVaultRoot: (vaultRootPath: O.Option<string>) => O.isSome(vaultRootPath),
    hasTauriRuntime: () => !P.isUndefined(globalThis.window) && "__TAURI_INTERNALS__" in globalThis.window,
  },
  delays: {
    configRetry: ({ context }) =>
      Math.min(context.configRetryBaseMillis * 2 ** context.configAttempt, MAX_CONFIG_RETRY_MILLIS),
  },
}).createMachine({
  id: "intake",
  type: "parallel",
  context: ({ input }) => ({
    workspaceId: input.workspaceId,
    configRetryBaseMillis: input.configRetryBaseMillis,
    configAttempt: 0,
    batchSequence: 0,
    liveBatches: [],
    results: [],
    manualDraftPath: O.none(),
    manualMessage: O.none(),
  }),
  on: {
    CLEAR_RESULTS: () => ({ context: { results: [] } }),
    FILE_RESULT: ({ context, event }) => ({ context: { results: A.append(context.results, event.entry) } }),
  },
  states: {
    vault: {
      initial: "watching",
      states: {
        watching: {
          initial: "loading",
          invoke: {
            id: "vaultConfigFeed",
            src: "vaultConfigFeed",
            input: ({ context }) => ({ workspaceId: context.workspaceId }),
            // The feed is a snapshot stream: an event relayed by a child would cross the
            // actor boundary and be rejected as an internal event, so the parent raises it.
            onSnapshot: ({ event }, enq) => {
              const vaultRootPath = event.snapshot.context;
              if (!P.isUndefined(vaultRootPath)) {
                enq.raise({ type: "VAULT_CONFIG_RESOLVED", vaultRootPath });
              }
            },
            onError: (args, enq) => {
              enq(args.actions.logIntakeCause, {
                ...args,
                params: IntakeLogRequest.make({
                  action: "load_workspace_vault",
                  cause: args.event.error,
                  message: "workspace vault configuration could not be read",
                }),
              });
              return { target: "loadFailed" };
            },
          },
          states: {
            loading: {
              on: {
                VAULT_CONFIG_RESOLVED: ({ event, guards }) =>
                  guards.hasVaultRoot(event.vaultRootPath)
                    ? { target: "configured", context: { configAttempt: 0 } }
                    : { target: "unconfigured", context: { configAttempt: 0 } },
              },
            },
            unconfigured: {
              initial: "idle",
              on: {
                VAULT_CONFIG_RESOLVED: ({ event, guards }) =>
                  guards.hasVaultRoot(event.vaultRootPath) ? { target: "configured" } : undefined,
              },
              states: {
                idle: {
                  on: { CHOOSE_VAULT: { target: "picker" } },
                },
                picker: {
                  initial: "routing",
                  states: {
                    routing: {
                      type: "choice",
                      choice: ({ guards }) => (guards.hasTauriRuntime() ? { target: "native" } : { target: "sidecar" }),
                    },
                    native: {
                      invoke: {
                        src: "pickNative",
                        onDone: ({ event }, enq) => {
                          const selected = selectedVaultPath(event.output);
                          if (O.isNone(selected)) {
                            enq.emit(outcome("cancelled"));
                            return { target: "cancelled" };
                          }
                          enq.emit(outcome("selected"));
                          return { target: "saving", input: { vaultRootPath: selected.value } };
                        },
                        onError: (args, enq) => {
                          enq.emit(outcome("picker_failure"));
                          enq(args.actions.logIntakeCause, {
                            ...args,
                            params: IntakeLogRequest.make({
                              action: "pick_workspace_vault",
                              cause: args.event.error,
                              message: "tauri vault directory picker failed",
                            }),
                          });
                          return { target: "pickerFailed" };
                        },
                      },
                    },
                    sidecar: {
                      invoke: {
                        src: "pickSidecar",
                        onDone: ({ event }, enq) => {
                          const selected = selectedVaultPath(event.output);
                          if (O.isNone(selected)) {
                            enq.emit(outcome("cancelled"));
                            return { target: "cancelled" };
                          }
                          enq.emit(outcome("selected"));
                          return { target: "saving", input: { vaultRootPath: selected.value } };
                        },
                        // A real in-card form, not `window.prompt`: the raw prompt was
                        // unstyled, unlabeled, and cancelling it stranded the operator on
                        // the vault gate with no visible way forward (QA closeout finding).
                        onError: (args, enq) => {
                          enq.emit(outcome("manual_path_form"));
                          enq(args.actions.logIntakeCause, {
                            ...args,
                            params: IntakeLogRequest.make({
                              action: "pick_workspace_vault",
                              cause: args.event.error,
                              message: "sidecar vault directory picker failed",
                            }),
                          });
                          return { target: "manualRequested" };
                        },
                      },
                    },
                    saving: {
                      invoke: {
                        src: "persistVaultRoot",
                        input: ({ context, input }) => ({
                          workspaceId: context.workspaceId,
                          vaultRootPath: input.vaultRootPath,
                        }),
                        onDone: (_, enq) => {
                          enq.emit(outcome("success"));
                          return { target: "saved" };
                        },
                        onError: (args, enq) => {
                          enq.emit(outcome("save_failure"));
                          enq(args.actions.logIntakeCause, {
                            ...args,
                            params: IntakeLogRequest.make({
                              action: "save_workspace_vault",
                              cause: args.event.error,
                              message: "workspace vault persistence failed",
                            }),
                          });
                          return {
                            target: "saveFailed",
                            input: { message: vaultConfigurationFailureMessage(args.event.error) },
                          };
                        },
                      },
                    },
                    cancelled: { type: "final", output: PickerOutcome.cases.cancelled.make() },
                    saved: { type: "final", output: PickerOutcome.cases.saved.make() },
                    pickerFailed: {
                      type: "final",
                      output: PickerOutcome.cases.failed.make({ message: PICKER_FAILURE_MESSAGE }),
                    },
                    saveFailed: {
                      type: "final",
                      output: ({ input }) => PickerOutcome.cases.failed.make({ message: input.message }),
                    },
                    manualRequested: { type: "final", output: PickerOutcome.cases.manual.make() },
                  },
                  onDone: ({ event }) => {
                    if (PickerOutcome.guards.saved(event.output)) {
                      return { target: "awaitingConfig" };
                    }
                    if (PickerOutcome.guards.failed(event.output)) {
                      return { target: "failed", context: { vaultFailure: event.output.message } };
                    }
                    if (PickerOutcome.guards.manual(event.output)) {
                      return { target: "manual", context: { manualDraftPath: O.none(), manualMessage: O.none() } };
                    }
                    return { target: "idle" };
                  },
                },
                manual: {
                  initial: "editing",
                  states: {
                    editing: {
                      on: {
                        SUBMIT_MANUAL_PATH: ({ event }, enq) => {
                          const trimmed = Str.trim(event.rawPath);
                          if (Str.isNonEmpty(trimmed)) {
                            return {
                              target: "saving",
                              input: { vaultRootPath: trimmed },
                              context: { manualDraftPath: O.some(trimmed), manualMessage: O.none() },
                            };
                          }
                          enq.emit(outcome("empty_manual_path"));
                          return {
                            context: { manualDraftPath: O.none(), manualMessage: O.some(EMPTY_MANUAL_PATH_MESSAGE) },
                          };
                        },
                        CANCEL_MANUAL: { target: "cancelled" },
                      },
                    },
                    saving: {
                      invoke: {
                        src: "persistVaultRoot",
                        input: ({ context, input }) => ({
                          workspaceId: context.workspaceId,
                          vaultRootPath: input.vaultRootPath,
                        }),
                        onDone: (_, enq) => {
                          enq.emit(outcome("success"));
                          return { target: "saved" };
                        },
                        // The submitted path stays in context, so the reopened form does
                        // not force the operator to retype it.
                        onError: (args, enq) => {
                          enq.emit(outcome("save_failure"));
                          enq(args.actions.logIntakeCause, {
                            ...args,
                            params: IntakeLogRequest.make({
                              action: "save_workspace_vault",
                              cause: args.event.error,
                              message: "workspace vault persistence failed",
                            }),
                          });
                          return {
                            target: "editing",
                            context: {
                              manualMessage: pipe(args.event.error, vaultConfigurationFailureMessage, O.some),
                            },
                          };
                        },
                      },
                    },
                    cancelled: { type: "final", output: ManualOutcome.cases.cancelled.make() },
                    saved: { type: "final", output: ManualOutcome.cases.saved.make() },
                  },
                  onDone: ({ event }) =>
                    ManualOutcome.guards.saved(event.output) ? { target: "awaitingConfig" } : { target: "idle" },
                },
                awaitingConfig: {},
                failed: {
                  on: { CHOOSE_VAULT: { target: "picker" } },
                },
              },
            },
            configured: {
              initial: "idle",
              on: {
                VAULT_CONFIG_RESOLVED: ({ event, guards }) =>
                  guards.hasVaultRoot(event.vaultRootPath) ? undefined : { target: "unconfigured" },
                FILES_SELECTED: ({ event }, enq) => {
                  enq.raise({ type: "BATCH_REQUESTED", files: event.files });
                  return {};
                },
              },
              states: {
                idle: {
                  on: {
                    DRAG_ENTER: { target: "dragging" },
                    DROP: ({ event }, enq) => {
                      enq.raise({ type: "BATCH_REQUESTED", files: event.files });
                      return {};
                    },
                  },
                },
                dragging: {
                  on: {
                    DRAG_LEAVE: ({ event }) => (event.leftSurface ? { target: "idle" } : undefined),
                    DROP: ({ event }, enq) => {
                      enq.raise({ type: "BATCH_REQUESTED", files: event.files });
                      return { target: "idle" };
                    },
                  },
                },
              },
            },
          },
        },
        // A failed configuration read used to leave intake silently inert: neither
        // configured nor in onboarding. This state makes the failure visible and
        // retries it.
        loadFailed: {
          after: {
            configRetry: ({ context }) => ({
              target: "watching",
              context: { configAttempt: context.configAttempt + 1 },
            }),
          },
          on: {
            RETRY_CONFIG: { target: "watching" },
          },
        },
      },
    },
    batches: {
      initial: "idle",
      on: {
        BATCH_REQUESTED: ({ context, event }, enq) => {
          if (A.isReadonlyArrayEmpty(event.files)) {
            return undefined;
          }
          const sequence = context.batchSequence + 1;
          const intakeBatchId = batchIdFor(event.files, sequence);
          const batch = enq.spawn("intakeBatch", {
            id: `intakeBatch-${sequence}`,
            input: { intakeBatchId, workspaceId: context.workspaceId, files: event.files },
          });
          // `enq.listen` does not infer the emitted event from its type filter.
          enq.listen(batch, "file.result", (emitted) => ({
            type: "FILE_RESULT",
            entry: (emitted as IntakeBatchEmittedEvent).entry,
          }));
          enq.subscribeTo(batch, {
            done: (output) => ({ type: "BATCH_SETTLED", sequence, output }),
            error: () => ({ type: "BATCH_SETTLED", sequence, output: { intakeBatchId, entries: [] } }),
          });
          return {
            target: ".busy",
            context: { batchSequence: sequence, liveBatches: A.append(context.liveBatches, sequence) },
          };
        },
      },
      states: {
        idle: {},
        busy: {
          on: {
            BATCH_SETTLED: ({ context, event }, enq) => {
              enq.emit({
                type: "batch.settled",
                intakeBatchId: event.output.intakeBatchId,
                fileCount: A.length(event.output.entries),
              });
              const liveBatches = A.filter(context.liveBatches, (sequence) => sequence !== event.sequence);
              return A.isReadonlyArrayEmpty(liveBatches)
                ? { target: "idle", context: { liveBatches } }
                : { context: { liveBatches } };
            },
          },
        },
      },
    },
  },
});

/**
 * Snapshot type of {@link documentIntakeMachine}.
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentIntakeSnapshot = SnapshotFrom<typeof documentIntakeMachine>;

/**
 * Project the `vault` region onto the vault status the surface renders.
 *
 * **Example** (Read the status of a snapshot)
 *
 * ```ts
 * import { documentIntakeMachine, vaultStatusOf } from "@/intake/DocumentIntake.machine"
 * import { DocumentIntakeInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { createEffectActor } from "@xstate/effect"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const actor = yield* createEffectActor(documentIntakeMachine, {
 *     input: DocumentIntakeInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID })
 *   })
 *   return vaultStatusOf(actor.getSnapshot())
 * })
 * console.log(program)
 * ```
 *
 * @param snapshot - Intake actor snapshot.
 * @returns Whether the vault configuration is pending, present, absent or unreadable.
 * @category projections
 * @since 0.0.0
 */
export const vaultStatusOf = (snapshot: DocumentIntakeSnapshot): DocumentIntakeVaultStatus => {
  if (snapshot.matches({ vault: { watching: "configured" } })) {
    return "configured";
  }
  if (snapshot.matches({ vault: { watching: "unconfigured" } })) {
    return "needs-onboarding";
  }
  return snapshot.matches({ vault: "loadFailed" }) ? "unavailable" : "pending";
};

/**
 * Project the `unconfigured` states onto the operator-facing selection view.
 *
 * **Details**
 *
 * `awaitingConfig` projects to `saving`: the vault root is persisted and the
 * card keeps its saving label until the configuration feed confirms it.
 *
 * **Example** (Read the selection view of a snapshot)
 *
 * ```ts
 * import { documentIntakeMachine, vaultSelectionOf } from "@/intake/DocumentIntake.machine"
 * import { DocumentIntakeInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { createEffectActor } from "@xstate/effect"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const actor = yield* createEffectActor(documentIntakeMachine, {
 *     input: DocumentIntakeInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID })
 *   })
 *   return vaultSelectionOf(actor.getSnapshot()).kind
 * })
 * console.log(program)
 * ```
 *
 * @param snapshot - Intake actor snapshot.
 * @returns The vault-selection view for the onboarding card.
 * @category projections
 * @since 0.0.0
 */
export const vaultSelectionOf = (snapshot: DocumentIntakeSnapshot): VaultSelectionState => {
  if (snapshot.matches({ vault: { watching: { unconfigured: { manual: "editing" } } } })) {
    return VaultSelectionState.cases.manual.make({
      draftPath: snapshot.context.manualDraftPath,
      message: snapshot.context.manualMessage,
    });
  }
  const failure = snapshot.matches({ vault: { watching: { unconfigured: "failed" } } })
    ? O.fromUndefinedOr(snapshot.context.vaultFailure)
    : O.none<string>();
  if (O.isSome(failure)) {
    return VaultSelectionState.cases.failed.make({ message: failure.value });
  }
  if (
    snapshot.matches({ vault: { watching: { unconfigured: { picker: "saving" } } } }) ||
    snapshot.matches({ vault: { watching: { unconfigured: { manual: "saving" } } } }) ||
    snapshot.matches({ vault: { watching: { unconfigured: "awaitingConfig" } } })
  ) {
    return VaultSelectionState.cases.saving.make();
  }
  return snapshot.matches({ vault: { watching: { unconfigured: "picker" } } })
    ? VaultSelectionState.cases.choosing.make()
    : VaultSelectionState.cases.idle.make();
};

/**
 * Project an intake snapshot onto the renderer-facing intake view.
 *
 * **Example** (Project a snapshot)
 *
 * ```ts
 * import { documentIntakeMachine, documentIntakeStateOf } from "@/intake/DocumentIntake.machine"
 * import { DocumentIntakeInput } from "@/intake/DocumentIntake.models"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { createEffectActor } from "@xstate/effect"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const actor = yield* createEffectActor(documentIntakeMachine, {
 *     input: DocumentIntakeInput.make({ workspaceId: DEFAULT_PROFESSIONAL_WORKSPACE_ID })
 *   })
 *   return documentIntakeStateOf(actor.getSnapshot()).activeBatches
 * })
 * console.log(program)
 * ```
 *
 * @param snapshot - Intake actor snapshot.
 * @returns Live batch count, drag highlight, results and vault-selection view.
 * @category projections
 * @since 0.0.0
 */
export const documentIntakeStateOf = (snapshot: DocumentIntakeSnapshot): DocumentIntakeState =>
  DocumentIntakeState.make({
    activeBatches: S.Natural.make(A.length(snapshot.context.liveBatches)),
    isDragging: snapshot.matches({ vault: { watching: { configured: "dragging" } } }),
    results: snapshot.context.results,
    vaultSelection: vaultSelectionOf(snapshot),
  });
