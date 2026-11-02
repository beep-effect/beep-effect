import {
  foldPacketEvents,
  PacketCreatedBody,
  PacketEvent,
  packetEventDigest,
  packetEventFileName,
  packetTraceIsStale,
  planForkRepair,
  projectPacketTrace,
  StageEnteredBody,
  StoredPacketEvent,
  upcastPacketEventJson,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";

type EventBody = PacketEvent["body"];

const created = PacketCreatedBody.make({ type: "packet-created", status: "active" });
const stage = (name: "align" | "shape" | "decompose", ordinal: number) =>
  StageEnteredBody.make({ type: "stage-entered", stage: name, ordinal });

const storedEvent = Effect.fnUntraced(function* (input: {
  readonly parent: string | undefined;
  readonly seq: number;
  readonly at: string;
  readonly body: EventBody;
}) {
  const event = PacketEvent.make({
    schemaVersion: "packet-event/v1",
    packet: "demo",
    root: "goals",
    seq: input.seq,
    ...(input.parent === undefined ? {} : { parent: input.parent }),
    expectedRevision: input.seq - 1,
    at: input.at,
    actor: "test",
    body: input.body,
  });
  const id = yield* packetEventDigest(event);
  return StoredPacketEvent.make({ id, fileName: packetEventFileName(event, id), event });
});

it.layer(NodeCrypto.layer, { concurrent: false, timeout: "20 seconds" })((it) => {
  describe("upcastPacketEventJson", () => {
    it("returns records without a string schemaVersion unchanged", () => {
      const missing = { packet: "demo" };
      const numeric = { schemaVersion: 1 };
      const unknownVersion = { schemaVersion: "packet-event/v999" };
      expect(upcastPacketEventJson(missing)).toBe(missing);
      expect(upcastPacketEventJson(numeric)).toBe(numeric);
      expect(upcastPacketEventJson(unknownVersion)).toBe(unknownVersion);
      expect(upcastPacketEventJson("not-a-record")).toBe("not-a-record");
    });
  });

  describe("packetTraceIsStale", () => {
    it("treats an empty trace of an empty stream as fresh, in both call forms", () => {
      const empty = foldPacketEvents({ packet: "demo", root: "goals", events: [] });
      const trace = projectPacketTrace(empty, []);
      expect(packetTraceIsStale(trace, empty)).toBe(false);
      expect(packetTraceIsStale(empty)(trace)).toBe(false);
    });
  });

  describe("foldPacketEvents linear prefix", () => {
    it.effect(
      "stops the prefix and records parent-seq-mismatch when a child skips a sequence number",
      () =>
        Effect.gen(function* () {
          const genesis = yield* storedEvent({
            parent: undefined,
            seq: 1,
            at: "2026-08-17T00:00:00.000Z",
            body: created,
          });
          const skipped = yield* storedEvent({
            parent: genesis.id,
            seq: 3,
            at: "2026-08-17T00:01:00.000Z",
            body: stage("align", 2),
          });
          const derived = foldPacketEvents({ packet: "demo", root: "goals", events: [genesis, skipped] });
          expect(derived.revision).toBe(1);
          expect(derived.tip?.id).toBe(genesis.id);
          const mismatch = A.findFirst(derived.issues, (issue) => issue.kind === "parent-seq-mismatch");
          mismatch.pipe(O.isSome, assertTrue);
          if (O.isSome(mismatch)) {
            expect(mismatch.value.fileName).toBe(skipped.fileName);
          }
        }),
      20_000
    );
  });

  describe("planForkRepair with descendants on both branches", () => {
    it.effect(
      "walks the surviving branch to its tip and rebases the whole losing subtree",
      () =>
        Effect.gen(function* () {
          const genesis = yield* storedEvent({
            parent: undefined,
            seq: 1,
            at: "2026-08-17T00:00:00.000Z",
            body: created,
          });
          const left = yield* storedEvent({
            parent: genesis.id,
            seq: 2,
            at: "2026-08-17T00:01:00.000Z",
            body: stage("align", 2),
          });
          const right = yield* storedEvent({
            parent: genesis.id,
            seq: 2,
            at: "2026-08-17T00:01:30.000Z",
            body: stage("shape", 3),
          });
          const leftChild = yield* storedEvent({
            parent: left.id,
            seq: 3,
            at: "2026-08-17T00:02:00.000Z",
            body: stage("decompose", 4),
          });
          const leftGrandchild = yield* storedEvent({
            parent: leftChild.id,
            seq: 4,
            at: "2026-08-17T00:03:00.000Z",
            body: stage("shape", 3),
          });
          const rightChild = yield* storedEvent({
            parent: right.id,
            seq: 3,
            at: "2026-08-17T00:02:30.000Z",
            body: stage("decompose", 4),
          });
          const rightGrandchild = yield* storedEvent({
            parent: rightChild.id,
            seq: 4,
            at: "2026-08-17T00:03:30.000Z",
            body: stage("align", 2),
          });
          const events = [genesis, left, right, leftChild, leftGrandchild, rightChild, rightGrandchild];
          const plan = O.getOrUndefined(yield* planForkRepair({ packet: "demo", root: "goals", events }));
          expect(plan).toBeDefined();
          if (plan === undefined) {
            return;
          }
          const survivorIsLeft = plan.survivor === left.id;
          const survivingTip = survivorIsLeft ? leftGrandchild : rightGrandchild;
          const losingBranch = survivorIsLeft
            ? [right, rightChild, rightGrandchild]
            : [left, leftChild, leftGrandchild];
          expect(plan.fork.parentSeq).toBe(1);
          expect(plan.survivorTip?.id).toBe(survivingTip.id);
          expect(plan.survivorTip?.seq).toBe(4);
          expect(A.length(plan.rebaseDrafts)).toBe(3);
          expect(A.map(plan.rebaseDrafts, (draft) => draft.seq)).toStrictEqual([5, 6, 7]);
          expect(plan.rebaseDrafts[0]?.parent).toBe(survivingTip.id);
          expect(A.sort(plan.filesToRemove, Order.String)).toStrictEqual(
            A.sort(
              A.map(losingBranch, (stored) => stored.fileName),
              Order.String
            )
          );
        }),
      20_000
    );
  });
});
