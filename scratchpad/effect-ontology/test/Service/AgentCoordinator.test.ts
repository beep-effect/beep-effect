import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import type { Agent } from "../../Domain/Model/Agent.ts";
import { AgentId, AgentMetadata } from "../../Domain/Model/Agent.ts";
import { AgentCoordinator, ExecutionPolicy } from "../../Service/Agent/AgentCoordinator.ts";
import { AgentExecutionError, AgentTask } from "../../Service/Agent/types.ts";

const makeFailingAgent = (id: string): Agent<AgentTask, AgentTask, AgentExecutionError> => {
  const agentId = AgentId.make(id);
  return {
    metadata: AgentMetadata.make({
      id: agentId,
      name: `Failing agent ${id}`,
      description: "Fails deterministically for coordinator policy tests.",
      type: "extractor",
    }),
    execute: () =>
      Effect.fail(
        AgentExecutionError.make({
          agentId,
          message: "Expected agent failure",
        })
      ),
    validate: O.none(),
  };
};

describe("AgentCoordinator execution policy", () => {
  it.layer(AgentCoordinator.Default)("sequential failure handling", (it) => {
    it.effect(
      "defaults to fail-fast and preserves an explicit false value",
      Effect.fnUntraced(function* () {
        const coordinator = yield* AgentCoordinator;
        const agent = makeFailingAgent("fail-fast-agent");
        yield* coordinator.register(agent);

        const defaultPolicy = ExecutionPolicy.make({});
        const explicitPolicy = ExecutionPolicy.make({ continueOnError: false });
        assert.isFalse(defaultPolicy.continueOnError);
        assert.isFalse(explicitPolicy.continueOnError);
        assert.isTrue(O.isNone(defaultPolicy.agentTimeout));

        const error = yield* coordinator
          .executeSequential(AgentTask.make({ taskId: "fail-fast-task" }), [agent.metadata.id], {
            continueOnError: false,
          })
          .pipe(Effect.flip);

        assert.strictEqual(error._tag, "PipelineExecutionError");
        assert.strictEqual(error.state.status._tag, "Failed");
      })
    );

    it.effect(
      "continues only when the policy is true without retaining a sentinel output",
      Effect.fnUntraced(function* () {
        const coordinator = yield* AgentCoordinator;
        const agent = makeFailingAgent("continue-agent");
        yield* coordinator.register(agent);

        const result = yield* coordinator.executeSequential(
          AgentTask.make({ taskId: "continue-task" }),
          [agent.metadata.id],
          { continueOnError: true }
        );

        assert.strictEqual(result.state.status._tag, "Completed");
        assert.isTrue(O.isNone(result.state.currentAgentId));
        assert.strictEqual(result.state.completedAgents.length, 0);
        assert.strictEqual(result.state.intermediateResults.length, 0);
      })
    );
  });
});
