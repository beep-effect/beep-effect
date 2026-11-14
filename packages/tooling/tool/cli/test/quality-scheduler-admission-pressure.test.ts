import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  ADMISSION_JOURNAL_ARCHIVE_DIRECTORY_NAME,
  AdmissionJournalAdmitted,
  AdmissionJournalEvent,
  AdmissionJournalReader,
  AdmissionJournalReleasedV3,
  AdmissionPressureStamp,
  AdmissionPromotionTransition,
  AdmissionRequest,
  AdmissionWorkKind,
  admissionJournalPath,
  admissionProtocolPath,
  admissionTokenWeight,
  appendAdmissionJournalEvent,
  currentEffectiveUserIdOption,
  decodeAdmissionJournalEvent,
  MemoryStats,
  noAdmissionOriginGate,
  provideRuntimeRootForTesting,
  QualityScheduler,
  QualitySchedulerLive,
  RuntimeRootChoice,
  readAdmissionHostPressure,
  readAdmissionJournalHistory,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "@beep/repo-cli/test/RepoRun";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";

// Bytes origin/main's encoder wrote at 653c2cdef18, before the pressure stamp, for one verify
// lifecycle (lease, enqueued, admitted, released), one withdrawn ticket, the same lifecycle with
// the units gate on, and one published promotion transition, captured verbatim. @PID@ and @NONCE@
// stand for this process's pid and the run's nonce; @TICKET@ for the transition's ticket nonce.
const originMainText = {
  lease:
    '{"schemaVersion":"yeet-admission-lease/v1","attemptId":"550e8400-e29b-41d4-a716-446655440059","computeProfile":"workstation","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"command":"bun run beep yeet verify","startedAt":"1970-01-01T00:00:00.000Z","admittedAtMillis":0,"heartbeatAtMillis":0,"enqueuedAtMillis":0,"nonce":"@NONCE@","hotPaths":[],"runScope":{"unitName":"agent-run-@NONCE@.scope","support":"disabled","attachedPid":@PID@,"attachedAt":"1970-01-01T00:00:00.000Z"}}',
  enqueued:
    '{"attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","kind":"full-proof","priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","enqueuedAtMillis":0,"nonce":"@NONCE@","schemaVersion":"yeet-admission-journal/v3","_tag":"admission-enqueued","weightTokens":3}',
  admitted:
    '{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"@NONCE@","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","enqueuedAtMillis":0,"admittedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059"}',
  released:
    '{"checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"@NONCE@","pid":@PID@,"releasedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059"}',
  ticket:
    '{"schemaVersion":"yeet-admission-ticket/v1","attemptId":"550e8400-e29b-41d4-a716-446655440059","computeProfile":"workstation","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"enqueuedAtMillis":0,"heartbeatAtMillis":0,"blockedOnOriginAtMillis":0,"nonce":"@NONCE@"}',
  withdrawn:
    '{"attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","kind":"full-proof","priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","enqueuedAtMillis":0,"nonce":"@NONCE@","schemaVersion":"yeet-admission-journal/v3","_tag":"admission-withdrawn","withdrawnAtMillis":0}',
  unitsLease:
    '{"schemaVersion":"yeet-admission-lease/v1","attemptId":"550e8400-e29b-41d4-a716-446655440059","computeProfile":"workstation","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"command":"bun run beep yeet verify","startedAt":"1970-01-01T00:00:00.000Z","admittedAtMillis":0,"heartbeatAtMillis":0,"enqueuedAtMillis":0,"nonce":"@NONCE@","hotPaths":[],"runScope":{"unitName":"agent-run-@NONCE@.scope","support":"disabled","attachedPid":@PID@,"attachedAt":"1970-01-01T00:00:00.000Z"},"unit":{"_tag":"tier"},"weightSource":{"_tag":"static-seed"},"owner":{"proofNonce":"@NONCE@","attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","command":"bun run beep yeet verify"}}',
  unitsEnqueued:
    '{"attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","kind":"full-proof","priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","enqueuedAtMillis":0,"nonce":"@NONCE@","unit":{"_tag":"tier"},"weightSource":{"_tag":"static-seed"},"owner":{"proofNonce":"@NONCE@","attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","command":"bun run beep yeet verify"},"schemaVersion":"yeet-admission-journal/v3","_tag":"admission-enqueued","weightTokens":3}',
  unitsAdmitted:
    '{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"@NONCE@","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","enqueuedAtMillis":0,"admittedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059","unit":{"_tag":"tier"},"weightSource":{"_tag":"static-seed"},"owner":{"proofNonce":"@NONCE@","attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","command":"bun run beep yeet verify"}}',
  unitsReleased:
    '{"checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"@NONCE@","pid":@PID@,"releasedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059","unit":{"_tag":"tier"},"weightSource":{"_tag":"static-seed"},"owner":{"proofNonce":"@NONCE@","attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":@PID@,"procStart":"424242","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","command":"bun run beep yeet verify"}}',
  transition:
    '{"schemaVersion":"yeet-admission-promotion/v1","nonce":"@NONCE@","ticketPath":"/q/t.ticket.json","leasePath":"/l/l.lease.json","ticket":{"schemaVersion":"yeet-admission-ticket/v1","attemptId":"550e8400-e29b-41d4-a716-446655440059","computeProfile":"workstation","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"enqueuedAtMillis":0,"heartbeatAtMillis":0,"blockedOnOriginAtMillis":0,"nonce":"@TICKET@"},"lease":{"schemaVersion":"yeet-admission-lease/v1","attemptId":"550e8400-e29b-41d4-a716-446655440059","computeProfile":"workstation","pid":@PID@,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0sche09","checkoutRoot":"/repo/sche-09","branch":"feat/sche-09","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"command":"bun run beep yeet verify","startedAt":"1970-01-01T00:00:00.000Z","admittedAtMillis":0,"heartbeatAtMillis":0,"enqueuedAtMillis":0,"nonce":"@NONCE@","hotPaths":[],"runScope":{"unitName":"agent-run-@NONCE@.scope","support":"disabled","attachedPid":@PID@,"attachedAt":"1970-01-01T00:00:00.000Z"}},"phase":"lease-published","createdAtMillis":0}',
};

const fillIdentity = (runNonce: string) =>
  flow(Str.replaceAll("@NONCE@", runNonce), Str.replaceAll("@PID@", `${process.pid}`));

const pressureKeys = ["pressure"] as const;
const unitKeys = ["unit", "weightSource", "owner"] as const;

// The readers older revisions run, built as #3308 built its pre-unit reader: the current row
// schemas without the keys those revisions did not know. origin/main (653c2cdef18, after #3317)
// knows the unit keys and the cache kind; slice 3 (#3308) knew the unit keys but read any
// non-empty kind outside the four it named; a reader before SCHE-08 knew neither.
const PreCacheWorkKind = AdmissionWorkKind.pick(["full-proof", "merged-preview", "review-fix", "publish"]);
const originMainRowReader = S.Union([
  S.Struct(Struct.omit(AdmissionJournalAdmitted.fields, pressureKeys)),
  S.Struct(Struct.omit(AdmissionJournalReleasedV3.fields, pressureKeys)),
]);
const slice3RowReader = S.Union([
  S.Struct({
    ...Struct.omit(AdmissionJournalAdmitted.fields, pressureKeys),
    kind: S.Union([PreCacheWorkKind, S.NonEmptyString]),
  }),
  S.Struct(Struct.omit(AdmissionJournalReleasedV3.fields, pressureKeys)),
]);
const preUnitRowReader = S.Union([
  S.Struct({ ...Struct.omit(AdmissionJournalAdmitted.fields, [...unitKeys, ...pressureKeys]), kind: PreCacheWorkKind }),
  S.Struct(Struct.omit(AdmissionJournalReleasedV3.fields, [...unitKeys, ...pressureKeys])),
]);
const olderReaders: ReadonlyArray<{
  readonly revision: string;
  readonly decode: (line: string) => Effect.Effect<unknown, S.SchemaError>;
}> = [
  { revision: "origin/main", decode: S.decodeUnknownEffect(S.fromJsonString(originMainRowReader)) },
  { revision: "slice 3", decode: S.decodeUnknownEffect(S.fromJsonString(slice3RowReader)) },
  { revision: "pre-SCHE-08", decode: S.decodeUnknownEffect(S.fromJsonString(preUnitRowReader)) },
];

const eventCodec = S.fromJsonString(AdmissionJournalEvent);
const encodeEvent = S.encodeEffect(eventCodec);
const leaseCodec = S.fromJsonString(YeetAdmissionLease);
const ticketCodec = S.fromJsonString(YeetAdmissionTicket);
const transitionCodec = S.fromJsonString(AdmissionPromotionTransition);
const decodeTransition = S.decodeEffect(transitionCodec);
const decodeLease = S.decodeEffect(leaseCodec);
const decodeTicket = S.decodeEffect(ticketCodec);
const decodeAdmitted = S.decodeEffect(S.fromJsonString(AdmissionJournalAdmitted));
const encodeTransition = S.encodeEffect(transitionCodec);

const attemptId = UUID.make("550e8400-e29b-41d4-a716-446655440059");
const fixtureProcStart = "424242";
const GIB = 1024 ** 3;

// Fixed procfs entry for this process, so its start identity never reads the host.
const procStatFixture = `${process.pid} (beep) S ${A.join(A.replicate("0", 18), " ")} ${fixtureProcStart} 0 0\n`;

// Fixed pressure stall files: the stamp reads `some avg10` of each.
const pressureFixture = {
  cpu: "some avg10=2.13 avg60=1.05 avg300=0.48 total=987654321\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n",
  memory: "some avg10=0.50 avg60=0.20 avg300=0.10 total=4200\nfull avg10=0.25 avg60=0.10 avg300=0.00 total=2100\n",
  io: "some avg10=0.31 avg60=0.12 avg300=0.05 total=77\nfull avg10=0.10 avg60=0.02 avg300=0.00 total=12\n",
};

const stampJson =
  '"pressure":{"capacityTokens":8,"activeTokens":3,"queuedTokens":0,"queuedTickets":0,"memAvailableGib":50,"psiCpuSome10":2.13,"psiMemorySome10":0.5,"psiIoSome10":0.31}';
const withStamp = (json: string) => (line: string) => Str.replace(/\}$/u, `,${json}}`)(line);

const spawner = ScriptedSpawner.make(() => ({}));

const SchedulerTestLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  BunCrypto.layer,
  spawner.layer,
  Layer.succeed(
    MemoryStats,
    MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128), ceilingGib: Effect.succeed(128) })
  ),
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" })),
  QualitySchedulerLive
);

// A private 0700 admission root owned by this uid, inside the in-memory volume.
const prepareRoot = Effect.fn("AdmissionPressureTest.prepareRoot")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtimeRoot = path.join("/run/sche-09", name);
  const root = path.join(runtimeRoot, "beep", "admit");
  yield* fs.makeDirectory(root, { recursive: true, mode: 0o700 });
  const uid = O.getOrElse(currentEffectiveUserIdOption(), () => 0);
  yield* fs.chown(root, uid, uid);
  yield* fs.makeDirectory(`/proc/${process.pid}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${process.pid}/stat`, procStatFixture);
  return { root, choice: RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot }) };
});

const writePressureFixture = Effect.fn("AdmissionPressureTest.writePressureFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("/proc/pressure", { recursive: true });
  yield* fs.writeFileString("/proc/pressure/cpu", pressureFixture.cpu);
  yield* fs.writeFileString("/proc/pressure/memory", pressureFixture.memory);
  yield* fs.writeFileString("/proc/pressure/io", pressureFixture.io);
});

const readLines = Effect.fn("AdmissionPressureTest.readLines")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file);
  return A.filter(Str.split("\n")(text), Str.isNonEmpty);
});

const verifyRequest = AdmissionRequest.make({
  kind: "full-proof",
  weightTokens: admissionTokenWeight("full-proof"),
  priority: "verify",
  originKey: "origin0sche09",
  checkoutRoot: "/repo/sche-09",
  branch: "feat/sche-09",
  command: "bun run beep yeet verify",
  attemptId: O.some(attemptId),
});

// Admit the verify request through the QualityScheduler service; read the lease it held and the journal.
const admitOnce = Effect.fn("AdmissionPressureTest.admitOnce")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scheduler = yield* QualityScheduler;
  const leases = path.join(root, "leases");
  const leaseText = yield* scheduler.admit(
    verifyRequest,
    noAdmissionOriginGate,
    fs
      .readDirectory(leases)
      .pipe(Effect.flatMap((names) => fs.readFileString(path.join(leases, A.join(A.take(names, 1), "")))))
  );
  const journalPath = yield* admissionJournalPath(root);
  const journal = yield* readLines(journalPath);
  return { leaseText: Str.trim(leaseText), journal };
});

// Queue the verify request behind a busy origin gate, read its ticket, then interrupt it so it withdraws.
const queueAndWithdraw = Effect.fn("AdmissionPressureTest.queueAndWithdraw")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scheduler = yield* QualityScheduler;
  const reached = yield* Deferred.make<void>();
  const busyGate = {
    tryAcquire: Deferred.succeed(reached, undefined).pipe(Effect.as(O.none<string>())),
    tryAcquireFallback: Effect.succeedNone,
    release: () => Effect.void,
  };
  const fiber = yield* scheduler.admit(verifyRequest, busyGate, Effect.void).pipe(Effect.forkChild);
  yield* Deferred.await(reached);
  const queue = path.join(root, "queue");
  const names = yield* fs.readDirectory(queue);
  const ticketText = yield* fs.readFileString(path.join(queue, A.join(A.take(names, 1), "")));
  yield* Fiber.interrupt(fiber);
  const journalPath = yield* admissionJournalPath(root);
  const journal = yield* readLines(journalPath);
  return { ticketText: Str.trim(ticketText), journal };
});

const decodeRows = (journal: ReadonlyArray<string>) =>
  Effect.forEach(journal, (line) => decodeAdmissionJournalEvent(line));

const stampOf = (fields: Partial<Parameters<typeof AdmissionPressureStamp.make>[0]> = {}) =>
  AdmissionPressureStamp.make({
    capacityTokens: 8,
    activeTokens: 3,
    queuedTokens: 0,
    queuedTickets: 0,
    memAvailableGib: 50,
    psiCpuSome10: O.some(2.13),
    psiMemorySome10: O.some(0.5),
    psiIoSome10: O.some(0.31),
    ...fields,
  });

const pressureOf = (row: AdmissionJournalEvent): O.Option<AdmissionPressureStamp> =>
  "pressure" in row ? row.pressure : O.none();

describe("admission pressure stamp schema (SCHE-09 slice 2)", () => {
  const nonce = "0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11";
  const fill = fillIdentity(nonce);
  const plainRows = A.map([originMainText.admitted, originMainText.released], fill);
  const stampedRows = A.map(plainRows, withStamp(stampJson));

  it.effect("decodes origin/main rows without a stamp and re-encodes them byte for byte", () =>
    Effect.gen(function* () {
      const rows = yield* decodeRows(plainRows);
      deepStrictEqual(A.map(rows, pressureOf), [O.none(), O.none()]);
      const reencoded = yield* Effect.forEach(rows, (row) => encodeEvent(row));
      deepStrictEqual(reencoded, plainRows);
      const transitionText = Str.replaceAll(
        "@TICKET@",
        "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
      )(fill(originMainText.transition));
      const transition = yield* decodeTransition(transitionText);
      assertNone(transition.pressure);
      const transitionReencoded = yield* encodeTransition(transition);
      strictEqual(transitionReencoded, transitionText);
    })
  );

  it.effect("reads a stamp and writes it back as the same bytes", () =>
    Effect.gen(function* () {
      const rows = yield* decodeRows(stampedRows);
      deepStrictEqual(A.map(rows, pressureOf), [O.some(stampOf()), O.some(stampOf())]);
      const reencoded = yield* Effect.forEach(rows, (row) => encodeEvent(row));
      deepStrictEqual(reencoded, stampedRows);
    })
  );

  it.effect("every older reader decodes a stamped row exactly as it decodes the unstamped row", () =>
    Effect.forEach(
      olderReaders,
      Effect.fnUntraced(function* ({ decode, revision }) {
        const stamped = yield* Effect.forEach(stampedRows, (line) => decode(line));
        const plain = yield* Effect.forEach(plainRows, (line) => decode(line));
        expect(stamped, revision).toStrictEqual(plain);
      }),
      { discard: true }
    )
  );

  it.effect("reads a stamp shape this revision cannot decode as no stamp, keeping the row", () =>
    Effect.gen(function* () {
      const newer = withStamp('"pressure":{"capacityTokens":"eight","gpuSome10":4}')(A.getUnsafe(plainRows, 0));
      const row = yield* decodeAdmissionJournalEvent(newer);
      strictEqual(row._tag, "admission-admitted");
      assertNone(pressureOf(row));
    })
  );

  it.effect.prop(
    "property: any stamp round-trips and stays invisible to every older reader",
    [Arbitrary.schema(AdmissionPressureStamp)],
    Effect.fnUntraced(function* ([stamp]) {
      const plain = yield* decodeAdmitted(A.getUnsafe(plainRows, 0));
      const text = yield* encodeEvent(AdmissionJournalAdmitted.make({ ...plain, pressure: O.some(stamp) }));
      // JSON drops the sign of -0, so the codec law is encode-stability rather than value identity.
      const decoded = yield* decodeAdmissionJournalEvent(text);
      const reencoded = yield* encodeEvent(decoded);
      strictEqual(reencoded, text);
      for (const { decode, revision } of olderReaders) {
        const seen = yield* decode(text);
        const unstamped = yield* decode(A.getUnsafe(plainRows, 0));
        expect(seen, revision).toStrictEqual(unstamped);
      }
    }),
    { arbitrary: fcRuns(32) }
  );
});

it.layer(SchedulerTestLayer, { concurrent: false, timeout: "20 seconds" })("pressure gate (SCHE-09 slice 2)", (it) => {
  it.effect("keeps the pressure gate independent of the eviction and unit gates", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const scheduler = yield* QualityScheduler;
      const { root, choice } = yield* prepareRoot("protocol");
      yield* Effect.gen(function* () {
        const steps = [
          yield* scheduler.protocol,
          yield* scheduler.setPressureProtocol("on"),
          yield* scheduler.setUnitProtocol("on"),
          yield* scheduler.setEvictionProtocol("on"),
          yield* scheduler.setPressureProtocol("off"),
        ];
        deepStrictEqual(
          A.map(steps, (protocol) => [protocol.eviction, protocol.units, protocol.pressure]),
          [
            ["off", "off", "off"],
            ["off", "off", "on"],
            ["off", "on", "on"],
            ["on", "on", "on"],
            ["on", "on", "off"],
          ]
        );
        const protocolPath = yield* admissionProtocolPath(root);
        yield* scheduler.setPressureProtocol("on");
        const marker = yield* fs.readFileString(protocolPath);
        expect(marker).toContain('"pressure":"on"');
        // A marker an older checkout writes has no pressure key, which turns the stamps off again.
        yield* fs.writeFileString(
          protocolPath,
          '{"schemaVersion":"yeet-admission-protocol/v2","eviction":"on","units":"on"}\n'
        );
        const older = yield* scheduler.protocol;
        deepStrictEqual([older.eviction, older.units, older.pressure], ["on", "on", "off"]);
      }).pipe(provideRuntimeRootForTesting(choice));
    })
  );

  it.effect("writes origin/main's bytes with every gate off, and with only the units gate on", () =>
    Effect.gen(function* () {
      const scheduler = yield* QualityScheduler;
      yield* writePressureFixture();
      const off = yield* prepareRoot("gates-off");
      const admitted = yield* admitOnce(off.root).pipe(provideRuntimeRootForTesting(off.choice));
      const lease = yield* decodeLease(admitted.leaseText);
      deepStrictEqual(
        [admitted.leaseText, ...admitted.journal],
        A.map(
          [originMainText.lease, originMainText.enqueued, originMainText.admitted, originMainText.released],
          fillIdentity(lease.nonce)
        )
      );
      const offQueued = yield* prepareRoot("gates-off-queued");
      const queued = yield* queueAndWithdraw(offQueued.root).pipe(provideRuntimeRootForTesting(offQueued.choice));
      const ticket = yield* decodeTicket(queued.ticketText);
      deepStrictEqual(
        [queued.ticketText, ...queued.journal],
        A.map([originMainText.ticket, originMainText.enqueued, originMainText.withdrawn], fillIdentity(ticket.nonce))
      );
      const units = yield* prepareRoot("units-on");
      const unitsAdmitted = yield* scheduler
        .setUnitProtocol("on")
        .pipe(Effect.andThen(admitOnce(units.root)), provideRuntimeRootForTesting(units.choice));
      const unitsLease = yield* decodeLease(unitsAdmitted.leaseText);
      deepStrictEqual(
        [unitsAdmitted.leaseText, ...unitsAdmitted.journal],
        A.map(
          [
            originMainText.unitsLease,
            originMainText.unitsEnqueued,
            originMainText.unitsAdmitted,
            originMainText.unitsReleased,
          ],
          fillIdentity(unitsLease.nonce)
        )
      );
      strictEqual(A.length(spawner.spawns), 0);
    })
  );

  it.effect("stamps the admitted and released rows, and nothing else, while the pressure gate is on", () =>
    Effect.gen(function* () {
      const scheduler = yield* QualityScheduler;
      yield* writePressureFixture();
      const { root, choice } = yield* prepareRoot("pressure-on");
      const { journal, leaseText } = yield* scheduler
        .setPressureProtocol("on")
        .pipe(Effect.andThen(admitOnce(root)), provideRuntimeRootForTesting(choice));
      const lease = yield* decodeLease(leaseText);
      const fill = fillIdentity(lease.nonce);
      // The lease and the enqueued row keep origin/main's bytes; the two rows gain one trailing key.
      deepStrictEqual(
        [leaseText, ...journal],
        [
          fill(originMainText.lease),
          fill(originMainText.enqueued),
          withStamp(stampJson)(fill(originMainText.admitted)),
          withStamp(stampJson)(fill(originMainText.released)),
        ]
      );
      const rows = yield* decodeRows(journal);
      deepStrictEqual(A.map(rows, pressureOf), [O.none(), O.some(stampOf()), O.some(stampOf())]);
      // Every older reader still reads the stamped lifecycle as the plain one.
      for (const { decode, revision } of olderReaders) {
        const stamped = yield* Effect.forEach(A.drop(journal, 1), (line) => decode(line));
        const plain = yield* Effect.forEach([originMainText.admitted, originMainText.released], (line) =>
          decode(fill(line))
        );
        expect(stamped, revision).toStrictEqual(plain);
      }
    })
  );

  it.effect("counts the other live leases as active and the other live tickets as queued", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const scheduler = yield* QualityScheduler;
      yield* writePressureFixture();
      const { root, choice } = yield* prepareRoot("pressure-contended");
      const holder = YeetAdmissionLease.make({
        schemaVersion: "yeet-admission-lease/v1",
        pid: process.pid,
        procStart: fixtureProcStart,
        kind: "review-fix",
        weightTokens: 1,
        priority: "verify",
        originKey: "origin0holder",
        checkoutRoot: "/repo/holder",
        branch: "feat/holder",
        command: "bun run beep yeet verify --tier review-fix",
        startedAt: "1970-01-01T00:00:00.000Z",
        admittedAtMillis: 0,
        heartbeatAtMillis: 0,
        enqueuedAtMillis: 0,
        nonce: "5d0c2e61-7c3a-4f0e-9a11-3b1f3c0a0001",
      });
      // Enqueued after this admission, so it waits behind it.
      const waiter = YeetAdmissionTicket.make({
        schemaVersion: "yeet-admission-ticket/v1",
        pid: process.pid,
        procStart: fixtureProcStart,
        kind: "review-fix",
        weightTokens: 2,
        priority: "verify",
        originKey: "origin0waiter",
        checkoutRoot: "/repo/waiter",
        branch: "feat/waiter",
        enqueuedAtMillis: 1,
        heartbeatAtMillis: 1,
        nonce: "5d0c2e61-7c3a-4f0e-9a11-3b1f3c0a0002",
      });
      yield* fs.makeDirectory(path.join(root, "leases"), { recursive: true, mode: 0o700 });
      yield* fs.makeDirectory(path.join(root, "queue"), { recursive: true, mode: 0o700 });
      const holderText = yield* S.encodeEffect(leaseCodec)(holder);
      const waiterText = yield* S.encodeEffect(ticketCodec)(waiter);
      yield* fs.writeFileString(
        path.join(root, "leases", `${holder.nonce}-${process.pid}.lease.json`),
        `${holderText}\n`
      );
      yield* fs.writeFileString(
        path.join(root, "queue", `${waiter.nonce}-${process.pid}.ticket.json`),
        `${waiterText}\n`
      );
      const { journal } = yield* scheduler
        .setPressureProtocol("on")
        .pipe(Effect.andThen(admitOnce(root)), provideRuntimeRootForTesting(choice));
      const rows = yield* decodeRows(journal);
      const contended = stampOf({ activeTokens: 4, queuedTokens: 2, queuedTickets: 1 });
      deepStrictEqual(A.map(rows, pressureOf), [O.none(), O.some(contended), O.some(contended)]);
    })
  );

  it.effect("journals a recovered promotion's stamp, and none for a promotion recovered before its stamp", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, choice } = yield* prepareRoot("recovered");
      const owner = {
        pid: process.pid,
        procStart: fixtureProcStart,
        kind: "review-fix",
        weightTokens: 1,
        priority: "verify",
        originKey: "origin0recovered",
        checkoutRoot: "/repo/recovered",
        branch: "feat/recovered",
        enqueuedAtMillis: 0,
        heartbeatAtMillis: 0,
      } as const;
      const transitionFor = (
        nonce: string,
        phase: "prepared" | "lease-published",
        pressure: O.Option<AdmissionPressureStamp>
      ) =>
        AdmissionPromotionTransition.make({
          schemaVersion: "yeet-admission-promotion/v1",
          nonce,
          ticketPath: path.join(root, "queue", `${nonce}-${process.pid}.ticket.json`),
          leasePath: path.join(root, "leases", `${nonce}-${process.pid}.lease.json`),
          ticket: YeetAdmissionTicket.make({ ...owner, schemaVersion: "yeet-admission-ticket/v1", nonce }),
          lease: YeetAdmissionLease.make({
            ...owner,
            schemaVersion: "yeet-admission-lease/v1",
            command: "bun run beep yeet verify --tier review-fix",
            startedAt: "1970-01-01T00:00:00.000Z",
            admittedAtMillis: 0,
            nonce,
          }),
          phase,
          createdAtMillis: 0,
          pressure,
        });
      const stamped = stampOf({ activeTokens: 1, psiIoSome10: O.none(), unadmittedSliceGib: O.some(1.5) });
      const transitions = [
        transitionFor("7e1f0a52-1c3d-4b6e-8f90-0a1b2c3d0001", "lease-published", O.some(stamped)),
        transitionFor("7e1f0a52-1c3d-4b6e-8f90-0a1b2c3d0002", "prepared", O.none()),
      ];
      for (const directory of ["leases", "promotions"]) {
        yield* fs.makeDirectory(path.join(root, directory), { recursive: true, mode: 0o700 });
      }
      for (const transition of transitions) {
        const leaseText = yield* S.encodeEffect(leaseCodec)(transition.lease);
        yield* fs.writeFileString(transition.leasePath, `${leaseText}\n`);
        const transitionText = yield* encodeTransition(transition);
        yield* fs.writeFileString(
          path.join(root, "promotions", `${transition.nonce}.promotion.json`),
          `${transitionText}\n`
        );
      }
      // This admission's repair scan recovers both promotions before it promotes itself (gates off).
      const { journal } = yield* admitOnce(root).pipe(provideRuntimeRootForTesting(choice));
      const rows = yield* decodeRows(journal);
      const admitted = A.filter(rows, S.is(AdmissionJournalAdmitted));
      const stampFor = (nonce: string) =>
        O.flatMap(
          A.findFirst(admitted, (row) => row.nonce === nonce),
          (row) => row.pressure
        );
      deepStrictEqual(stampFor("7e1f0a52-1c3d-4b6e-8f90-0a1b2c3d0001"), O.some(stamped));
      assertNone(stampFor("7e1f0a52-1c3d-4b6e-8f90-0a1b2c3d0002"));
      strictEqual(A.length(A.filter(admitted, (row) => O.isSome(row.pressure))), 1);
      strictEqual(A.length(admitted), 3);
    })
  );

  it.effect("an older reader's locked rewrite keeps stamped rows byte for byte in the journal and the archive", () =>
    Effect.forEach(
      olderReaders,
      Effect.fnUntraced(function* ({ decode, revision }) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root } = yield* prepareRoot(`older-rewrite-${Str.replaceAll(" ", "-")(revision)}`);
        const stampedAdmitted = (index: number) =>
          withStamp(stampJson)(
            fillIdentity(`7e1f0a52-1c3d-4b6e-8f90-${Str.padStart(12, "0")(index.toString(16))}`)(
              originMainText.admitted
            )
          );
        // 201 admissions: one past the 200-admission ring, so the rewrite trims the oldest rows.
        const prefill = A.makeBy(201, stampedAdmitted);
        const journalPath = yield* admissionJournalPath(root);
        yield* fs.writeFileString(journalPath, `${A.join(prefill, "\n")}\n`);
        // The older revision classifies each row by its own schema and keeps every row's raw line.
        const reader = AdmissionJournalReader.of({
          decode: Effect.fn("OlderAdmissionJournalReader.decode")((line) =>
            decode(line).pipe(Effect.andThen(decodeAdmissionJournalEvent(line)))
          ),
        });
        const appended = yield* decodeAdmitted(stampedAdmitted(201));
        yield* appendAdmissionJournalEvent(root, appended).pipe(Effect.provideService(AdmissionJournalReader, reader));
        const kept = yield* readLines(journalPath);
        const archived = yield* readLines(
          path.join(root, ADMISSION_JOURNAL_ARCHIVE_DIRECTORY_NAME, "1970-01-01.ndjson")
        );
        expect(archived, revision).toStrictEqual(A.take(prefill, 2));
        expect(kept, revision).toStrictEqual([...A.drop(prefill, 2), stampedAdmitted(201)]);
        // The current fold reads every stamp back from both.
        const history = yield* readAdmissionJournalHistory(root);
        assertTrue(A.every(history.events, (row) => O.isSome(pressureOf(row))));
        strictEqual(A.length(history.events), 202);
      }),
      { discard: true }
    )
  );
});

// A cgroup v2 mount at /sys/fs/cgroup, as the workstation's mountinfo lists it.
const mountinfoFixture = "30 23 0:26 / /sys/fs/cgroup rw,nosuid,nodev,noexec,relatime shared:4 - cgroup2 cgroup2 rw\n";
const sliceCgroup = "/user.slice/user-1000.slice/user@1000.service/agent-runs.slice";
const ownScope = `${sliceCgroup}/agent-run-own.scope`;
const OUTSIDE_PID = 2_147_483_000;

const leaseFor = (pid: number, nonce: string) =>
  YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid,
    procStart: fixtureProcStart,
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "origin0slice",
    checkoutRoot: "/repo/slice",
    branch: "feat/slice",
    command: "bun run beep yeet verify",
    startedAt: "1970-01-01T00:00:00.000Z",
    admittedAtMillis: 0,
    heartbeatAtMillis: 0,
    enqueuedAtMillis: 0,
    nonce,
  });

const writeCgroupFixture = Effect.fn("AdmissionPressureTest.writeCgroupFixture")(function* (ownCgroup: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`/proc/${process.pid}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${process.pid}/cgroup`, `0::${ownCgroup}\n`);
  yield* fs.makeDirectory(`/proc/${OUTSIDE_PID}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${OUTSIDE_PID}/cgroup`, "0::/user.slice/user-1000.slice/session-2.scope\n");
  yield* fs.makeDirectory("/proc/self", { recursive: true });
  yield* fs.writeFileString("/proc/self/mountinfo", mountinfoFixture);
  yield* fs.makeDirectory(`/sys/fs/cgroup${ownScope}`, { recursive: true });
  yield* fs.writeFileString(`/sys/fs/cgroup${sliceCgroup}/memory.current`, `${6 * GIB}\n`);
  yield* fs.writeFileString(`/sys/fs/cgroup${ownScope}/memory.current`, `${2 * GIB}\n`);
});

it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), { concurrent: false, timeout: "20 seconds" })(
  "host pressure reading (SCHE-09 slice 2)",
  (it) => {
    it.effect("reads nothing on a host without pressure files or a run scope", () =>
      Effect.gen(function* () {
        const reading = yield* readAdmissionHostPressure([]);
        deepStrictEqual(reading, {
          psiCpuSome10: O.none(),
          psiMemorySome10: O.none(),
          psiIoSome10: O.none(),
          unadmittedSliceGib: O.none(),
        });
      })
    );

    it.effect("subtracts every live lease cgroup inside the slice once, and none outside it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* writePressureFixture();
        yield* fs.writeFileString("/proc/pressure/memory", "not a pressure line\n");
        yield* fs.remove("/proc/pressure/io");
        yield* writeCgroupFixture(ownScope);
        // Two leases of this process share its scope; the third lease's owner runs outside the slice.
        const leases = [
          leaseFor(process.pid, "9a0b1c2d-0000-4000-8000-000000000001"),
          leaseFor(process.pid, "9a0b1c2d-0000-4000-8000-000000000002"),
          leaseFor(OUTSIDE_PID, "9a0b1c2d-0000-4000-8000-000000000003"),
        ];
        const reading = yield* readAdmissionHostPressure(leases);
        deepStrictEqual(reading, {
          psiCpuSome10: O.some(2.13),
          psiMemorySome10: O.none(),
          psiIoSome10: O.none(),
          unadmittedSliceGib: O.some(4),
        });
      })
    );

    it.effect("reads no slice memory when the writer runs outside the slice or a cgroup file is missing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* writeCgroupFixture("/user.slice/user-1000.slice/session-2.scope");
        const outside = yield* readAdmissionHostPressure([
          leaseFor(process.pid, "9a0b1c2d-0000-4000-8000-000000000004"),
        ]);
        assertNone(outside.unadmittedSliceGib);
        yield* writeCgroupFixture(ownScope);
        yield* fs.remove(`/sys/fs/cgroup${ownScope}/memory.current`);
        const unreadable = yield* readAdmissionHostPressure([
          leaseFor(process.pid, "9a0b1c2d-0000-4000-8000-000000000005"),
        ]);
        assertNone(unreadable.unadmittedSliceGib);
        yield* fs.writeFileString(
          "/proc/self/mountinfo",
          "25 1 259:2 / / rw,relatime shared:1 - btrfs /dev/nvme0n1p2 rw\n"
        );
        const unmounted = yield* readAdmissionHostPressure([]);
        assertNone(unmounted.unadmittedSliceGib);
      })
    );
  }
);
