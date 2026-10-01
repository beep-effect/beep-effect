import { fileURLToPath } from "node:url";
import {
  decideYeetPrWaveOwner,
  escalateYeetPrWave,
  GreptileSummary,
  makeYeetPrWaveDescriptor,
  PROOF_JOB_FORWARDED_ENV_NAMES,
  PrCloseoutReport,
  PrNumber,
  PrRepository,
  PrSessionRecord,
  PrSessionRegistryError,
  probeYeetPrWaveOwner,
  RepoRunContext,
  runYeetMonitorUntilMerged,
  YEET_PR_WAVE_LEDGER_NAMESPACE,
  YeetAckState,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxEntry,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetPrWave,
  YeetPrWaveDescriptor,
  YeetPrWaveDescriptorInput,
  YeetPrWaveDescriptorJson,
  YeetPrWaveEscalation,
  YeetPrWaveOwnerVerdict,
  YeetRulesetRequiredContexts,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetUntilReadyPolicy,
  YeetWatchCheck,
  yeetInboxRowId,
} from "@beep/repo-cli/test/Yeet";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { DateTime, Duration, Effect, FileSystem, HashSet, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const workerPath = `${repoRoot}.claude/hooks/yeet-pr-wave-notifier.sh`;
const sequenceBreakPath = `${repoRoot}.claude/hooks/sequence-break-notifier.sh`;
const at = "2026-09-28T00:00:00.000Z";
const head = "abc1234def5678";
const prUrl = "https://github.com/beep/repo/pull/7";
const repository = PrRepository.make({ host: "github.com", owner: "beep", name: "repo" });
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const LedgerRow = S.Struct({
  stage: S.String,
  transport: S.String,
  ownerReason: S.String,
  livenessProbe: S.String,
  delivery: S.Struct({ status: S.String, outcome: S.optionalKey(S.String), reason: S.optionalKey(S.String) }),
});
const decodeLedgerRow = S.decodeUnknownEffect(S.fromJsonString(LedgerRow));
const isPrNumber = S.is(PrNumber);
const ledgerRows = (text: string) =>
  Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) => decodeLedgerRow(line));

const record = (harness: "claude-code" | "codex", sessionId: string, recordedAt = at) =>
  PrSessionRecord.make({
    schemaVersion: 1,
    repository,
    prNumber: O.some(7),
    prUrl: O.some(prUrl),
    branch: "feat/wave",
    harness,
    hostHarness: O.none(),
    sessionId: O.some(sessionId),
    hostSessionId: O.none(),
    sessionHome: O.none(),
    sessionHomeSource: "index",
    entrypoint: harness === "codex" ? "codex-tui" : "claude-desktop",
    sessionName: O.none(),
    nameSource: "user",
    model: "fixture-model",
    clonePath: "/src/repo",
    checkoutPath: "/worktrees/wave",
    worktreePath: O.none(),
    workspace: "wave-lane",
    sessionWorkspace: O.none(),
    childSession: false,
    headSha: head,
    runId: `run-${sessionId}`,
    role: "pushed",
    recordedAt: DateTime.makeUnsafe(recordedAt),
  });

const waveFor = Effect.fn("prWaveTest.wave")(function* (checkout: string, lanes: ReadonlyArray<string> = ["Lint"]) {
  const entries = yield* Effect.forEach(lanes, (lane) =>
    Effect.gen(function* () {
      const capsule = YeetFailureCapsule.make({
        bucket: "fail",
        headSha: head,
        lane,
        link: null,
        observedAt: at,
        prNumber: 7,
        state: "FAILURE",
        workflow: null,
      });
      return YeetInboxEntry.make({
        ack: YeetAckState.make({ acked: false, receipt: null }),
        liveness: "live",
        row: YeetCheckFailedRow.make({
          capsule,
          checkout,
          id: yield* yeetInboxRowId(capsule),
          severity: "P0",
          ts: at,
        }),
      });
    })
  );
  return YeetPrWave.make({
    prNumber: 7,
    entries: A.isReadonlyArrayNonEmpty(entries) ? entries : yield* Effect.die("no rows"),
  });
});

const handle = (output: string, code = 0) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(code)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

// Records every command the escalation launches instead of running it.
const recordingSpawner = (launched: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>) =>
  ChildProcessSpawner.make((command) =>
    ChildProcess.isStandardCommand(command)
      ? Ref.update(launched, A.append([command.command, ...command.args])).pipe(Effect.as(handle("")))
      : Effect.die("unexpected pipe")
  );

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const withCheckout = Effect.fn("prWaveTest.checkout")(function* <V, E, R>(
  use: (root: string) => Effect.Effect<V, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-wave-" });
  yield* fs.makeDirectory(`${root}/.claude/hooks`, { recursive: true });
  yield* fs.writeFileString(`${root}/.claude/hooks/yeet-pr-wave-notifier.sh`, "#!/usr/bin/env bash\n");
  return yield* use(root);
});

const readText = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(Effect.orElseSucceed(() => Str.empty));
});

describe("W9 liveness rule", () => {
  it("a live Claude owner is live and every other owner is dead", () => {
    const claude = record("claude-code", "claude-live");
    const codex = record("codex", "codex-thread", "2026-09-28T01:00:00.000Z");
    expect(decideYeetPrWaveOwner([claude], HashSet.make("claude-live"))).toStrictEqual(
      YeetPrWaveOwnerVerdict.make({
        live: true,
        reason: "claude-session-live",
        owner: O.some("claude-code · wave-lane"),
      })
    );
    expect(decideYeetPrWaveOwner([codex], HashSet.empty()).reason).toBe("non-claude-harness");
    expect(decideYeetPrWaveOwner([codex], HashSet.empty()).live).toBe(false);
    expect(decideYeetPrWaveOwner([], HashSet.empty())).toStrictEqual(
      YeetPrWaveOwnerVerdict.make({ live: false, reason: "no-owner-record" })
    );
    expect(decideYeetPrWaveOwner([claude], HashSet.empty()).reason).toBe("claude-session-not-live");
    // A newer Codex owner does not hide an older Claude session that is still live.
    expect(decideYeetPrWaveOwner([claude, codex], HashSet.make("claude-live")).live).toBe(true);
  });
});

it.layer(platform, { timeout: "30 seconds" })("W9 liveness probe", (it) => {
  it.effect("probes Claude sessions against the live index and the process table; stale is dead", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-wave-probe-" });
      yield* fs.makeDirectory(`${root}/sessions`);
      yield* fs.makeDirectory(`${root}/proc/4242`, { recursive: true });
      yield* fs.writeFileString(
        `${root}/sessions/4242.json`,
        yield* encodeJson({ pid: 4242, sessionId: "claude-live", cwd: root })
      );
      // An index whose process is gone: the session is stale, not live.
      yield* fs.writeFileString(
        `${root}/sessions/9999.json`,
        yield* encodeJson({ pid: 9999, sessionId: "claude-stale", cwd: root })
      );
      const probe = (records: ReadonlyArray<PrSessionRecord>) =>
        probeYeetPrWaveOwner(records, `${root}/sessions`, `${root}/proc`);

      expect((yield* probe([record("claude-code", "claude-live")])).live).toBe(true);
      expect((yield* probe([record("claude-code", "claude-stale")])).reason).toBe("claude-session-not-live");
      expect((yield* probe([record("codex", "claude-live")])).reason).toBe("non-claude-harness");
      expect((yield* probe([])).reason).toBe("no-owner-record");
      // An unreadable sessions root is unknown liveness, which is dead.
      expect(
        (yield* probeYeetPrWaveOwner([record("claude-code", "claude-live")], `${root}/missing`, `${root}/proc`)).live
      ).toBe(false);
    })
  );
});

it.layer(platform, { timeout: "30 seconds" })("W9 escalation", (it) => {
  const escalateWith = Effect.fn("prWaveTest.escalateWith")(function* (
    root: string,
    records: ReadonlyArray<PrSessionRecord>,
    launched: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>
  ) {
    const wave = yield* waveFor(root);
    return yield* escalateYeetPrWave(root, wave, head, O.some(prUrl), {
      lookup: () => Effect.succeed(records),
      sessionsRoot: `${root}/no-sessions`,
      procRoot: `${root}/no-proc`,
      now: Effect.succeed(DateTime.makeUnsafe(at)),
    }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recordingSpawner(launched)));
  });

  it.effect("spawns the notifier once per wave for a Codex owner and records the descriptor", () =>
    withCheckout((root) =>
      Effect.gen(function* () {
        const launched = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const first = yield* escalateWith(root, [record("codex", "codex-thread")], launched);
        const second = yield* escalateWith(root, [record("codex", "codex-thread")], launched);

        expect(first.outcome).toBe("spawned");
        expect(first.owner.reason).toBe("non-claude-harness");
        expect(second).toStrictEqual(YeetPrWaveEscalation.make({ ...first, outcome: "already-escalated" }));
        const commands = yield* Ref.get(launched);
        expect(A.length(commands)).toBe(1);
        const descriptorPath = `${root}/.beep/yeet/pr-wave-notifier/waves/${first.waveKey}.json`;
        assertSome(A.head(commands), [
          "setsid",
          "-f",
          "bash",
          "-c",
          'exec bash "$0" "$@" </dev/null >/dev/null 2>&1',
          `${root}/.claude/hooks/yeet-pr-wave-notifier.sh`,
          descriptorPath,
        ]);
        const descriptor = yield* YeetPrWaveDescriptorJson.decode(yield* readText(descriptorPath));
        expect(descriptor.urgency).toBe("critical");
        expect(descriptor.ownerReason).toBe("non-claude-harness");
        expect(descriptor.desktopBody).toContain("yeet resume 7");
        expect(descriptor.desktopBody).toContain("owner: codex · wave-lane (non-claude-harness)");
        expect(Str.length(first.waveKey)).toBe(16);
      })
    )
  );

  it.effect("spawns for an ownerless wave and a different wave gets its own key", () =>
    withCheckout((root) =>
      Effect.gen(function* () {
        const launched = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const first = yield* escalateWith(root, A.empty(), launched);
        const other = yield* escalateYeetPrWave(root, yield* waveFor(root, ["Lint", "Test"]), head, O.some(prUrl), {
          lookup: () => Effect.succeed(A.empty()),
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recordingSpawner(launched)));

        expect(first.outcome).toBe("spawned");
        expect(first.owner.reason).toBe("no-owner-record");
        expect(other.outcome).toBe("spawned");
        expect(other.waveKey).not.toBe(first.waveKey);
        expect(A.length(yield* Ref.get(launched))).toBe(2);
      })
    )
  );

  it.effect("spawns nothing when a Claude owner is live", () =>
    withCheckout((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`${root}/sessions`);
        yield* fs.makeDirectory(`${root}/proc/77`, { recursive: true });
        yield* fs.writeFileString(
          `${root}/sessions/77.json`,
          yield* encodeJson({ pid: 77, sessionId: "live", cwd: root })
        );
        const launched = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const result = yield* escalateYeetPrWave(root, yield* waveFor(root), head, O.some(prUrl), {
          lookup: () => Effect.succeed([record("claude-code", "live")]),
          sessionsRoot: `${root}/sessions`,
          procRoot: `${root}/proc`,
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recordingSpawner(launched)));

        expect(result.outcome).toBe("owner-live");
        expect(A.length(yield* Ref.get(launched))).toBe(0);
        expect(yield* fs.exists(`${root}/.beep/yeet/pr-wave-notifier`)).toBe(false);
      })
    )
  );

  it.effect("releases the claim when the spawn fails, so the next attempt launches", () =>
    withCheckout((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const failing = ChildProcessSpawner.make(() => Effect.succeed(handle("", 1)));
        const launched = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const attempt = (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]) =>
          Effect.flatMap(waveFor(root), (wave) =>
            escalateYeetPrWave(root, wave, head, O.some(prUrl), { lookup: () => Effect.succeed(A.empty()) }).pipe(
              Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
            )
          );
        const failed = yield* attempt(failing);
        expect(failed.outcome).toBe("spawn-failed");
        expect(yield* fs.exists(`${root}/.beep/yeet/pr-wave-notifier/waves/${failed.waveKey}.json`)).toBe(false);
        const retrySpawner = recordingSpawner(launched);
        const retried = yield* attempt(retrySpawner);
        expect(retried.outcome).toBe("spawned");
        expect(retried.waveKey).toBe(failed.waveKey);
        const launches = yield* Ref.get(launched);
        expect(A.length(launches)).toBe(1);
      })
    )
  );

  it.effect("treats an unresolvable repository and an unreadable registry as dead", () =>
    withCheckout((root) =>
      Effect.gen(function* () {
        const launched = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
        const spawner = recordingSpawner(launched);
        const unresolved = yield* escalateYeetPrWave(root, yield* waveFor(root), head, O.none(), {
          lookup: () => Effect.die("not read"),
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
        const unreadable = yield* escalateYeetPrWave(root, yield* waveFor(root, ["Test"]), head, O.some(prUrl), {
          lookup: () => Effect.fail(PrSessionRegistryError.make({ reason: "io", message: "fixture" })),
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

        expect(unresolved.owner.reason).toBe("repository-unresolved");
        expect(unresolved.outcome).toBe("spawned");
        expect(unreadable.owner.reason).toBe("registry-unreadable");
        expect(unreadable.outcome).toBe("spawned");
      })
    )
  );
});

it.layer(platform, { timeout: "30 seconds" })("W9 descriptor rendering", (it) => {
  it.effect("decodes only a positive integer pull request number, the worker's shape", () =>
    Effect.gen(function* () {
      const wave = yield* waveFor("/repo");
      const descriptor = makeYeetPrWaveDescriptor(
        YeetPrWaveDescriptorInput.make({
          wave,
          headSha: head,
          checkout: "/repo",
          waveKey: "feedfacefeedface",
          owner: YeetPrWaveOwnerVerdict.make({ live: false, reason: "no-owner-record" }),
          createdAt: at,
        })
      );
      const encoded = yield* YeetPrWaveDescriptorJson.encode(descriptor);
      assertSome(YeetPrWaveDescriptorJson.decodeOption(encoded), descriptor);
      for (const prNumber of ["0", "-1", "1.5"]) {
        const bad = Str.replace('"prNumber":7', `"prNumber":${prNumber}`)(encoded);
        expect(bad).not.toBe(encoded);
        assertNone(YeetPrWaveDescriptorJson.decodeOption(bad));
      }
    })
  );

  it.effect.prop(
    "round-trips every schema-generated descriptor with a positive integer pull request number",
    { descriptor: YeetPrWaveDescriptor },
    ({ descriptor }) =>
      Effect.gen(function* () {
        const decoded = yield* YeetPrWaveDescriptorJson.decode(yield* YeetPrWaveDescriptorJson.encode(descriptor));
        expect(decoded).toStrictEqual(descriptor);
        expect(isPrNumber(decoded.prNumber)).toBe(true);
      })
  );

  it.effect("the local body names the resume command and the summary; nothing else carries them", () =>
    Effect.gen(function* () {
      const wave = yield* waveFor("/repo", ["Lint", "Test"]);
      const descriptor = makeYeetPrWaveDescriptor(
        YeetPrWaveDescriptorInput.make({
          wave,
          headSha: head,
          checkout: "/repo",
          waveKey: "feedfacefeedface",
          owner: YeetPrWaveOwnerVerdict.make({
            live: false,
            reason: "non-claude-harness",
            owner: O.some("codex · lane"),
          }),
          createdAt: at,
        })
      );
      expect(descriptor.resumeCommand).toBe("bun run beep yeet resume 7");
      expect(descriptor.summary).toBe("P0 Lint (pr #7 @ abc1234) (+1 more) · owner: codex · lane (non-claude-harness)");
      expect(descriptor.desktopTitle).toBe("PR #7: 2 new inbox row(s), no live owner");
      expect(descriptor.desktopBody).toBe(`${descriptor.summary}\nbun run beep yeet resume 7`);
      expect(A.length(descriptor.rowIds)).toBe(2);
    })
  );
});

// The worker runs for real against stub transports on PATH: notify-send,
// curl (behind the real circuit breaker), and gdbus record what they received.
const stubScript = (record: string, output: string) => `#!/usr/bin/env bash
{ printf '%s\\n' "$@"; printf -- '--\\n'; } >>"${record}.args"
case " $* " in *" --data-binary "*) cat >>"${record}.stdin" ;; esac
printf '${output}'
`;

const runWorker = Effect.fn("prWaveTest.runWorker")(function* (acked: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-wave-worker-" });
  const checkout = path.join(root, "checkout");
  const bin = path.join(root, "bin");
  const evidence = path.join(root, "evidence");
  yield* fs.makeDirectory(path.join(checkout, ".beep", "inbox", "acks"), { recursive: true });
  yield* fs.makeDirectory(path.join(checkout, ".beep", "yeet", "pr-wave-notifier", "waves"), { recursive: true });
  yield* fs.makeDirectory(bin);
  for (const [name, output] of [
    ["notify-send", "42\\n"],
    ["curl", ""],
    ["gdbus", ""],
  ] as const) {
    yield* fs.writeFileString(path.join(bin, name), stubScript(path.join(root, name), output));
    yield* fs.chmod(path.join(bin, name), 0o755);
  }
  const wave = yield* waveFor(checkout);
  const descriptor = makeYeetPrWaveDescriptor(
    YeetPrWaveDescriptorInput.make({
      wave,
      headSha: head,
      checkout,
      waveKey: "feedfacefeedface",
      owner: YeetPrWaveOwnerVerdict.make({ live: false, reason: "non-claude-harness", owner: O.some("codex · lane") }),
      createdAt: at,
    })
  );
  const descriptorPath = path.join(checkout, ".beep", "yeet", "pr-wave-notifier", "waves", "feedfacefeedface.json");
  yield* fs.writeFileString(descriptorPath, yield* YeetPrWaveDescriptorJson.encode(descriptor));
  if (acked) {
    yield* Effect.forEach(descriptor.rowIds, (id) =>
      fs.writeFileString(path.join(checkout, ".beep", "inbox", "acks", id), "{}")
    );
  }
  const worker = yield* ChildProcess.make("bash", [workerPath, descriptorPath], {
    cwd: root,
    extendEnv: false,
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      HOME: root,
      BEEP_AGENT_EVIDENCE_ROOT: evidence,
      XDG_RUNTIME_DIR: root,
      DBUS_SESSION_BUS_ADDRESS: `unix:path=${root}/bus`,
      BEEP_SEQUENCE_BREAK_NTFY_BASE_URL: "https://ntfy.example.test",
      BEEP_SEQUENCE_BREAK_NTFY_TOPIC: "beep_wave_topic",
      BEEP_SEQUENCE_BREAK_NTFY_TOKEN: "fixture-bearer-value",
      BEEP_PR_WAVE_NOTIFIER_MAX_SECONDS: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = yield* worker.exitCode;
  const ledgerDir = path.join(evidence, YEET_PR_WAVE_LEDGER_NAMESPACE);
  const ledgerFiles = yield* fs.readDirectory(ledgerDir).pipe(Effect.orElseSucceed(A.empty));
  const ledger = yield* Effect.forEach(ledgerFiles, (name) => readText(path.join(ledgerDir, name)));
  return {
    exitCode,
    descriptor,
    ledgerFiles,
    ledger: A.join(ledger, ""),
    notify: yield* readText(path.join(root, "notify-send.args")),
    curlArgs: yield* readText(path.join(root, "curl.args")),
    curlStdin: yield* readText(path.join(root, "curl.stdin")),
  };
});

describe("W9 job environment", () => {
  it("forwards the session bus address to detached jobs", () => {
    expect(PROOF_JOB_FORWARDED_ENV_NAMES).toContain("DBUS_SESSION_BUS_ADDRESS");
    expect(PROOF_JOB_FORWARDED_ENV_NAMES).toContain("XDG_RUNTIME_DIR");
  });
});

it.layer(platform, { timeout: "30 seconds" })("W9 notifier worker", (it) => {
  it.effect(
    "notifies the desktop with the resume command and ntfy with generic text, then resolves",
    () =>
      Effect.gen(function* () {
        const result = yield* runWorker(false);
        expect(result.exitCode).toBe(0);
        expect(result.notify).toContain("--urgency=critical");
        expect(result.notify).toContain("--expire-time=0");
        expect(result.notify).toContain("PR #7: 1 new inbox row(s), no live owner");
        expect(result.notify).toContain("bun run beep yeet resume 7");
        expect(result.curlStdin).toContain('"topic":"beep_wave_topic"');
        expect(result.curlStdin).toContain("no live agent session owns it");
        // ntfy stays generic: no pull request, head, row, summary, or resume command.
        for (const content of ["#7", "resume", head, "Lint", result.descriptor.rowIds[0], "codex"]) {
          expect(result.curlStdin).not.toContain(content);
          expect(result.ledger).not.toContain(content);
        }
        // The bearer token reaches curl through a descriptor, never argv.
        expect(result.curlArgs).not.toContain("fixture-bearer-value");
        expect(result.curlArgs).toContain("@/dev/fd/8");
        expect(result.ledgerFiles).toStrictEqual([
          expect.stringMatching(/^pr-wave-\d{4}-\d{2}-\d{2}-feedfacefeedface\.ndjson$/u),
        ]);
        const rows = yield* ledgerRows(result.ledger);
        expect(A.map(rows, (row) => `${row.stage}/${row.transport}/${row.delivery.status}`)).toStrictEqual([
          "initial/desktop/sent",
          "initial/ntfy/sent",
          "resolution/none/resolved",
        ]);
        expect(
          A.every(rows, (row) => row.ownerReason === "non-claude-harness" && row.livenessProbe === "claude-only")
        ).toBe(true);
        assertSome(
          O.map(A.last(rows), (row) => row.delivery.outcome),
          "timeout"
        );
      }),
    20_000
  );

  it.effect(
    "an already acknowledged wave notifies no one",
    () =>
      Effect.gen(function* () {
        const result = yield* runWorker(true);
        expect(result.exitCode).toBe(0);
        expect(result.notify).toBe("");
        expect(result.curlStdin).toBe("");
        const rows = yield* ledgerRows(result.ledger);
        expect(A.map(rows, (row) => `${row.stage}/${row.delivery.outcome}`)).toStrictEqual(["resolution/acked"]);
      }),
    20_000
  );

  it.effect(
    "parses, and leaves the sequence-break notifier byte-identical to origin/main",
    () =>
      Effect.gen(function* () {
        const syntax = yield* ChildProcess.make("bash", ["-n", workerPath], { stdout: "pipe", stderr: "pipe" });
        expect(yield* syntax.exitCode).toBe(0);
        const show = yield* ChildProcess.make("git", ["show", "origin/main:.claude/hooks/sequence-break-notifier.sh"], {
          cwd: repoRoot,
          stdout: "pipe",
          stderr: "pipe",
        });
        const [upstream, code] = yield* Effect.all([Stream.mkString(Stream.decodeText(show.stdout)), show.exitCode], {
          concurrency: "unbounded",
        });
        expect(code).toBe(0);
        expect(yield* readText(sequenceBreakPath)).toBe(upstream);
      }),
    20_000
  );
});

// The monitor side: a detached until-ready loop escalates each new wave once.
const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/wave",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

const snapshot = (root: string, checks: ReadonlyArray<YeetWatchCheck>, state = "OPEN") => {
  const green = A.every(checks, (value) => value.outcome === "pass");
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: state === "OPEN",
    notDraft: true,
    closeoutRun: true,
    requiredChecksGreen: green,
    threadsResolved: true,
    mergeable: true,
    mergeStateAcceptable: true,
    reviewDecisionAcceptable: true,
    closeoutGatesPassed: true,
    greptileScore: O.none(),
  });
  return YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feature/wave",
    head: "HEAD",
    createdAt: at,
    nextCommand: "monitor",
    runId: "wave",
    schemaVersion: "yeet-status/v1",
    statusPath: `${root}/status.json`,
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    closeout: YeetStatusArtifact.make({ detail: "fixture", path: "closeout.json", state: "missing" }),
    verdict: YeetStatusArtifact.make({ detail: "fixture", path: "verdict.json", state: "missing" }),
    remote: YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "fixture",
      headSha: O.some(head),
      number: 7,
      url: prUrl,
      checks,
      state,
      failingCheckCount: A.filter(checks, (value) => value.outcome === "fail").length,
    }),
    mergeReady: O.some(
      YeetMergeReady.make({
        ready: criteria.prOpen && green,
        criteria,
        failing: green ? O.none() : O.some("required-checks-green"),
      })
    ),
  });
};

const monitorRunner = ChildProcessSpawner.make(
  Effect.fnUntraced(function* (command) {
    if (!ChildProcess.isStandardCommand(command)) return yield* Effect.die("unexpected pipe");
    const [first, second] = command.args;
    if (first === "run" && second === "list")
      return handle(
        yield* encodeJson([
          { databaseId: 7, headSha: head, status: "completed", conclusion: "failure", name: "CI" },
        ]).pipe(Effect.orDie)
      );
    if (A.contains(command.args, "--log-failed")) return handle("Assertion failed");
    return handle(
      yield* encodeJson({
        jobs: [
          {
            databaseId: 991,
            name: "Lint",
            status: "completed",
            conclusion: "failure",
            steps: [{ name: "Test", conclusion: "failure" }],
          },
        ],
      }).pipe(Effect.orDie)
    );
  })
);

it.layer(platform, { timeout: "30 seconds" })("W9 monitor escalation", (it) => {
  it.effect("re-probes a wave whose owner was live and escalates once the owner is dead", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-wave-live-dead-" });
      const polls = yield* Ref.make(0);
      const verdicts = yield* Ref.make<ReadonlyArray<YeetPrWaveEscalation["outcome"]>>(A.empty());
      // The owner is live on poll 0, the notifier fails to start on poll 1, it
      // launches on poll 2, and every later poll sees the wave as settled.
      const script: ReadonlyArray<YeetPrWaveEscalation["outcome"]> = ["owner-live", "spawn-failed", "spawned"];
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        policy: YeetUntilReadyPolicy.make({}),
        pollInterval: Duration.zero,
        capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
        rulesetRead: () =>
          Effect.succeedSome(
            YeetRulesetRequiredContexts.make({ base: "main", readAt: at, contexts: ["Lint"], rulesetIds: [1] })
          ),
        closeout: () => Effect.die("unexpected closeout"),
        onMerged: () => Effect.die("unexpected sweep"),
        replayComments: () => Effect.void,
        commentRows: () => Effect.succeed(A.empty()),
        bindPullRequest: () => Effect.void,
        escalateWave: () =>
          Ref.modify(verdicts, (seen) => {
            const outcome = O.getOrElse(A.get(script, A.length(seen)), () => "already-escalated" as const);
            return [outcome, A.append(seen, outcome)];
          }).pipe(
            Effect.map((outcome) =>
              YeetPrWaveEscalation.make({
                outcome,
                waveKey: "feedfacefeedface",
                owner: YeetPrWaveOwnerVerdict.make({
                  live: outcome === "owner-live",
                  reason: outcome === "owner-live" ? "claude-session-live" : "claude-session-not-live",
                }),
              })
            )
          ),
        // The same red on polls 0-4; poll 5 closes the pull request.
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              snapshot(
                root,
                [
                  YeetWatchCheck.make({
                    name: "Lint",
                    outcome: "fail",
                    link: "https://github.com/beep/repo/actions/runs/7/job/991",
                  }),
                ],
                n === 5 ? "CLOSED" : "OPEN"
              )
            )
          ),
      }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, monitorRunner));

      expect(terminal).toBe("closed");
      expect(yield* Ref.get(verdicts)).toStrictEqual(["owner-live", "spawn-failed", "spawned"]);
    })
  );

  it.effect("escalates a detached until-ready wave once, and again when a rerun comes back red", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-wave-monitor-" });
      const polls = yield* Ref.make(0);
      const escalations = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>(A.empty());
      const red = (job: number) =>
        YeetWatchCheck.make({
          name: "Lint",
          outcome: "fail",
          link: `https://github.com/beep/repo/actions/runs/7/job/${job}`,
        });
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        policy: YeetUntilReadyPolicy.make({}),
        pollInterval: Duration.zero,
        capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
        rulesetRead: () =>
          Effect.succeedSome(
            YeetRulesetRequiredContexts.make({ base: "main", readAt: at, contexts: ["Lint"], rulesetIds: [1] })
          ),
        closeout: () =>
          Effect.succeed({
            reportPath: "closeout.json",
            report: PrCloseoutReport.make({
              actionableReviewThreadCount: 0,
              botCommentCount: 0,
              greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
              issueCount: 0,
              issues: [],
              prNumber: 7,
              prUrl,
              reviewedHeadSha: O.some(head),
              retriggeredGreptile: false,
              schemaVersion: "yeet-pr-closeout/v1",
            }),
          }),
        onMerged: () => Effect.die("unexpected sweep"),
        replayComments: () => Effect.void,
        commentRows: () => Effect.succeed(A.empty()),
        bindPullRequest: () => Effect.void,
        escalateWave: (_checkout, wave, headSha, url) =>
          Ref.update(
            escalations,
            A.append([
              `${wave.prNumber}`,
              headSha,
              O.getOrElse(url, () => ""),
              ...A.map(wave.entries, (entry) => entry.row.id),
            ])
          ).pipe(
            Effect.as(
              YeetPrWaveEscalation.make({
                outcome: "spawned",
                waveKey: "feedfacefeedface",
                owner: YeetPrWaveOwnerVerdict.make({ live: false, reason: "no-owner-record" }),
              })
            )
          ),
        // Polls 0-2 report one red; poll 3 reports it again from a new job (a
        // rerun that came back red); poll 4 closes the pull request.
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) => snapshot(root, [red(n >= 3 ? 992 : 991)], n === 4 ? "CLOSED" : "OPEN"))
          ),
      }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, monitorRunner));

      expect(terminal).toBe("closed");
      const seen = yield* Ref.get(escalations);
      expect(A.length(seen)).toBe(2);
      expect(A.map(seen, A.take(3))).toStrictEqual([
        ["7", head, prUrl],
        ["7", head, prUrl],
      ]);
    })
  );

  it.effect("an attached until-ready loop never escalates", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-pr-wave-attached-" });
      const polls = yield* Ref.make(0);
      const escalations = yield* Ref.make(0);
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        policy: YeetUntilReadyPolicy.make({}),
        attachment: "attached",
        pollInterval: Duration.zero,
        capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
        rulesetRead: () =>
          Effect.succeedSome(
            YeetRulesetRequiredContexts.make({ base: "main", readAt: at, contexts: ["Lint"], rulesetIds: [1] })
          ),
        closeout: () => Effect.die("unexpected closeout"),
        onMerged: () => Effect.die("unexpected sweep"),
        replayComments: () => Effect.void,
        commentRows: () => Effect.succeed(A.empty()),
        escalateWave: () =>
          Ref.update(escalations, (n) => n + 1).pipe(
            Effect.as(
              YeetPrWaveEscalation.make({
                outcome: "spawned",
                waveKey: "feedfacefeedface",
                owner: YeetPrWaveOwnerVerdict.make({ live: false, reason: "no-owner-record" }),
              })
            )
          ),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map(() => snapshot(root, [YeetWatchCheck.make({ name: "Lint", outcome: "fail", link: null })]))
          ),
      }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, monitorRunner));

      expect(terminal).toBe("wave");
      expect(yield* Ref.get(escalations)).toBe(0);
    })
  );
});
