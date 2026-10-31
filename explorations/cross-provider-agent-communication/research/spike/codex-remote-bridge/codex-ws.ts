// Generic JSON-RPC probe for a Codex app-server WebSocket listener (Bun).
// usage: bun run codex-ws.ts --url ws://127.0.0.1:48123 --token-env CODEX_TOMPC_WS_TOKEN \
//          [--until turn/completed] [--timeout-ms 90000] [--quiet-deltas] <json-request>...
// Each <json-request> is {"method":..., "params":...}; ids are assigned 1..n and sent after
// `initialize` succeeds, each one after the previous response arrives. Prints every message.
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
const url = opt("--url", "ws://127.0.0.1:48123")!;
if (O.isNone(protectedBridgeUrl(url))) {
  console.error("--url requires wss:// remotely, or ws:// on a loopback SSH tunnel endpoint");
  process.exit(2);
}
const tokenEnv = opt("--token-env", "CODEX_TOMPC_WS_TOKEN")!;
const until = opt("--until");
const timeoutMs = Number(opt("--timeout-ms", "90000"));
const quietDeltas = argv.includes("--quiet-deltas");
if (quietDeltas) argv.splice(argv.indexOf("--quiet-deltas"), 1);
const token = process.env[tokenEnv];
if (!token) {
  console.error(`env ${tokenEnv} is empty`);
  process.exit(2);
}
const reqFile = opt("--requests-file");
const rawReqs = reqFile ? (await Bun.file(reqFile).text()).split("\n").filter((l) => l.trim().length > 0) : argv;
const requests = rawReqs.map((a) => JSON.parse(a) as { method: string; params?: unknown });
const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } } as any);
let nextId = 1;
let pending: number | null = null;
const queue = [...requests];
let done = false;
const log = (tag: string, o: unknown) => console.log(`${new Date().toISOString()} ${tag} ${JSON.stringify(o)}`);
const send = (method: string, params?: unknown) => {
  const id = nextId++;
  pending = id;
  const msg = { id, method, params };
  log(">>", msg);
  ws.send(JSON.stringify(msg));
  return id;
};
const finish = (code: number) => {
  if (done) return;
  done = true;
  try {
    ws.close();
  } catch {}
  setTimeout(() => process.exit(code), 100);
};
const timer = setTimeout(() => {
  log("!!", { timeout: timeoutMs });
  finish(3);
}, timeoutMs);
ws.addEventListener("open", () => {
  log("--", { open: url });
  send("initialize", {
    clientInfo: { name: "beep_bridge_probe", title: "beep bridge probe", version: "0.0.1" },
    capabilities: { experimentalApi: true },
  });
});
ws.addEventListener("message", (ev) => {
  let m: any;
  try {
    m = JSON.parse(String(ev.data));
  } catch {
    log("<<raw", String(ev.data));
    return;
  }
  const isDelta = typeof m.method === "string" && /delta|outputDelta|summaryText/.test(m.method);
  if (!(quietDeltas && isDelta)) log("<<", m);
  if (m.id !== undefined && m.id === pending) {
    pending = null;
    if (m.id === 1 && !m.error) {
      ws.send(JSON.stringify({ method: "initialized" }));
      log(">>", { method: "initialized" });
    }
    if (m.error) {
      log("!!", { error: m.error });
      finish(4);
      return;
    }
    const nxt = queue.shift();
    if (nxt) send(nxt.method, nxt.params);
    else if (!until) finish(0);
  }
  if (until && m.method === until) finish(0);
});
ws.addEventListener("error", (e: any) => {
  log("!!", { error: String(e?.message ?? e) });
  finish(5);
});
ws.addEventListener("close", (e: any) => {
  log("--", { close: e.code, reason: e.reason });
  clearTimeout(timer);
  finish(done ? 0 : 6);
});
