import {
  canonicalJsonText,
  canonicalJsonTextPretty,
  foldPacketEvents,
  PACKET_EVENT_UPCASTERS,
  PacketDerivedState,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketStreamLocator,
  PacketTraceEntry,
  PacketTraceProjection,
  packetEventDigest,
  packetEventFileName,
  packetTraceIsStale,
  parsePacketEventFileName,
  projectPacketTrace,
  renderPacketEventFile,
  renderPacketTraceFile,
  StoredPacketEvent,
  upcastPacketEventJson,
} from "@beep/repo-cli/test/Goals";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const testLayer = Layer.mergeAll(NodeServices.layer, PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)));

const FIXTURES_ROOT = new URL("./fixtures/packet-core", import.meta.url).pathname;
const GOLDEN_PATH = `${FIXTURES_ROOT}/golden-linear`;
const FORKED_PATH = `${FIXTURES_ROOT}/forked`;
const RISK_OVERRIDE_PATH = `${FIXTURES_ROOT}/risk-override`;

type EventBody = PacketEvent["body"];

const storedIdAt = (events: ReadonlyArray<StoredPacketEvent>, index: number): string | undefined =>
  O.getOrUndefined(O.map(A.get(events, index), (stored) => stored.id));

const chainEvents = Effect.fnUntraced(function* (
  packet: string,
  specs: ReadonlyArray<{ readonly body: EventBody; readonly at: string }>
) {
  let stored = A.empty<StoredPacketEvent>();
  let parent = O.none<string>();
  let seq = 0;
  for (const spec of specs) {
    seq += 1;
    const event = PacketEvent.make({
      schemaVersion: "packet-event/v1",
      packet,
      root: "goals",
      seq,
      ...(O.isSome(parent) ? { parent: parent.value } : {}),
      expectedRevision: seq - 1,
      at: spec.at,
      actor: "test",
      body: spec.body,
    });
    const id = yield* packetEventDigest(event);
    stored = A.append(stored, StoredPacketEvent.make({ id, fileName: packetEventFileName(event, id), event }));
    parent = O.some(id);
  }
  return stored;
});

describe("canonical encoding and digests", () => {
  it("renders key order deterministically, compact and pretty", () => {
    expect(canonicalJsonText({ b: 1, a: [true, null] })).toBe('{"a":[true,null],"b":1}');
    expect(canonicalJsonText({ a: [true, null], b: 1 })).toBe('{"a":[true,null],"b":1}');
    expect(canonicalJsonTextPretty({ b: 1, a: 2 })).toBe('{\n  "a": 2,\n  "b": 1\n}\n');
    expect(canonicalJsonText({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("round-trips event file names and rejects non-CAS names", () => {
    const digest = "a".repeat(64);
    const parsed = parsePacketEventFileName(`00002-status-set-${digest}.json`);
    expect(O.isSome(parsed)).toBe(true);
    if (O.isSome(parsed)) {
      expect(parsed.value.seq).toBe(2);
      expect(parsed.value.type).toBe("status-set");
      expect(parsed.value.id).toBe(digest);
    }
    expect(O.isNone(parsePacketEventFileName("notes.md"))).toBe(true);
    expect(O.isNone(parsePacketEventFileName(`2-status-set-${digest}.json`))).toBe(true);
  });

  it(
    "changes the digest whenever any event content changes",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const base = PacketEvent.make({
            schemaVersion: "packet-event/v1",
            packet: "demo",
            root: "goals",
            seq: 1,
            expectedRevision: 0,
            at: "2026-08-17T00:00:00.000Z",
            actor: "test",
            body: { type: "packet-created", status: "active" },
          });
          const moved = PacketEvent.make({ ...base, at: "2026-08-17T00:00:01.000Z" });
          const baseDigest = yield* packetEventDigest(base);
          const stableDigest = yield* packetEventDigest(base);
          const movedDigest = yield* packetEventDigest(moved);
          expect(baseDigest).toBe(stableDigest);
          expect(baseDigest).not.toBe(movedDigest);
        })
      ),
    20_000
  );

  it("upcasts v1 as identity and passes unknown shapes through", () => {
    const raw = { schemaVersion: "packet-event/v1", seq: 1 };
    expect(upcastPacketEventJson(raw)).toBe(raw);
    const unknownVersion = { schemaVersion: "packet-event/v999" };
    expect(upcastPacketEventJson(unknownVersion)).toBe(unknownVersion);
    expect(upcastPacketEventJson("scalar")).toBe("scalar");
    expect("packet-event/v1" in PACKET_EVENT_UPCASTERS).toBe(true);
  });
});

describe("schema-derived properties", () => {
  const PacketTraceEntryArbitrary = S.toArbitrary(PacketTraceEntry)(fc);
  const encodeTraceEntry = S.encodeUnknownSync(PacketTraceEntry);
  const decodeTraceEntry = S.decodeUnknownSync(PacketTraceEntry);

  it("round-trips arbitrary timeline entries through encode/decode byte-stably", () => {
    fc.assert(
      fc.property(PacketTraceEntryArbitrary, (entry) => {
        const encoded = encodeTraceEntry(entry);
        const reencoded = encodeTraceEntry(decodeTraceEntry(encoded));
        return canonicalJsonText(reencoded) === canonicalJsonText(encoded);
      }),
      fcRuns(50)
    );
  });
});

describe("foldPacketEvents", () => {
  it("folds an empty stream to revision 0 with no derivations", () => {
    const derived = foldPacketEvents({ packet: "demo", root: "goals", events: [] });
    expect(derived.revision).toBe(0);
    expect(derived.tip).toBeUndefined();
    expect(derived.status).toBeUndefined();
    expect(derived.forks).toStrictEqual([]);
    expect(derived.issues).toStrictEqual([]);
  });

  it(
    "derives furthest and resume stages across a loop-back (D3)",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const events = yield* chainEvents("demo", [
            {
              body: { type: "packet-created", status: "active", stage: "capture", ordinal: 0 },
              at: "2026-08-17T00:00:00.000Z",
            },
            { body: { type: "stage-entered", stage: "decompose", ordinal: 4 }, at: "2026-08-17T00:01:00.000Z" },
            { body: { type: "stage-entered", stage: "align", ordinal: 2 }, at: "2026-08-17T00:02:00.000Z" },
          ]);
          const derived = foldPacketEvents({ packet: "demo", root: "goals", events });
          expect(derived.revision).toBe(3);
          expect(derived.furthestStage).toBe("decompose");
          expect(derived.furthestOrdinal).toBe(4);
          expect(derived.resumeStage).toBe("align");
          expect(derived.status).toBe("active");
        })
      ),
    20_000
  );

  it(
    "derives the last risk-tier override on the linear prefix, with its challenge surface",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const events = yield* chainEvents("demo", [
            { body: { type: "packet-created", status: "active" }, at: "2026-08-17T00:00:00.000Z" },
            {
              body: { type: "risk-tier-overridden", tier: "standard", reason: "initial routing" },
              at: "2026-08-17T00:01:00.000Z",
            },
            {
              body: { type: "risk-tier-overridden", tier: "full", previous: "standard", reason: "scope grew" },
              at: "2026-08-17T00:02:00.000Z",
            },
          ]);
          const derived = foldPacketEvents({ packet: "demo", root: "goals", events });
          expect(derived.riskTierOverride?.tier).toBe("full");
          expect(derived.riskTierOverride?.reason).toBe("scope grew");
          expect(derived.riskTierOverride?.actor).toBe("test");
          expect(derived.riskTierOverride?.at).toBe("2026-08-17T00:02:00.000Z");
        })
      ),
    20_000
  );

  it(
    "keeps only the pre-fork risk-tier override when the stream forks",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const events = yield* chainEvents("demo", [
            { body: { type: "packet-created", status: "active" }, at: "2026-08-17T00:00:00.000Z" },
            {
              body: { type: "risk-tier-overridden", tier: "standard", reason: "initial routing" },
              at: "2026-08-17T00:01:00.000Z",
            },
            {
              body: { type: "risk-tier-overridden", tier: "full", previous: "standard", reason: "post-fork claim" },
              at: "2026-08-17T00:02:00.000Z",
            },
          ]);
          // A sibling of the seq-3 override forks the chain at seq 2's children:
          // the standard override at seq 2 sits on the unambiguous prefix and
          // must survive, while the full override past the fork must not derive.
          const parentId = storedIdAt(events, 1);
          const sibling = PacketEvent.make({
            schemaVersion: "packet-event/v1",
            packet: "demo",
            root: "goals",
            seq: 3,
            ...(parentId === undefined ? {} : { parent: parentId }),
            expectedRevision: 2,
            at: "2026-08-17T00:01:30.000Z",
            actor: "test",
            body: { type: "status-set", status: "paused", previous: "active" },
          });
          const siblingId = yield* packetEventDigest(sibling);
          const withFork = A.append(
            events,
            StoredPacketEvent.make({ id: siblingId, fileName: packetEventFileName(sibling, siblingId), event: sibling })
          );
          const derived = foldPacketEvents({ packet: "demo", root: "goals", events: withFork });
          expect(A.length(derived.forks)).toBe(1);
          expect(derived.revision).toBe(2);
          expect(derived.riskTierOverride?.tier).toBe("standard");
          expect(derived.riskTierOverride?.reason).toBe("initial routing");
        })
      ),
    20_000
  );

  it(
    "reports two children of one parent as a first-class fork verdict",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const events = yield* chainEvents("demo", [
            { body: { type: "packet-created", status: "active" }, at: "2026-08-17T00:00:00.000Z" },
            { body: { type: "stage-entered", stage: "align", ordinal: 2 }, at: "2026-08-17T00:01:00.000Z" },
          ]);
          const parentId = storedIdAt(events, 0);
          const sibling = PacketEvent.make({
            schemaVersion: "packet-event/v1",
            packet: "demo",
            root: "goals",
            seq: 2,
            ...(parentId === undefined ? {} : { parent: parentId }),
            expectedRevision: 1,
            at: "2026-08-17T00:01:30.000Z",
            actor: "test",
            body: { type: "status-set", status: "paused", previous: "active" },
          });
          const siblingId = yield* packetEventDigest(sibling);
          const withFork = A.append(
            events,
            StoredPacketEvent.make({ id: siblingId, fileName: packetEventFileName(sibling, siblingId), event: sibling })
          );
          const derived = foldPacketEvents({ packet: "demo", root: "goals", events: withFork });
          expect(A.length(derived.forks)).toBe(1);
          const fork = derived.forks[0];
          expect(fork?.parent).toBe(parentId);
          expect(fork?.parentSeq).toBe(1);
          expect(fork?.children.length).toBe(2);
          // Derivations stop at the unambiguous prefix before the fork.
          expect(derived.revision).toBe(1);
        })
      ),
    20_000
  );

  it(
    "reports a missing parent digest as a chain issue",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const orphan = PacketEvent.make({
            schemaVersion: "packet-event/v1",
            packet: "demo",
            root: "goals",
            seq: 2,
            parent: "b".repeat(64),
            expectedRevision: 1,
            at: "2026-08-17T00:01:00.000Z",
            actor: "test",
            body: { type: "status-set", status: "paused", previous: "active" },
          });
          const orphanId = yield* packetEventDigest(orphan);
          const derived = foldPacketEvents({
            packet: "demo",
            root: "goals",
            events: [
              StoredPacketEvent.make({ id: orphanId, fileName: packetEventFileName(orphan, orphanId), event: orphan }),
            ],
          });
          expect(A.length(derived.issues)).toBe(1);
          expect(derived.issues[0]?.kind).toBe("missing-parent");
          expect(derived.revision).toBe(0);
        })
      ),
    20_000
  );
});

describe("golden replay (committed fixture)", () => {
  it(
    "folds the committed golden stream to the committed derived state and trace, byte-for-byte",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const store = yield* PacketEventStore;
          const listing = yield* store.list(
            PacketStreamLocator.make({ packet: "golden-linear", root: "goals", packetPath: GOLDEN_PATH })
          );
          expect(listing.issues).toStrictEqual([]);
          expect(A.length(listing.events)).toBe(5);

          const derived = foldPacketEvents({ packet: "golden-linear", root: "goals", events: listing.events });
          expect(derived.revision).toBe(5);
          expect(derived.status).toBe("paused");
          expect(derived.furthestStage).toBe("decompose");
          expect(derived.furthestOrdinal).toBe(4);
          expect(derived.resumeStage).toBe("align");
          expect(derived.forks).toStrictEqual([]);
          expect(derived.issues).toStrictEqual([]);

          const expectedTrace = yield* fs.readFileString(`${GOLDEN_PATH}/expected-trace.json`);
          const renderedTrace = yield* renderPacketTraceFile(projectPacketTrace(derived, listing.events));
          expect(renderedTrace).toBe(expectedTrace);

          const expectedDerived = yield* fs.readFileString(`${GOLDEN_PATH}/expected-derived.json`);
          const encodedDerived = yield* S.encodeUnknownEffect(PacketDerivedState)(derived);
          expect(canonicalJsonTextPretty(encodedDerived)).toBe(expectedDerived);
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "folds the committed risk-override stream to the committed derived state and trace, byte-for-byte",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const store = yield* PacketEventStore;
          const listing = yield* store.list(
            PacketStreamLocator.make({ packet: "risk-override", root: "goals", packetPath: RISK_OVERRIDE_PATH })
          );
          expect(listing.issues).toStrictEqual([]);
          expect(A.length(listing.events)).toBe(4);

          const derived = foldPacketEvents({ packet: "risk-override", root: "goals", events: listing.events });
          expect(derived.revision).toBe(4);
          expect(derived.riskTierOverride?.tier).toBe("full");
          expect(derived.riskTierOverride?.reason).toBe("fixture: raised after scope review");
          expect(derived.forks).toStrictEqual([]);
          expect(derived.issues).toStrictEqual([]);

          const expectedTrace = yield* fs.readFileString(`${RISK_OVERRIDE_PATH}/expected-trace.json`);
          const renderedTrace = yield* renderPacketTraceFile(projectPacketTrace(derived, listing.events));
          expect(renderedTrace).toBe(expectedTrace);

          const expectedDerived = yield* fs.readFileString(`${RISK_OVERRIDE_PATH}/expected-derived.json`);
          const encodedDerived = yield* S.encodeUnknownEffect(PacketDerivedState)(derived);
          expect(canonicalJsonTextPretty(encodedDerived)).toBe(expectedDerived);
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "retires the committed v1 trace: stale by decode under the v2 projector, bytes changed",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // Projections are disposable derived copies: a v1 trace is never
          // upcast — it fails the v2 decode, explore --check reports it as
          // packet-trace-stale, and the next write regenerates it.
          const v1Text = yield* fs.readFileString(`${GOLDEN_PATH}/expected-trace.v1.json`);
          const decoded = yield* Effect.exit(S.decodeEffect(S.fromJsonString(PacketTraceProjection))(v1Text));
          expect(Exit.isFailure(decoded)).toBe(true);

          const v2Text = yield* fs.readFileString(`${GOLDEN_PATH}/expected-trace.json`);
          expect(v2Text).not.toBe(v1Text);
          expect(v2Text).toContain('"timeline"');
          expect(v2Text).toContain('"projectorVersion": 2');
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "folds the committed fork fixture to a fork verdict and refuses appends",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const store = yield* PacketEventStore;
          const locator = PacketStreamLocator.make({ packet: "forked", root: "goals", packetPath: FORKED_PATH });
          const listing = yield* store.list(locator);
          expect(listing.issues).toStrictEqual([]);
          expect(A.length(listing.events)).toBe(4);

          const derived = foldPacketEvents({ packet: "forked", root: "goals", events: listing.events });
          expect(A.length(derived.forks)).toBe(1);
          expect(derived.forks[0]?.parentSeq).toBe(2);
          expect(derived.forks[0]?.children.length).toBe(2);
          expect(derived.revision).toBe(2);

          // The timeline stops at the unambiguous prefix: both seq-3 children
          // are ambiguous history and must not project.
          const trace = projectPacketTrace(derived, listing.events);
          expect(A.length(trace.timeline)).toBe(2);
          expect(A.map(trace.timeline, (entry) => entry.seq)).toStrictEqual([1, 2]);

          const tipId = O.getOrUndefined(O.map(O.fromUndefinedOr(derived.tip), (tip) => tip.id));
          const next = PacketEvent.make({
            schemaVersion: "packet-event/v1",
            packet: "forked",
            root: "goals",
            seq: 3,
            ...(tipId === undefined ? {} : { parent: tipId }),
            expectedRevision: 2,
            at: "2026-08-17T01:00:00.000Z",
            actor: "test",
            body: { type: "status-set", status: "paused", previous: "active" },
          });
          const result = yield* Effect.exit(store.append(locator, next));
          expect(Exit.isFailure(result)).toBe(true);
          if (Exit.isFailure(result)) {
            expect(String(Cause.squash(result.cause))).toContain("forked");
          }
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );
});

describe("store read robustness", () => {
  const writeStoredEvent = Effect.fnUntraced(function* (directory: string, event: PacketEvent) {
    const fs = yield* FileSystem.FileSystem;
    const id = yield* packetEventDigest(event);
    const content = yield* renderPacketEventFile(event);
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* fs.writeFileString(`${directory}/${packetEventFileName(event, id)}`, content);
    return { id, content };
  });

  const genesisEvent = (packet: string): PacketEvent =>
    PacketEvent.make({
      schemaVersion: "packet-event/v1",
      packet,
      root: "goals",
      seq: 1,
      expectedRevision: 0,
      at: "2026-08-17T00:00:00.000Z",
      actor: "test",
      body: { type: "packet-created", status: "active" },
    });

  it(
    "reports unreadable names, invalid JSON, undecodable events, and digest or name mismatches as issues",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const store = yield* PacketEventStore;
          const packetPath = yield* fs.makeTempDirectory();
          const events = `${packetPath}/ops/events`;
          const { content } = yield* writeStoredEvent(events, genesisEvent("robust"));
          const digest = "d".repeat(64);
          yield* fs.writeFileString(`${events}/junk.json`, "{}");
          yield* fs.writeFileString(`${events}/00002-status-set-${digest}.json`, "not json at all");
          yield* fs.writeFileString(
            `${events}/00003-status-set-${"e".repeat(64)}.json`,
            '{"schemaVersion":"packet-event/v1"}'
          );
          yield* fs.writeFileString(`${events}/00004-status-set-${"f".repeat(64)}.json`, content);

          const listing = yield* store.list(PacketStreamLocator.make({ packet: "robust", root: "goals", packetPath }));
          expect(A.length(listing.events)).toBe(1);
          const kinds = A.map(listing.issues, (issue) => issue.kind);
          expect(kinds).toContain("file-name-mismatch");
          expect(kinds).toContain("event-invalid");
          expect(kinds).toContain("digest-mismatch");
          yield* fs.remove(packetPath, { recursive: true, force: true });
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "refuses appends onto a missing stream, a broken stream, and a mismatched parent",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const store = yield* PacketEventStore;

          const missingPath = yield* fs.makeTempDirectory();
          const missingLocator = PacketStreamLocator.make({ packet: "robust", root: "goals", packetPath: missingPath });
          const missing = yield* Effect.exit(store.append(missingLocator, genesisEvent("robust")));
          expect(Exit.isFailure(missing)).toBe(true);
          if (Exit.isFailure(missing)) {
            expect(String(Cause.squash(missing.cause))).toContain("ops/events");
          }

          const brokenPath = yield* fs.makeTempDirectory();
          yield* fs.makeDirectory(`${brokenPath}/ops/events`, { recursive: true });
          yield* fs.writeFileString(`${brokenPath}/ops/events/junk.json`, "{}");
          const brokenLocator = PacketStreamLocator.make({ packet: "robust", root: "goals", packetPath: brokenPath });
          const broken = yield* Effect.exit(store.append(brokenLocator, genesisEvent("robust")));
          expect(Exit.isFailure(broken)).toBe(true);
          if (Exit.isFailure(broken)) {
            expect(String(Cause.squash(broken.cause))).toContain("integrity");
          }

          const parentPath = yield* fs.makeTempDirectory();
          yield* writeStoredEvent(`${parentPath}/ops/events`, genesisEvent("robust"));
          const parentLocator = PacketStreamLocator.make({ packet: "robust", root: "goals", packetPath: parentPath });
          const wrongParent = PacketEvent.make({
            schemaVersion: "packet-event/v1",
            packet: "robust",
            root: "goals",
            seq: 2,
            parent: "a".repeat(64),
            expectedRevision: 1,
            at: "2026-08-17T00:01:00.000Z",
            actor: "test",
            body: { type: "status-set", status: "paused", previous: "active" },
          });
          const conflicted = yield* Effect.exit(store.append(parentLocator, wrongParent));
          expect(Exit.isFailure(conflicted)).toBe(true);
          if (Exit.isFailure(conflicted)) {
            expect(String(Cause.squash(conflicted.cause))).toContain("parent digest");
          }

          yield* fs.remove(missingPath, { recursive: true, force: true });
          yield* fs.remove(brokenPath, { recursive: true, force: true });
          yield* fs.remove(parentPath, { recursive: true, force: true });
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );
});

describe("packetTraceIsStale", () => {
  it(
    "flags a moved sourceTip and an outdated projector version",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const events = yield* chainEvents("demo", [
            { body: { type: "packet-created", status: "active" }, at: "2026-08-17T00:00:00.000Z" },
          ]);
          const derived = foldPacketEvents({ packet: "demo", root: "goals", events });
          const fresh = projectPacketTrace(derived, events);
          expect(packetTraceIsStale(fresh, derived)).toBe(false);

          const emptyDerived = foldPacketEvents({ packet: "demo", root: "goals", events: [] });
          expect(packetTraceIsStale(fresh, emptyDerived)).toBe(true);
          expect(packetTraceIsStale(projectPacketTrace(emptyDerived, []), derived)).toBe(true);

          const outdated = PacketTraceProjection.make({ ...fresh, projectorVersion: fresh.projectorVersion + 1 });
          expect(packetTraceIsStale(outdated, derived)).toBe(true);
        })
      ),
    20_000
  );
});
