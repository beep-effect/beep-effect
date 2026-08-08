/**
 * Package entry point for `@beep/architecture-lab-proof`.
 *
 * @packageDocumentation
 * @category workflows
 * @since 0.0.0
 */

import { defaultWorkItemPublicConfig } from "@beep/architecture-lab-config/public";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import { WorkItemServer } from "@beep/architecture-lab-server/aggregates/WorkItem";
import { toWorkItemSummaryViewModel, WorkItemSummaryViewModel } from "@beep/architecture-lab-ui/aggregates/WorkItem";
import { WorkItem as WorkItemUseCases } from "@beep/architecture-lab-use-cases/public";
import { $ArchitectureLabProofId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $ArchitectureLabProofId.create("index");
const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);

/**
 * App-level WorkItem proof result.
 *
 * **Example** (Logging the AST property)
 *
 * ```ts
 * import { ArchitectureLabProofResult } from "@beep/architecture-lab-proof"
 *
 * console.log(ArchitectureLabProofResult.ast)
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export class ArchitectureLabProofResult extends S.Class<ArchitectureLabProofResult>($I`ArchitectureLabProofResult`)(
  {
    created: DomainWorkItem.WorkItem,
    summary: WorkItemSummaryViewModel,
  },
  $I.annote("ArchitectureLabProofResult", {
    title: "Architecture lab proof result",
    description: "Result produced by the architecture lab app contract harness.",
  })
) {}

/**
 * Execute the architecture lab proof harness against the composed server layer.
 *
 * **Example** (Logging the proof runner)
 *
 * ```ts
 * import { runArchitectureLabProof } from "@beep/architecture-lab-proof"
 *
 * console.log(runArchitectureLabProof)
 * ```
 *
 * @effects Requires `WorkItemServer`, creates one proof WorkItem, and projects it to a summary view model.
 * @category workflows
 * @since 0.0.0
 */
export const runArchitectureLabProof: Effect.Effect<
  ArchitectureLabProofResult,
  WorkItemUseCases.WorkItemActionError,
  WorkItemServer
> = Effect.gen(function* () {
  const server = yield* WorkItemServer;
  const id = yield* decodeWorkItemId("architecture-lab-proof-1").pipe(Effect.orDie);
  const created = yield* server.create(
    WorkItemUseCases.CreateWorkItemCommand.make({
      id,
      title: "Prove canonical slice topology",
    })
  );
  return ArchitectureLabProofResult.make({
    created,
    summary: toWorkItemSummaryViewModel(created, defaultWorkItemPublicConfig),
  });
});
