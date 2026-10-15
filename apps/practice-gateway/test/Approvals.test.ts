import { Remediation, SetupRequirement } from "@beep/law-practice-domain";
import { SetupApprovals } from "@beep/law-practice-use-cases/PracticeSetup";
import { approvalMessage, ElicitedApprovals } from "@beep/practice-gateway/Approvals";
import { requirementFromCatalog } from "@beep/practice-gateway/Requirements";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as McpSchema from "effect/ai/McpSchema";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const boxInstall = requirementFromCatalog("box-drive-installed", "documents");
const clientInfo = { name: "approvals-test-client", version: "0.0.0" };

const decodeElicitResult = S.decodeUnknownEffect(McpSchema.ElicitResult);
const decodeInitialize = S.decodeUnknownEffect(McpSchema.Initialize.payloadSchema);
const decodeCapabilities = S.decodeUnknownEffect(McpSchema.ClientCapabilities);

// A client session whose elicitation prompt answers with `answer`.
const clientAnswering = Effect.fnUntraced(function* (answer: unknown, capabilities: unknown) {
  const result = yield* decodeElicitResult(answer);
  const clientCapabilities = yield* decodeCapabilities(capabilities);
  const initializePayload = yield* decodeInitialize({ capabilities, clientInfo, protocolVersion: "2025-06-18" });
  return McpSchema.McpServerClient.of({
    clientId: 1,
    protocolVersion: "2025-06-18",
    clientCapabilities,
    clientInfo,
    initializePayload,
    getClient: Effect.succeed({
      listRoots: () => Effect.die("listRoots is not used"),
      createMessage: () => Effect.die("createMessage is not used"),
      elicit: () => Effect.succeed(result),
    }),
  });
});

const approve = SetupApprovals.use((approvals) => approvals.approveRepair(boxInstall)).pipe(
  provideScopedLayer(ElicitedApprovals)
);

const approveWith = Effect.fnUntraced(function* (answer: unknown, capabilities: unknown = { elicitation: {} }) {
  const client = yield* clientAnswering(answer, capabilities);
  return yield* approve.pipe(Effect.provideService(McpSchema.McpServerClient, client));
});

describe("ElicitedApprovals", () => {
  it.effect("approves when the lawyer accepts with approve checked", () =>
    Effect.gen(function* () {
      expect(yield* approveWith({ action: "accept", content: { approve: true } })).toBe("approved");
    })
  );

  it.effect("declines an unchecked accept, a decline and a cancel", () =>
    Effect.gen(function* () {
      expect(yield* approveWith({ action: "accept", content: { approve: false } })).toBe("declined");
      expect(yield* approveWith({ action: "decline" })).toBe("declined");
      expect(yield* approveWith({ action: "cancel" })).toBe("declined");
    })
  );

  it.effect("declines without prompting when the client lacks elicitation or no client exists", () =>
    Effect.gen(function* () {
      expect(yield* approveWith({ action: "accept", content: { approve: true } }, {})).toBe("declined");
      expect(yield* approve).toBe("declined");
    })
  );

  it.prop(
    "always shows the remediation text and the reason",
    { requirement: Arbitrary.schema(SetupRequirement) },
    ({ requirement }) => {
      const message = approvalMessage(requirement);
      const text = Remediation.guards.automatic(requirement.remediation)
        ? requirement.remediation.summary
        : requirement.remediation.instruction;
      assertTrue(Str.startsWith(text)(message));
      assertTrue(F.pipe(message, Str.includes(`Why: ${requirement.explain}`)));
    },
    { arbitrary: fcRuns(50) }
  );

  it("shows the repair summary and the reason", () => {
    const message = approvalMessage(boxInstall);
    expect(message).toContain("Install Box Drive for your Windows account.");
    expect(message).toContain("Why: Box Drive puts your Box documents in a folder Claude can read.");
  });
});
