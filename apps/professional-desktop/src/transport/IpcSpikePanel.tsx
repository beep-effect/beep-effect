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
import { redactCauseForClient } from "@beep/observability";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Stream } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { RpcClient } from "effect/unstable/rpc";
import { decodeWorkspaceId, userDocument } from "@/chat/ChatFixtures";
import { IpcChatProtocolLive } from "./IpcChatClient.js";
import type { JSX } from "react";

// Runtime that provides the IPC transport (`RpcClient.Protocol`) plus a Scope to
// the spike effect. The runtime owns the socket lifecycle and the fiber driving
// each run, replacing the component-local `Layer.build` + `Effect.runFork`.
const ipcSpikeRuntime = Atom.runtime(IpcChatProtocolLive);

// Streamed log buffer (client state, replaces `useState`). The run effect writes
// lines as they arrive via `ctx.set`; "Cancel"/re-run reset it through the
// registry-backed setter.
const linesAtom = Atom.make<ReadonlyArray<string>>([]);

// One self-contained run: open the IPC socket, create a thread, and stream a
// turn. The runtime Scope discharges the socket on completion/interrupt; typed
// errors and interrupts are surfaced to the log buffer (a `stopped: …` line) via
// `catchCause` rather than bubbling out of the atom.
const runSpikeAtom = ipcSpikeRuntime.fn<void>()(
  Effect.fnUntraced(function* () {
    const registry = yield* AtomRegistry.AtomRegistry;
    // The fn node is interrupted on re-run/Cancel before this fiber unwinds, so
    // its `ctx` may already be disposed; go through the registry-backed setter,
    // which outlives the node, to append/reset log lines.
    const log = (line: string): void => registry.set(linesAtom, [...registry.get(linesAtom), line]);
    registry.set(linesAtom, []);
    yield* Effect.gen(function* () {
      const client = yield* RpcClient.make(ChatRpcs);
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* client.CreateThread({ workspaceId, title: "ipc spike" });
      log(`thread created over ipc: ${thread.id}`);
      let blocks = 0;
      yield* client
        .SendMessage({ threadId: thread.id, content: userDocument("hello over tauri ipc"), requestId: "ipc-spike" })
        .pipe(
          Stream.runForEach(() =>
            Effect.sync(() => {
              blocks += 1;
              log(`streamed block ${blocks}`);
            })
          )
        );
      log(`stream complete (${blocks} block(s)) — no /rpc, no :3939`);
    }).pipe(Effect.catchCause((cause) => Effect.sync(() => log(`stopped: ${redactCauseForClient(cause).message}`))));
  })
);

/**
 * Floating dev panel that drives the IPC transport spike. Mounted by `App` only
 * when the shell reports IPC mode and the page URL carries `?ipc=1`.
 *
 * @example
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
  // Re-run interrupts any in-flight run before forking a new one (the fn node
  // guards re-entry), so we never orphan a fiber or interleave its log lines.
  const run = (): void => runSpike();
  // Cancel interrupts the in-flight run; `onInterrupt`/`catchCause` log the stop.
  const cancel = (): void => runSpike(Atom.Interrupt);

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
        <button type="button" onClick={run}>
          Send over IPC
        </button>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
      <div style={{ maxHeight: 180, overflow: "auto" }}>
        {lines.map((line, index) => (
          <div key={`${index}-${line}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}
