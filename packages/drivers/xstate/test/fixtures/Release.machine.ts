import { fromEffect, setupEffect } from "@xstate/effect";
import { Context, Effect } from "effect";
import * as S from "effect/Schema";

export class Deployments extends Context.Service<
  Deployments,
  { readonly deploy: (release: string) => Effect.Effect<string, Error> }
>()("@beep/xstate/test/fixtures/Release.machine/Deployments") {}

export const ReleaseInput = S.Struct({ release: S.NonEmptyString });
export const ReleaseEvents = {
  APPROVE: S.Struct({ reviewer: S.NonEmptyString }),
  CANCEL: S.Struct({}),
  RETRY: S.Struct({}),
};

const deploy = fromEffect({
  schemas: { input: ReleaseInput },
  effect: ({ input }) => Deployments.use((api) => api.deploy(input.release)),
});

export const releaseMachine = setupEffect({
  schemas: {
    input: ReleaseInput,
    events: ReleaseEvents,
    emitted: { approved: S.Struct({ reviewer: S.NonEmptyString }) },
  },
  actors: { deploy },
}).createMachine({
  id: "release",
  context: ({ input }) => ({ release: input.release, reviewer: "", url: "" }),
  initial: "awaitingApproval",
  states: {
    awaitingApproval: {
      after: { 30000: { target: "expired" } },
      on: {
        APPROVE: ({ context, event }, enq) => {
          enq.emit({ type: "approved", reviewer: event.reviewer });
          return { target: "deploying", context: { ...context, reviewer: event.reviewer } };
        },
        CANCEL: { target: "cancelled" },
      },
    },
    deploying: {
      invoke: {
        src: "deploy",
        input: ({ context }) => ({ release: context.release }),
        onDone: ({ context, event }) => ({ target: "deployed", context: { ...context, url: event.output } }),
        onError: { target: "failed" },
      },
      on: { CANCEL: { target: "cancelled" } },
    },
    failed: { on: { RETRY: { target: "deploying" }, CANCEL: { target: "cancelled" } } },
    deployed: { type: "final" },
    expired: { type: "final" },
    cancelled: { type: "final" },
  },
});

export const deploymentsSucceeding = Deployments.of({
  deploy: Effect.fn("Deployments.deploy")((release: string) => Effect.succeed(`https://releases.example/${release}`)),
});
