import {
  OpenclawAgentTurn,
  OpenclawChannelAccountStatus,
  OpenclawLiveAcceptanceInput,
  OpenclawLocalModelEntry,
  OpenclawLocalModels,
  OpenclawSecretsReloaded,
  OpenclawSkillInventory,
  OpenclawSkillInventoryEntry,
  OpenclawTelegramSendPayload,
  OpenclawTelegramSendResult,
} from "@beep/openclaw/Openclaw.models";
import { coordinateOpenclawLiveAcceptance, probeOpenclawLocalModels } from "@beep/openclaw/OpenclawProbe.service";
import { NonNegativeInt } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const validInput = OpenclawLiveAcceptanceInput.make({
  channelAccounts: [
    OpenclawChannelAccountStatus.make({
      accountId: "default",
      configured: true,
      enabled: true,
      probeOk: O.some(true),
      running: true,
    }),
  ],
  hostedModelId: "hosted-model",
  hostedProviderId: "hosted",
  hostedTurn: OpenclawAgentTurn.make({
    aborted: O.some(false),
    model: O.some("hosted-model"),
    provider: O.some("hosted"),
    runId: O.some("synthetic-run-id"),
    status: "ok",
    stopReason: O.some("stop"),
    text: O.some("P3_MODEL_OK"),
  }),
  localModelId: "local-model",
  localModels: OpenclawLocalModels.make({
    data: [OpenclawLocalModelEntry.make({ id: "local-model" })],
  }),
  restoredReload: OpenclawSecretsReloaded.make({
    _tag: "Reloaded",
    warningCount: NonNegativeInt.make(0),
  }),
  skillInventory: OpenclawSkillInventory.make({
    skills: [
      OpenclawSkillInventoryEntry.make({
        description: "Return one fixed synthetic sentinel for the P3 declarative-skill proof.",
        eligible: true,
        name: "beep-proof-ping",
        source: "openclaw-workspace",
      }),
    ],
    workspaceDir: "/etc/beep/openclaw/current/workspace",
  }),
  skillTurn: OpenclawAgentTurn.make({
    status: "ok",
    text: O.some("P3_SKILL_OK"),
  }),
  telegramSend: OpenclawTelegramSendResult.make({
    action: "send",
    channel: "telegram",
    dryRun: false,
    handledBy: "plugin",
    messageId: "synthetic-message-id",
    payload: OpenclawTelegramSendPayload.make({
      messageId: "synthetic-message-id",
      ok: true,
    }),
  }),
});

describe("@beep/openclaw live acceptance probes", () => {
  it("passes only when every decoded acceptance assertion is satisfied", () => {
    expect(coordinateOpenclawLiveAcceptance(validInput)._tag).toBe("Passed");
    expect(
      coordinateOpenclawLiveAcceptance(
        OpenclawLiveAcceptanceInput.make({
          ...validInput,
          skillTurn: OpenclawAgentTurn.make({ status: "ok", text: O.some("wrong") }),
        })
      )
    ).toMatchObject({ _tag: "Failed", step: "skill" });
  });

  it.effect("decodes local /models and fails closed when the configured model is absent", () => {
    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response('{"data":[{"id":"local-model"}]}', {
            headers: { "content-type": "application/json" },
          })
        )
      )
    );
    return Effect.all([
      probeOpenclawLocalModels({
        baseUrl: "http://127.0.0.1:11434/v1",
        modelId: "local-model",
      }),
      probeOpenclawLocalModels({
        baseUrl: "http://127.0.0.1:11434/v1",
        modelId: "missing",
      }),
    ]).pipe(
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.tap(([present, missing]) =>
        Effect.sync(() => {
          expect(present._tag).toBe("Passed");
          expect(missing).toMatchObject({ _tag: "Failed", step: "local-model" });
        })
      )
    );
  });
  it.prop(
    "rejects each invalid acceptance component independently",
    {
      suffix: Arbitrary.schema(S.NonEmptyString),
      warningCount: Arbitrary.schema(NonNegativeInt.check(S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(100))),
    },
    ({ suffix, warningCount }) => {
      expect(coordinateOpenclawLiveAcceptance(validInput)._tag).toBe("Passed");
      expect(
        coordinateOpenclawLiveAcceptance(
          OpenclawLiveAcceptanceInput.make({
            ...validInput,
            hostedTurn: OpenclawAgentTurn.make({ ...validInput.hostedTurn, provider: O.some(`wrong-${suffix}`) }),
          })
        ),
        "hosted provider mismatch"
      ).toMatchObject({ _tag: "Failed", step: "hosted-model" });
      expect(
        coordinateOpenclawLiveAcceptance(
          OpenclawLiveAcceptanceInput.make({
            ...validInput,
            localModelId: `missing-${suffix}`,
          })
        ),
        "local model absent"
      ).toMatchObject({ _tag: "Failed", step: "local-model" });
      expect(
        coordinateOpenclawLiveAcceptance(
          OpenclawLiveAcceptanceInput.make({
            ...validInput,
            skillTurn: OpenclawAgentTurn.make({ ...validInput.skillTurn, text: O.some(`wrong-${suffix}`) }),
          })
        ),
        "skill sentinel mismatch"
      ).toMatchObject({ _tag: "Failed", step: "skill" });
      expect(
        coordinateOpenclawLiveAcceptance(
          OpenclawLiveAcceptanceInput.make({
            ...validInput,
            restoredReload: OpenclawSecretsReloaded.make({ warningCount }),
          })
        ),
        "reload warnings"
      ).toMatchObject({ _tag: "Failed", step: "reload" });
      expect(
        coordinateOpenclawLiveAcceptance(
          OpenclawLiveAcceptanceInput.make({
            ...validInput,
            channelAccounts: [
              OpenclawChannelAccountStatus.make({
                ...O.getOrThrow(A.head(validInput.channelAccounts)),
                probeOk: O.some(false),
              }),
            ],
          })
        ),
        "telegram probe rejected"
      ).toMatchObject({ _tag: "Failed", step: "telegram" });
    },
    { arbitrary: fcRuns(50) }
  );
});
