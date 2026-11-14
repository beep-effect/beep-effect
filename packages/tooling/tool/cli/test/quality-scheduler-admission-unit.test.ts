import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { ScopedPackageName } from "@beep/package-json/PackageName";
import {
  AdmissionJournalAdmitted,
  AdmissionJournalEnqueued,
  AdmissionJournalEvent,
  AdmissionJournalReleasedV3,
  AdmissionJournalWithdrawn,
  AdmissionOwner,
  AdmissionRequest,
  AdmissionUnit,
  AdmissionWeightSource,
  AdmissionWorkKind,
  admissionJournalPath,
  admissionProtocolPath,
  admissionProtocolStatus,
  admissionStatus,
  admissionTokenWeight,
  currentEffectiveUserIdOption,
  decodeAdmissionJournalEvent,
  MemoryStats,
  noAdmissionOriginGate,
  provideRuntimeRootForTesting,
  RecordedAdmissionWorkKind,
  RuntimeRootChoice,
  setAdmissionEvictionProtocol,
  setAdmissionUnitProtocol,
  UnrecognizedAdmissionWorkKind,
  withQualityAdmission,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "@beep/repo-cli/test/RepoRun";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";

// Bytes the origin/main encoder (before SCHE-08) wrote for one lifecycle, captured from it verbatim.
const preUnitText = {
  ticket:
    '{"schemaVersion":"yeet-admission-ticket/v1","attemptId":"550e8400-e29b-41d4-a716-446655440031","pid":4242,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"publish","originKey":"origin0sche08","checkoutRoot":"/repo/sche-08","branch":"feat/sche-08","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"enqueuedAtMillis":1000,"heartbeatAtMillis":1000,"blockedOnOriginAtMillis":0,"nonce":"0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11"}',
  lease:
    '{"schemaVersion":"yeet-admission-lease/v1","attemptId":"550e8400-e29b-41d4-a716-446655440031","pid":4242,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"publish","originKey":"origin0sche08","checkoutRoot":"/repo/sche-08","branch":"feat/sche-08","coordinationProtocol":"scheduler-origin-concurrency/v1","forceLocal":false,"command":"bun run beep yeet publish","startedAt":"2026-11-13T12:00:00.000Z","admittedAtMillis":2000,"heartbeatAtMillis":2000,"enqueuedAtMillis":1000,"nonce":"0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11","hotPaths":[]}',
  enqueued:
    '{"attemptId":"550e8400-e29b-41d4-a716-446655440031","pid":4242,"procStart":"424242","kind":"full-proof","priority":"publish","originKey":"origin0sche08","checkoutRoot":"/repo/sche-08","branch":"feat/sche-08","enqueuedAtMillis":1000,"nonce":"0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11","schemaVersion":"yeet-admission-journal/v3","_tag":"admission-enqueued","weightTokens":3}',
  admitted:
    '{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11","pid":4242,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"publish","originKey":"origin0sche08","enqueuedAtMillis":1000,"admittedAtMillis":2000,"attemptId":"550e8400-e29b-41d4-a716-446655440031"}',
  released:
    '{"checkoutRoot":"/repo/sche-08","branch":"feat/sche-08","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11","pid":4242,"releasedAtMillis":3000,"memoryPeakBytes":1073741824,"attemptId":"550e8400-e29b-41d4-a716-446655440031"}',
  withdrawn:
    '{"attemptId":"550e8400-e29b-41d4-a716-446655440031","pid":4242,"procStart":"424242","kind":"full-proof","priority":"publish","originKey":"origin0sche08","checkoutRoot":"/repo/sche-08","branch":"feat/sche-08","enqueuedAtMillis":1000,"nonce":"0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11","schemaVersion":"yeet-admission-journal/v3","_tag":"admission-withdrawn","withdrawnAtMillis":1500}',
};

const unitKeys = ["unit", "weightSource", "owner"] as const;

// The readers a pre-SCHE-08 checkout runs: the same records without the unit keys and with the closed kind.
const preUnitLeaseReader = S.Struct({ ...Struct.omit(YeetAdmissionLease.fields, unitKeys), kind: AdmissionWorkKind });
const preUnitTicketReader = S.Struct({ ...Struct.omit(YeetAdmissionTicket.fields, unitKeys), kind: AdmissionWorkKind });
const preUnitRowReader = S.Union([
  S.Struct({ ...Struct.omit(AdmissionJournalEnqueued.fields, unitKeys), kind: AdmissionWorkKind }),
  S.Struct({ ...Struct.omit(AdmissionJournalAdmitted.fields, unitKeys), kind: AdmissionWorkKind }),
  S.Struct(Struct.omit(AdmissionJournalReleasedV3.fields, unitKeys)),
  S.Struct({ ...Struct.omit(AdmissionJournalWithdrawn.fields, unitKeys), kind: AdmissionWorkKind }),
]);

const leaseCodec = S.fromJsonString(YeetAdmissionLease);
const ticketCodec = S.fromJsonString(YeetAdmissionTicket);
const eventCodec = S.fromJsonString(AdmissionJournalEvent);
const decodeLease = S.decodeUnknownEffect(leaseCodec);
const encodeLease = S.encodeEffect(leaseCodec);
const decodeTicket = S.decodeUnknownEffect(ticketCodec);
const encodeTicket = S.encodeEffect(ticketCodec);
const encodeEvent = S.encodeEffect(eventCodec);
const decodePreUnitLease = S.decodeUnknownEffect(S.fromJsonString(preUnitLeaseReader));
const decodePreUnitTicket = S.decodeUnknownEffect(S.fromJsonString(preUnitTicketReader));
const decodePreUnitRow = S.decodeUnknownEffect(S.fromJsonString(preUnitRowReader));
const decodeJsonObject = S.decodeUnknownEffect(S.fromJsonString(S.JsonObject));

const attemptId = UUID.make("550e8400-e29b-41d4-a716-446655440031");
const nonce = "0b6f6f3e-7f1a-4c55-9d1e-5a0c8e2f7a11";
const fixtureProcStart = "424242";

const unitKeyNames: ReadonlyArray<string> = unitKeys;

const unitKeysOf = (text: string) =>
  decodeJsonObject(text).pipe(Effect.map((record) => A.filter(R.keys(record), (key) => A.contains(unitKeyNames, key))));

const laneUnit = AdmissionUnit.cases.lane.make({ lane: "check" });
const staticSeed = AdmissionWeightSource.cases["static-seed"].make({});
const owner = AdmissionOwner.make({
  proofNonce: nonce,
  pid: 4242,
  procStart: fixtureProcStart,
  attemptId: O.some(attemptId),
  originKey: "origin0sche08",
  checkoutRoot: "/repo/sche-08",
  branch: "feat/sche-08",
  command: "bun run beep yeet publish",
});
const unitFields = { unit: O.some(laneUnit), weightSource: O.some(staticSeed), owner: O.some(owner) };

const leaseOf = (fields: Partial<Parameters<typeof YeetAdmissionLease.make>[0]> = {}) =>
  YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid: 4242,
    procStart: fixtureProcStart,
    kind: "full-proof",
    weightTokens: 3,
    priority: "publish",
    originKey: "origin0sche08",
    checkoutRoot: "/repo/sche-08",
    branch: "feat/sche-08",
    command: "bun run beep yeet publish",
    startedAt: "2026-11-13T12:00:00.000Z",
    admittedAtMillis: 2000,
    heartbeatAtMillis: 2000,
    enqueuedAtMillis: 1000,
    nonce,
    attemptId: O.some(attemptId),
    ...fields,
  });

const ticketOf = (fields: Partial<Parameters<typeof YeetAdmissionTicket.make>[0]> = {}) =>
  YeetAdmissionTicket.make({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: 4242,
    procStart: fixtureProcStart,
    kind: "full-proof",
    weightTokens: 3,
    priority: "publish",
    originKey: "origin0sche08",
    checkoutRoot: "/repo/sche-08",
    branch: "feat/sche-08",
    enqueuedAtMillis: 1000,
    heartbeatAtMillis: 1000,
    nonce,
    attemptId: O.some(attemptId),
    ...fields,
  });

const rowsOf = (ticket: YeetAdmissionTicket) => [
  AdmissionJournalEnqueued.make({ ...ticket, schemaVersion: "yeet-admission-journal/v3", _tag: "admission-enqueued" }),
  AdmissionJournalAdmitted.make({
    schemaVersion: "yeet-admission-journal/v1",
    _tag: "admission-admitted",
    nonce,
    pid: 4242,
    procStart: fixtureProcStart,
    kind: ticket.kind,
    weightTokens: 3,
    priority: "publish",
    originKey: "origin0sche08",
    enqueuedAtMillis: 1000,
    admittedAtMillis: 2000,
    attemptId: O.some(attemptId),
    unit: ticket.unit,
    weightSource: ticket.weightSource,
    owner: ticket.owner,
  }),
  AdmissionJournalReleasedV3.make({
    schemaVersion: "yeet-admission-journal/v3",
    _tag: "admission-released",
    nonce,
    pid: 4242,
    releasedAtMillis: 3000,
    memoryPeakBytes: 1073741824,
    attemptId: O.some(attemptId),
    checkoutRoot: "/repo/sche-08",
    branch: "feat/sche-08",
    unit: ticket.unit,
    weightSource: ticket.weightSource,
    owner: ticket.owner,
  }),
  AdmissionJournalWithdrawn.make({
    ...ticket,
    schemaVersion: "yeet-admission-journal/v3",
    _tag: "admission-withdrawn",
    withdrawnAtMillis: 1500,
  }),
];

describe("admission unit schema (SCHE-08)", () => {
  const preUnitRows = [preUnitText.enqueued, preUnitText.admitted, preUnitText.released, preUnitText.withdrawn];

  it.effect("decodes pre-unit records as tier units and re-encodes them byte for byte", () =>
    Effect.gen(function* () {
      const lease = yield* decodeLease(preUnitText.lease);
      const ticket = yield* decodeTicket(preUnitText.ticket);
      for (const record of [lease, ticket]) {
        assertNone(record.unit);
        assertNone(record.weightSource);
        assertNone(record.owner);
      }
      const leaseText = yield* encodeLease(lease);
      const ticketText = yield* encodeTicket(ticket);
      deepStrictEqual([leaseText, ticketText], [preUnitText.lease, preUnitText.ticket]);
      const rows = yield* Effect.forEach(preUnitRows, (line) => decodeAdmissionJournalEvent(line));
      const reencoded = yield* Effect.forEach(rows, (row) => encodeEvent(row));
      deepStrictEqual(reencoded, preUnitRows);
      const keys = yield* Effect.forEach(preUnitRows, unitKeysOf);
      deepStrictEqual(keys, [[], [], [], []]);
    })
  );

  it.effect("records written with the units gate off are the pre-unit bytes", () =>
    Effect.gen(function* () {
      const leaseText = yield* encodeLease(leaseOf());
      const ticketText = yield* encodeTicket(ticketOf());
      deepStrictEqual([leaseText, ticketText], [preUnitText.lease, preUnitText.ticket]);
      const rows = yield* Effect.forEach(rowsOf(ticketOf()), (row) => encodeEvent(row));
      deepStrictEqual(rows, preUnitRows);
    })
  );

  it.effect("a pre-unit reader decodes gated records exactly as it decodes the pre-unit bytes", () =>
    Effect.gen(function* () {
      const leaseText = yield* encodeLease(leaseOf(unitFields));
      const ticketText = yield* encodeTicket(ticketOf(unitFields));
      const leaseKeys = yield* unitKeysOf(leaseText);
      deepStrictEqual(leaseKeys, [...unitKeys]);
      const gatedLease = yield* decodePreUnitLease(leaseText);
      const plainLease = yield* decodePreUnitLease(preUnitText.lease);
      deepStrictEqual(gatedLease, plainLease);
      const gatedTicket = yield* decodePreUnitTicket(ticketText);
      const plainTicket = yield* decodePreUnitTicket(preUnitText.ticket);
      deepStrictEqual(gatedTicket, plainTicket);
      const rowTexts = yield* Effect.forEach(rowsOf(ticketOf(unitFields)), (row) => encodeEvent(row));
      const rowKeys = yield* Effect.forEach(rowTexts, unitKeysOf);
      deepStrictEqual(rowKeys, A.replicate([...unitKeys], 4));
      const gatedRows = yield* Effect.forEach(rowTexts, (line) => decodePreUnitRow(line));
      const plainRows = yield* Effect.forEach(preUnitRows, (line) => decodePreUnitRow(line));
      deepStrictEqual(gatedRows, plainRows);
    })
  );

  it.effect("round-trips every unit and weight-source variant", () =>
    Effect.gen(function* () {
      const units = [
        AdmissionUnit.cases.tier.make({}),
        laneUnit,
        AdmissionUnit.cases.package.make({ packageName: ScopedPackageName.make("@beep/repo-cli"), task: "test" }),
      ];
      const sources = [
        staticSeed,
        AdmissionWeightSource.cases.measured.make({ sampleCount: 14 }),
        AdmissionWeightSource.cases["conservative-fallback"].make({}),
      ];
      const leases = A.map(A.zip(units, sources), ([unit, weightSource]) =>
        leaseOf({ unit: O.some(unit), weightSource: O.some(weightSource), owner: O.some(owner) })
      );
      const texts = yield* Effect.forEach(leases, (lease) => encodeLease(lease));
      const decoded = yield* Effect.forEach(texts, (text) => decodeLease(text));
      deepStrictEqual(decoded, leases);
    })
  );

  it.effect("reads a newer writer's kind and unit shapes without failing the record", () =>
    Effect.gen(function* () {
      const newer = Str.replace('"kind":"full-proof"', '"kind":"cache-qualification"')(preUnitText.lease);
      const withUnknownShapes = Str.replace(
        '"hotPaths":[]',
        '"hotPaths":[],"unit":{"_tag":"partition","shard":3},"weightSource":{"_tag":"p99-envelope"},"owner":{"proofNonce":7}'
      )(newer);
      const lease = yield* decodeLease(withUnknownShapes);
      strictEqual(lease.kind, "cache-qualification");
      strictEqual(lease.weightTokens, 3);
      assertTrue(S.is(UnrecognizedAdmissionWorkKind)(lease.kind));
      assertNone(lease.unit);
      assertNone(lease.weightSource);
      assertNone(lease.owner);
      const reencoded = yield* encodeLease(lease);
      strictEqual(reencoded, newer);
      const preUnitFailure = yield* decodePreUnitLease(newer).pipe(Effect.flip);
      strictEqual(preUnitFailure._tag, "SchemaError");
      const admitted = yield* decodeAdmissionJournalEvent(
        Str.replace('"kind":"full-proof"', '"kind":"gate"')(preUnitText.admitted)
      );
      strictEqual(admitted._tag, "admission-admitted");
    })
  );

  it.effect.prop(
    "property: any unit, weight source and owner round-trips and stays invisible to a pre-unit reader",
    [Arbitrary.schema(AdmissionUnit), Arbitrary.schema(AdmissionWeightSource), Arbitrary.schema(AdmissionOwner)],
    Effect.fnUntraced(function* ([unit, weightSource, anyOwner]) {
      const lease = leaseOf({ unit: O.some(unit), weightSource: O.some(weightSource), owner: O.some(anyOwner) });
      const text = yield* encodeLease(lease);
      const decoded = yield* decodeLease(text);
      // JSON drops the sign of -0, so the codec law is encode-stability rather than value identity.
      const reencoded = yield* encodeLease(decoded);
      strictEqual(reencoded, text);
      const seenByPreUnitReader = yield* decodePreUnitLease(text);
      const preUnitLease = yield* decodePreUnitLease(preUnitText.lease);
      deepStrictEqual(seenByPreUnitReader, preUnitLease);
    }),
    { arbitrary: fcRuns(32) }
  );

  it("keeps known kinds known and refuses an empty kind", () => {
    assertFalse(S.is(UnrecognizedAdmissionWorkKind)("full-proof"));
    assertTrue(S.is(RecordedAdmissionWorkKind)("review-fix"));
    assertNone(S.decodeOption(RecordedAdmissionWorkKind)(""));
  });

  it("requests default to a whole-tier unit charged by the static seed", () => {
    const request = AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: admissionTokenWeight("review-fix"),
      priority: "verify",
      originKey: "",
      checkoutRoot: "/repo/sche-08",
      branch: "feat/sche-08",
      command: "bun run beep yeet verify --tier review-fix",
    });
    deepStrictEqual(request.unit, AdmissionUnit.cases.tier.make({}));
    deepStrictEqual(request.weightSource, staticSeed);
  });
});

// Fixed procfs entry for this process, so its start identity never reads the host.
const procStatFixture = `${process.pid} (beep) S ${A.join(A.replicate("0", 18), " ")} ${fixtureProcStart} 0 0\n`;

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
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" }))
);

// A private 0700 admission root owned by this uid, inside the in-memory volume.
const prepareRoot = Effect.fn("AdmissionUnitTest.prepareRoot")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtimeRoot = path.join("/run/sche-08", name);
  const root = path.join(runtimeRoot, "beep", "admit");
  yield* fs.makeDirectory(root, { recursive: true, mode: 0o700 });
  const uid = O.getOrElse(currentEffectiveUserIdOption(), () => 0);
  yield* fs.chown(root, uid, uid);
  yield* fs.makeDirectory(`/proc/${process.pid}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${process.pid}/stat`, procStatFixture);
  return { root, choice: RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot }) };
});

const readLines = Effect.fn("AdmissionUnitTest.readLines")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file);
  return A.filter(Str.split("\n")(text), Str.isNonEmpty);
});

const admitOnce = Effect.fn("AdmissionUnitTest.admitOnce")(function* (root: string, request: AdmissionRequest) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const leases = path.join(root, "leases");
  const leaseText = yield* withQualityAdmission(
    request,
    noAdmissionOriginGate,
    fs
      .readDirectory(leases)
      .pipe(Effect.flatMap((names) => fs.readFileString(path.join(leases, A.join(A.take(names, 1), "")))))
  );
  const journalPath = yield* admissionJournalPath(root);
  const journal = yield* readLines(journalPath);
  return { leaseText: Str.trim(leaseText), journal };
});

const decodeRows = (journal: ReadonlyArray<string>) =>
  Effect.forEach(journal, (line) => decodeAdmissionJournalEvent(line));

const verifyRequest = (unit: AdmissionUnit) =>
  AdmissionRequest.make({
    kind: "full-proof",
    weightTokens: admissionTokenWeight("full-proof"),
    priority: "verify",
    originKey: "origin0sche08",
    checkoutRoot: "/repo/sche-08",
    branch: "feat/sche-08",
    command: "bun run beep yeet verify",
    attemptId: O.some(attemptId),
    unit,
  });

it.layer(SchedulerTestLayer, { concurrent: false, timeout: "20 seconds" })("admission unit gate (SCHE-08)", (it) => {
  it.effect("keeps both gates independent in the protocol marker", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { root, choice } = yield* prepareRoot("protocol");
      yield* Effect.gen(function* () {
        const initial = yield* admissionProtocolStatus();
        const evictionOn = yield* setAdmissionEvictionProtocol("on");
        const unitsOn = yield* setAdmissionUnitProtocol("on");
        const evictionOff = yield* setAdmissionEvictionProtocol("off");
        deepStrictEqual(
          A.map([initial, evictionOn, unitsOn, evictionOff], (protocol) => [protocol.eviction, protocol.units]),
          [
            ["off", "off"],
            ["on", "off"],
            ["on", "on"],
            ["off", "on"],
          ]
        );
        const protocolPath = yield* admissionProtocolPath(root);
        const marker = yield* fs.readFileString(protocolPath);
        expect(marker).toContain('"units":"on"');
        // An older checkout rewrites the marker without the key, which turns unit fields off again.
        yield* fs.writeFileString(protocolPath, '{"schemaVersion":"yeet-admission-protocol/v2","eviction":"on"}\n');
        const older = yield* admissionProtocolStatus();
        deepStrictEqual([older.eviction, older.units], ["on", "off"]);
      }).pipe(provideRuntimeRootForTesting(choice));
    })
  );

  it.effect("writes no unit keys while the gate is off", () =>
    Effect.gen(function* () {
      const { root, choice } = yield* prepareRoot("gate-off");
      const { journal, leaseText } = yield* admitOnce(root, verifyRequest(laneUnit)).pipe(
        provideRuntimeRootForTesting(choice)
      );
      const leaseKeys = yield* unitKeysOf(leaseText);
      deepStrictEqual(leaseKeys, []);
      const rows = yield* decodeRows(journal);
      deepStrictEqual(
        A.map(rows, (row) => row._tag),
        ["admission-enqueued", "admission-admitted", "admission-released"]
      );
      const rowKeys = yield* Effect.forEach(journal, unitKeysOf);
      deepStrictEqual(rowKeys, [[], [], []]);
      strictEqual(A.length(spawner.spawns), 0);
    })
  );

  it.effect("stamps the request's unit, the weight source and the owner while the gate is on", () =>
    Effect.gen(function* () {
      const { root, choice } = yield* prepareRoot("gate-on");
      const { journal, leaseText } = yield* setAdmissionUnitProtocol("on").pipe(
        Effect.andThen(admitOnce(root, verifyRequest(laneUnit))),
        provideRuntimeRootForTesting(choice)
      );
      const lease = yield* decodeLease(leaseText);
      const expectedOwner = AdmissionOwner.make({
        proofNonce: lease.nonce,
        pid: process.pid,
        procStart: fixtureProcStart,
        attemptId: O.some(attemptId),
        originKey: "origin0sche08",
        checkoutRoot: "/repo/sche-08",
        branch: "feat/sche-08",
        command: "bun run beep yeet verify",
      });
      const expected = { unit: O.some(laneUnit), weightSource: O.some(staticSeed), owner: O.some(expectedOwner) };
      deepStrictEqual(Struct.pick(lease, unitKeys), expected);
      const rows = yield* decodeRows(journal);
      const stamped = A.map(rows, (row) => ("unit" in row ? O.some(Struct.pick(row, unitKeys)) : O.none()));
      deepStrictEqual(stamped, A.replicate(O.some(expected), 3));
      const preUnitLease = yield* decodePreUnitLease(leaseText);
      strictEqual(preUnitLease.weightTokens, 3);
      const preUnitRows = yield* Effect.forEach(journal, (line) => decodePreUnitRow(line));
      strictEqual(A.length(preUnitRows), 3);
    })
  );

  it.effect("charges a live lease whose kind and unit come from a newer writer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, choice } = yield* prepareRoot("newer-writer");
      const newerLease = Str.replace(
        '"hotPaths":[]',
        '"hotPaths":[],"unit":{"_tag":"partition","shard":3}'
      )(Str.replace('"kind":"full-proof"', '"kind":"cache-qualification"')(preUnitText.lease));
      const live = Str.replace('"pid":4242', `"pid":${process.pid}`)(newerLease);
      yield* fs.makeDirectory(path.join(root, "leases"), { recursive: true, mode: 0o700 });
      yield* fs.writeFileString(path.join(root, "leases", `${nonce}-${process.pid}.lease.json`), `${live}\n`);
      const snapshot = yield* admissionStatus().pipe(provideRuntimeRootForTesting(choice));
      deepStrictEqual(
        A.map(snapshot.leases, (lease) => lease.kind),
        ["cache-qualification"]
      );
      strictEqual(snapshot.activeTokens, 3);
      deepStrictEqual(snapshot.quarantined, []);
    })
  );
});
