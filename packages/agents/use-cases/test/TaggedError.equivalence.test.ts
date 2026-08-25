import {
  ChatActionError,
  ProfessionalRuntimePromotionBlocked,
  ProfessionalRuntimeValidationError,
  ProviderInstanceNotFound,
  ProviderProbeUnavailable,
  ProviderUnauthenticated,
  TurnGenerationError,
} from "@beep/agents-use-cases/public";
import { BlockRepairFailed } from "@beep/agents-use-cases/server";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { PromotionBlockReason, PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("agents use-case tagged-error declared equivalence", () => {
  it("compares ProviderInstanceNotFound by declared fields", () => {
    const same = S.toEquivalence(ProviderInstanceNotFound);
    const first = ProviderInstanceNotFound.make({ providerInstanceId: Agents.ProviderInstanceId.make(1) });
    const second = ProviderInstanceNotFound.make({ providerInstanceId: Agents.ProviderInstanceId.make(1) });
    const different = ProviderInstanceNotFound.make({ providerInstanceId: Agents.ProviderInstanceId.make(2) });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ProviderUnauthenticated by declared fields", () => {
    const same = S.toEquivalence(ProviderUnauthenticated);
    const first = ProviderUnauthenticated.make({
      providerInstanceId: Agents.ProviderInstanceId.make(1),
      guidance: "Log in and retry.",
    });
    const second = ProviderUnauthenticated.make({
      providerInstanceId: Agents.ProviderInstanceId.make(1),
      guidance: "Log in and retry.",
    });
    const different = ProviderUnauthenticated.make({
      providerInstanceId: Agents.ProviderInstanceId.make(1),
      guidance: "Refresh credentials and retry.",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ProviderProbeUnavailable by declared fields", () => {
    const same = S.toEquivalence(ProviderProbeUnavailable);
    const first = ProviderProbeUnavailable.make({ guidance: "Retry the provider probe." });
    const second = ProviderProbeUnavailable.make({ guidance: "Retry the provider probe." });
    const different = ProviderProbeUnavailable.make({ guidance: "Restart the provider probe." });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares TurnGenerationError by declared fields", () => {
    const same = S.toEquivalence(TurnGenerationError);
    const first = TurnGenerationError.new("Turn generation failed.");
    const second = TurnGenerationError.new("Turn generation failed.");
    const different = TurnGenerationError.new("Turn generation timed out.");

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares BlockRepairFailed by declared fields", () => {
    const same = S.toEquivalence(BlockRepairFailed);
    const first = BlockRepairFailed.new("Block repair failed.");
    const second = BlockRepairFailed.new("Block repair failed.");
    const different = BlockRepairFailed.new("Block repair timed out.");

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ChatActionError by declared fields", () => {
    const same = S.toEquivalence(ChatActionError);
    const first = ChatActionError.new("Chat action failed.");
    const second = ChatActionError.new("Chat action failed.");
    const different = ChatActionError.new("Chat action was rejected.");

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ProfessionalRuntimeValidationError by declared fields", () => {
    const same = S.toEquivalence(ProfessionalRuntimeValidationError);
    const first = ProfessionalRuntimeValidationError.new("Runtime request is invalid.");
    const second = ProfessionalRuntimeValidationError.new("Runtime request is invalid.");
    const different = ProfessionalRuntimeValidationError.new("Runtime proposal is invalid.");

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares ProfessionalRuntimePromotionBlocked by declared fields", () => {
    const same = S.toEquivalence(ProfessionalRuntimePromotionBlocked);
    const makeSubject = () => PromotionSubjectRef.make({ id: "subject-1", kind: "matter" });
    const first = ProfessionalRuntimePromotionBlocked.make({
      reason: PromotionBlockReason.make("vertical-policy-blocked"),
      subject: makeSubject(),
    });
    const second = ProfessionalRuntimePromotionBlocked.make({
      reason: PromotionBlockReason.make("vertical-policy-blocked"),
      subject: makeSubject(),
    });
    const different = ProfessionalRuntimePromotionBlocked.make({
      reason: PromotionBlockReason.make("vertical-policy-revision-required"),
      subject: makeSubject(),
    });

    expectDeclaredEquivalence(same, first, second, different);
  });
});
