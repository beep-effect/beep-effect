// @effect-diagnostics-next-line nodeBuiltinImport:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
import * as Fs from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
import * as Http from "node:http";
import * as Os from "node:os";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
import * as Path from "node:path";
import { AiProviderCliCodexHomeLayout, AiProviderCliHome } from "@beep/ai-provider-cli";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { ObservationLaunchIdentity, ObservationLaunchReceipt } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Toml from "effect/encoding/Toml";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CodexNativeCanaryRequest, runCodexNativeCanary } from "./codex-native-canary.ts";

const workspaceName = "workspace.v1 with spaces";
const logName = "logs";
const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
const output =
  '{"type":"thread.started","thread_id":"PRIVATE_NATIVE_THREAD"}\n{"type":"turn.started"}\n{"type":"item.completed","item":{"id":"i0","type":"reasoning","text":"PRIVATE_REASONING"}}\n{"type":"item.completed","item":{"id":"i1","type":"agent_message","text":"ENROLLMENT_CANARY_OK"}}\n{"type":"turn.completed","usage":{"input_tokens":9,"cached_input_tokens":2,"output_tokens":3,"reasoning_output_tokens":1}}\n';

// @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
const fixture = async (
  options: {
    readonly rejectTraceOnce?: boolean;
    readonly wrongConstant?: boolean;
    readonly staleEpoch?: boolean;
    readonly nativeHome?: boolean;
    readonly mcpMode?: "changed" | "enabled" | "unknown";
    readonly configText?: string;
    readonly configDrift?: boolean;
  } = {}
) => {
  const directory = await Fs.mkdtemp(Path.join(Os.tmpdir(), "codex-canary-"));
  await Fs.chmod(directory, 0o700);
  for (const name of ["attempt", "home", "shadow", "shared", workspaceName, logName])
    await Fs.mkdir(Path.join(directory, name), { mode: 0o700 });
  await Fs.writeFile(Path.join(directory, "shadow/auth.json"), "SYNTHETIC_NOT_AUTH", { mode: 0o600 });
  const configText = options.configText ?? "";
  await Fs.writeFile(Path.join(directory, "shared/config.toml"), configText, { mode: 0o600 });
  await Fs.writeFile(Path.join(directory, "shadow/config.toml"), configText, { mode: 0o600 });
  // @effect-diagnostics-next-line strictEffectProvide:off -- Test fixture derives its independently pinned config digest at its runtime boundary.
  const configSha = await Effect.runPromise(hashPublicTextSha256(configText).pipe(Effect.provide(NodeCrypto.layer)));
  const unknown = ObservationLaunchIdentity.fields.repository.cases.Unknown.make({});
  const request = CodexNativeCanaryRequest.make({
    launchId: id("a"),
    hostId: id("b"),
    namespaceId: id("c"),
    evidenceEpoch: 2,
    ingressRouteId: id("d"),
    identity: ObservationLaunchIdentity.make({
      routeId: id("e"),
      harness: "codex-cli",
      surface: "cli",
      root: unknown,
      repository: unknown,
      clone: unknown,
      worktree: unknown,
      task: unknown,
      attempt: unknown,
      evidenceId: id("f"),
    }),
    hashSalt: Redacted.make("synthetic-test-salt"),
    executable: "/synthetic/codex",
    workspace: Path.join(directory, workspaceName),
    attemptDirectory: Path.join(directory, "attempt"),
    isolatedHome: Path.join(directory, "home"),
    sharedCodexHome: Path.join(directory, "shared"),
    authMode: options.nativeHome === true ? "existing-native-auth-home" : "preprovisioned-shadow",
    shadowCodexHome: options.nativeHome === true ? O.none() : O.some(Path.join(directory, "shadow")),
    nativeLogDirectory: Path.join(directory, logName),
    nativeConfigSha256: configSha,
    socketPath: Path.join(directory, "o.sock"),
  });
  const facts: Array<string> = [];
  const traceBodies: Array<Buffer> = [];
  let traceCount = 0;
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  const server = Http.createServer(async (incoming, response) => {
    let body = "";
    for await (const chunk of incoming) body += Buffer.isBuffer(chunk) ? chunk.toString("binary") : String(chunk);
    if (incoming.url === "/v1/launch-context") {
      response.end(
        await Effect.runPromise(
          S.encodeEffect(S.fromJsonString(ObservationLaunchContext))(
            ObservationLaunchContext.make({
              hostId: request.hostId,
              namespaceId: request.namespaceId,
              evidenceEpoch: options.staleEpoch === true ? 3 : 2,
              accepting: true,
              routes: [{ routeId: request.identity.routeId, harness: "codex-cli", surface: "cli" }],
            })
          )
        )
      );
    } else if (incoming.url === "/v1/launch-facts") {
      const submitted = await Effect.runPromise(S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission))(body));
      facts.push(submitted.fact._tag);
      if (options.configDrift === true && submitted.fact._tag === "Prepared") {
        await Fs.appendFile(
          Path.join(directory, options.nativeHome === true ? "shared/config.toml" : "shadow/config.toml"),
          "# changed\n"
        );
      }
      response.end(
        await Effect.runPromise(
          S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt))(
            ObservationLaunchReceipt.make({
              receiptId: id("1"),
              hostId: submitted.hostId,
              namespaceId: submitted.namespaceId,
              evidenceEpoch: submitted.evidenceEpoch,
              fact: submitted.fact,
              recordedAt: 1,
            })
          )
        )
      );
    } else if (incoming.url === "/v1/traces") {
      traceCount += 1;
      traceBodies.push(Buffer.from(body, "binary"));
      if (options.rejectTraceOnce === true && traceCount === 1) {
        response.statusCode = 503;
        response.end("synthetic loss");
      } else {
        response.setHeader("x-observation-receipt", id("2"));
        response.end();
      }
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  // @effect-diagnostics-next-line newPromise:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  await new Promise<void>((resolve) => server.listen(request.socketPath, resolve));
  await Fs.chmod(request.socketPath, 0o600);
  const spawner = ScriptedSpawner.make((_command, args) =>
    args[0] === "--version"
      ? { stdout: "codex-cli 0.166.0\n" }
      : args[0] === "login"
        ? { stdout: "PRIVATE_AUTH_STATUS", stderr: "PRIVATE_AUTH_STATUS" }
        : args[0] === "mcp"
          ? {
              stdout: A.some(args, Str.startsWith("mcp_servers="))
                ? options.mcpMode === "changed"
                  ? '[{"name":"changed","enabled":false,"transport":{"type":"stdio"}}]'
                  : options.mcpMode === "enabled"
                    ? '[{"name":"synthetic","enabled":true,"transport":{"type":"stdio"}}]'
                    : '[{"name":"synthetic","enabled":false,"transport":{"type":"stdio","env":{"TOKEN":"PRIVATE_ENV"}}}]'
                : options.mcpMode === "unknown"
                  ? '[{"name":"synthetic","enabled":true,"transport":{"type":"future-unknown"}}]'
                  : '[{"name":"synthetic","enabled":true,"transport":{"type":"stdio","env":{"TOKEN":"PRIVATE_ENV"}}}]',
            }
          : {
              stdout:
                options.wrongConstant === true
                  ? Str.replace("ENROLLMENT_CANARY_OK", "PRIVATE_WRONG_REPLY")(output)
                  : output,
              stderr: "PRIVATE_STDERR",
            }
  );
  const layout = AiProviderCliCodexHomeLayout.make({
    mode: options.nativeHome === true ? "direct" : "authOverlay",
    sharedHomePath: request.sharedCodexHome,
    effectiveHomePath: options.nativeHome === true ? O.some(request.sharedCodexHome) : request.shadowCodexHome,
  });
  const home = AiProviderCliHome.of({
    ensureCodexShadowHome: Effect.fn("TestHome.ensureShadow")(() => Effect.void),
    makeCodexEnv: ({ baseEnv }) => ({
      ...baseEnv,
      CODEX_HOME: O.getOrElse(request.shadowCodexHome, () => request.sharedCodexHome),
    }),
    resolveCodexHomeLayout: () => layout,
    makeClaudeEnv: ({ baseEnv }) => baseEnv,
    resolveClaudeHome: () => "/synthetic-unused",
  });
  const run = runCodexNativeCanary(request).pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off -- Each test owns one isolated runtime and platform layers.
    Effect.provide(Layer.mergeAll(spawner.layer, NodeCrypto.layer, NodePath.layer)),
    Effect.provideService(AiProviderCliHome, home)
  );
  return {
    directory,
    request,
    run,
    spawner,
    facts,
    traceBodies,
    // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
    close: async () => {
      // @effect-diagnostics-next-line newPromise:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error)))
      );
      await Fs.rm(directory, { recursive: true, force: true });
    },
  };
};

it.live("retries immutable metadata after delivery loss without repeating source or probes and exports no text", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      await Effect.runPromise(f.run.pipe(Effect.result));
      expect(f.spawner.spawns).toHaveLength(5);
      const accepted = await Effect.runPromise(f.run);
      expect(f.spawner.spawns).toHaveLength(5);
      expect(accepted.backend).toBe("Unknown");
      expect(f.traceBodies).toHaveLength(2);
      expect(f.traceBodies[0]).toEqual(f.traceBodies[1]);
      const source = await Fs.readFile(Path.join(f.request.attemptDirectory, "source.json"), "utf8");
      expect(source).not.toContain("PRIVATE_");
      expect(source).not.toContain("synthetic");
      const preflight = await Fs.readFile(Path.join(f.request.attemptDirectory, "preflight.json"), "utf8");
      expect(preflight).not.toContain("synthetic");
      expect(preflight).not.toContain("PRIVATE_");
      expect(preflight).not.toContain("command");
      expect(accepted.source.qualification.qualifiedEnabledCount).toBe(0);
      expect(accepted.source.qualification.configuredCount).toBe(1);
      expect(source).not.toContain("ENROLLMENT_CANARY_OK");
      expect(f.traceBodies[0]?.toString()).not.toContain("PRIVATE_");
      expect(f.traceBodies[0]?.toString()).not.toContain("input_tokens");
      expect(f.facts).toContain("SessionBound");
      const actual = f.spawner.spawns[4];
      expect(actual?.extendEnv).toBe(false);
      expect(actual?.env).not.toHaveProperty("OPENAI_API_KEY");
      expect(actual?.args).toContain("--ephemeral");
      expect(actual?.args).toContain("gpt-6.1-sol");
      expect(actual?.args).not.toContain("resume");
    } finally {
      await f.close();
    }
  })
);

it.live("wrong constant leaves attempted unknown and cannot spawn again", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  Effect.tryPromise(async () => {
    const f = await fixture({ wrongConstant: true });
    try {
      const first = await Effect.runPromise(f.run.pipe(Effect.result));
      expect(first._tag).toBe("Failure");
      const second = await Effect.runPromise(f.run.pipe(Effect.result));
      expect(second._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(5);
      expect(f.traceBodies).toHaveLength(0);
      expect(A.sort(await Fs.readdir(f.request.attemptDirectory), Str.Order)).toEqual(["attempted", "preflight.json"]);
      expect(String(first)).not.toContain("PRIVATE_");
    } finally {
      await f.close();
    }
  })
);

it.live("a preexisting attempted fence never launches a source", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      await Fs.writeFile(Path.join(f.request.attemptDirectory, "attempted"), "interrupted", { mode: 0o600 });
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(0);
    } finally {
      await f.close();
    }
  })
);

it.live("stale epoch admission refuses before source or a new attempt fence", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  Effect.tryPromise(async () => {
    const f = await fixture({ staleEpoch: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(0);
      expect(await Fs.readdir(f.request.attemptDirectory)).toEqual([]);
    } finally {
      await f.close();
    }
  })
);

it.live("changed immutable source evidence cannot be replayed or cause another model turn", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      await Effect.runPromise(f.run.pipe(Effect.result));
      const filename = Path.join(f.request.attemptDirectory, "source.json");
      const saved = await Fs.readFile(filename, "utf8");
      await Fs.writeFile(filename, Str.replace('"input_tokens":9', '"input_tokens":10')(saved));
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(5);
      expect(f.traceBodies).toHaveLength(1);
    } finally {
      await f.close();
    }
  })
);

it.live("existing native auth home is consumed without shadow creation or inherited credentials", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native filesystem/socket fixture independently exercises the real platform boundary and closes every resource.
  Effect.tryPromise(async () => {
    const f = await fixture({ nativeHome: true });
    try {
      const accepted = await Effect.runPromise(f.run);
      expect(accepted.backend).toBe("Unknown");
      const actual = f.spawner.spawns[4];
      expect(actual?.env).toMatchObject({
        HOME: f.request.isolatedHome,
        CODEX_HOME: f.request.sharedCodexHome,
        RUST_LOG: "off",
      });
      expect(actual?.args).toContain("otel.log_user_prompt=false");
      expect(actual?.args).toContain("otel.log_agent_responses=false");
      expect(actual?.args).toContain('otel.exporter="none"');
      // Parse the real TOML table value instead of reproducing Codex's dotted-key splitter.
      // The independent native mcp-list regression separately qualifies actual override application.
      const projectOverride = O.getOrThrow(A.findFirst(actual?.args ?? [], Str.startsWith("projects=")));
      expect(await Effect.runPromise(Toml.parse(projectOverride).pipe(Effect.fromResult))).toEqual({
        projects: { [f.request.workspace]: { trust_level: "untrusted" } },
      });
      expect(projectOverride).not.toContain('projects."');
      const logOverride = O.getOrThrow(A.findFirst(actual?.args ?? [], Str.startsWith("log_dir=")));
      expect(await Effect.runPromise(Toml.parse(logOverride).pipe(Effect.fromResult))).toEqual({
        log_dir: f.request.nativeLogDirectory,
      });
      expect(actual?.cwd).toBe(f.request.workspace);
      expect(await Fs.readdir(f.request.sharedCodexHome)).toEqual(["config.toml"]);
    } finally {
      await f.close();
    }
  })
);

for (const mcpMode of ["changed", "enabled", "unknown"] as const) {
  it.live(`refuses ${mcpMode} MCP metadata before any source turn`, () =>
    // @effect-diagnostics-next-line asyncFunction:off -- Native socket fixture owns the real platform boundary.
    Effect.tryPromise(async () => {
      const f = await fixture({ mcpMode });
      try {
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(A.filter(f.spawner.spawns, (spawn) => spawn.args[0] === "exec")).toHaveLength(0);
        const count = f.spawner.spawns.length;
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(f.spawner.spawns).toHaveLength(count);
        expect(f.traceBodies).toHaveLength(0);
      } finally {
        await f.close();
      }
    })
  );
}
it.live("refuses a user bootstrap auth projection before MCP or source execution", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Native socket fixture owns the real platform boundary.
  Effect.tryPromise(async () => {
    const f = await fixture({ configText: 'chatgpt_base_url="https://example.invalid"' });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(2);
      expect(f.traceBodies).toHaveLength(0);
    } finally {
      await f.close();
    }
  })
);

it.live("config drift after MCP qualification refuses before source and cannot trigger another attempt", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Real socket fixture changes only its own non-auth synthetic config.
  Effect.tryPromise(async () => {
    const f = await fixture({ configDrift: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(4);
      expect(A.filter(f.spawner.spawns, (spawn) => spawn.args[0] === "exec")).toHaveLength(0);
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(4);
    } finally {
      await f.close();
    }
  })
);
it.live("changed immutable qualification cannot replay or launch another source", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Test changes only its own safe synthetic receipt.
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      await Effect.runPromise(f.run.pipe(Effect.result));
      const filename = Path.join(f.request.attemptDirectory, "source.json");
      const saved = await Fs.readFile(filename, "utf8");
      await Fs.writeFile(filename, Str.replace('"configuredCount":1', '"configuredCount":2')(saved));
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(5);
      expect(f.traceBodies).toHaveLength(1);
    } finally {
      await f.close();
    }
  })
);

it.effect("retains admission refusal for quote and backslash paths", () =>
  Effect.sync(() => {
    const validWorkspace = S.is(CodexNativeCanaryRequest.fields.workspace);
    const validLog = S.is(CodexNativeCanaryRequest.fields.nativeLogDirectory);
    expect(validWorkspace('/fixture/"quoted"')).toBe(false);
    expect(validWorkspace("/fixture/back\\slash")).toBe(false);
    expect(validLog('/fixture/"quoted"')).toBe(false);
    expect(validLog("/fixture/back\\slash")).toBe(false);
    expect(validWorkspace("/fixture/workspace.v1 with spaces")).toBe(true);
  })
);

it.live("serialized private admission round-trips its redacted salt without launching a source", () =>
  // @effect-diagnostics-next-line asyncFunction:off -- Offline codec regression owns only a synthetic local fixture; no producer is invoked.
  Effect.tryPromise(async () => {
    const f = await fixture({ nativeHome: true });
    try {
      const codec = S.fromJsonString(CodexNativeCanaryRequest);
      const serialized = await Effect.runPromise(S.encodeEffect(codec)(f.request));
      const decoded = await Effect.runPromise(S.decodeEffect(codec, { onExcessProperty: "error" })(serialized));
      expect(Redacted.isRedacted(decoded.hashSalt)).toBe(true);
      expect(Redacted.value(decoded.hashSalt) === Redacted.value(f.request.hashSalt)).toBe(true);
      expect(await Effect.runPromise(S.encodeEffect(codec)(decoded))).toBe(serialized);
      expect(f.spawner.spawns).toHaveLength(0);
      expect(await Fs.readdir(f.request.attemptDirectory)).toHaveLength(0);
    } finally {
      await f.close();
    }
  })
);

it.effect("private salt wire codec rejects empty and non-string values", () =>
  Effect.gen(function* () {
    const decode = S.decodeUnknownEffect(CodexNativeCanaryRequest.fields.hashSalt);
    expect((yield* decode("").pipe(Effect.result))._tag).toBe("Failure");
    expect((yield* decode(0).pipe(Effect.result))._tag).toBe("Failure");
    expect((yield* decode(null).pipe(Effect.result))._tag).toBe("Failure");
  })
);
