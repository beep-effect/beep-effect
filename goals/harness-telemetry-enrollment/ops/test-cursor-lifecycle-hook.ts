import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as Fs from "node:fs/promises";
import * as Os from "node:os";
import { promisify } from "node:util";
import { CursorLifecyclePolicy } from "@beep/repo-ai-metrics/cursor-lifecycle";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { cursorPeerSource } from "@beep/repo-ai-metrics/test/cursor-lifecycle";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { CursorCallbackEnrollment, cursorCallbackFixture } from "./cursor-lifecycle-hook.ts";

const execFileAsync = promisify(execFile);
// Resolve only the public test runtime; enrollment still binds its exact executable and digest.
const bun = process.versions.bun
  ? process.execPath
  : Str.trim(
      execFileSync(
        Str.trim(execFileSync("/usr/bin/which", ["bun"], { encoding: "utf8" })),
        ["--no-env-file", "--print", "process.execPath"],
        { encoding: "utf8" }
      )
    );
const salt = "PRIVATE-SYNTHETIC-SALT-MARKER-cursor-callback";
const id = Sha256Hex.make(Str.repeat(64)("a"));
const json = S.fromJsonString(S.Unknown);
const encode = S.encodeUnknownEffect(json);
const encodeLiteral = S.encodeEffect(S.fromJsonString(S.String));
const literal = (value: string) => Effect.runSync(encodeLiteral(value));
const encodeEnrollment = S.encodeEffect(S.fromJsonString(CursorCallbackEnrollment));
const decodeResults = S.decodeEffect(
  S.fromJsonString(
    S.NonEmptyArray(S.Struct({ code: S.NullOr(S.Int), stdout: S.String, stderr: S.String })).check(S.isMaxLength(2))
  )
);
const decodeExecFailure = S.decodeUnknownEffect(S.Struct({ code: S.Int, stdout: S.String, stderr: S.String }));
const io = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: (cause) => cause });
const digest = (b: Uint8Array | string) => Sha256Hex.make(createHash("sha256").update(b).digest("hex"));
const body = {
  hook_event_name: "sessionStart",
  cursor_version: "2026.11.05-86047df",
  session_id: "synthetic-native-session",
  conversation_id: "synthetic-native-session",
  generation_id: "synthetic-generation",
  is_background_agent: false,
  prompt: "PRIVATE-PROMPT",
  callerVerified: true,
  rootId: "forged-root",
};
const scriptRoot = `${process.cwd()}/goals/harness-telemetry-enrollment/ops`;
const modules = `${process.cwd()}/node_modules`;
const bridge = `import * as Effect from ${literal(`${modules}/effect/dist/Effect.js`)};
import * as Stream from ${literal(`${modules}/effect/dist/Stream.js`)};
import * as Layer from ${literal(`${modules}/effect/dist/Layer.js`)};
import * as S from ${literal(`${modules}/effect/dist/Schema.js`)};
import * as Crypto from ${literal(`${modules}/@effect/platform-node/dist/NodeCrypto.js`)};
import * as Fs from ${literal(`${modules}/@effect/platform-node/dist/NodeFileSystem.js`)};
import * as Path from ${literal(`${modules}/@effect/platform-node/dist/NodePath.js`)};
import * as Spawner from ${literal(`${modules}/@effect/platform-node/dist/NodeChildProcessSpawner.js`)};
import {makeCursorLifecycleFixtureReceiver} from ${literal(`${process.cwd()}/packages/tooling/library/ai-metrics/src/test/cursor-lifecycle.ts`)};
import {cursorCallbackFixture,CursorCallbackError} from ${literal(`${scriptRoot}/cursor-lifecycle-hook.ts`)};
const layers=Layer.merge(Crypto.layer,Spawner.layer.pipe(Layer.provideMerge(Layer.merge(Fs.layer,Path.layer))));
const serialize=S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
try {const receipt=await Effect.runPromise(cursorCallbackFixture.consume(process.argv[2],Stream.fromAsyncIterable(process.stdin,()=>undefined),makeCursorLifecycleFixtureReceiver).pipe(Effect.provide(layers)));
process.stdout.write(Effect.runSync(serialize({receiptId:receipt.page.receiptId,accepted:receipt.accepted}))+"\\n");}catch(error){process.stderr.write(S.is(CursorCallbackError)(error)?error.reason:"unclassified");process.exitCode=1;}
`;
const native = `const {spawn}=require("node:child_process");
(async()=>{const Effect=await import(${literal(`${modules}/effect/dist/Effect.js`)});const S=await import(${literal(`${modules}/effect/dist/Schema.js`)});
const serialize=S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const root=process.argv[2],bun=process.argv[3],body=process.argv[4],repeat=Number(process.argv[5]);
const results=[];function next(){if(results.length===repeat){process.stdout.write(Effect.runSync(serialize(results)));return;}
const child=spawn(bun,["--no-env-file",root+"/bridge.ts",root,bun],{cwd:${literal(process.cwd())},env:{PATH:"/usr/bin:/bin",TMPDIR:root},stdio:["pipe","pipe","pipe"]});
let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err+=b);child.on("close",code=>{results.push({code,stdout:out,stderr:err});next();});child.stdin.end(body);}next();})();`;
const fixture = Effect.fn("CursorCallbackTest.fixture")(function* () {
  const parent = `${Os.homedir()}/.local/state/beep`;
  yield* io(() => Fs.mkdir(parent, { recursive: true, mode: 0o700 }));
  const root = yield* Effect.acquireRelease(
    io(() => Fs.mkdtemp(`${parent}/ce-`)),
    (root) => io(() => Fs.rm(root, { recursive: true, force: true })).pipe(Effect.orDie)
  );
  yield* io(() => Fs.chmod(root, 0o700));
  const node = yield* io(() => Fs.realpath("/usr/bin/node"));
  const python = yield* io(() => Fs.realpath("/usr/bin/python3"));
  const callback = yield* io(() => Fs.realpath(bun));
  const sourcePins = [];
  for (const name of ["dispatcher.js", "payload.js"]) {
    const path = `${root}/${name}`;
    yield* io(() => Fs.writeFile(path, "// synthetic native public source\n", { mode: 0o600 }));
    sourcePins.push({ path, sha256: digest(yield* io(() => Fs.readFile(path))) });
  }
  const namespaceId = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt));
  const receiver = CursorLifecyclePolicy.make({
    workspace: process.cwd(),
    runtimeExecutable: node,
    runtimeSha256: digest(yield* io(() => Fs.readFile(node))),
    sourcePins,
    helperSha256: digest(cursorPeerSource),
    pythonExecutable: python,
    pythonSha256: digest(yield* io(() => Fs.readFile(python))),
    rootId: id,
    hostId: id,
    routeId: id,
    hashSalt: Redacted.make(salt),
    approvedModels: [],
  });
  const enrollment = CursorCallbackEnrollment.make({
    state: "active",
    expiresAtMillis: Date.now() + 60000,
    receiver: Struct.omit(receiver, ["hashSalt"]),
    saltCredentialFile: `${root}/salt.credential`,
    intake: TranscriptIntakeConfig.make({
      hostId: id,
      namespaceId,
      maxPages: 16,
      maxPayloadBytes: 1048576,
      maxDatabasePages: 512,
    }),
    callbackExecutable: callback,
    callbackSha256: digest(yield* io(() => Fs.readFile(callback))),
  });
  const write = Effect.fn("CursorCallbackTest.write")(function* (value = enrollment) {
    const text = yield* encodeEnrollment(value);
    yield* io(() => Fs.writeFile(`${root}/enrollment.json`, text, { mode: 0o600 }));
  });
  yield* write();
  yield* io(() => Fs.writeFile(`${root}/salt.credential`, salt, { mode: 0o600 }));
  yield* io(() => Fs.writeFile(`${root}/journal.sqlite`, "", { mode: 0o600 }));
  yield* io(() => Fs.writeFile(`${root}/bridge.ts`, bridge, { mode: 0o600 }));
  yield* io(() => Fs.writeFile(`${root}/native.cjs`, native, { mode: 0o600 }));
  const run = Effect.fn("CursorCallbackTest.run")(function* (input: unknown = body, repeat = 1) {
    const text = yield* encode(input);
    const result = yield* io(() =>
      execFileAsync(node, [`${root}/native.cjs`, root, bun, text, `${repeat}`], {
        cwd: process.cwd(),
        env: { PATH: "/usr/bin:/bin", TMPDIR: root },
        timeout: 20000,
        maxBuffer: 16384,
      })
    );
    return yield* decodeResults(result.stdout);
  });
  return { root, enrollment, run, write };
});

it.effect("the transient stdin projector drops caller authority and private content", () =>
  Effect.gen(function* () {
    const text = yield* encode(body);
    const projected = yield* cursorCallbackFixture.projectInput(Stream.make(new TextEncoder().encode(text)));
    for (const marker of ["PRIVATE-PROMPT", "callerVerified", "forged-root"])
      expect(Str.includes(marker)(projected)).toBe(false);
    const invalid = yield* cursorCallbackFixture.projectInput(Stream.make(new Uint8Array(8193))).pipe(Effect.flip);
    expect(invalid.reason).toBe("input");
    const invalidUtf8 = yield* cursorCallbackFixture
      .projectInput(Stream.make(new Uint8Array([0xff])))
      .pipe(Effect.flip);
    expect(invalidUtf8.reason).toBe("input");
    const splitOversize = yield* cursorCallbackFixture
      .projectInput(Stream.make(new Uint8Array(4097), new Uint8Array(4096)))
      .pipe(Effect.flip);
    expect(splitOversize.reason).toBe("input");
  })
);

it.effect(
  "on-demand real Node ancestry commits before ACK and replay preserves one event",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        const results = yield* f.run(body, 2);
        const second = yield* Effect.fromOption(A.get(results, 1));
        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({ code: 0, stderr: "" });
        expect(second.code).toBe(0);
        expect(results[0].stdout).toBe(second.stdout);
        expect(results[0].stderr).toBe("");
        const db = yield* io(() => Fs.readFile(`${f.root}/journal.sqlite`));
        const text = db.toString("utf8");
        for (const marker of ["PRIVATE-PROMPT", "synthetic-native-session", "forged-root", salt])
          expect(Str.includes(marker)(text)).toBe(false);
        const enrollmentText = yield* io(() => Fs.readFile(`${f.root}/enrollment.json`, "utf8"));
        expect(Str.includes(salt)(enrollmentText)).toBe(false);
        expect(Str.includes("hashSalt")(enrollmentText)).toBe(false);
        expect(Str.includes(salt)(results[0].stdout + results[0].stderr + second.stdout + second.stderr)).toBe(false);
        const entries = yield* io(() => Fs.readdir(f.root));
        expect(entries).not.toContain("callback.lock");
        expect(entries.some((x) => x.startsWith("cursor-lifecycle-"))).toBe(false);
      })
    ).pipe(Effect.provide(NodeCrypto.layer)),
  30000
);

it.effect(
  "enrollment accepts only a credential reference and refuses inline or unsafe credential bytes",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        const forbidden = yield* encode({ ...f.enrollment, receiver: { ...f.enrollment.receiver, hashSalt: salt } });
        yield* io(() => Fs.writeFile(`${f.root}/enrollment.json`, forbidden));
        const inline = yield* f.run();
        expect(inline[0].code).toBe(1);
        expect((yield* io(() => Fs.stat(`${f.root}/journal.sqlite`))).size).toBe(0);
        yield* f.write();
        yield* io(() => Fs.chmod(`${f.root}/salt.credential`, 0o640));
        expect((yield* f.run())[0].code).toBe(1);
        yield* io(() => Fs.chmod(`${f.root}/salt.credential`, 0o600));
        yield* io(() => Fs.rename(`${f.root}/salt.credential`, `${f.root}/owned.credential`));
        yield* io(() => Fs.symlink(`${f.root}/owned.credential`, `${f.root}/salt.credential`));
        expect((yield* f.run())[0].code).toBe(1);
        yield* io(() => Fs.unlink(`${f.root}/salt.credential`));
        yield* io(() => Fs.writeFile(`${f.root}/salt.credential`, Str.repeat(4097)("x"), { mode: 0o600 }));
        expect((yield* f.run())[0].code).toBe(1);
        expect((yield* io(() => Fs.stat(`${f.root}/journal.sqlite`))).size).toBe(0);
        expect(yield* io(() => Fs.readdir(f.root))).not.toContain("callback.lock");
      })
    ).pipe(Effect.provide(NodeCrypto.layer)),
  30000
);

it.effect(
  "projects before disk writes and refuses oversize or malformed input",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        const results = yield* f.run({ ...body, prompt: Str.repeat(8193)("x") });
        expect(results[0].code).toBe(1);
        expect(results[0].stdout).toBe("");
        expect((yield* io(() => Fs.stat(`${f.root}/journal.sqlite`))).size).toBe(0);
        const bad = yield* f.run({ ...body, cursor_version: "wrong" });
        expect(bad[0].code).toBe(1);
        expect(yield* io(() => Fs.readdir(f.root))).not.toContain("callback.lock");
      })
    ).pipe(Effect.provide(NodeCrypto.layer)),
  30000
);

it.effect(
  "refuses paused expired host namespace and same-runtime enrollment before journal writes",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const enrollment of [
          CursorCallbackEnrollment.make({ ...f.enrollment, state: "paused" }),
          CursorCallbackEnrollment.make({ ...f.enrollment, expiresAtMillis: 0 }),
          CursorCallbackEnrollment.make({
            ...f.enrollment,
            callbackExecutable: f.enrollment.receiver.runtimeExecutable,
          }),
          CursorCallbackEnrollment.make({
            ...f.enrollment,
            intake: TranscriptIntakeConfig.make({
              ...f.enrollment.intake,
              hostId: Sha256Hex.make(Str.repeat(64)("b")),
            }),
          }),
          CursorCallbackEnrollment.make({
            ...f.enrollment,
            intake: TranscriptIntakeConfig.make({
              ...f.enrollment.intake,
              namespaceId: Sha256Hex.make(Str.repeat(64)("b")),
            }),
          }),
        ]) {
          yield* f.write(enrollment);
          const result = yield* f.run();
          expect(result[0].code).toBe(1);
          expect((yield* io(() => Fs.stat(`${f.root}/journal.sqlite`))).size).toBe(0);
        }
      })
    ).pipe(Effect.provide(NodeCrypto.layer)),
  30000
);

it.effect(
  "honors an exclusive cross-process lease and never clears another occurrence",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* io(() => Fs.writeFile(`${f.root}/callback.lock`, "", { flag: "wx", mode: 0o600 }));
        const locked = yield* f.run();
        expect(locked[0].code).toBe(1);
        expect((yield* io(() => Fs.stat(`${f.root}/journal.sqlite`))).size).toBe(0);
        expect((yield* io(() => Fs.stat(`${f.root}/callback.lock`))).size).toBe(0);
        yield* io(() => Fs.unlink(`${f.root}/callback.lock`));
        const admitted = yield* f.run();
        expect(admitted[0]).toMatchObject({ code: 0, stderr: "" });
      })
    ).pipe(Effect.provide(NodeCrypto.layer)),
  30000
);

it.effect(
  "refuses unsafe owner file modes symlinks and journal targets",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* io(() => Fs.chmod(`${f.root}/enrollment.json`, 0o640));
        expect((yield* f.run())[0].code).toBe(1);
        yield* io(() => Fs.chmod(`${f.root}/enrollment.json`, 0o600));
        yield* io(() => Fs.rename(`${f.root}/enrollment.json`, `${f.root}/owner.json`));
        yield* io(() => Fs.symlink(`${f.root}/owner.json`, `${f.root}/enrollment.json`));
        expect((yield* f.run())[0].code).toBe(1);
        yield* io(() => Fs.unlink(`${f.root}/enrollment.json`));
        yield* io(() => Fs.rename(`${f.root}/owner.json`, `${f.root}/enrollment.json`));
        yield* io(() => Fs.unlink(`${f.root}/journal.sqlite`));
        yield* io(() => Fs.symlink(`${f.root}/owner-never-open`, `${f.root}/journal.sqlite`));
        expect((yield* f.run())[0].code).toBe(1);
        const entries = yield* io(() => Fs.readdir(f.root));
        expect(entries).not.toContain("owner-never-open");
        expect(entries).not.toContain("callback.lock");
      })
    ).pipe(Effect.provide(NodeCrypto.layer)),
  30000
);

it.effect("installed command rejects config arguments silently without reading the fixed owner root", () =>
  Effect.gen(function* () {
    const rejected = yield* io(() =>
      execFileAsync(
        bun,
        ["--no-env-file", `${scriptRoot}/cursor-lifecycle-hook.ts`, "--enrollment-file", "/nonexistent"],
        {
          cwd: process.cwd(),
          env: { PATH: "/usr/bin:/bin" },
          timeout: 10000,
          maxBuffer: 4096,
        }
      )
    ).pipe(Effect.flip);
    const result = yield* decodeExecFailure(rejected);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  })
);
