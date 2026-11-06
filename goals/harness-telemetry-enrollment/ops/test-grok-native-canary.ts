// @effect-diagnostics-next-line nodeBuiltinImport:off -- Only the owned local compiler fixture is spawned; no Grok/provider process is used in tests.
import { execFile } from "node:child_process";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Independent byte hashes bind the synthetic fixture binary and filesystem metadata.
import { createHash } from "node:crypto";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- A compiled synthetic native fixture independently exercises real Linux process identity and exclusive fsync fences.
import * as Fs from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- The fixture owns its private local Unix socket and closes every resource.
import * as Http from "node:http";
import * as Os from "node:os";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Only generated private fixture paths are manipulated.
import * as Path from "node:path";
import { promisify } from "node:util";
import { ObservationLaunchIdentity, ObservationLaunchReceipt } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { vi } from "vitest";
import {
  GrokNativeCanaryDiagnostic,
  GrokNativeCanaryEvidence,
  GrokNativeCanaryRequest,
  GrokNativeSessionContext,
  grokCanaryProfile,
  grokCanaryProjectMcp,
  grokCanaryProjectMcpFormatted,
  runGrokNativeCanary,
} from "./grok-native-canary.ts";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, lstat: vi.fn(original.lstat), realpath: vi.fn(original.realpath) };
});

const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
const digest = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");
const compile = promisify(execFile);
const nativeFixture = String.raw`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
static void record(const char *home,const char *name) {char p[8192];snprintf(p,sizeof(p),"%s/%s",home,name);FILE *f=fopen(p,"a");if(f){fputs("1\n",f);fclose(f);}}
int main(int argc,char **argv) {
 const char *home=getenv("GROK_HOME");char cwd[4096],p[8192],mode[64]="ok";getcwd(cwd,sizeof(cwd));if(!home)return 83;
 const char *context[]={"USER","LOGNAME","SHELL","TERM","XDG_RUNTIME_DIR","DBUS_SESSION_BUS_ADDRESS"};
 for(int i=0;i<6;i++)if(!getenv(context[i])||!strlen(getenv(context[i])))return 87;
 if(strcmp(getenv("USER"),getenv("LOGNAME")))return 88;
 char bus[8192];snprintf(bus,sizeof(bus),"unix:path=%s/bus",getenv("XDG_RUNTIME_DIR"));if(strcmp(bus,getenv("DBUS_SESSION_BUS_ADDRESS")))return 89;
 if(!getenv("HOME")||!strcmp(getenv("HOME"),home))return 90;
 snprintf(p,sizeof(p),"%s/fixture-mode",home);FILE *f=fopen(p,"r");if(f){fgets(mode,sizeof(mode),f);fclose(f);}
 if(argc>1&&!strcmp(argv[1],"inspect")) {
  record(home,"inspect-count");
  printf("{\"grokVersion\":\"%s\",\"cwd\":\"%s\",\"projectRoot\":\"%s/\",\"projectTrusted\":false,\"projectInstructions\":[],\"hooks\":[],\"skills\":[],\"plugins\":[],\"marketplaces\":[],\"mcpServers\":%s,\"lspServers\":[],\"configSources\":{\"layers\":[{\"role\":\"user\",\"path\":\"%s/config.toml\"}]},\"externalCompat\":{\"remoteSettingsLoaded\":false,\"cells\":[{\"enabled\":false}]}}\n",!strcmp(mode,"wrong-version")?"1.0.73":"1.0.77",cwd,cwd,!strcmp(mode,"bad-inspect")?"[{}]":"[]",home);return 0;
 }
 record(home,"source-count");
 struct stat exe;stat("/proc/self/exe",&exe);char line[8192],tickcopy[128]="";FILE *self=fopen("/proc/self/stat","r");
 if(self){fgets(line,sizeof(line),self);fclose(self);char *save,*token=strtok_r(strrchr(line,')')+2," ",&save);for(int i=0;token&&i<19;i++)token=strtok_r(NULL," ",&save);if(token)snprintf(tickcopy,sizeof(tickcopy),"%s",token);}
 snprintf(p,sizeof(p),"%s/fixture-identity",home);FILE *identity=fopen(p,"w");if(identity){fprintf(identity,"%ld:%s:%llu:%llu",(long)getpid(),tickcopy,(unsigned long long)exe.st_dev,(unsigned long long)exe.st_ino);fclose(identity);}

 if(getenv("XAI_API_KEY")||getenv("GROK_AUTH")||getenv("GROK_AUTH_PROVIDER_COMMAND")||getenv("GROK_MODELS_BASE_URL"))return 84;
 if(!getenv("GROK_SESSION_SUMMARY_MODEL")||strcmp(getenv("GROK_SESSION_SUMMARY_MODEL"),"grok-4.7"))return 85;
 int model=0,effort=0,deny=0;
 for(int i=1;i+1<argc;i++){if(!strcmp(argv[i],"-m")&&!strcmp(argv[i+1],"grok-4.7"))model=1;if(!strcmp(argv[i],"--effort")&&!strcmp(argv[i+1],"medium"))effort=1;if(!strcmp(argv[i],"--disallowed-tools")){int commas=0;for(char *c=argv[i+1];*c;c++)if(*c==',')commas++;deny=commas==22&&strstr(argv[i+1],"read_file")&&strstr(argv[i+1],"use_tool")&&strstr(argv[i+1],"image_gen");}}
 if(!model||!effort||!deny)return 86;
 usleep(200000);
 fputs("PRIVATE_STDERR_SYNTHETIC_ONLY",stderr);
 if(!strcmp(mode,"source-fail"))return 7;
 if(!strcmp(mode,"reported-not-signed-in")){puts("{\"type\":\"error\",\"message\":\"PRIVATE_PREFIX Not signed in PRIVATE_SUFFIX\",\"cwd\":\"PRIVATE_CWD\",\"spend\":\"PRIVATE_SPEND\"}");return 1;}
 if(!strcmp(mode,"auth-error")){puts("{\"type\":\"error\",\"message\":\"Not signed in\",\"cwd\":\"PRIVATE_CWD\"}");return 1;}
 if(!strcmp(mode,"subscription-error")){puts("{\"type\":\"error\",\"message\":\"SuperGrok subscription required\",\"cwd\":\"PRIVATE_CWD\"}");return 1;}
 if(!strcmp(mode,"model-error")){puts("{\"type\":\"error\",\"message\":\"Model not found in config.toml [model.*]\",\"cwd\":\"PRIVATE_CWD\"}");return 1;}
 if(!strcmp(mode,"network-error")){puts("{\"type\":\"error\",\"message\":\"Connection to Grok timed out or was interrupted. Please try again. (HTTP 504).\",\"cwd\":\"PRIVATE_CWD\"}");return 1;}
 if(!strcmp(mode,"other-native-error")){puts("{\"type\":\"error\",\"message\":\"PRIVATE_OTHER_ERROR\"}");return 1;}
 puts("{\"type\":\"available_commands\",\"tools\":[],\"commands\":[]}");
 puts("{\"type\":\"thought\",\"data\":\"PRIVATE_REASONING_SYNTHETIC_ONLY\"}");
 if(!strcmp(mode,"tool"))puts("{\"type\":\"tool_call\",\"toolName\":\"read_file\",\"rawInput\":\"PRIVATE_INPUT\"}");
 printf("{\"type\":\"text\",\"data\":\"%s\"}\n",!strcmp(mode,"wrong-reply")?"PRIVATE_WRONG_REPLY":"ENROLLMENT_CANARY_OK");
 printf("{\"type\":\"end\",\"stopReason\":\"end_turn\",\"sessionId\":\"PRIVATE_NATIVE_SESSION\",\"requestId\":\"PRIVATE_NATIVE_REQUEST\",\"cwd\":\"%s\",\"num_turns\":1,\"usage\":{\"input_tokens\":9,\"output_tokens\":3},\"modelUsage\":{\"grok-4.7-build\":{\"modelCalls\":3}}}\n",cwd);
 return 0;
}`;

// @effect-diagnostics-next-line asyncFunction:off -- Offline fixture: real owned C process/socket/filesystem, with no native provider binary or authentication reads.
const fixture = async (
  options: {
    readonly rejectTraceOnce?: boolean;
    readonly mode?: string;
    readonly driftAuthAtPrepared?: boolean;
    readonly projectMcp?: string;
    readonly sessionMetadata?: "wrong-owner" | "bus-file" | "symlink" | "drift";
  } = {}
) => {
  const directory = await Fs.mkdtemp(Path.join(Os.tmpdir(), "grok-canary-"));
  await Fs.chmod(directory, 0o700);
  for (const name of ["attempt", "home", "native", "shared", "workspace"])
    await Fs.mkdir(Path.join(directory, name), { mode: 0o700 });
  await Fs.writeFile(Path.join(directory, "native/config.toml"), grokCanaryProfile, { mode: 0o600 });
  await Fs.writeFile(Path.join(directory, "workspace/.mcp.json"), options.projectMcp ?? grokCanaryProjectMcp, {
    mode: 0o644,
  });
  const auth = Path.join(directory, "shared/auth.json");
  await Fs.writeFile(auth, "SYNTHETIC_NOT_AUTH", { mode: 0o600 });
  const configText = "[cli]\nauto_update=true\n";
  await Fs.writeFile(Path.join(directory, "shared/config.toml"), configText, { mode: 0o600 });
  if (options.mode !== undefined)
    await Fs.writeFile(Path.join(directory, "native/fixture-mode"), options.mode, { mode: 0o600 });
  const sourceFile = Path.join(directory, "fixture.c");
  const executable = Path.join(directory, "synthetic-native-grok");
  await Fs.writeFile(sourceFile, nativeFixture, { mode: 0o600 });
  await compile("/usr/bin/cc", [sourceFile, "-O0", "-o", executable], { timeout: 10000 });
  const st = await Fs.lstat(auth, { bigint: true });
  const authSignature = `${st.dev}:${st.ino}:${st.uid}:${st.mode}:${st.size}:${st.mtimeNs}:${st.ctimeNs}`;
  const unknown = ObservationLaunchIdentity.fields.repository.cases.Unknown.make({});
  const request = GrokNativeCanaryRequest.make({
    launchId: id("a"),
    hostId: id("b"),
    namespaceId: id("c"),
    evidenceEpoch: 2,
    ingressRouteId: id("d"),
    identity: ObservationLaunchIdentity.make({
      routeId: id("e"),
      harness: "grok",
      surface: "cli",
      root: unknown,
      repository: unknown,
      clone: unknown,
      worktree: unknown,
      task: unknown,
      attempt: unknown,
      evidenceId: id("f"),
    }),
    hashSalt: Redacted.make("synthetic-salt-only"),
    executable,
    executableSha256: Sha256Hex.make(digest(await Fs.readFile(executable))),
    workspace: Path.join(directory, "workspace"),
    attemptDirectory: Path.join(directory, "attempt"),
    isolatedHome: Path.join(directory, "home"),
    sessionContext: GrokNativeSessionContext.make({
      USER: Os.userInfo().username,
      LOGNAME: Os.userInfo().username,
      XDG_RUNTIME_DIR: `/run/user/${process.getuid?.()}`,
      DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${process.getuid?.()}/bus`,
    }),
    nativeHome: Path.join(directory, "native"),
    nativeAuthFile: auth,
    nativeAuthIdentitySha256: Sha256Hex.make(digest(authSignature)),
    originalUserConfigSha256: O.some(Sha256Hex.make(digest(configText))),
    socketPath: Path.join(directory, "intake.sock"),
  });
  let epoch = 2;
  let traces = 0;
  const facts: Array<string> = [];
  const server = Http.createServer((incoming, response) => {
    const handle = async () => {
      let body = "";
      for await (const chunk of incoming) body += Buffer.isBuffer(chunk) ? chunk.toString("binary") : String(chunk);
      if (incoming.url === "/v1/launch-context") {
        response.end(
          await Effect.runPromise(
            S.encodeEffect(S.fromJsonString(ObservationLaunchContext))(
              ObservationLaunchContext.make({
                hostId: request.hostId,
                namespaceId: request.namespaceId,
                evidenceEpoch: epoch,
                accepting: true,
                routes: [{ routeId: request.identity.routeId, harness: "grok", surface: "cli" }],
              })
            )
          )
        );
      } else if (incoming.url === "/v1/launch-facts") {
        const submission = await Effect.runPromise(S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission))(body));
        facts.push(submission.fact._tag);
        if (submission.fact._tag === "Prepared" && options.driftAuthAtPrepared === true) await Fs.utimes(auth, 1, 1);
        response.end(
          await Effect.runPromise(
            S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt))(
              ObservationLaunchReceipt.make({
                receiptId: id("1"),
                hostId: request.hostId,
                namespaceId: request.namespaceId,
                evidenceEpoch: epoch,
                recordedAt: 1,
                fact: submission.fact,
              })
            )
          )
        );
      } else if (incoming.url === "/v1/traces") {
        traces += 1;
        if (traces === 1 && options.rejectTraceOnce === true) {
          response.statusCode = 503;
          response.end();
        } else {
          response.setHeader("x-observation-receipt", id("9"));
          response.end();
        }
      } else {
        response.statusCode = 404;
        response.end();
      }
    };
    handle().catch(() => {
      response.statusCode = 500;
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(request.socketPath, resolve);
  });
  await Fs.chmod(request.socketPath, 0o600);
  // Hermetic public-session metadata: only canonical runtime/bus stat/realpath
  // calls are mapped to this fixture's owned directory/socket; no bus is contacted.
  const nativeLstat = vi.mocked(Fs.lstat).getMockImplementation();
  const nativeRealpath = vi.mocked(Fs.realpath).getMockImplementation();
  if (nativeLstat === undefined || nativeRealpath === undefined) throw new Error("fixture-filesystem-mock");
  const runtime = request.sessionContext.XDG_RUNTIME_DIR;
  const bus = `${runtime}/bus`;
  let busStats = 0;
  const mapped = (filename: Parameters<typeof Fs.lstat>[0]) =>
    filename === runtime
      ? request.isolatedHome
      : filename === bus
        ? options.sessionMetadata === "bus-file"
          ? auth
          : request.socketPath
        : filename;
  const statMock = vi.mocked(Fs.lstat).mockImplementation(async (filename, settings) => {
    const value = await nativeLstat(mapped(filename), settings);
    if (filename === runtime && options.sessionMetadata === "wrong-owner") value.uid = process.getuid?.() === 0 ? 1 : 0;
    if (filename === runtime && options.sessionMetadata === "symlink") value.isSymbolicLink = () => true;
    if (filename === bus && ++busStats > 1 && options.sessionMetadata === "drift") value.ino = 0;
    return value;
  });
  const realpathMock = vi.mocked(Fs.realpath).mockImplementation(async (filename, settings) => {
    if (filename === request.sessionContext.SHELL || filename === Os.userInfo().shell) return "/usr/bin/zsh";
    const value = await nativeRealpath(mapped(filename), settings);
    return filename === runtime || filename === bus ? filename : value;
  });
  const run = runGrokNativeCanary(request).pipe(
    Effect.provide(NodeCrypto.layer.pipe(Layer.provideMerge(NodeServices.layer)))
  );
  const count = async (name: string) => {
    try {
      return (await Fs.readFile(Path.join(request.nativeHome, name), "utf8")).trim().split("\n").length;
    } catch {
      return 0;
    }
  };
  return {
    directory,
    request,
    run,
    facts,
    count,
    traces: () => traces,
    setEpoch: (value: number) => {
      epoch = value;
    },
    close: async () => {
      statMock.mockImplementation(nativeLstat);
      realpathMock.mockImplementation(nativeRealpath);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Fs.rm(directory, { recursive: true, force: true });
    },
  };
};

// Each case owns its public-session metadata mapping; avoid sharing it across
// globally concurrent tests. No real session bus or login shell is used.
const nativeCase = (name: string, body: () => Effect.Effect<void, unknown>) =>
  it.live(name, body, { concurrent: false });

nativeCase("serialized admission round-trips a redacted salt and spawns nothing", () =>
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      const codec = S.fromJsonString(GrokNativeCanaryRequest);
      const encoded = await Effect.runPromise(S.encodeEffect(codec)(f.request));
      const decoded = await Effect.runPromise(S.decodeEffect(codec, { onExcessProperty: "error" })(encoded));
      expect(Redacted.isRedacted(decoded.hashSalt)).toBe(true);
      expect(Redacted.value(decoded.hashSalt) === Redacted.value(f.request.hashSalt)).toBe(true);
      expect(await Effect.runPromise(S.encodeEffect(codec)(decoded))).toBe(encoded);
      expect(
        (
          await Effect.runPromise(
            S.decodeEffect(codec)(encoded.replace("request/v2", "request/v1")).pipe(Effect.result)
          )
        )._tag
      ).toBe("Failure");
      expect(
        (
          await Effect.runPromise(
            S.decodeEffect(codec, { onExcessProperty: "error" })(
              encoded.replace('"sessionContext":{', '"sessionContext":{"XAI_API_KEY":"PRIVATE_FORBIDDEN",')
            ).pipe(Effect.result)
          )
        )._tag
      ).toBe("Failure");
      for (const [field, qualified, rejected] of [
        ["TERM", "xterm-256color", "screen"],
        ["SHELL", "/usr/bin/zsh", "/usr/bin/bash"],
      ]) {
        const changed = encoded.replace(`"${field}":"${qualified}"`, `"${field}":"${rejected}"`);
        expect((await Effect.runPromise(S.decodeEffect(codec)(changed).pipe(Effect.result)))._tag).toBe("Failure");
      }
      expect(await f.count("source-count")).toBe(0);
      expect(await Fs.readdir(f.request.attemptDirectory)).toHaveLength(0);
    } finally {
      await f.close();
    }
  })
);

nativeCase("one real synthetic native process binds process/session and replays only immutable metadata", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      const raw = await Fs.readFile(Path.join(f.request.attemptDirectory, "source.json"), "utf8");
      const evidence = await Effect.runPromise(S.decodeEffect(S.fromJsonString(GrokNativeCanaryEvidence))(raw));
      expect(evidence.qualification.sessionContextSha256).toHaveLength(64);
      expect(raw).not.toContain("DBUS_SESSION_BUS_ADDRESS");
      expect(raw).not.toContain("xterm-256color");
      const diagnosticRaw = await Fs.readFile(
        Path.join(f.request.attemptDirectory, "diagnostic-090-outcome.json"),
        "utf8"
      );
      const diagnosticCodec = S.fromJsonString(GrokNativeCanaryDiagnostic);
      const diagnostic = await Effect.runPromise(
        S.decodeEffect(diagnosticCodec, { onExcessProperty: "error" })(diagnosticRaw)
      );
      expect(diagnostic.category).toBe("accepted");
      expect(O.getOrThrow(diagnostic.protocolTags).end).toBe(1);
      expect(O.getOrThrow(diagnostic.protocolTags).catalog).toBe(1);
      expect(diagnosticRaw).not.toContain("PRIVATE_");
      expect(
        (
          await Effect.runPromise(
            S.decodeEffect(diagnosticCodec, { onExcessProperty: "error" })(
              diagnosticRaw.replace('"stage":', '"rawMessage":"PRIVATE_FORBIDDEN","stage":')
            ).pipe(Effect.result)
          )
        )._tag
      ).toBe("Failure");
      expect(evidence.process.directOwnedNativeProcess).toBe(true);
      // The independent fixture records its actual native PID/startticks/exe identity.
      const nativeIdentity = await Fs.readFile(Path.join(f.request.nativeHome, "fixture-identity"), "utf8");
      const expectedProcess = await Effect.runPromise(
        hashPrivateIdentifier(
          `grok-canary-process/v1:${f.request.launchId}:${nativeIdentity}`,
          O.some(Redacted.value(f.request.hashSalt))
        ).pipe(Effect.provide(NodeCrypto.layer))
      );
      expect(evidence.process.instanceId).toBe(expectedProcess);
      expect(evidence.observation.processInstanceId).toBe(evidence.process.instanceId);
      expect(evidence.observation.sourceSessionId).toBe(evidence.source.sourceSessionId);
      expect(evidence.source.sourceInvocations).toBe(1);
      expect(evidence.source.nativeHttpRequests).toBe("Unknown");
      expect(O.getOrThrow(evidence.source.nativeModelUsage)["grok-4.7-build"]?.modelCalls).toBe(3);
      expect(raw).not.toContain("PRIVATE_");
      expect(raw).not.toContain(f.directory);
      const delivered = await Effect.runPromise(f.run);
      expect(delivered.backend).toBe("Unknown");
      expect(await f.count("source-count")).toBe(1);
      expect(await f.count("inspect-count")).toBe(2);
      expect(f.traces()).toBe(2);
      expect(await Fs.readFile(Path.join(f.request.attemptDirectory, "source.json"), "utf8")).toBe(raw);
      const marker = await Fs.lstat(Path.join(f.request.attemptDirectory, "attempted"));
      expect(marker.mode & 0o777).toBe(0o600);
      expect(marker.size).toBe(64);
    } finally {
      await f.close();
    }
  })
);

for (const mode of ["source-fail", "wrong-reply", "tool"]) {
  nativeCase(`unknown attempted ${mode} cannot invoke a second native source`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture({ mode });
      try {
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        const filename = Path.join(f.request.attemptDirectory, "diagnostic-090-outcome.json");
        const raw = await Fs.readFile(filename, "utf8");
        const diagnostic = await Effect.runPromise(
          S.decodeEffect(S.fromJsonString(GrokNativeCanaryDiagnostic), { onExcessProperty: "error" })(raw)
        );
        expect(diagnostic.category).toBe(mode === "source-fail" ? "native-exit-refused" : "wire-refused");
        expect(O.getOrThrow(diagnostic.nativeExitStatus)).toBe(mode === "source-fail" ? 7 : 0);
        expect(O.getOrThrow(diagnostic.stderrBytes)).toBeGreaterThan(0);
        expect(diagnostic.producerDispatchAttempts).toBe(1);
        expect(raw).not.toContain("PRIVATE_");
        expect(raw).not.toContain(f.directory);
        expect(raw).not.toContain("synthetic-salt");
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(await Fs.readFile(filename, "utf8")).toBe(raw);
        expect(await f.count("source-count")).toBe(1);
        expect(await f.count("inspect-count")).toBe(2);
        expect(f.traces()).toBe(0);
      } finally {
        await f.close();
      }
    })
  );
}

for (const [mode, expected] of [
  ["reported-not-signed-in", "Unknown"],
  ["other-native-error", "Unknown"],
  ["auth-error", "auth"],
  ["subscription-error", "subscription-or-quota"],
  ["model-error", "model-unavailable-or-config"],
  ["network-error", "network"],
] as const) {
  nativeCase(`finite nonzero failure projection retains only a qualified report: ${mode}`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture({ mode });
      try {
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        const filename = Path.join(f.request.attemptDirectory, "diagnostic-090-outcome.json");
        const raw = await Fs.readFile(filename, "utf8");
        const codec = S.fromJsonString(GrokNativeCanaryDiagnostic);
        const diagnostic = await Effect.runPromise(S.decodeEffect(codec, { onExcessProperty: "error" })(raw));
        expect(diagnostic.nativeReportedNotSignedIn).toEqual(
          mode === "reported-not-signed-in" || mode === "auth-error" ? O.some(true) : O.none()
        );
        expect(diagnostic.nativeFailureClass).toEqual(O.some(expected));
        expect(diagnostic.category).toBe("native-exit-refused");
        expect(O.getOrThrow(diagnostic.nativeExitStatus)).toBe(1);
        expect(O.getOrThrow(diagnostic.protocolTags).error).toBe(1);
        expect(raw).not.toContain("PRIVATE_");
        expect(raw).not.toContain("Not signed in");
        expect(raw).not.toContain("message");
        expect(raw).not.toContain("spend");
        const invalidClass = raw.replace(/"nativeFailureClass":"[^"]+"/, '"nativeFailureClass":"PRIVATE_UNBOUNDED"');
        expect((await Effect.runPromise(S.decodeEffect(codec)(invalidClass).pipe(Effect.result)))._tag).toBe("Failure");
        const unqualifiedClass = raw.replace('"operation":"main"', '"operation":"inspect-1"');
        expect((await Effect.runPromise(S.decodeEffect(codec)(unqualifiedClass).pipe(Effect.result)))._tag).toBe(
          "Failure"
        );
        if (mode === "reported-not-signed-in") {
          const wrongExit = raw.replace('"nativeExitStatus":1', '"nativeExitStatus":0');
          expect((await Effect.runPromise(S.decodeEffect(codec)(wrongExit).pipe(Effect.result)))._tag).toBe("Failure");
          const falseReport = raw.replace('"nativeReportedNotSignedIn":true', '"nativeReportedNotSignedIn":false');
          expect((await Effect.runPromise(S.decodeEffect(codec)(falseReport).pipe(Effect.result)))._tag).toBe(
            "Failure"
          );
        }
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(await f.count("source-count")).toBe(1);
        expect(await Fs.readFile(filename, "utf8")).toBe(raw);
      } finally {
        await f.close();
      }
    })
  );
}

nativeCase("nonempty native inventory refuses before the main source and retains its fence", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ mode: "bad-inspect" });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("source-count")).toBe(0);
      expect(await f.count("inspect-count")).toBe(1);
    } finally {
      await f.close();
    }
  })
);

nativeCase("native auth identity drift after Prepared refuses without reading auth contents or launching", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ driftAuthAtPrepared: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("source-count")).toBe(0);
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
    } finally {
      await f.close();
    }
  })
);

nativeCase("changed immutable process proof or stale epoch cannot replay or relaunch", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      await Effect.runPromise(f.run.pipe(Effect.result));
      f.setEpoch(3);
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      f.setEpoch(2);
      const filename = Path.join(f.request.attemptDirectory, "source.json");
      const saved = await Fs.readFile(filename, "utf8");
      await Fs.writeFile(
        filename,
        saved.replace('"directOwnedNativeProcess":true', '"directOwnedNativeProcess":false')
      );
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("source-count")).toBe(1);
      expect(f.traces()).toBe(1);
    } finally {
      await f.close();
    }
  })
);

nativeCase("valid-shaped changed source or process identity cannot replay metadata or relaunch", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      await Effect.runPromise(f.run.pipe(Effect.result));
      const filename = Path.join(f.request.attemptDirectory, "source.json");
      const original = await Fs.readFile(filename, "utf8");
      const evidence = await Effect.runPromise(S.decodeEffect(S.fromJsonString(GrokNativeCanaryEvidence))(original));
      for (const digest of [evidence.process.instanceId, evidence.source.sourceSessionId]) {
        await Fs.writeFile(filename, original.replace(digest, id("8")));
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      }
      expect(await f.count("source-count")).toBe(1);
      expect(f.traces()).toBe(1);
    } finally {
      await f.close();
    }
  })
);

it.effect("salt JSON boundary rejects empty and non-string external values", () =>
  Effect.gen(function* () {
    const decode = S.decodeUnknownEffect(GrokNativeCanaryRequest.fields.hashSalt);
    expect((yield* decode("").pipe(Effect.result))._tag).toBe("Failure");
    expect((yield* decode(0).pipe(Effect.result))._tag).toBe("Failure");
    expect((yield* decode(null).pipe(Effect.result))._tag).toBe("Failure");
  })
);

for (const projectMcp of [grokCanaryProjectMcp, grokCanaryProjectMcpFormatted]) {
  nativeCase(`exact empty MCP serialization ${projectMcp.length} bytes binds its actual digest`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture({ projectMcp });
      try {
        await Effect.runPromise(f.run);
        const evidence = await Effect.runPromise(
          S.decodeEffect(S.fromJsonString(GrokNativeCanaryEvidence))(
            await Fs.readFile(Path.join(f.request.attemptDirectory, "source.json"), "utf8")
          )
        );
        expect(evidence.qualification.projectMcpSha256).toBe(digest(projectMcp));
        expect(await f.count("source-count")).toBe(1);
      } finally {
        await f.close();
      }
    })
  );
}
for (const projectMcp of [
  '{"mcpServers":{},"mcpServers":{}}\n',
  '{"mcpServers":{"unexpected":{}}}\n',
  '{ "mcpServers": {} }\n',
]) {
  nativeCase(`unadmitted MCP bytes ${digest(projectMcp).slice(0, 8)} refuse before inventory`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture({ projectMcp });
      try {
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(await f.count("source-count")).toBe(0);
        expect(await f.count("inspect-count")).toBe(0);
      } finally {
        await f.close();
      }
    })
  );
}

nativeCase("a nonregular MCP FIFO refuses before any read can block", () =>
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      const filename = Path.join(f.request.workspace, ".mcp.json");
      await Fs.unlink(filename);
      await compile("/usr/bin/mkfifo", [filename], { timeout: 3000 });
      // A FIFO read with no writer would block. A completed typed refusal before
      // this outer timeout demonstrates that metadata rejects it before opening.
      const result = await Effect.runPromise(f.run.pipe(Effect.result, Effect.timeout("2 seconds")));
      expect(result._tag).toBe("Failure");
      expect(await f.count("inspect-count")).toBe(0);
      expect(await f.count("source-count")).toBe(0);
    } finally {
      await f.close();
    }
  })
);

nativeCase("an older native version refuses before source and cannot replay inspection", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ mode: "wrong-version" });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("inspect-count")).toBe(1);
      expect(await f.count("source-count")).toBe(0);
    } finally {
      await f.close();
    }
  })
);

const publicSessionRefusals: Array<"wrong-owner" | "bus-file" | "symlink"> = ["wrong-owner", "bus-file", "symlink"];
for (const sessionMetadata of publicSessionRefusals) {
  nativeCase(`public session ${sessionMetadata} refuses before native inspection and consumes the fence`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture({ sessionMetadata });
      try {
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(await f.count("inspect-count")).toBe(0);
        expect(await f.count("source-count")).toBe(0);
        expect(await Fs.readFile(Path.join(f.request.attemptDirectory, "attempted"), "utf8")).toHaveLength(64);
      } finally {
        await f.close();
      }
    })
  );
}

nativeCase("a foreign public session identity refuses without borrowing another UID or HOME", () =>
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      const request = GrokNativeCanaryRequest.make({
        ...f.request,
        sessionContext: GrokNativeSessionContext.make({ ...f.request.sessionContext, LOGNAME: "foreign_session_user" }),
      });
      const result = await Effect.runPromise(
        runGrokNativeCanary(request).pipe(
          Effect.provide(NodeCrypto.layer.pipe(Layer.provideMerge(NodeServices.layer))),
          Effect.result
        )
      );
      expect(result._tag).toBe("Failure");
      expect(await f.count("inspect-count")).toBe(0);
      expect(await f.count("source-count")).toBe(0);
    } finally {
      await f.close();
    }
  })
);

nativeCase("session bus identity drift after inspection refuses source dispatch without replay", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ sessionMetadata: "drift" });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("inspect-count")).toBe(1);
      expect(await f.count("source-count")).toBe(0);
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("inspect-count")).toBe(1);
    } finally {
      await f.close();
    }
  })
);

nativeCase("a changed retained session-context pin cannot replay metadata or relaunch", () =>
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Success");
      const filename = Path.join(f.request.attemptDirectory, "source.json");
      const raw = await Fs.readFile(filename, "utf8");
      const evidence = await Effect.runPromise(S.decodeEffect(S.fromJsonString(GrokNativeCanaryEvidence))(raw));
      const changed = raw.replace(
        `"sessionContextSha256":"${evidence.qualification.sessionContextSha256}"`,
        `"sessionContextSha256":"${id("7")}"`
      );
      expect(changed).not.toBe(raw);
      await Fs.writeFile(filename, changed, { mode: 0o600 });
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("source-count")).toBe(1);
      expect(await f.count("inspect-count")).toBe(2);
    } finally {
      await f.close();
    }
  })
);
