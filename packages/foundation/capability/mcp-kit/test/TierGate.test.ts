/**
 * Fixture proof: the tier-gate dispatch wrapper refuses fail-closed as a
 * value for an unapproved write-tool call and produces a sanitized audit
 * record matching the kit's audit schema. Every gated call — approved or
 * refused — produces an audit record (Q7); an unannotated tool is refused
 * fail-closed as a value, never a throw.
 *
 * @since 0.0.0
 */
import {
  dispatchWithTierGate,
  fromApprovedToolsPolicy,
  TierGate,
  TierGateAuditRecord,
  TierGatePolicy,
  TierGateSettlement,
  TierGateVerdict,
} from "@beep/mcp-kit";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { Tool } from "effect/unstable/ai";

const writeTool = Tool.make("delete_document", { success: S.String }).annotate(Tool.Destructive, true);
const readTool = Tool.make("search_documents", { success: S.String })
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false);
const nonReadOnlyWriteTool = Tool.make("write_cache", { success: S.String }).annotate(Tool.Destructive, false);
const unannotatedTool = Tool.make("unannotated_tool", { success: S.String });

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      assert.isTrue(equals(decode(encode(value)), value));
    }),
    fcRuns(50)
  );
};

describe("dispatchWithTierGate", () => {
  it.effect(
    "refuses fail-closed as a value for an unapproved destructive tool call",
    Effect.fnUntraced(function* () {
      const gate = fromApprovedToolsPolicy({ approvedTools: [] });
      const result = yield* dispatchWithTierGate(
        { tool: writeTool, toolCallId: O.some("call-1") },
        Effect.succeed("this handler must never run")
      ).pipe(Effect.provideService(TierGate, TierGate.of(gate)));

      assert.strictEqual(result._tag, "Refused");
      if (result._tag === "Refused") {
        assert.isTrue(TierGateAuditRecord.is(result.audit));
        assert.strictEqual(result.audit.tool, "delete_document");
        assert.strictEqual(result.audit.outcome, "refused");
        assert.isTrue(result.audit.destructive);
        assert.deepStrictEqual(result.audit.toolCallId, O.some("call-1"));
        assert.isString(result.audit.occurredAt);
      }
    })
  );

  it.effect(
    "dispatches an approved destructive tool call and produces both the handler result and a schema-valid audit record",
    Effect.fnUntraced(function* () {
      const gate = fromApprovedToolsPolicy({ approvedTools: ["delete_document"] });
      const result = yield* dispatchWithTierGate(
        { tool: writeTool, toolCallId: O.none() },
        Effect.succeed("deleted")
      ).pipe(Effect.provideService(TierGate, TierGate.of(gate)));

      assert.strictEqual(result._tag, "Dispatched");
      if (result._tag === "Dispatched") {
        assert.strictEqual(result.value, "deleted");
        assert.isTrue(TierGateAuditRecord.is(result.audit));
        assert.strictEqual(result.audit.outcome, "approved");
        assert.strictEqual(result.audit.tool, "delete_document");
        assert.isTrue(result.audit.destructive);
      }
    })
  );

  it.effect(
    "dispatches a read-only tool call without requiring approval and still audits it",
    Effect.fnUntraced(function* () {
      const gate = fromApprovedToolsPolicy({ approvedTools: [] });
      const result = yield* dispatchWithTierGate(
        { tool: readTool, toolCallId: O.none() },
        Effect.succeed("results")
      ).pipe(Effect.provideService(TierGate, TierGate.of(gate)));

      assert.strictEqual(result._tag, "Dispatched");
      if (result._tag === "Dispatched") {
        assert.strictEqual(result.value, "results");
        assert.strictEqual(result.audit.outcome, "approved");
        assert.isFalse(result.audit.destructive);
      }
    })
  );

  it.effect(
    "refuses a non-destructive write without explicit read-only approval",
    Effect.fnUntraced(function* () {
      const gate = fromApprovedToolsPolicy({ approvedTools: [] });
      const result = yield* dispatchWithTierGate(
        { tool: nonReadOnlyWriteTool, toolCallId: O.none() },
        Effect.succeed("this handler must never run")
      ).pipe(Effect.provideService(TierGate, TierGate.of(gate)));

      assert.strictEqual(result._tag, "Refused");
      if (result._tag === "Refused") {
        assert.isTrue(TierGateAuditRecord.is(result.audit));
        assert.strictEqual(result.audit.tool, "write_cache");
        assert.strictEqual(result.audit.outcome, "refused");
        assert.isFalse(result.audit.destructive);
        assert.strictEqual(result.audit.reason, "Tool is not marked read-only; approval required.");
      }
    })
  );

  it.effect(
    "refuses an unannotated tool fail-closed as a value, never a throw",
    Effect.fnUntraced(function* () {
      const gate = fromApprovedToolsPolicy({ approvedTools: [] });
      const result = yield* dispatchWithTierGate(
        { tool: unannotatedTool, toolCallId: O.none() },
        Effect.succeed("this handler must never run")
      ).pipe(Effect.provideService(TierGate, TierGate.of(gate)));

      assert.strictEqual(result._tag, "Refused");
      if (result._tag === "Refused") {
        assert.isTrue(TierGateAuditRecord.is(result.audit));
        assert.strictEqual(result.audit.tool, "unannotated_tool");
        assert.strictEqual(result.audit.outcome, "refused");
        assert.isTrue(result.audit.destructive);
      }
    })
  );
});

describe("recordOutcome settlement", () => {
  // A gate that evaluates via the policy but records settlements into a Ref,
  // so the tests observe exactly what dispatchWithTierGate reports.
  const recordingGate = Effect.fnUntraced(function* (approvedTools: ReadonlyArray<string>) {
    const recorded = yield* Ref.make<ReadonlyArray<{ readonly tool: string; readonly settlement: string }>>([]);
    const policyGate = fromApprovedToolsPolicy({ approvedTools });
    const gate = TierGate.of({
      evaluate: policyGate.evaluate,
      recordOutcome: Effect.fn("TierGateTest.recordOutcome")(function* (request, settlement) {
        yield* Ref.update(recorded, (entries) => [...entries, { settlement, tool: request.tool.name }]);
      }),
    });
    return { gate, recorded };
  });

  it.effect(
    "reports completed after an approved dispatch succeeds",
    Effect.fnUntraced(function* () {
      const { gate, recorded } = yield* recordingGate(["delete_document"]);
      const result = yield* dispatchWithTierGate(
        { tool: writeTool, toolCallId: O.none() },
        Effect.succeed("deleted")
      ).pipe(Effect.provideService(TierGate, gate));

      assert.strictEqual(result._tag, "Dispatched");
      assert.deepStrictEqual(yield* Ref.get(recorded), [{ settlement: "completed", tool: "delete_document" }]);
    })
  );

  it.effect(
    "reports failed after an approved dispatch fails, without widening the error channel",
    Effect.fnUntraced(function* () {
      const { gate, recorded } = yield* recordingGate(["delete_document"]);
      const failure = yield* dispatchWithTierGate(
        { tool: writeTool, toolCallId: O.none() },
        Effect.fail("boom" as const)
      ).pipe(Effect.provideService(TierGate, gate), Effect.flip);

      assert.strictEqual(failure, "boom");
      assert.deepStrictEqual(yield* Ref.get(recorded), [{ settlement: "failed", tool: "delete_document" }]);
    })
  );

  it.effect(
    "reports interrupted when an approved dispatch is interrupted",
    Effect.fnUntraced(function* () {
      const { gate, recorded } = yield* recordingGate(["delete_document"]);
      const fiber = yield* dispatchWithTierGate({ tool: writeTool, toolCallId: O.none() }, Effect.never).pipe(
        Effect.provideService(TierGate, gate),
        Effect.forkChild
      );
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);

      assert.deepStrictEqual(yield* Ref.get(recorded), [{ settlement: "interrupted", tool: "delete_document" }]);
    })
  );

  it.effect(
    "reports no settlement for a refused dispatch — there was no execution to settle",
    Effect.fnUntraced(function* () {
      const { gate, recorded } = yield* recordingGate([]);
      const result = yield* dispatchWithTierGate(
        { tool: writeTool, toolCallId: O.none() },
        Effect.succeed("this handler must never run")
      ).pipe(Effect.provideService(TierGate, gate));

      assert.strictEqual(result._tag, "Refused");
      assert.deepStrictEqual(yield* Ref.get(recorded), []);
    })
  );

  it.effect(
    "fromApprovedToolsPolicy keeps no settlement record",
    Effect.fnUntraced(function* () {
      const gate = fromApprovedToolsPolicy({ approvedTools: ["delete_document"] });
      yield* gate.recordOutcome({ tool: writeTool, toolCallId: O.none() }, "completed");
    })
  );
});

describe("tier-gate schema parity laws", () => {
  it("round-trips TierGateAuditRecord with schema-owned toolCallId absence", () => {
    const audit = TierGateAuditRecord.make({
      tool: "search_documents",
      outcome: "approved",
      reason: "Tool is read-only and non-destructive; no approval required.",
      destructive: false,
      occurredAt: "2026-07-01T00:00:00.000Z",
    });

    assert.deepStrictEqual(audit.toolCallId, O.none());
    assert.throws(() =>
      S.decodeUnknownSync(TierGateAuditRecord)({
        tool: "search_documents",
        outcome: "approved",
        reason: "Tool is read-only and non-destructive; no approval required.",
        destructive: false,
        toolCallId: "",
        occurredAt: "2026-07-01T00:00:00.000Z",
      })
    );
    assertSchemaRoundTrip(TierGateAuditRecord);
  });

  it("round-trips TierGateVerdict and TierGatePolicy from their production schemas", () => {
    assertSchemaRoundTrip(TierGateSettlement);
    assertSchemaRoundTrip(TierGateVerdict);
    assertSchemaRoundTrip(TierGatePolicy);
  });
});
