import { createHash } from "node:crypto";
import * as FsSync from "node:fs";
import * as Fs from "node:fs/promises";
import * as Http from "node:http";
import * as Os from "node:os";
import * as Path from "node:path";
import { AiProviderCliHome } from "@beep/ai-provider-cli";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { ObservationLaunchIdentity, ObservationLaunchReceipt } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClaudeNativeCanaryRequest, runClaudeNativeCanary } from "./claude-native-canary.ts";
import { checkClaudeManagedPolicy, qualifyClaudeManagedPolicy } from "./claude-native-policy.ts";

const id = (text: string) => Sha256Hex.make(Str.repeat(64)(text));
const fixture = async (
  options: {
    rejectTraceOnce?: boolean;
    badInventory?: boolean;
    staleEpoch?: boolean;
    policyDrift?: boolean;
    nativeExit?: number;
    unknownEvent?: boolean;
    rateLimitStatus?: "allowed" | "allowed_warning" | "rejected";
    outputOverflow?: boolean;
    postPolicyDrift?: boolean;
    rejectFinished?: boolean;
  } = {}
) => {
  const directory = await Fs.mkdtemp(Path.join(Os.tmpdir(), "claude-canary-"));
  await Fs.chmod(directory, 0o700);
  for (const name of ["attempt", "home", "config", "tmp", "workspace.v1 with spaces"])
    await Fs.mkdir(Path.join(directory, name), { mode: 0o700 });
  const executable = Path.join(directory, "claude");
  const executableBytes = "synthetic-executable-never-run";
  await Fs.writeFile(executable, executableBytes, { mode: 0o700 });
  const nativePolicy = await Effect.runPromise(
    qualifyClaudeManagedPolicy(Path.join(directory, "config")).pipe(Effect.provide(NodeCrypto.layer))
  );
  const unknown = ObservationLaunchIdentity.fields.repository.cases.Unknown.make({});
  const request = ClaudeNativeCanaryRequest.make({
    launchId: id("a"),
    hostId: id("b"),
    namespaceId: id("c"),
    evidenceEpoch: 2,
    ingressRouteId: id("d"),
    identity: ObservationLaunchIdentity.make({
      routeId: id("e"),
      harness: "claude-code",
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
    executable,
    executableSha256: Sha256Hex.make(createHash("sha256").update(executableBytes).digest("hex")),
    workspace: Path.join(directory, "workspace.v1 with spaces"),
    attemptDirectory: Path.join(directory, "attempt"),
    nativeHome: Path.join(directory, "home"),
    sharedClaudeConfigDirectory: Path.join(directory, "config"),
    temporaryDirectory: Path.join(directory, "tmp"),
    nativePolicySha256: nativePolicy.digest,
    socketPath: Path.join(directory, "o.sock"),
  });
  const facts: Array<string> = [];
  const finishedOutcomes: Array<string> = [];
  const dispatchIntents: Array<boolean> = [];
  const traces: Array<Buffer> = [];
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
              evidenceEpoch: options.staleEpoch ? 3 : 2,
              accepting: true,
              routes: [{ routeId: request.identity.routeId, harness: "claude-code", surface: "cli" }],
            })
          )
        )
      );
    } else if (incoming.url === "/v1/launch-facts") {
      const submitted = await Effect.runPromise(S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission))(body));
      facts.push(submitted.fact._tag);
      if (submitted.fact._tag === "Finished") {
        finishedOutcomes.push(submitted.fact.outcome);
        if (options.rejectFinished) {
          response.statusCode = 503;
          response.end("PRIVATE_FINISH_REFUSAL");
          return;
        }
      }
      if (options.policyDrift && submitted.fact._tag === "Prepared")
        await Fs.writeFile(
          Path.join(request.sharedClaudeConfigDirectory, "remote-settings.json"),
          '{"permissions":{}}',
          { mode: 0o600 }
        );
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
      traces.push(Buffer.from(body, "binary"));
      if (options.rejectTraceOnce && traces.length === 1) {
        response.statusCode = 503;
        response.end("PRIVATE_LOSS");
      } else {
        response.setHeader("x-observation-receipt", id("2"));
        response.end();
      }
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(request.socketPath, resolve));
  await Fs.chmod(request.socketPath, 0o600);
  const output = [
    {
      type: "system",
      subtype: "init",
      session_id: "PRIVATE_SESSION",
      claude_code_version: "2.1.318",
      cwd: request.workspace,
      model: "claude-opus-5-5",
      apiKeySource: "none",
      tools: options.badInventory ? ["Read"] : [],
      mcp_servers: [],
      plugins: [{ name: "cc-plugin-agents-md" }, { name: "cc-plugin-privacy" }, { name: "cc-plugin-plugin-authoring" }],
      agents: ["claude", "Explore", "general-purpose", "Plan"],
      skills: [],
      slash_commands: [],
    },
    {
      type: "assistant",
      session_id: "PRIVATE_SESSION",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text: "ENROLLMENT_CANARY_OK" }],
      },
    },
    {
      type: "result",
      subtype: "success",
      session_id: "PRIVATE_SESSION",
      is_error: false,
      result: "ENROLLMENT_CANARY_OK",
      duration_ms: 10,
      duration_api_ms: 5,
      num_turns: 1,
      permission_denials: [],
      usage: { input_tokens: 9, output_tokens: 3 },
    },
  ]
    .map((value) => JSON.stringify(value))
    .join("\n");
  const spawner = ScriptedSpawner.make((_command, args) => {
    const purpose = args[0] === "--version" ? "version" : "source";
    dispatchIntents.push(
      FsSync.existsSync(Path.join(request.attemptDirectory, `diagnostic-${purpose}-dispatch-intent.json`))
    );
    if (purpose === "version") return { stdout: "2.1.318 (Claude Code)\n" };
    if (options.postPolicyDrift)
      FsSync.writeFileSync(
        Path.join(request.sharedClaudeConfigDirectory, "remote-settings.json"),
        '{"permissions":{}}',
        { mode: 0o600 }
      );
    const firstNewline = output.indexOf("\n");
    const reported = options.unknownEvent
      ? `${output.slice(0, firstNewline)}\n{"type":"rate_limit_event","privateBody":"PRIVATE_NATIVE_METADATA"}\n${output.slice(firstNewline + 1)}`
      : options.rateLimitStatus
        ? `${output.slice(0, firstNewline)}\n${JSON.stringify({ type: "rate_limit_event", session_id: "PRIVATE_SESSION", rate_limit_info: { status: options.rateLimitStatus }, message: "PRIVATE_WARNING" })}\n${output.slice(firstNewline + 1)}`
        : output;
    return {
      stdout: options.outputOverflow ? "x".repeat(262145) : reported,
      stderr: "PRIVATE_STDERR",
      exit: options.nativeExit ?? 0,
    };
  });
  const home = AiProviderCliHome.of({
    ensureCodexShadowHome: Effect.fn("TestHome.unused")(() => Effect.die("unused")),
    makeCodexEnv: () => {
      throw new Error("unused");
    },
    resolveCodexHomeLayout: () => {
      throw new Error("unused");
    },
    makeClaudeEnv: ({ baseEnv }) => baseEnv,
    resolveClaudeHome: () => request.nativeHome,
  });
  const run = runClaudeNativeCanary(request).pipe(
    Effect.provide(Layer.mergeAll(spawner.layer, NodeCrypto.layer, NodePath.layer)),
    Effect.provideService(AiProviderCliHome, home)
  );
  return {
    request,
    run,
    spawner,
    traces,
    facts,
    finishedOutcomes,
    dispatchIntents,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await Fs.rm(directory, { recursive: true, force: true });
    },
  };
};

it.live("runs one fixed native consumer then replays immutable metadata without source/probe rerun", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true, rateLimitStatus: "allowed_warning" });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      const accepted = await Effect.runPromise(f.run);
      expect(f.spawner.spawns).toHaveLength(2);
      expect(f.traces).toHaveLength(2);
      expect(f.traces[0]).toEqual(f.traces[1]);
      expect(accepted.backend).toBe("Unknown");
      const source = await Fs.readFile(Path.join(f.request.attemptDirectory, "source.json"), "utf8");
      expect(source).not.toContain("PRIVATE_");
      expect(source).not.toContain("ENROLLMENT_CANARY_OK");
      expect(JSON.parse(source).source.observedRateLimitNotifications).toEqual({
        allowed: 0,
        allowedWarning: 1,
        rejected: 0,
      });
      expect(f.traces[0]?.toString()).not.toContain("input_tokens");
      const actual = f.spawner.spawns[1];
      expect(actual?.extendEnv).toBe(false);
      expect(actual?.args).toContain("--safe-mode");
      expect(actual?.args).toContain("--restricted");
      expect(actual?.args).toContain("--no-session-persistence");
      expect(actual?.args).not.toContain("--bare");
      expect(actual?.env).not.toHaveProperty("ANTHROPIC_API_KEY");
      expect(actual?.env).toMatchObject({
        HOME: f.request.nativeHome,
        CLAUDE_CONFIG_DIR: f.request.sharedClaudeConfigDirectory,
        OTEL_LOG_USER_PROMPTS: "0",
        OTEL_LOG_ASSISTANT_RESPONSES: "0",
        OTEL_LOG_TOOL_CONTENT: "0",
        OTEL_LOG_RAW_API_BODIES: "0",
        OTEL_LOGS_EXPORTER: "none",
        OTEL_TRACES_EXPORTER: "none",
        OTEL_METRICS_EXPORTER: "none",
        CLAUDE_CODE_EFFORT_LEVEL: "medium",
      });
      expect(await Fs.readdir(f.request.nativeHome)).toEqual([]);
      expect(f.facts).toContain("SessionBound");
    } finally {
      await f.close();
    }
  })
);
it.live("nonempty native inventory fences an unknown attempt and never promotes or repeats source", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ badInventory: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(2);
      expect(f.traces).toHaveLength(0);
      expect(await Fs.readdir(f.request.attemptDirectory)).not.toContain("source.json");
    } finally {
      await f.close();
    }
  })
);
it.live("stale epoch refuses without a fence or any process", () =>
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
it.live("tampered source counters refuse replay without another native request", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ rejectTraceOnce: true });
    try {
      await Effect.runPromise(f.run.pipe(Effect.result));
      const path = Path.join(f.request.attemptDirectory, "source.json");
      await Fs.writeFile(path, Str.replace('"input_tokens":9', '"input_tokens":10')(await Fs.readFile(path, "utf8")));
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(2);
      expect(f.traces).toHaveLength(1);
    } finally {
      await f.close();
    }
  })
);
it.live("serialized private admission preserves redacted salt across JSON boundary", () =>
  Effect.tryPromise(async () => {
    const f = await fixture();
    try {
      const codec = S.fromJsonString(ClaudeNativeCanaryRequest);
      const serialized = await Effect.runPromise(S.encodeEffect(codec)(f.request));
      const decoded = await Effect.runPromise(S.decodeEffect(codec, { onExcessProperty: "error" })(serialized));
      expect(Redacted.isRedacted(decoded.hashSalt)).toBe(true);
      expect(await Effect.runPromise(S.encodeEffect(codec)(decoded))).toBe(serialized);
      expect(f.spawner.spawns).toHaveLength(0);
    } finally {
      await f.close();
    }
  })
);
for (const value of [
  { hooks: { SessionStart: [{ command: "PRIVATE_COMMAND" }] } },
  { apiKeyHelper: "PRIVATE_COMMAND" },
  { policyHelper: "PRIVATE_COMMAND" },
  { mcpServers: { private: {} } },
  { env: { OTEL_LOG_RAW_API_BODIES: "1" } },
  { env: { ANTHROPIC_API_KEY: "PRIVATE_VALUE" } },
  { model: "unapproved" },
  { futureBootstrap: true },
])
  it.effect("rejects active selected managed bootstrap policy without source values", () =>
    Effect.gen(function* () {
      const result = yield* checkClaudeManagedPolicy(JSON.stringify(value)).pipe(Effect.result);
      expect(result._tag).toBe("Failure");
      expect(String(result)).not.toContain("PRIVATE_");
    })
  );
it.effect("permits absent or inert selected keys and explicit privacy-off managed env", () =>
  Effect.gen(function* () {
    yield* checkClaudeManagedPolicy(
      JSON.stringify({
        hooks: {},
        mcpServers: {},
        disableAllHooks: true,
        env: { OTEL_LOG_RAW_API_BODIES: "0", OTEL_TRACES_EXPORTER: "none" },
      })
    );
  })
);

it.live("policy drift after preparation fences the attempt before the model process", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ policyDrift: true });
    try {
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(1);
      expect(f.traces).toHaveLength(0);
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(1);
    } finally {
      await f.close();
    }
  })
);

for (const scenario of [
  { name: "known nonzero native exit", options: { nativeExit: 2 }, phase: "source-exit", exit: 2, outcome: "failed" },
  {
    name: "rejected rate notification with native nonzero",
    options: { nativeExit: 2, rateLimitStatus: "rejected" as const },
    phase: "source-exit",
    exit: 2,
    outcome: "failed",
  },
  {
    name: "unsupported native metadata",
    options: { unknownEvent: true },
    phase: "source-protocol",
    exit: 0,
    outcome: "unknown",
  },
  {
    name: "post-run native policy drift",
    options: { postPolicyDrift: true },
    phase: "source-policy",
    exit: 0,
    outcome: "unknown",
  },
  {
    name: "bounded output overflow",
    options: { outputOverflow: true },
    phase: "source-output",
    exit: undefined,
    outcome: "unknown",
  },
])
  it.live(`persists finite diagnostics and separate failed lifecycle for ${scenario.name}`, () =>
    Effect.tryPromise(async () => {
      const f = await fixture(scenario.options);
      try {
        const result = await Effect.runPromise(f.run.pipe(Effect.result));
        expect(result).toMatchObject({ _tag: "Failure", failure: { phase: scenario.phase } });
        expect(f.dispatchIntents).toEqual([true, true]);
        expect(f.finishedOutcomes).toEqual([scenario.outcome]);
        expect(f.traces).toHaveLength(0);
        const raw = await Fs.readFile(Path.join(f.request.attemptDirectory, "diagnostic-source-failed.json"), "utf8");
        const meta = JSON.parse(raw);
        expect(meta.nativeSpawned).toBe(true);
        expect(meta.nativeExitStatus).toBe(scenario.exit);
        expect(meta.failurePhase).toBe(scenario.phase);
        expect(meta.actualApiRequestCount).toBe("unknown");
        if (scenario.options.unknownEvent) expect(meta.protocol.rateLimit).toBe(1);
        expect(raw).not.toContain("PRIVATE_");
        expect(raw).not.toContain("ENROLLMENT_CANARY_OK");
        expect(await Fs.readdir(f.request.attemptDirectory)).not.toContain("source.json");
        expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
        expect(f.spawner.spawns).toHaveLength(2);
        expect(f.finishedOutcomes).toHaveLength(1);
      } finally {
        await f.close();
      }
    })
  );
it.live("failed Finished delivery preserves original source refusal and a durable pending intent", () =>
  Effect.tryPromise(async () => {
    const f = await fixture({ nativeExit: 2, rejectFinished: true });
    try {
      const result = await Effect.runPromise(f.run.pipe(Effect.result));
      expect(result).toMatchObject({ _tag: "Failure", failure: { phase: "source-exit" } });
      const raw = await Fs.readFile(Path.join(f.request.attemptDirectory, "diagnostic-lifecycle-pending.json"), "utf8");
      expect(JSON.parse(raw)).toMatchObject({
        lifecycleOutcome: "failed",
        lifecycleDelivery: "pending",
        failurePhase: "source-exit",
        nativeExitStatus: 2,
      });
      expect(raw).not.toContain("PRIVATE_");
      expect((await Effect.runPromise(f.run.pipe(Effect.result)))._tag).toBe("Failure");
      expect(f.spawner.spawns).toHaveLength(2);
      expect(f.finishedOutcomes).toEqual(["failed"]);
    } finally {
      await f.close();
    }
  })
);
