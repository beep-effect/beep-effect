import { expect, it } from "@effect/vitest";
import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
import type { PrincipalId } from "@proto/kernel/Ids";
import { GrantRef } from "@proto/kernel/Invocation";
import { RunStatus } from "@proto/runs-contract/Run/RunStatus";
import { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { Cast } from "./Cast.ts";
import { Harness, RunsClient, worldOf } from "./RunsWorld.ts";

// The `RunState` query through the runs Api, behind the boundary's `Session`: what the model's
// stories cannot show, the middleware and read-your-own-write. Each run builds a world of its own on
// the live clock, so these run 25 times, not the default 100.
const worldRuns = { arbitrary: { runs: 25 }, timeout: 120_000 };

const asHuman = (principal: PrincipalId) => ({ headers: headersFor(Credential.cases.Human.make({ principal })) });

/** The statuses a run reads as right after its request commits: its grant may or may not be back. */
const justRequested = S.is(RunStatus.pick(["requested", "running"]));

it.live.prop(
  "a person reads their run right after requesting it; someone outside the session and a caller with no credential are refused",
  [Cast],
  ([cast]) => {
    const world = worldOf(cast);
    return world.World.pipe(
      Layer.build,
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const harness = yield* Harness;
          const client = yield* RunsClient;
          const { requester, owner } = cast.principals;
          const { run } = cast.runs;
          yield* harness.grant;
          const receipt = yield* client.RequestRun(
            run,
            {
              session: cast.session,
              purpose: cast.purpose,
              versions: cast.versions,
              allowance: cast.ledger.used + cast.ledger.unused + cast.ledger.free,
              historyBound: A.length(cast.steps),
              source: GrantRef.make({ grant: cast.grant, delegation: O.none() }),
              terms: world.terms,
            },
            asHuman(requester),
          );
          // With the receipt, the read waits for the session to take the requester in.
          const first = yield* client.RunState({ run }, { ...asHuman(requester), atLeast: receipt });
          expect(justRequested(first.status)).toBe(true);
          expect(first.outcome).toEqual(O.none());
          yield* harness.run(run, AgentRunState.guards.Running);
          const running = yield* client.RunState({ run }, asHuman(requester));
          expect(running).toEqual({ status: RunStatus.Enum.running, outcome: O.none() });
          // The org's owner requested no run in the session.
          const outsider = yield* Effect.flip(client.RunState({ run }, asHuman(owner)));
          expect(outsider).toMatchObject({ _tag: "NotInSession" });
          const anonymous = yield* Effect.flip(client.RunState({ run }));
          expect(anonymous).toMatchObject({ _tag: "Unauthorized" });
        }).pipe(Effect.provideContext(context)),
      ),
      Effect.scoped,
    );
  },
  worldRuns,
);
