import { Errors, Protocol } from "@beep/acp";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import type { AcpPatchedProtocol } from "@beep/acp/protocol";

const Input = S.Struct({ input: S.Array(S.Struct({ text: S.String })) });
const start = {
  thread: { id: "owned-thread" },
  model: "gpt-6.1-sol",
  reasoningEffort: "medium",
  approvalPolicy: "never",
  sandbox: { type: "readOnly", networkAccess: false },
};
const main = Effect.scoped(
  Effect.gen(function* () {
    const mode = yield* Config.String("FIXTURE_MODE").pipe(Config.withDefault("echo"));
    let hasTurn = false;
    let count = 0;
    let activeId = "";
    const ready = yield* Deferred.make<AcpPatchedProtocol>();
    const protocol = yield* Protocol.makeAcpPatchedProtocol({
      stdio: yield* Stdio.Stdio,
      serverRequestMethods: HashSet.empty(),
      onExtRequest: Effect.fn("Fixture.onExtRequest")(function* (method, params) {
        if (method === "initialize") return {};
        if (method === "thread/start")
          return mode === "wrong-policy" ? { ...start, approvalPolicy: "on-request" } : start;
        if (method === "thread/resume" && !hasTurn)
          return yield* Errors.AcpRequestError.make({
            code: -32600,
            errorMessage: "no rollout found before first turn",
          });
        if (method === "thread/resume")
          return mode === "wrong-resume" ? { ...start, thread: { id: "foreign-thread" } } : start;
        if (method === "turn/start") {
          hasTurn = true;
          count += 1;
          activeId = `owned-turn-${count}`;
          if (mode === "busy") return { turn: { id: activeId } };
          const input = yield* S.decodeUnknownEffect(Input)(params).pipe(Effect.orDie);
          const transport = yield* Deferred.await(ready);
          yield* transport.notify("item/completed", {
            threadId: "owned-thread",
            turnId: activeId,
            item: { type: "agentMessage", text: input.input[0]?.text ?? "" },
          });
          yield* transport.notify("turn/completed", {
            threadId: "owned-thread",
            turn: { id: activeId, status: "completed" },
          });
          yield* transport.notify("turn/completed", {
            threadId: "owned-thread",
            turn: { id: "stale-turn", status: "interrupted" },
          });
          return { turn: { id: activeId } };
        }
        if (method === "turn/steer" || method === "turn/interrupt") {
          const transport = yield* Deferred.await(ready);
          yield* transport.notify("turn/completed", {
            threadId: "owned-thread",
            turn: { id: "stale-turn", status: "completed" },
          });
          yield* transport.notify("item/completed", {
            threadId: "owned-thread",
            turnId: activeId,
            item: { type: "agentMessage", text: method === "turn/steer" ? "steered" : "interrupted" },
          });
          yield* transport.notify("turn/completed", {
            threadId: "owned-thread",
            turn: { id: activeId, status: method === "turn/steer" ? "completed" : "interrupted" },
          });
          return { turnId: activeId };
        }
        return {};
      }),
    });
    yield* Deferred.succeed(ready, protocol);
    return yield* Effect.never;
  })
);
NodeServices.layer.pipe(
  Layer.build,
  Effect.flatMap((context) => main.pipe(Effect.provide(context))),
  Effect.scoped,
  NodeRuntime.runMain
);
