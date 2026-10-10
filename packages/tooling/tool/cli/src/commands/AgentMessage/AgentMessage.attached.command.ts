/**
 * Attach durable messaging to an explicitly owned existing T3 thread.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { T3Code, T3CodeConfig } from "@beep/t3-code";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AttachedT3Profile } from "./AgentMessage.attached.schemas.ts";
import { makeAttachedT3Dispatch, verifyAttachedT3 } from "./AgentMessage.attached.service.ts";
import { agentMessageStoreLayer, requirePrivateAgentPath } from "./AgentMessage.layer.ts";
import { EndpointBinding, RouterError } from "./AgentMessage.models.ts";
import { runAgentMessageDispatchLoop } from "./AgentMessage.runtime.ts";
import { EndpointDispatch } from "./AgentMessage.service.ts";
import { AgentMessageStore } from "./AgentMessage.store.ts";

const ProfileJson = S.fromJsonString(AttachedT3Profile);
const BindingJson = S.fromJsonString(EndpointBinding);
const encodeBinding = S.encodeEffect(BindingJson);
const ConfigJson = S.fromJsonString(S.Unknown);
const encodeConfig = S.encodeEffect(ConfigJson);

/**
 * Compose an attached bridge while retaining ownership of the original app.
 * **Details**
 * The profile must be private and declare exclusive host ownership. Live MCP
 * verifies host configuration; the dated native baseline is not re-observed.
 * Cleanup closes this worker only, preserving the app and native conversation.
 * **Example** (Inspect attachment command)
 * ```ts
 * import { agentMessageAttachT3Command } from "@beep/repo-cli/commands/AgentMessage"
 * console.log(agentMessageAttachT3Command.name) // "attach-t3"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const agentMessageAttachT3Command = Command.make(
  "attach-t3",
  {
    stateDir: Flag.String("state-dir"),
    profileFile: Flag.String("profile-file"),
  },
  Effect.fnUntraced(function* ({ stateDir, profileFile }) {
    const fs = yield* FileSystem.FileSystem;
    yield* requirePrivateAgentPath(profileFile, "File");
    const profile = yield* S.decodeEffect(ProfileJson)(yield* fs.readFileString(profileFile));
    const configuration = profile.expectedConfiguration;
    const pinnedModel = profile.provider === "codex" ? "gpt-6.1-sol" : "claude-opus-5-5";
    const effortKey = profile.provider === "codex" ? "reasoningEffort" : "effort";
    if (
      configuration.threadId !== profile.threadId ||
      configuration.modelSelection.model !== pinnedModel ||
      configuration.runtimeMode !== "full-access" ||
      configuration.interactionMode !== "default" ||
      !A.some(
        configuration.modelSelection.options ?? [],
        (option) => option.id === effortKey && option.value === "medium"
      )
    ) {
      return yield* RouterError.make({
        code: "policyMismatch",
        message:
          "Attached T3 declaration must pin the approved provider/model/medium effort and full-access/default host configuration.",
      });
    }
    yield* requirePrivateAgentPath(profile.oauthCredentialFile, "File");
    yield* requirePrivateAgentPath(profile.grantFile, "File");
    yield* requirePrivateAgentPath(profile.peerExecutable, "File");
    const bearer = Redacted.make(Str.trim(yield* fs.readFileString(profile.oauthCredentialFile)));
    const connection = T3Code.layer(T3CodeConfig.make({ url: profile.url, bearer, timeoutMs: 30000 }));
    return yield* Effect.gen(function* () {
      const connectionContext = yield* Layer.build(connection);
      return yield* Effect.gen(function* () {
        yield* verifyAttachedT3(profile, true);
        const policyFingerprint = yield* sha256Hex(
          yield* encodeConfig({
            configuration,
            sourceCommit: profile.sourceCommit,
            serverVersion: profile.serverVersion,
            artifactDigest: profile.artifactDigest,
          })
        );
        const binding = yield* S.decodeEffect(EndpointBinding)({
          endpointId: profile.endpointId,
          participantId: profile.participantId,
          sessionId: profile.threadId,
          ownerId: profile.ownerId,
          generation: profile.generation,
          repositoryScope: profile.repositoryScope,
          execution: { workspace: yield* fs.realPath(profile.workspace) },
          host: { mode: "native-app", provider: profile.provider, backend: "t3-legacy-mcp-attached", appId: "t3-code" },
          capabilityFingerprint: "t3-attached-queued-ack/v1",
          policyFingerprint,
          supported: true,
          capabilityEvidence: [
            {
              capability: "send",
              disposition: "advertised",
              source:
                "Owned T3 host configuration read; queue ACK and exact terminal proof remain required. Native identity/policy baseline is a separate dated attestation.",
              observedAt: yield* Clock.currentTimeMillis,
            },
          ],
          policy: {
            provider: profile.provider,
            modelId: pinnedModel,
            effort: "medium",
            sandbox: "t3-host/full-access; native-baseline-only",
            approvalPolicy: "t3-host-reported; native-baseline-only",
            fingerprint: policyFingerprint,
            policyEvidence: "effective-reported",
          },
        });
        const store = yield* AgentMessageStore;
        yield* store.register(binding);
        const dispatch = yield* makeAttachedT3Dispatch(profile, stateDir);
        yield* Console.log(yield* encodeBinding(binding));
        return yield* runAgentMessageDispatchLoop(profile.endpointId, profile.ownerId).pipe(
          Effect.provideService(EndpointDispatch, dispatch)
        );
      }).pipe(Effect.provide(connectionContext));
    }).pipe(Effect.scoped);
  })
).pipe(
  Command.provide(({ stateDir }) => agentMessageStoreLayer(stateDir)),
  Command.withDescription("Attach to one owned T3 thread; queue-only, no native child ownership or automatic replay")
);
