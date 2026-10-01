import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";
import { WorkspaceVaultConfig } from "@beep/workspace-use-cases/public";
import { createEffectActor } from "@xstate/effect";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import { Reactivity } from "effect/reactivity";
import { DesktopIntakeClient } from "@/intake/DesktopIntake.client";
import { documentIntakeMachine } from "@/intake/DocumentIntake.machine";
import { DocumentIntakeInput } from "@/intake/DocumentIntake.models";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import type { DocumentIntakeActionError } from "@beep/documents-use-cases/public";
import type { WorkspaceVaultActionError } from "@beep/workspace-use-cases/public";
import type { VaultSelectionOutcome } from "@/intake/DocumentIntake.models";
import type { VaultDirectoryPickError } from "@/intake/VaultDirectoryPicker.rpc";

export const workspaceId = DEFAULT_PROFESSIONAL_WORKSPACE_ID;

export const selectedPath = "/tmp/professional-desktop-vault";

export const configuredVault = WorkspaceVaultConfig.make({
  workspaceId,
  vaultRootPath: O.some(WorkspaceVaultRootPath.make(selectedPath)),
});

export const unconfiguredVault = WorkspaceVaultConfig.make({ workspaceId });

type IntakeRpcError = DocumentIntakeActionError | VaultDirectoryPickError | WorkspaceVaultActionError;

export interface IntakeHandlers {
  readonly GetWorkspaceVault?: () => Effect.Effect<WorkspaceVaultConfig, IntakeRpcError>;
  readonly IntakeDroppedFile?: (payload: unknown) => Effect.Effect<unknown, IntakeRpcError>;
  readonly PickVaultDirectory?: () => Effect.Effect<O.Option<string>, IntakeRpcError>;
  readonly SetWorkspaceVault?: (payload: unknown) => Effect.Effect<WorkspaceVaultConfig, IntakeRpcError>;
}

// A fake RPC client: an RPC with no handler is a test defect, not a failure the
// machine should recover from.
export const intakeClient = (handlers: IntakeHandlers): DesktopIntakeClient["Service"] =>
  DesktopIntakeClient.of(((tag: keyof IntakeHandlers, payload: unknown) => {
    const handler = handlers[tag];
    return handler === undefined ? Effect.die(`unexpected intake RPC: ${tag}`) : handler(payload);
  }) as unknown as DesktopIntakeClient["Service"]);

export const intakeFile = (name: string): File => {
  const file = new File(["content"], name);
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  });
  return file;
};

const startIntakeWithRetryBase = (configRetryBaseMillis: number) => (client: DesktopIntakeClient["Service"]) =>
  createEffectActor(documentIntakeMachine, {
    input: DocumentIntakeInput.make({ workspaceId, configRetryBaseMillis }),
  }).pipe(Effect.provideService(DesktopIntakeClient, client));

export const startIntake = startIntakeWithRetryBase(2000);

// A retry test advances its own TestClock, so it runs outside the shared layer
// block and brings a Reactivity service of its own.
export const startIntakeIsolated = (configRetryBaseMillis: number) => (client: DesktopIntakeClient["Service"]) =>
  Effect.flatMap(Reactivity.make, (reactivity) =>
    startIntakeWithRetryBase(configRetryBaseMillis)(client).pipe(
      Effect.provideService(Reactivity.Reactivity, reactivity)
    )
  );

type IntakeActor = Effect.Success<ReturnType<typeof startIntake>>;

// Emitted events reach listeners after the snapshot that produced them, so a
// test waits on this queue instead of reading an array right after `waitFor`.
export const recordOutcomes = Effect.fnUntraced(function* (actor: IntakeActor) {
  const outcomes = yield* Queue.unbounded<VaultSelectionOutcome>();
  actor.on("vault.outcome", (event) => Queue.offerUnsafe(outcomes, event.outcome));
  return outcomes;
});

export const recordSettledBatches = Effect.fnUntraced(function* (actor: IntakeActor) {
  const settled = yield* Queue.unbounded<number>();
  actor.on("batch.settled", (event) => Queue.offerUnsafe(settled, event.fileCount));
  return settled;
});
