import { Remediation, SetupRequirement } from "@beep/law-practice-domain";
import { SetupApprovals } from "@beep/law-practice-use-cases/PracticeSetup";
import { approvalMessage, ElicitedApprovals, GatewayApprovals } from "@beep/practice-gateway/Approvals";
import { requirementFromCatalog } from "@beep/practice-gateway/Requirements";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as McpSchema from "effect/ai/McpSchema";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeHost } from "./fixtures.ts";

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
      const approveWith1 = yield* approveWith({ action: "accept", content: { approve: true } });
      expect(approveWith1).toBe("approved");
    })
  );

  it.effect("declines an unchecked accept, a decline and a cancel", () =>
    Effect.gen(function* () {
      const approveWith2 = yield* approveWith({ action: "accept", content: { approve: false } });
      expect(approveWith2).toBe("declined");
      const approveWith3 = yield* approveWith({ action: "decline" });
      expect(approveWith3).toBe("declined");
      const approveWith4 = yield* approveWith({ action: "cancel" });
      expect(approveWith4).toBe("declined");
    })
  );

  it.effect("declines without prompting when the client lacks elicitation or no client exists", () =>
    Effect.gen(function* () {
      const approveWith5 = yield* approveWith({ action: "accept", content: { approve: true } }, {});
      expect(approveWith5).toBe("declined");
      const approve6 = yield* approve;
      expect(approve6).toBe("declined");
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

// The gateway's approvals on a fake Windows host whose dialog answers Yes or No.
const gatewayApprove = (machine: { readonly answersYes: boolean; readonly isWindows?: boolean }) =>
  SetupApprovals.use((approvals) => approvals.approveRepair(boxInstall)).pipe(
    provideScopedLayer(GatewayApprovals.pipe(Layer.provide(fakeHost(machine))))
  );

const gatewayApproveWith = Effect.fnUntraced(function* (
  machine: { readonly answersYes: boolean; readonly isWindows?: boolean },
  capabilities: unknown
) {
  const client = yield* clientAnswering({ action: "decline" }, capabilities);
  return yield* gatewayApprove(machine).pipe(Effect.provideService(McpSchema.McpServerClient, client));
});

describe("GatewayApprovals", () => {
  it.effect("asks in a Windows dialog when the client cannot elicit", () =>
    Effect.gen(function* () {
      const gatewayApproveWith7 = yield* gatewayApproveWith({ answersYes: true }, {});
      expect(gatewayApproveWith7).toBe("approved");
      const gatewayApproveWith8 = yield* gatewayApproveWith({ answersYes: false }, {});
      expect(gatewayApproveWith8).toBe("declined");
    })
  );

  it.effect("prefers elicitation when the client supports it", () =>
    Effect.gen(function* () {
      // The fake client declines the elicitation; the Yes dialog is never consulted.
      const gatewayApproveWith9 = yield* gatewayApproveWith({ answersYes: true }, { elicitation: {} });
      expect(gatewayApproveWith9).toBe("declined");
    })
  );

  it.effect("declines off Windows and outside an MCP call without asking", () =>
    Effect.gen(function* () {
      const gatewayApproveWith10 = yield* gatewayApproveWith({ answersYes: true, isWindows: false }, {});
      expect(gatewayApproveWith10).toBe("declined");
      const gatewayApprove11 = yield* gatewayApprove({ answersYes: true });
      expect(gatewayApprove11).toBe("declined");
    })
  );
});
