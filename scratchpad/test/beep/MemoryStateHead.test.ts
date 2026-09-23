import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  MEMORY_STATE_HEAD_SCHEMA_VERSION,
  MEMORY_STATE_HEAD_SOURCE,
  TrustedMemoryStateHead,
  trustedMemoryStateHeadFields,
  trustedMemoryStateHeadFieldsFromControl,
  trustedMemoryStateHeadFieldsFromState,
} from "../../beep/MemoryStateHead.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const wire = {
  schemaVersion: 1,
  uid: "user-1",
  source: "memory_state_head",
  accountGeneration: 3,
  headCommitId: "commit-9",
  commitSequence: 42,
};

const expectHead = (head: O.Option<TrustedMemoryStateHead>): TrustedMemoryStateHead => {
  assert.strictEqual(O.isSome(head), true);
  return O.getOrThrow(head);
};

describe("TrustedMemoryStateHead", () => {
  it("pins the constants", () => {
    assert.strictEqual(MEMORY_STATE_HEAD_SCHEMA_VERSION, 1);
    assert.strictEqual(MEMORY_STATE_HEAD_SOURCE, "memory_state_head");
  });

  it("decodes the trusted fields and rejects each broken one", () => {
    const decoded = decode(TrustedMemoryStateHead, wire);
    assert.strictEqual(decoded.headCommitId, "commit-9");
    assert.strictEqual(decoded.commitSequence, 42);
    assert.strictEqual(decodeFails(TrustedMemoryStateHead, { ...wire, schemaVersion: 2 }), true);
    assert.strictEqual(decodeFails(TrustedMemoryStateHead, { ...wire, source: "control" }), true);
    assert.strictEqual(decodeFails(TrustedMemoryStateHead, { ...wire, uid: "" }), true);
    assert.strictEqual(decodeFails(TrustedMemoryStateHead, { ...wire, headCommitId: "" }), true);
    assert.strictEqual(decodeFails(TrustedMemoryStateHead, { ...wire, accountGeneration: -1 }), true);
    assert.strictEqual(decodeFails(TrustedMemoryStateHead, { ...wire, commitSequence: 1.5 }), true);
  });

  it("derives an arbitrary", () => {
    assert.isDefined(Arbitrary.schema(TrustedMemoryStateHead));
  });
});

describe("trustedMemoryStateHeadFields", () => {
  it("builds a head from valid inputs", () => {
    const head = expectHead(
      trustedMemoryStateHeadFields({ uid: " user-1 ", accountGeneration: 0, headCommitId: "c", commitSequence: 0 }),
    );
    assert.strictEqual(head.uid, " user-1 ");
    assert.strictEqual(head.schemaVersion, 1);
    assert.strictEqual(head.source, "memory_state_head");
  });

  it("returns none for each rejected input", () => {
    const valid = { uid: "user-1", accountGeneration: 1, headCommitId: "c", commitSequence: 2 };
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, uid: "" })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, accountGeneration: true })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, accountGeneration: -1 })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, accountGeneration: "1" })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, headCommitId: "" })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, headCommitId: 7 })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, commitSequence: 1.5 })), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFields({ ...valid, commitSequence: null })), true);
  });
});

describe("trustedMemoryStateHeadFieldsFromState", () => {
  const snake = {
    schema_version: 1,
    uid: "user-1",
    source: "memory_state_head",
    account_generation: 3,
    head_commit_id: "commit-9",
    commit_sequence: 42,
  };

  it("reads snake_case and camelCase documents in both call forms", () => {
    const dataFirst = expectHead(trustedMemoryStateHeadFieldsFromState(snake, "user-1"));
    assert.strictEqual(dataFirst.accountGeneration, 3);
    const pipeable = expectHead(trustedMemoryStateHeadFieldsFromState("user-1")(wire));
    assert.strictEqual(pipeable.commitSequence, 42);
    assert.deepStrictEqual(dataFirst, pipeable);
  });

  it("rejects non-objects and marker mismatches", () => {
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromState(null, "user-1")), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromState("state", "user-1")), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromState({ ...snake, schema_version: 2 }, "user-1")), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromState(snake, "user-2")), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromState({ ...snake, source: "other" }, "user-1")), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromState({ ...snake, head_commit_id: "" }, "user-1")), true);
  });
});

describe("trustedMemoryStateHeadFieldsFromControl", () => {
  const control = { uid: "user-1", account_generation: 5, head_commit_id: "commit-1", commit_sequence: 9 };

  it("does not require the schema or source markers", () => {
    const head = expectHead(trustedMemoryStateHeadFieldsFromControl(control, "user-1"));
    assert.strictEqual(head.accountGeneration, 5);
    assert.strictEqual(head.source, "memory_state_head");
    assert.deepStrictEqual(trustedMemoryStateHeadFieldsFromControl("user-1")(control), O.some(head));
  });

  it("rejects a uid mismatch, a non-object, and an untrusted field", () => {
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromControl(control, "user-2")), true);
    assert.strictEqual(O.isNone(trustedMemoryStateHeadFieldsFromControl(undefined, "user-1")), true);
    assert.strictEqual(
      O.isNone(trustedMemoryStateHeadFieldsFromControl({ ...control, commit_sequence: -1 }, "user-1")),
      true,
    );
  });
});
