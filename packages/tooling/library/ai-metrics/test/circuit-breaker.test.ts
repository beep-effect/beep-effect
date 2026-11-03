import * as NodeURL from "node:url";
import {
  agentEvidenceRoot,
  CircuitBreakerEventV1,
  CircuitBreakerOpenStateV1,
  circuitBreakerEventLedgerDir,
  circuitBreakerOpenStateDir,
  circuitBreakerRoot,
} from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const claudeBreakerPath = `${repoRoot}.claude/hooks/circuit-breaker.sh`;
const codexBreakerPath = `${repoRoot}.codex/hooks/circuit-breaker.sh`;
const CANARY = "CIRCUIT-BREAKER-COMMAND-CONTENT-CANARY";
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

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
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
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
      A.filter(Str.split("\n")(contents), (line) => line.length > 0)
    )
  );
  return A.flatten(rows);
});

const decodedEvents = Effect.fnUntraced(function* (store: BreakerStore) {
  const eventRows1 = yield* eventRows(store);
  return yield* Effect.forEach(eventRows1, (row) => CircuitBreakerEventV1.decodeJsonEffect(row));
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

      const readFileString2 = yield* fs.readFileString(store.openStatePath);
      const openState = yield* CircuitBreakerOpenStateV1.decodeJsonEffect(readFileString2);
      expect(openState.probe).toBe("op");
      expect(openState.exitCode).toBe(1);
      expect(openState.retryAfterEpochMs).toBeGreaterThan(openState.trippedEpochMs);

      const skipped = yield* runBreaker(
        store,
        ["run", "op", "codex-cli", "--", "/usr/bin/touch", store.markerPath],
        codexBreakerPath
      );
      expect(skipped).toEqual({ exitCode: 75, stderr: "", stdout: "" });
      const exists3 = yield* fs.exists(store.markerPath);
      pipe(exists3, assertFalse);

      const reset = yield* runBreaker(store, ["reset", "op", "operator"]);
      expect(reset).toEqual({ exitCode: 0, stderr: "", stdout: "" });
      const exists4 = yield* fs.exists(store.openStatePath);
      pipe(exists4, assertFalse);

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
      const eventRows5 = yield* eventRows(store);
      pipe(
        A.every(eventRows5, (row) => !Str.includes(CANARY)(row)),
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
      const encodedJson = yield* encodeJson({ schemaVersion: "unknown", command: CANARY, retryAfterEpochMs: 0 });
      yield* fs.writeFileString(store.openStatePath, encodedJson);

      const run = yield* runBreaker(store, ["run", "op", "claude-code", "--", "/usr/bin/touch", store.markerPath]);
      expect(run).toEqual({ exitCode: 76, stderr: "", stdout: "" });
      const exists6 = yield* fs.exists(store.markerPath);
      pipe(exists6, assertFalse);

      const events = yield* decodedEvents(store);
      expect(A.map(events, ({ outcome }) => outcome.status)).toEqual(["coordination-skipped"]);
      const eventRows7 = yield* eventRows(store);
      pipe(
        A.every(eventRows7, (row) => !Str.includes(CANARY)(row)),
        assertTrue
      );
    })
  );
});
