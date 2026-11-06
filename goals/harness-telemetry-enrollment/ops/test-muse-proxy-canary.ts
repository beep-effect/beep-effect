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
import { AiProviderCliHome } from "@beep/ai-provider-cli";
import { ObservationLaunchIdentity, ObservationLaunchReceipt } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { qualifyClaudeManagedPolicy } from "./claude-native-policy.ts";
import { MuseProxyCanaryEvidence, MuseProxyCanaryRequest, runMuseProxyCanary } from "./muse-proxy-canary.ts";
import { NativeAttemptDiagnostic } from "./native-attempt-diagnostic.ts";

const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
const digest = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");
const compile = promisify(execFile);
const nativeFixture =
  '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <unistd.h>\n#include <sys/stat.h>\nint main(int argc,char **argv){\n if(argc>1&&!strcmp(argv[1],"--version")){puts("2.1.318 (Claude Code)");return 0;}\n const char *home=getenv("HOME");if(!home)return 83;char p[8192],cwd[4096],mode[64]="ok";getcwd(cwd,sizeof(cwd));\n snprintf(p,sizeof(p),"%s/source-count",home);FILE *f=fopen(p,"a");if(f){fputs("1\\n",f);fclose(f);}\n snprintf(p,sizeof(p),"%s/fixture-mode",home);f=fopen(p,"r");if(f){fgets(mode,sizeof(mode),f);fclose(f);}\n if(!getenv("ANTHROPIC_BASE_URL")||strcmp(getenv("ANTHROPIC_BASE_URL"),"http://127.0.0.1:8317")||!getenv("ANTHROPIC_AUTH_TOKEN")||strcmp(getenv("ANTHROPIC_AUTH_TOKEN"),"synthetic-not-a-secret"))return 84;\n int model=0;for(int i=1;i+1<argc;i++)if(!strcmp(argv[i],"--model")&&!strcmp(argv[i+1],"muse-wonder-1.0(medium)"))model=1;if(!model)return 85;\n struct stat exe;stat("/proc/self/exe",&exe);char line[8192],ticks[128]="";FILE *self=fopen("/proc/self/stat","r");\n if(self){fgets(line,sizeof(line),self);fclose(self);char *save,*token=strtok_r(strrchr(line,\')\')+2," ",&save);for(int i=0;token&&i<19;i++)token=strtok_r(NULL," ",&save);if(token)snprintf(ticks,sizeof(ticks),"%s",token);}\n snprintf(p,sizeof(p),"%s/fixture-identity",home);FILE *identity=fopen(p,"w");if(identity){fprintf(identity,"%ld:%s:%llu:%llu",(long)getpid(),ticks,(unsigned long long)exe.st_dev,(unsigned long long)exe.st_ino);fclose(identity);}\n if(!strcmp(mode,"hang"))sleep(5);else usleep(300000);if(!strcmp(mode,"source-fail"))return 7;\nprintf("{\\"type\\":\\"system\\",\\"subtype\\":\\"init\\",\\"session_id\\":\\"PRIVATE_SESSION\\",\\"claude_code_version\\":\\"2.1.318\\",\\"cwd\\":\\"%s\\",\\"model\\":\\"muse-wonder-1.0(medium)\\",\\"apiKeySource\\":\\"none\\",\\"tools\\":[],\\"mcp_servers\\":[],\\"plugins\\":[{\\"name\\":\\"cc-plugin-agents-md\\"},{\\"name\\":\\"cc-plugin-privacy\\"},{\\"name\\":\\"cc-plugin-plugin-authoring\\"}],\\"skills\\":[],\\"slash_commands\\":[],\\"agents\\":[\\"claude\\",\\"Explore\\",\\"general-purpose\\",\\"Plan\\"]}\\n",cwd);\nif(!strcmp(mode,"reported-error")){puts("{\\"type\\":\\"assistant\\",\\"session_id\\":\\"PRIVATE_SESSION\\",\\"parent_tool_use_id\\":null,\\"error\\":\\"rate_limit\\",\\"uuid\\":\\"PRIVATE_UUID\\",\\"message\\":{\\"role\\":\\"assistant\\",\\"model\\":\\"muse-wonder-1.0(medium)\\",\\"content\\":[{\\"type\\":\\"text\\",\\"text\\":\\"PRIVATE_PROVIDER_MESSAGE\\"}]}}");puts("{\\"type\\":\\"result\\",\\"session_id\\":\\"PRIVATE_SESSION\\",\\"subtype\\":\\"error_during_execution\\",\\"is_error\\":true,\\"errors\\":[\\"PRIVATE_ACCOUNT_OR_TOKEN\\"],\\"result\\":\\"PRIVATE_PROVIDER_RESULT\\"}");return 7;}\nif(!strcmp(mode,"wrong-reply"))puts("{\\"type\\":\\"tool_use\\",\\"content\\":\\"PRIVATE_CONTENT\\"}");\nputs("{\\"type\\":\\"assistant\\",\\"session_id\\":\\"PRIVATE_SESSION\\",\\"parent_tool_use_id\\":null,\\"message\\":{\\"role\\":\\"assistant\\",\\"model\\":\\"muse-wonder-1.0(medium)\\",\\"content\\":[{\\"type\\":\\"text\\",\\"text\\":\\"ENROLLMENT_CANARY_OK\\"}]}}");\nputs("{\\"type\\":\\"result\\",\\"subtype\\":\\"success\\",\\"session_id\\":\\"PRIVATE_SESSION\\",\\"is_error\\":false,\\"result\\":\\"ENROLLMENT_CANARY_OK\\",\\"duration_ms\\":1,\\"duration_api_ms\\":1,\\"num_turns\\":1,\\"permission_denials\\":[]}");\nputs("{\\"type\\":\\"rate_limit_event\\",\\"session_id\\":\\"PRIVATE_SESSION\\",\\"rate_limit_info\\":{\\"status\\":\\"allowed_warning\\",\\"utilization\\":1.25},\\"message\\":\\"PRIVATE_PROXY_WARNING\\"}");\nreturn 0;}\n';
const fixture = async (
  options: { readonly rejectTraceOnce?: boolean; readonly mode?: string; readonly driftAuthAtPrepared?: boolean } = {}
) => {
  const directory = await Fs.mkdtemp(Path.join(Os.tmpdir(), "muse-canary-"));
  await Fs.chmod(directory, 0o700);
  for (const name of ["attempt", "home", "config", "tmp", "commands", "workspace"])
    await Fs.mkdir(Path.join(directory, name), { mode: 0o700 });
  await Fs.mkdir(Path.join(directory, "home/.cli-proxy-api"), { mode: 0o700 });
  // zsh -f must skip unrelated user startup, even when it would terminate the consumer.
  await Fs.writeFile(Path.join(directory, "home/.zshenv"), "exit 99\n", { mode: 0o600 });
  await Fs.writeFile(Path.join(directory, "home/.cli-proxy-api/client-token"), "synthetic-not-a-secret\n", {
    mode: 0o600,
  });
  const wrapper = Path.join(directory, "functions.zsh");
  await Fs.copyFile(new URL("./muse-proxy-canonical-functions.zsh", import.meta.url), wrapper);
  await Fs.chmod(wrapper, 0o600);
  if (options.mode !== undefined)
    await Fs.writeFile(Path.join(directory, "home/fixture-mode"), options.mode, { mode: 0o600 });
  const sourceFile = Path.join(directory, "fixture.c");
  const executable = Path.join(directory, "synthetic-native");
  await Fs.writeFile(sourceFile, nativeFixture, { mode: 0o600 });
  await compile("/usr/bin/cc", [sourceFile, "-O0", "-o", executable], { timeout: 10000 });
  await Fs.symlink(executable, Path.join(directory, "commands/claude"));
  const policy = await Effect.runPromise(
    qualifyClaudeManagedPolicy(Path.join(directory, "config")).pipe(Effect.provide(NodeCrypto.layer))
  );
  const unknown = ObservationLaunchIdentity.fields.repository.cases.Unknown.make({});
  const request = MuseProxyCanaryRequest.make({
    launchId: id("a"),
    hostId: id("b"),
    namespaceId: id("c"),
    evidenceEpoch: 2,
    ingressRouteId: id("d"),
    identity: ObservationLaunchIdentity.make({
      routeId: id("e"),
      harness: "muse",
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
    nativeHome: Path.join(directory, "home"),
    sharedClaudeConfigDirectory: Path.join(directory, "config"),
    temporaryDirectory: Path.join(directory, "tmp"),
    nativePolicySha256: policy.digest,
    canonicalWrapperFile: wrapper,
    nativeCommandDirectory: Path.join(directory, "commands"),
    socketPath: Path.join(directory, "intake.sock"),
  });
  let epoch = 2;
  let traces = 0;
  const facts: Array<string> = [];
  let signalStarted = () => {};
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
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
                routes: [{ routeId: request.identity.routeId, harness: "muse", surface: "cli" }],
              })
            )
          )
        );
      } else if (incoming.url === "/v1/launch-facts") {
        const submission = await Effect.runPromise(S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission))(body));
        facts.push(submission.fact._tag);
        if (submission.fact._tag === "Started") signalStarted();
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
  const run = runMuseProxyCanary(request).pipe(
    Effect.provide(
      Layer.mergeAll(AiProviderCliHome.layer, NodeCrypto.layer).pipe(Layer.provideMerge(NodeServices.layer))
    )
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
    started,
    count,
    traces: () => traces,
    setEpoch: (value: number) => {
      epoch = value;
    },
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Fs.rm(directory, { recursive: true, force: true });
    },
  };
};

it.live("canonical consumer, actual descendant and metadata-only replay stay distinct", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      const raw = await Fs.readFile(Path.join(f.request.attemptDirectory, "source.json"), "utf8");
      const evidence = await Effect.runPromise(S.decodeEffect(S.fromJsonString(MuseProxyCanaryEvidence))(raw));
      expect(evidence.process.nativeInstanceId).toBe(evidence.observation.processInstanceId);
      expect(evidence.source.observedRateLimitNotifications).toEqual({ allowed: 0, allowedWarning: 1, rejected: 0 });
      const actual = await Fs.readFile(Path.join(f.request.nativeHome, "fixture-identity"), "utf8");
      const expected = await Effect.runPromise(
        hashPrivateIdentifier(
          `muse-native/v1:${f.request.launchId}:${actual}`,
          O.some(Redacted.value(f.request.hashSalt))
        ).pipe(Effect.provide(NodeCrypto.layer))
      );
      expect(evidence.process.nativeInstanceId).toBe(expected);
      expect(evidence.process.relation).toMatch(/^(shell-exec-native|owned-shell-descendant)$/);
      expect(raw).not.toContain("PRIVATE_");
      expect(raw).not.toContain("synthetic-not-a-secret");
      expect(raw).not.toContain(f.directory);
      await Effect.runPromise(f.run);
      expect(await f.count("source-count")).toBe(1);
      expect(f.traces()).toBe(2);
      f.setEpoch(3);
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("source-count")).toBe(1);
    } finally {
      await f.close();
    }
  })
);
for (const mode of ["source-fail", "reported-error", "wrong-reply"]) {
  it.live(`attempted ${mode} never invokes another wrapper source`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture({ mode });
      try {
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(await f.count("source-count")).toBe(1);
        expect(f.traces()).toBe(0);
        const text = await Fs.readFile(Path.join(f.request.attemptDirectory, "diagnostic-source-failed.json"), "utf8");
        const diagnostic = await Effect.runPromise(
          S.decodeEffect(S.fromJsonString(NativeAttemptDiagnostic), { onExcessProperty: "error" })(text)
        );
        expect(diagnostic.failurePhase).toEqual(O.some(mode !== "wrong-reply" ? "source-exit" : "source-protocol"));
        expect(diagnostic.nativeExitStatus).toEqual(O.some(mode !== "wrong-reply" ? 7 : 0));
        expect(diagnostic.nativeSpawned).toEqual(O.some(true));
        expect(text).not.toContain("PRIVATE_");
        expect(text).not.toContain("synthetic-not-a-secret");
        expect(f.facts).toContain("Finished");
        if (mode === "reported-error") {
          const reported = O.getOrThrow(O.getOrThrow(diagnostic.protocol).reportedSdkErrors);
          expect(reported.assistant.rate_limit).toBe(1);
          expect(reported.terminal.error_during_execution).toBe(1);
          expect(text).not.toContain("PRIVATE_PROVIDER_MESSAGE");
          expect(text).not.toContain("PRIVATE_ACCOUNT_OR_TOKEN");
        }
      } finally {
        await f.close();
      }
    })
  );
}
it.live("wrapper bytes drift refuses before consumer invocation", () =>
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      await Fs.appendFile(f.request.canonicalWrapperFile, "\n# changed");
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(await f.count("source-count")).toBe(0);
    } finally {
      await f.close();
    }
  })
);

it.live("external source interruption terminalizes after cleanup", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ mode: "hang" });
    try {
      const fiber = Effect.runFork(f.run);
      await f.started;
      await Effect.runPromise(Fiber.interrupt(fiber));
      const result = await Effect.runPromise(Fiber.await(fiber));
      expect(Exit.hasInterrupts(result)).toBe(true);
      expect(f.facts).toEqual(["Prepared", "Started", "Finished"]);
      const text = await Fs.readFile(
        Path.join(f.request.attemptDirectory, "diagnostic-lifecycle-validated.json"),
        "utf8"
      );
      const diagnostic = await Effect.runPromise(S.decodeEffect(S.fromJsonString(NativeAttemptDiagnostic))(text));
      expect(diagnostic.lifecycleOutcome).toEqual(O.some("cancelled"));
      expect(diagnostic.lifecycleDelivery).toEqual(O.some("acknowledged"));
      expect(diagnostic.nativeExitStatus).toEqual(O.none());
      expect(text).not.toContain("PRIVATE_");
    } finally {
      await f.close();
    }
  })
);
