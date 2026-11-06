/**
 * Real private application ancestry for synthetic Cowork callback fixtures.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { failure } from "../internal/cursor-lifecycle-schemas.ts";
import { makeSealedRuntimeFixture, sealedRuntimeSocketPeerSource } from "./sealed-runtime.ts";

const $I = $RepoAiMetricsId.create("test/cowork-ancestor");
const identity = S.Struct({ appPid: S.Int, appStartTicks: S.String }).pipe(
  $I.annoteSchema("SyntheticAppIdentity", { description: "Transient metadata of the exact owned synthetic parent." })
);
const scriptResult = S.Struct({ code: S.Int, stdout: S.String, stderr: S.String }).pipe(
  $I.annoteSchema("SyntheticScriptResult", { description: "Bounded output from the actual owned plugin fixture." })
);
const encode = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeIdentity = S.decodeEffect(S.fromJsonString(identity));
const decodeScriptResult = S.decodeEffect(S.fromJsonString(scriptResult));
// The real application wrapper owns the real persistent callback child. Only its own
// PID/start ticks and bounded child replies cross stdout; no process argv/env is read.
const appSource = String.raw`
const {spawn} = require("node:child_process");
const fs = require("node:fs");
const readline = require("node:readline");
const input = readline.createInterface({input:process.stdin,crlfDelay:Infinity});
let engine;
const children = new Set();
function own(child) { children.add(child); child.once("close",()=>children.delete(child)); return child; }
function stop() {
  const pending = Array.from(children, child => new Promise(resolve => {
    child.once("close",resolve); child.kill("SIGKILL");
  }));
  Promise.all(pending).then(()=>process.exit(0));
}
process.once("SIGTERM",stop);
input.on("line", line => {
  const command = JSON.parse(line);
  if (!engine) {
    engine = own(spawn(process.execPath,["--eval",command.peer],{stdio:["pipe","pipe","ignore"],env:{}}));
    engine.stdout.pipe(process.stdout,{end:false});
    const stat=fs.readFileSync("/proc/self/stat","utf8");
    const fields=stat.slice(stat.lastIndexOf(")")+2).split(" ");
    process.stdout.write(JSON.stringify({appPid:process.pid,appStartTicks:fields[19]})+"\n");
  } else if (command.kind === "peer") {
    engine.stdin.write((command.drop?"drop":"ack")+"|"+command.path+"\n"+command.body+"\n");
  } else {
    const child=own(spawn(process.execPath,[command.script,command.path],{
      stdio:["pipe","pipe","pipe"],env:{CLAUDE_CODE_ENTRYPOINT:command.selector}
    }));
    let stdout="",stderr="",size=0;
    function capture(name,chunk) {
      size+=chunk.length;if(size>4096){child.kill("SIGKILL");return;}
      if(name==="out")stdout+=chunk.toString("utf8");else stderr+=chunk.toString("utf8");
    }
    child.stdout.on("data",chunk=>capture("out",chunk));
    child.stderr.on("data",chunk=>capture("err",chunk));
    child.once("close",code=>process.stdout.write(JSON.stringify({code:code===null?1:code,stdout,stderr})+"\n"));
    child.stdin.end(command.body);
  }
});
`;

/**
 * Own a sealed executable, a real app parent and a persistent real callback child.
 * **Example** (Inspect the fixture factory)
 * ```ts
 * import { makeCoworkAncestorFixture } from "@beep/repo-ai-metrics/test/cowork-ancestor"
 * console.log(typeof makeCoworkAncestorFixture)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const makeCoworkAncestorFixture = Effect.fn("CoworkTest.ancestor")(function* () {
  const runtime = yield* makeSealedRuntimeFixture();
  const parent = yield* Effect.scope;
  const owned = yield* Scope.fork(parent);
  const close = Scope.close(owned, Exit.void);
  return yield* Effect.gen(function* () {
    const commands = yield* Effect.acquireRelease(Queue.bounded<Uint8Array>(1), Queue.shutdown);
    const child = yield* ChildProcess.make(runtime.executable, ["--eval", appSource], {
      extendEnv: false,
      cwd: process.cwd(),
      stdin: Stream.fromQueue(commands),
      stderr: "ignore",
      killSignal: "SIGTERM",
      forceKillAfter: "500 millis",
    });
    const next = yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.rechunk(1), Stream.toPull);
    const initialization = yield* encode({ peer: sealedRuntimeSocketPeerSource });
    yield* Queue.offer(commands, new TextEncoder().encode(`${initialization}\n`));
    const ready = yield* next;
    const app = yield* decodeIdentity(ready[0]);
    const semaphore = yield* Semaphore.make(1);
    const exchange = Effect.fnUntraced(
      function* (command: unknown) {
        const encoded = yield* encode(command);
        if (new TextEncoder().encode(encoded).byteLength > 16384) return yield* failure("transport");
        yield* Queue.offer(commands, new TextEncoder().encode(`${encoded}\n`));
        const line = yield* next;
        return `${line[0]}\n`;
      },
      semaphore.withPermit,
      Effect.onInterrupt(() => close),
      Effect.timeout("6 seconds"),
      Effect.mapError(() => failure("transport"))
    );
    const send = Effect.fnUntraced(function* (path: string, body: string, drop = false) {
      if (new TextEncoder().encode(body).byteLength > 8192 || Str.includes("\n")(body))
        return yield* failure("transport");
      return yield* exchange({ kind: "peer", path, body, drop });
    });
    const runScript = Effect.fnUntraced(function* (script: string, path: string, body: string, selector: string) {
      const result = yield* exchange({ kind: "script", script, path, body, selector });
      return yield* decodeScriptResult(result).pipe(Effect.mapError(() => failure("transport")));
    });
    return { ...app, runtime, send, runScript, close };
  }).pipe(
    Scope.provide(owned),
    Effect.onError(() => close),
    Effect.mapError(() => failure("transport"))
  );
});
