/**
 * Law claim MCP tools: the agent surface that proposes claims and never admits
 * them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LawProposedClaimRecord } from "@beep/law-practice-domain/values/LawClaim";
import { dispatchWithTierGate, TierGate, TierGateDispatchResult } from "@beep/mcp-kit/TierGate";
import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit/ToolAnnotations";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ClaimProposalRefused } from "./ClaimProposal.errors.ts";
import { ClaimProposal } from "./ClaimProposal.ports.ts";
import { ClaimProposalRequest } from "./ClaimProposal.values.ts";
import type * as Layer from "effect/Layer";

const $I = $LawPracticeUseCasesId.create("ClaimProposal/ClaimProposal.tools");

/**
 * The tier gate refused the tool call before it ran.
 *
 * **Example** (Refuse an unapproved call)
 *
 * ```ts
 * import { ClaimToolGateRefused } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * const refused = ClaimToolGateRefused.make({ reason: "Tool is not marked read-only; approval required." })
 * console.log(refused._tag) // "TierGateRefused"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClaimToolGateRefused = S.TaggedStruct("TierGateRefused", { reason: S.String }).pipe(
  $I.annoteSchema("ClaimToolGateRefused", { description: "The tier gate refused the tool call before it ran." })
);

/**
 * Type of {@link ClaimToolGateRefused}.
 *
 * @category errors
 * @since 0.0.0
 */
export type ClaimToolGateRefused = typeof ClaimToolGateRefused.Type;

/**
 * Why `claim_propose` wrote nothing: a proposal refusal or the tier gate's.
 *
 * **Example** (Check a refusal)
 *
 * ```ts
 * import { ClaimProposeFailure } from "@beep/law-practice-use-cases/ClaimProposal"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimProposeFailure)({ _tag: "DeniedScope" })) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClaimProposeFailure = S.Union([ClaimProposalRefused, ClaimToolGateRefused]).pipe(
  $I.annoteSchema("ClaimProposeFailure", { description: "Why claim_propose wrote no proposed record." })
);

/**
 * Type of {@link ClaimProposeFailure}.
 *
 * @category errors
 * @since 0.0.0
 */
export type ClaimProposeFailure = typeof ClaimProposeFailure.Type;

const proposeHints = FourHintAnnotations.make({
  destructive: false,
  idempotent: true,
  openWorld: false,
  readOnly: false,
});

/**
 * Proposes one distinction claim from verified annotations and returns the
 * proposed record.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { ClaimProposeTool } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * console.log(ClaimProposeTool.name) // "claim_propose"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ClaimProposeTool = annotateFourHints(
  Tool.make("claim_propose", {
    description:
      "Propose one distinction claim from candidate annotations of a verified annotation document. Returns the proposed record; a repeated identical request returns the stored record. Never admits a claim.",
    failure: ClaimProposeFailure,
    failureMode: "return",
    parameters: ClaimProposalRequest,
    success: LawProposedClaimRecord,
  }).annotate(Tool.Strict, true),
  proposeHints
);

/**
 * The law claim toolkit.
 *
 * **Details**
 *
 * `claim_propose` is a write tool: it is not read-only, so the tier gate
 * dispatches it only with an approval. Its success schema is the proposed
 * record, which has no admitted case.
 *
 * **Example** (List the tool names)
 *
 * ```ts
 * import { LawClaimToolkit } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * console.log(Object.keys(LawClaimToolkit.tools)) // ["claim_propose"]
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const LawClaimToolkit = Toolkit.make(ClaimProposeTool);

/**
 * The law claim toolkit's handlers over the tier gate and the proposal
 * service.
 *
 * **Details**
 *
 * Every call dispatches through the tier gate; a refusal returns
 * `TierGateRefused` and runs nothing. The layer requires no admission port.
 *
 * **Example** (Reference the handler layer)
 *
 * ```ts
 * import { LawClaimToolkitLayer } from "@beep/law-practice-use-cases/ClaimProposal"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(LawClaimToolkitLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LawClaimToolkitLayer: Layer.Layer<
  Tool.HandlersFor<typeof LawClaimToolkit.tools>,
  never,
  TierGate | ClaimProposal
> = LawClaimToolkit.toLayer(
  Effect.gen(function* () {
    const gate = yield* TierGate;
    const proposal = yield* ClaimProposal;
    return LawClaimToolkit.of({
      claim_propose: Effect.fn("LawClaimToolkit.claim_propose")(function* (request) {
        const dispatch = yield* dispatchWithTierGate(
          { tool: ClaimProposeTool, toolCallId: O.none() },
          proposal.propose(request)
        ).pipe(Effect.provideService(TierGate, gate));
        return yield* TierGateDispatchResult.$match(dispatch, {
          Dispatched: ({ value }) => Effect.succeed(value),
          Refused: ({ audit }) => Effect.fail(ClaimToolGateRefused.make({ reason: audit.reason })),
        });
      }),
    });
  })
);
