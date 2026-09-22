import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ReadRolloutCapabilities,
  ReadRolloutConsumerObservability,
  ShortTermLifecycleRunResponse,
} from "../../beep/MemoryAdmin.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const capabilities = {
  legacyOnly: false,
  shadowArtifactsEnabled: true,
  memoryWritesEnabled: true,
  memoryReadsEnabled: true,
  legacyReadsAuthoritative: false,
};

describe("MemoryAdmin", () => {
  it("decodes capability flags and a consumer report", () => {
    const flags = decode(ReadRolloutCapabilities, capabilities);
    assert.strictEqual(flags.memoryReadsEnabled, true);
    const report = decode(ReadRolloutConsumerObservability, {
      consumer: "custom-consumer",
      enabled: true,
      reason: "grant",
      readDecision: "USE_MEMORY",
      mode: "read",
      memoryReadsEnabled: true,
      legacyReadsAuthoritative: false,
      defaultMemoryGrant: true,
      archiveDefaultVisible: false,
      archiveCapability: true,
      fallbackReason: null,
      capabilities,
    });
    assert.strictEqual(report.consumer, "custom-consumer");
    assert.strictEqual(report.readDecision, "USE_MEMORY");
    assert.strictEqual(O.isNone(report.fallbackReason), true);
    assert.strictEqual(report.capabilities.legacyOnly, false);
  });

  it("decodes a missing fallback reason as None", () => {
    const report = decode(ReadRolloutConsumerObservability, {
      consumer: "mcp",
      enabled: false,
      reason: "off",
      readDecision: "DENY_MEMORY",
      mode: "legacy",
      memoryReadsEnabled: false,
      legacyReadsAuthoritative: true,
      defaultMemoryGrant: false,
      archiveDefaultVisible: true,
      archiveCapability: false,
      capabilities,
    });
    assert.strictEqual(O.isNone(report.fallbackReason), true);
    assert.strictEqual(report.archiveDefaultVisible, true);
  });

  it("decodes a short-term lifecycle report with a string clock and an empty skip list", () => {
    const decoded = decode(ShortTermLifecycleRunResponse, {
      uid: "user-1",
      runId: "run-1",
      evaluatedAt: "2020-01-02T03:04:05.000Z",
      evaluatedCount: 2,
      createdCount: 1,
      existingCount: 0,
      skippedCount: 1,
      transitionCount: 1,
      skippedMemoryIds: ["mem-1"],
      defaultAccessAllowed: false,
      archiveDefaultVisible: false,
    });
    assert.strictEqual(decoded.evaluatedAt, "2020-01-02T03:04:05.000Z");
    assert.strictEqual(decoded.skippedMemoryIds[0], "mem-1");
    assert.strictEqual(decoded.transitionCount, 1);
  });

  it("derives an arbitrary for every exported model", () => {
    const schemas = [ReadRolloutCapabilities, ReadRolloutConsumerObservability, ShortTermLifecycleRunResponse];
    A.forEach(schemas, (schema) => {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    });
  });
});
