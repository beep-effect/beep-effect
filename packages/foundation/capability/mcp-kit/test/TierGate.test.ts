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
  TierGateVerdict,
} from "@beep/mcp-kit";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { Tool } from "effect/unstable/ai";

const writeTool = Tool.make("delete_document", { success: S.String }).annotate(Tool.Destructive, true);
const readTool = Tool.make("search_documents", { success: S.String }).annotate(Tool.Destructive, false);
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
  it.effect("refuses fail-closed as a value for an unapproved destructive tool call", () =>
    Effect.gen(function* () {
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
    () =>
      Effect.gen(function* () {
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

  it.effect("dispatches a read-only tool call without requiring approval and still audits it", () =>
    Effect.gen(function* () {
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

  it.effect("refuses an unannotated tool fail-closed as a value, never a throw", () =>
    Effect.gen(function* () {
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

describe("tier-gate schema parity laws", () => {
  it("round-trips TierGateAuditRecord with schema-owned toolCallId absence", () => {
    const audit = TierGateAuditRecord.make({
      tool: "search_documents",
      outcome: "approved",
      reason: "Tool is not destructive; no approval required.",
      destructive: false,
      occurredAt: "2026-07-01T00:00:00.000Z",
    });

    assert.deepStrictEqual(audit.toolCallId, O.none());
    assert.throws(() =>
      S.decodeUnknownSync(TierGateAuditRecord)({
        tool: "search_documents",
        outcome: "approved",
        reason: "Tool is not destructive; no approval required.",
        destructive: false,
        toolCallId: "",
        occurredAt: "2026-07-01T00:00:00.000Z",
      })
    );
    assertSchemaRoundTrip(TierGateAuditRecord);
  });

  it("round-trips TierGateVerdict and TierGatePolicy from their production schemas", () => {
    assertSchemaRoundTrip(TierGateVerdict);
    assertSchemaRoundTrip(TierGatePolicy);
  });
});
