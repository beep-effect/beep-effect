/**
 * `SetupApprovals` for the gateway: the lawyer approves each automatic
 * repair in an MCP elicitation prompt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import { Remediation } from "@beep/law-practice-domain";
import { makeSetupApprovals, RepairDecision, SetupApprovals } from "@beep/law-practice-use-cases/PracticeSetup";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { SetupRequirement } from "@beep/law-practice-domain";

const $I = $PracticeGatewayId.create("Approvals");

/**
 * The lawyer's answer in the approval prompt.
 *
 * **Example** (An approving answer)
 *
 * ```ts
 * import { RepairApprovalAnswer } from "@beep/practice-gateway/Approvals"
 *
 * console.log(RepairApprovalAnswer.make({ approve: true }).approve) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RepairApprovalAnswer extends S.Opaque<RepairApprovalAnswer, { readonly brand: unique symbol }>()(
  S.Struct({
    approve: S.Boolean.annotateKey({
      title: "Approve this change",
      description: "Check the box to let the practice gateway make this change.",
    }),
  }).pipe(
    $I.annoteSchema("RepairApprovalAnswer", {
      description: "The lawyer's yes/no answer to a repair approval prompt.",
    })
  )
) {}

/**
 * How long the gateway waits for an answer before treating the prompt as
 * declined.
 *
 * **Example** (Read the timeout)
 *
 * ```ts
 * import { APPROVAL_TIMEOUT } from "@beep/practice-gateway/Approvals"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(APPROVAL_TIMEOUT)) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const APPROVAL_TIMEOUT = Duration.minutes(10);

/**
 * The plain-language prompt shown for one repair.
 *
 * **Example** (Prompt for a Box Drive install)
 *
 * ```ts
 * import { AutomaticRemediation, SetupRequirement, SetupRequirementId } from "@beep/law-practice-domain"
 * import { approvalMessage } from "@beep/practice-gateway/Approvals"
 *
 * const requirement = SetupRequirement.make({
 *   id: SetupRequirementId.make("box-drive-installed"),
 *   capability: "documents",
 *   provider: "box-drive",
 *   dependsOn: [],
 *   remediation: AutomaticRemediation.make({ summary: "Install Box Drive for your Windows account." }),
 *   explain: "Box Drive puts your Box documents in a folder Claude can read.",
 * })
 * console.log(approvalMessage(requirement))
 * ```
 *
 * @param requirement - The requirement whose repair needs approval.
 * @category utilities
 * @since 0.0.0
 */
export const approvalMessage = (requirement: SetupRequirement): string => {
  const summary = Remediation.guards.automatic(requirement.remediation)
    ? requirement.remediation.summary
    : requirement.remediation.instruction;
  return `${summary}\n\nWhy: ${requirement.explain}\n\nShould the practice gateway make this change now?`;
};

const declined = Effect.succeed(RepairDecision.Enum.declined);

const ask = (client: McpSchema.McpServerClient["Service"], requirement: SetupRequirement) =>
  McpServer.elicit({ message: approvalMessage(requirement), schema: RepairApprovalAnswer }).pipe(
    Effect.map((answer) => (answer.approve ? RepairDecision.Enum.approved : RepairDecision.Enum.declined)),
    Effect.provideService(McpSchema.McpServerClient, client),
    Effect.timeoutOption(APPROVAL_TIMEOUT),
    Effect.map(O.getOrElse(() => RepairDecision.Enum.declined)),
    // Declined, cancelled (an interrupt from `elicit`), failed or malformed
    // answers all leave the machine unchanged.
    Effect.catchCause(() => declined)
  );

/**
 * Ask for approval through MCP elicitation, failing closed.
 *
 * **Details**
 *
 * Outside an MCP request (the `--self-check` command line), on a protocol
 * without a client session, or with a client that does not advertise
 * elicitation, the answer is `declined` without prompting. A declined,
 * cancelled or timed-out prompt is also `declined`. Host support for
 * elicitation in Claude Desktop and Claude Code is unverified (see
 * `goals/practice-gateway/history/p1/gateway-tools.md`).
 *
 * **Example** (Compose the approvals)
 *
 * ```ts
 * import { ElicitedApprovals } from "@beep/practice-gateway/Approvals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ElicitedApprovals))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ElicitedApprovals = Layer.succeed(
  SetupApprovals,
  makeSetupApprovals((requirement) =>
    Effect.serviceOption(McpSchema.McpServerClient).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => declined,
          onSome: (client) =>
            P.isNotUndefined(client.clientCapabilities.elicitation) ? ask(client, requirement) : declined,
        })
      ),
      Effect.withSpan("PracticeGateway.approveRepair", { attributes: { requirement: requirement.id } })
    )
  )
);
