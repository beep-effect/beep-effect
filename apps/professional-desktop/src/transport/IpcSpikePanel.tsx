/**
 * Dev/QA panel for the Tauri-IPC sidecar transport spike, gated behind both an
 * IPC sidecar launch and `?ipc=1` (so it ships in packaged builds for
 * validation but stays hidden by default).
 *
 * "Send over IPC" creates a thread and streams a fixture assistant turn over the
 * {@link IpcChatProtocolLive} transport — proving the streaming `SendMessage`
 * path round-trips through the Rust stdio bridge with no loopback HTTP (verify
 * DevTools Network shows no `/rpc` / `:3939` traffic). "Cancel" interrupts a
 * running turn, exercising the orchestrator's "cancel leaves no partial assistant
 * row" contract over IPC.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { ChatRpcs } from "@beep/agents-use-cases/public";
import { LogRedactedCauseOptions, logRedactedCause, redactCauseForClient } from "@beep/observability/CauseRedaction";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { RpcClient } from "effect/unstable/rpc";
import { decodeWorkspaceId, userDocument } from "@/chat/ChatFixtures";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { IpcChatProtocolLive } from "./IpcChatClient.ts";
import type { JSX } from "react";

// Runtime that provides the IPC transport (`RpcClient.Protocol`) plus a Scope to
// the spike effect. The runtime owns the socket lifecycle and the fiber driving
// each run, replacing the component-local `Layer.build` + `Effect.runFork`.
const ipcSpikeRuntime = professionalBrowserRuntime.factory(IpcChatProtocolLive);

// Streamed log buffer (client state, replaces `useState`). The run effect writes
// lines as they arrive via `ctx.set`; "Cancel"/re-run reset it through the
// registry-backed setter.
const linesAtom = Atom.make<ReadonlyArray<string>>([]);

// One self-contained run: open the IPC socket, create a thread, and stream a
// turn. The runtime Scope discharges the socket on completion/interrupt; typed
// errors and interrupts are surfaced to the log buffer (a `stopped: …` line) via
// `catchCause` rather than bubbling out of the atom.
const runSpikeAtom = ipcSpikeRuntime.fn<void>()(
  Effect.fn("professional_desktop.ipc.run_spike")(function* () {
    const registry = yield* AtomRegistry.AtomRegistry;
    // The fn node is interrupted on re-run/Cancel before this fiber unwinds, so
    // its `ctx` may already be disposed; go through the registry-backed setter,
    // which outlives the node, to append/reset log lines.
    const log = Effect.fnUntraced(function* (line: string) {
      registry.set(linesAtom, [...registry.get(linesAtom), line]);
    });
    yield* Effect.sync(() => {
      registry.set(linesAtom, []);
    });
    yield* Effect.gen(function* () {
      const client = yield* RpcClient.make(ChatRpcs);
      const workspaceId = decodeWorkspaceId(1);
      yield* Effect.annotateCurrentSpan({
        "professional_desktop.ipc.workspace_id": workspaceId,
      });
      const thread = yield* client.CreateThread({ workspaceId, title: "ipc spike" });
      yield* log(`thread created over ipc: ${thread.id}`);
      const blocks = yield* Ref.make(0);
      const logStreamBlock = Effect.fnUntraced(function* () {
        const blockCount = yield* Ref.updateAndGet(blocks, (count) => count + 1);
        yield* log(`streamed block ${blockCount}`);
      });
      yield* client
        .SendMessage({ threadId: thread.id, content: userDocument("hello over tauri ipc"), requestId: "ipc-spike" })
        .pipe(Stream.runForEach(logStreamBlock));
      yield* Ref.get(blocks).pipe(
        Effect.flatMap((blockCount) => log(`stream complete (${blockCount} block(s)) — no /rpc, no :3939`))
      );
      yield* Effect.annotateCurrentSpan({
        "professional_desktop.ipc.outcome": "succeeded",
      });
    }).pipe(
      Effect.catchCause((cause) =>
        logRedactedCause(
          cause,
          LogRedactedCauseOptions.make({
            message: "professional desktop ipc spike stopped",
            level: "Warn",
            attributes: {
              "professional_desktop.ipc.outcome": "stopped",
              subsystem: "ipc_spike",
            },
          })
        ).pipe(
          Effect.andThen(
            Effect.annotateCurrentSpan({
              "professional_desktop.ipc.outcome": "stopped",
            })
          ),
          Effect.andThen(log(`stopped: ${redactCauseForClient(cause).message}`))
        )
      )
    );
  })
);

/**
 * Floating dev panel that drives the IPC transport spike. Mounted by `App` only
 * when the shell reports IPC mode and the page URL carries `?ipc=1`.
 *
 * **Example** (Access component name)
 *
 * ```tsx
 * import { IpcSpikePanel } from "@/transport/IpcSpikePanel"
 *
 * console.log(IpcSpikePanel.name)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function IpcSpikePanel(): JSX.Element {
  const lines = useAtomValue(linesAtom);
  const runSpike = useAtomSet(runSpikeAtom);

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: 360,
        padding: 12,
        background: "rgba(0,0,0,0.85)",
        color: "#e6e6e6",
        borderRadius: 8,
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      <strong>IPC transport spike</strong>
      <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <button type="button" onClick={() => runSpike(void 0)}>
          Send over IPC
        </button>
        <button type="button" onClick={() => runSpike(Atom.Interrupt)}>
          Cancel
        </button>
      </div>
      <div style={{ maxHeight: 180, overflow: "auto" }}>
        {A.map(lines, (line, index) => (
          <div key={`${index}-${line}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}
