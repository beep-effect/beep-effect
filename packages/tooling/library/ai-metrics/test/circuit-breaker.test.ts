import * as NodeURL from "node:url";
import {
  agentEvidenceRoot,
  CircuitBreakerEventV1,
  CircuitBreakerOpenStateV1,
  circuitBreakerEventLedgerDir,
  circuitBreakerOpenStateDir,
  circuitBreakerRoot,
} from "@beep/repo-ai-metrics";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Path, pipe, Stream } from "effect";
import * as A from "effect/Array";
import { ChildProcess } from "effect/process";
import * as R from "effect/Record";

const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const claudeBreakerPath = `${repoRoot}.claude/hooks/circuit-breaker.sh`;
const codexBreakerPath = `${repoRoot}.codex/hooks/circuit-breaker.sh`;
const CANARY = "CIRCUIT-BREAKER-COMMAND-CONTENT-CANARY";
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;

const canonicalEventKeys = ["schemaVersion", "ts", "probe", "caller", "breakerRev", "evidenceTier", "outcome"];
const canonicalOpenStateKeys = [
  "schemaVersion",
  "probe",
  "breakerRev",
  "trippedEpochMs",
  "retryAfterEpochMs",
  "exitCode",
];

interface BreakerStore {
  readonly eventDir: string;
  readonly evidenceRoot: string;
  readonly markerPath: string;
  readonly openStatePath: string;
  readonly stateHome: string;
}

const makeBreakerStore = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stateHome = yield* fs.makeTempDirectoryScoped({ prefix: "beep-circuit-breaker-" });
  const evidenceRoot = agentEvidenceRoot(stateHome);
  const root = circuitBreakerRoot(evidenceRoot);

  return {
    eventDir: circuitBreakerEventLedgerDir(root),
    evidenceRoot,
    markerPath: path.join(stateHome, CANARY),
    openStatePath: path.join(circuitBreakerOpenStateDir(root), "op.json"),
    stateHome,
  } satisfies BreakerStore;
});

const runBreaker = Effect.fnUntraced(function* (
  store: BreakerStore,
  args: ReadonlyArray<string>,
  breakerPath = claudeBreakerPath
) {
  const handle = yield* ChildProcess.make(breakerPath, args, {
    cwd: repoRoot,
    extendEnv: true,
    env: {
      HOME: store.stateHome,
      PATH: "/usr/bin:/bin",
      XDG_STATE_HOME: store.stateHome,
      BEEP_AGENT_EVIDENCE_ROOT: store.evidenceRoot,
      BEEP_CIRCUIT_BREAKER_COOLDOWN_SECONDS: "900",
      BEEP_CIRCUIT_BREAKER_REV: "shared-cooldown-1",
      BEEP_HOOK_PULSE_DISARM_SENTINEL: "",
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );

  return { exitCode, stderr, stdout };
});

const eventRows = Effect.fnUntraced(function* (store: BreakerStore) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!(yield* fs.exists(store.eventDir))) return A.empty<string>();

  const files = yield* fs.readDirectory(store.eventDir);
  const rows = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(store.eventDir, file)), (contents) =>
      A.filter(contents.split("\n"), (line) => line.length > 0)
    )
  );
  return A.flatten(rows);
});

const decodedEvents = Effect.fnUntraced(function* (store: BreakerStore) {
  return yield* Effect.forEach(yield* eventRows(store), (row) => CircuitBreakerEventV1.decodeJsonEffect(row));
});

it.layer(NodeServices.layer)("agent command circuit breaker", (it) => {
  it("declares only bounded content-free persisted fields", () => {
    expect(A.difference(R.keys(CircuitBreakerEventV1.fields), canonicalEventKeys)).toEqual([]);
    expect(A.difference(canonicalEventKeys, R.keys(CircuitBreakerEventV1.fields))).toEqual([]);
    expect(A.difference(R.keys(CircuitBreakerOpenStateV1.fields), canonicalOpenStateKeys)).toEqual([]);
    expect(A.difference(canonicalOpenStateKeys, R.keys(CircuitBreakerOpenStateV1.fields))).toEqual([]);
  });

  it.effect("trips once across agent adapters, labels the retry skip, and recovers only after reset", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* makeBreakerStore();

      const failed = yield* runBreaker(store, ["run", "op", "claude-code", "--", "/bin/false"]);
      expect(failed).toEqual({ exitCode: 1, stderr: "", stdout: "" });

      const openState = yield* CircuitBreakerOpenStateV1.decodeJsonEffect(
        yield* fs.readFileString(store.openStatePath)
      );
      expect(openState.probe).toBe("op");
      expect(openState.exitCode).toBe(1);
      expect(openState.retryAfterEpochMs).toBeGreaterThan(openState.trippedEpochMs);

      const skipped = yield* runBreaker(
        store,
        ["run", "op", "codex-cli", "--", "/usr/bin/touch", store.markerPath],
        codexBreakerPath
      );
      expect(skipped).toEqual({ exitCode: 75, stderr: "", stdout: "" });
      pipe(yield* fs.exists(store.markerPath), assertFalse);

      const reset = yield* runBreaker(store, ["reset", "op", "operator"]);
      expect(reset).toEqual({ exitCode: 0, stderr: "", stdout: "" });
      pipe(yield* fs.exists(store.openStatePath), assertFalse);

      const succeeded = yield* runBreaker(store, ["run", "op", "codex-cli", "--", "/bin/true"]);
      expect(succeeded).toEqual({ exitCode: 0, stderr: "", stdout: "" });

      const events = yield* decodedEvents(store);
      expect(A.map(events, ({ outcome }) => outcome.status)).toEqual([
        "tripped",
        "retry-skipped",
        "reset",
        "probe-succeeded",
      ]);
      expect(A.map(events, ({ caller }) => caller)).toEqual(["claude-code", "codex-cli", "operator", "codex-cli"]);
      pipe(
        A.every(yield* eventRows(store), (row) => !row.includes(CANARY)),
        assertTrue
      );
    })
  );

  it.effect("refuses malformed shared state without running or guessing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* makeBreakerStore();
      yield* fs.makeDirectory(path.dirname(store.openStatePath), { recursive: true });
      yield* fs.writeFileString(
        store.openStatePath,
        yield* encodeJson({ schemaVersion: "unknown", command: CANARY, retryAfterEpochMs: 0 })
      );

      const run = yield* runBreaker(store, ["run", "op", "claude-code", "--", "/usr/bin/touch", store.markerPath]);
      expect(run).toEqual({ exitCode: 76, stderr: "", stdout: "" });
      pipe(yield* fs.exists(store.markerPath), assertFalse);

      const events = yield* decodedEvents(store);
      expect(A.map(events, ({ outcome }) => outcome.status)).toEqual(["coordination-skipped"]);
      pipe(
        A.every(yield* eventRows(store), (row) => !row.includes(CANARY)),
        assertTrue
      );
    })
  );
});
