// One-shot ask against a Codex app-server WebSocket listener (Bun >= 1.2, no dependencies).
//
// Qualified 2026-10-21 against codex-cli 0.160.1 on Windows through an SSH loopback tunnel:
//   ssh -f -N -M -S ~/.ssh/cm-tom-pc-bridge -o ExitOnForwardFailure=yes -L 127.0.0.1:48123:127.0.0.1:48123 <pc-user>@tom-pc-1
//   (close later with: ssh -S ~/.ssh/cm-tom-pc-bridge -O exit <pc-user>@tom-pc-1)
//   CODEX_TOMPC_WS_TOKEN="$(cat ~/.config/beep/tom-pc-codex-ws.token)" \
//   bun run codex-remote-ask.ts --url ws://127.0.0.1:48123 --token-env CODEX_TOMPC_WS_TOKEN \
//     (--thread <uuid> | --new --cwd 'C:\PracticeKG\bridge-probe' [--name "<thread name>"]) \
//     --text "probe: reply with the single word PONG and take no action" \
//     [--sandbox read-only] [--approval never] [--timeout-ms 180000]
//
// Flow: initialize -> thread/start | thread/resume with explicit approvalPolicy + sandbox (fail closed
// when the effective policy differs) -> turn/start -> wait for the turn/completed notification on this
// same connection (the app-server only streams turn events to the connection that started or resumed
// the thread) -> print one JSON line with the last agentMessage text. thread/read is the fallback when
// the notification is missed: the turn gets the whole `--timeout-ms` budget, and the read then runs with
// its own `fallbackGraceMs` budget past the deadline, as turn/interrupt does with `interruptGraceMs`, so
// a short budget never interrupts a turn just to make room for the read. Worst-case wall clock is
// `--timeout-ms` plus both graces. A turn/completed that arrives while the read is in flight still
// counts, even when the read then fails. Every other RPC is bounded by the remaining `--timeout-ms`
// budget, and every RPC fails when the socket closes. If the turn this client started is still running
// when the budget runs out, or when any later step fails, the client sends turn/interrupt before
// exiting. If the socket itself is gone (the SSH tunnel dropped), the interrupt cannot travel over it:
// the client makes one bounded reconnect attempt to send it and otherwise prints `interruptNotPossible`
// with the thread and turn ids, because the turn keeps running on the remote machine until someone
// re-opens the tunnel and sends turn/interrupt (for example with codex-ws.ts). Notifications are echoed
// to stderr. The bearer token is read from the named environment variable only; it never appears in
// argv or output.
//
// Exit codes: 0 completed; 2 bad arguments or empty token env; 3 timeout (turn interrupted); 4 RPC or
// protocol error; 6 socket closed or errored (interrupt attempted over a fresh connection); 7 effective
// policy differs from the requested one; 8 turn ended without completing; 9 thread busy (a turn is
// already running; use codex queue).
import * as O from "effect/Option";
import { protectedBridgeUrl } from "./transport.ts";

const argv = Bun.argv.slice(2);
const opt = (name: string, dflt?: string) => {
  const i = argv.indexOf(name);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const flag = (name: string) => {
  const i = argv.indexOf(name);
  if (i < 0) return false;
  argv.splice(i, 1);
  return true;
};
const url = opt("--url", "ws://127.0.0.1:48123")!;
if (O.isNone(protectedBridgeUrl(url))) {
  console.error("--url requires wss:// remotely, or ws:// on a loopback SSH tunnel endpoint");
  process.exit(2);
}
const tokenEnv = opt("--token-env", "CODEX_TOMPC_WS_TOKEN")!;
const threadId = opt("--thread");
const isNew = flag("--new");
const cwd = opt("--cwd");
const name = opt("--name");
const text = opt("--text");
const sandbox = opt("--sandbox", "read-only")!;
const approvalPolicy = opt("--approval", "never")!;
const timeoutMs = Number(opt("--timeout-ms", "180000"));
const interruptGraceMs = 5000;
const fallbackGraceMs = 5000;
const token = process.env[tokenEnv];
if (!token) {
  console.error(`env ${tokenEnv} is empty`);
  process.exit(2);
}
if (!text) {
  console.error("--text is required");
  process.exit(2);
}
if (!threadId && !isNew) {
  console.error("pass --thread <uuid> or --new --cwd <path>");
  process.exit(2);
}
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error("--timeout-ms must be a positive number of milliseconds");
  process.exit(2);
}
const err = (o: unknown) => console.error(`${new Date().toISOString()} ${JSON.stringify(o)}`);
const deadline = Date.now() + timeoutMs;
const remaining = () => Math.max(0, deadline - Date.now());
const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } } as any);
type Waiter = {
  method: string;
  resolve: (m: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const waiters = new Map<number, Waiter>();
let nextId = 1;
let socketOpen = false;
let startedTurn: { threadId: string; turnId: string } | null = null;
let completedTurn: any = null;
const agentMessages: string[] = [];
// Bounded JSON-RPC call: rejects when the budget runs out or the socket closes.
const call = (method: string, params?: unknown, budgetMs = remaining()) =>
  new Promise<any>((resolve, reject) => {
    if (!socketOpen) {
      reject(new Error(`${method}: socket is closed`));
      return;
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error(`${method}: no response within ${budgetMs} ms`));
    }, budgetMs);
    waiters.set(id, { method, resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
const settle = (id: number, m: any) => {
  const w = waiters.get(id);
  if (!w) return;
  waiters.delete(id);
  clearTimeout(w.timer);
  if (m.error) w.reject(new Error(`${w.method}: ${JSON.stringify(m.error)}`));
  else w.resolve(m.result);
};
ws.addEventListener("message", (ev) => {
  let m: any;
  try {
    m = JSON.parse(String(ev.data));
  } catch {
    return;
  }
  if (m.id !== undefined && waiters.has(m.id)) {
    settle(m.id, m);
    return;
  }
  if (!m.method) return;
  if (!/delta|tokenUsage|startupStatus/.test(m.method)) err({ notification: m.method, params: m.params });
  const p = m.params ?? {};
  if (m.method === "item/completed" && p.turnId === startedTurn?.turnId && p.item?.type === "agentMessage")
    agentMessages.push(p.item.text ?? JSON.stringify(p.item.content));
  if (m.method === "turn/completed" && p.turn?.id === startedTurn?.turnId) completedTurn = p.turn;
});
ws.addEventListener("error", (e: any) => {
  err({ wsError: String(e?.message ?? e) }); // `close` follows and rejects every pending waiter
});
ws.addEventListener("close", (e: any) => {
  socketOpen = false;
  for (const [id, w] of waiters) {
    waiters.delete(id);
    clearTimeout(w.timer);
    w.reject(new Error(`${w.method}: socket closed (${e.code})`));
  }
});
await new Promise<void>((res, rej) => {
  const t = setTimeout(() => rej(new Error("open: no connection within budget")), remaining());
  ws.addEventListener("open", () => {
    clearTimeout(t);
    socketOpen = true;
    res();
  });
  ws.addEventListener("close", (e: any) => {
    clearTimeout(t);
    rej(new Error(`closed before open: ${e.code}`));
  });
}).catch((e) => {
  err({ error: String(e) });
  process.exit(6);
});
const statusWord = (s: any) => (typeof s === "string" ? s : (s?.type ?? JSON.stringify(s)));
const expectSandbox: Record<string, string> = {
  "read-only": "readOnly",
  "workspace-write": "workspaceWrite",
  "danger-full-access": "dangerFullAccess",
};
// One bounded attempt to send turn/interrupt over a fresh connection when the original socket is gone.
const reconnectAndInterrupt = (target: { threadId: string; turnId: string }, reason: string) =>
  new Promise<void>((done) => {
    const recovery = "re-open the tunnel, then send turn/interrupt {threadId, turnId} (codex-ws.ts --requests-file)";
    let finished = false;
    const finish = (receipt: unknown) => {
      if (finished) return;
      finished = true;
      err(receipt);
      try {
        w.close();
      } catch {}
      done();
    };
    const timer = setTimeout(() => finish({ interruptNotPossible: { ...target, reason, recovery } }), interruptGraceMs);
    const w = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } } as any);
    let id = 0;
    const pending = new Map<number, (m: any) => void>();
    const send = (method: string, params?: unknown) =>
      new Promise<any>((res) => {
        const i = ++id;
        pending.set(i, res);
        w.send(JSON.stringify({ id: i, method, params }));
      });
    w.addEventListener("message", (ev) => {
      try {
        const m = JSON.parse(String(ev.data));
        const r = m.id !== undefined ? pending.get(m.id) : undefined;
        if (r) {
          pending.delete(m.id);
          r(m);
        }
      } catch {}
    });
    w.addEventListener("error", () => {});
    w.addEventListener("close", () => {
      clearTimeout(timer);
      finish({ interruptNotPossible: { ...target, reason, recovery } });
    });
    w.addEventListener("open", async () => {
      await send("initialize", {
        clientInfo: { name: "beep_bridge_ask", title: "beep bridge ask (interrupt)", version: "0.0.4" },
      });
      w.send(JSON.stringify({ method: "initialized" }));
      const r = await send("turn/interrupt", { threadId: target.threadId, turnId: target.turnId });
      clearTimeout(timer);
      finish(
        r.error
          ? { interruptFailed: { ...target, reason, error: r.error } }
          : { interrupted: { ...target, reason, via: "reconnect" } }
      );
    });
  });
// Never leave the turn this client started running on the remote machine.
const interruptStartedTurn = async (reason: string) => {
  if (!startedTurn || completedTurn) return;
  if (!socketOpen) {
    await reconnectAndInterrupt(startedTurn, reason);
    return;
  }
  try {
    await call("turn/interrupt", { threadId: startedTurn.threadId, turnId: startedTurn.turnId }, interruptGraceMs);
    err({ interrupted: { ...startedTurn, reason } });
  } catch (e) {
    err({ interruptFailed: { ...startedTurn, reason, error: String(e) } });
  }
};
const exitWith = async (code: number, reason: string) => {
  await interruptStartedTurn(reason);
  try {
    ws.close();
  } catch {}
  process.exit(code);
};
try {
  const init = await call("initialize", {
    clientInfo: { name: "beep_bridge_ask", title: "beep bridge ask", version: "0.0.4" },
  });
  ws.send(JSON.stringify({ method: "initialized" }));
  err({ initialized: { userAgent: init.userAgent, platformOs: init.platformOs } });
  const policy = { approvalPolicy, sandbox };
  const opened = threadId
    ? await call("thread/resume", { threadId, excludeTurns: true, ...policy })
    : await call("thread/start", { cwd, ...policy });
  const tid: string = opened.thread.id;
  const effSandbox = statusWord(opened.sandbox);
  const effApproval = statusWord(opened.approvalPolicy);
  if (effApproval !== approvalPolicy || effSandbox !== expectSandbox[sandbox]) {
    err({ policyMismatch: { requested: policy, effective: { approvalPolicy: effApproval, sandbox: effSandbox } } });
    await exitWith(7, "policy mismatch"); // fail closed: never run a turn under a wider policy than requested
  }
  const threadStatus = statusWord(opened.thread.status);
  if (threadStatus === "active") {
    // turn/start on a busy thread joins the running turn (steer semantics) and returns that turn's id,
    // so a second ask would be folded into someone else's turn: refuse instead.
    err({ threadBusy: { threadId: tid, status: opened.thread.status } });
    await exitWith(9, "thread busy");
  }
  if (name) await call("thread/name/set", { threadId: tid, name });
  const started = await call("turn/start", { threadId: tid, input: [{ type: "text", text }] });
  startedTurn = { threadId: tid, turnId: started.turn.id };
  err({ turnStarted: { ...startedTurn, model: opened.model, approvalPolicy: effApproval, sandbox: effSandbox } });
  let last: any = null;
  // The turn gets the whole budget; the thread/read fallback below runs on its own grace past the deadline.
  while (remaining() > 0 && socketOpen) {
    if (completedTurn) {
      last = completedTurn;
      break;
    }
    await Bun.sleep(Math.min(1000, remaining()));
  }
  if (!last && completedTurn) last = completedTurn;
  if (!last && socketOpen) {
    // notification missed: read the thread (own `fallbackGraceMs` budget) before deciding it timed out.
    // If turn/completed lands while the read is in flight, a read that then fails (socket closed, no
    // response within its grace) is moot: the re-check below reports that turn.
    const read = await call("thread/read", { threadId: tid, includeTurns: true }, fallbackGraceMs).catch((e) => {
      if (completedTurn) return null;
      throw e;
    });
    if (read) {
      const turn = (read.thread.turns ?? []).find((t: any) => t.id === startedTurn!.turnId);
      const readStatus = turn ? statusWord(turn.status) : "missing";
      // Hydrated history can label a still-open turn "interrupted" with no completedAt; only a completed
      // status, or a terminal status that carries completedAt, counts as finished.
      const finished =
        turn && (readStatus === "completed" || (readStatus !== "inProgress" && turn.completedAt != null));
      err({
        fallbackRead: {
          turnId: startedTurn!.turnId,
          status: readStatus,
          completedAt: turn?.completedAt ?? null,
          finished: Boolean(finished),
        },
      });
      if (finished) {
        last = turn;
        for (const it of turn.items ?? [])
          if (it.type === "agentMessage") agentMessages.push(it.text ?? JSON.stringify(it.content));
      }
    }
  }
  // turn/completed can arrive while thread/read is in flight: report that turn instead of a timeout.
  if (!last && completedTurn) last = completedTurn;
  if (!last) {
    if (!socketOpen) throw new Error("socket closed while the turn was running");
    err({ timeout: timeoutMs, ...startedTurn });
    await exitWith(3, "client timeout");
  }
  const replies =
    agentMessages.length > 0
      ? agentMessages
      : (last.items ?? [])
          .filter((it: any) => it.type === "agentMessage")
          .map((it: any) => it.text ?? JSON.stringify(it.content));
  console.log(
    JSON.stringify({
      threadId: tid,
      turnId: startedTurn!.turnId,
      status: statusWord(last.status),
      durationMs: last.durationMs ?? null,
      reply: replies.at(-1) ?? null,
      agentMessages: replies.length,
    })
  );
  ws.close();
  process.exit(statusWord(last.status) === "completed" ? 0 : 8);
} catch (e) {
  err({ error: String(e) });
  await exitWith(socketOpen ? 4 : 6, "error");
}
