import * as NodeServices from "@effect/platform-node/NodeServices";
import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { ContinuationOpened } from "@proto/runs-contract/Run/OpenContinuation.command";
import { RunContinued, StepRecorded } from "@proto/runs-contract/Run/RecordStep.command";
import { RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { BudgetReserved, ReserveBudget } from "@proto/runs-contract/Run/ReserveBudget.command";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import { UsageSettled } from "@proto/runs-contract/Run/SettleUsage.command";
import { Authority } from "@proto/runs-model/Authority.external";
import { AgentRun, StoredAgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import { SessionRuns } from "@proto/runs-model/Run/SessionRuns.view";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

// Stored as phase 2 wrote them (test/stored/*.json): no `released`, `parent` or `reservations`.
const StoredEvent = S.Union([
  RunRequested,
  RunActivated,
  BudgetReserved,
  UsageSettled,
  StepRecorded,
  RunContinued,
  ContinuationOpened,
  RunCompleted,
]);
const decodeAs = <Schema extends S.Top>(schema: Schema) => S.decodeUnknownEffect(S.toCodecJson(schema));
const stored = Effect.fn("stored")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL(`./stored/${name}`, import.meta.url));
  const bytes = yield* fs.readFileString(file);
  const json = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(bytes);
  return { file, bytes, json };
});
const decodeEvent = (json: unknown) => decodeAs(StoredEvent)(json);
const history = (name: string) =>
  Effect.flatMap(stored(name), ({ json }) => Effect.forEach(json as ReadonlyArray<unknown>, decodeEvent, { concurrency: 1 }));

const { given, state, view } = Story;
const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

it.layer(NodeServices.layer)((it) => {
  it.effect("phase 2's run events read with today's defaults; state, receipt with reply and provenance decode", () =>
    Effect.gen(function* () {
      const first = yield* history("run_1.history.json");
      expect(first[6]).toMatchObject({ _tag: "RunContinued", parent: O.none(), reservations: [], remaining: 88 });
      const next = yield* history("run_1~1.history.json");
      expect(next[0]).toMatchObject({ _tag: "ContinuationOpened", parent: O.none(), reservations: [], allowance: 88 });
      expect(next[2]).toMatchObject({ _tag: "RunCompleted", released: 0 });

      const running = yield* Effect.flatMap(stored("AgentRun.state.json"), ({ json }) => decodeAs(StoredAgentRunState)(json));
      expect(running).toMatchObject({ _tag: "Running", run: { budget: { reserved: 30 }, reservations: [{ reservation: "r2", units: 30 }] } });

      const receipt = (yield* stored("ReserveBudget.receipt.json")).json as {
        readonly events: ReadonlyArray<unknown>;
        readonly reply: unknown;
      };
      const receiptEvents = yield* Effect.forEach(receipt.events, decodeEvent, { concurrency: 1 });
      expect(receiptEvents).toMatchObject([{ _tag: "BudgetReserved", units: 30 }]);
      const reply = yield* decodeAs(ReserveBudget.reply!)(receipt.reply);
      expect(reply).toEqual({ remaining: 58 });

      const provenance = yield* Effect.flatMap(stored("Provenance.json"), ({ json }) => decodeAs(Provenance)(json));
      expect(provenance.root).toEqual({ _tag: "Agent", run: "run_1", accountable: "p_req" });
    }),
  );

  it.effect("frozen run history replays through today's evolve: the run continued, its continuation completed", () =>
    Effect.gen(function* () {
      const first = yield* history("run_1.history.json");
      const next = yield* history("run_1~1.history.json");
      yield* story(
        given(AgentRun.ref("run_1"), ...first),
        given(AgentRun.ref("run_1~1"), ...next),
        state(AgentRun.ref("run_1"), (current) => expect(current).toMatchObject({ _tag: "Continued", next: "run_1~1" })),
        state(AgentRun.ref("run_1~1"), (current) =>
          expect(current).toMatchObject({
            _tag: "Completed",
            outcome: "approved:approval_1",
            run: { lineage: "run_1", parent: O.none(), budget: { allowance: 88, reserved: 0 }, reservations: [] },
          }),
        ),
        view(SessionRuns, SessionId.make("session_1"), {
          runs: [
            { run: RunId.make("run_1"), previous: O.none(), parent: O.none(), status: "continued" },
            { run: RunId.make("run_1~1"), previous: RunId.makeOption("run_1"), parent: O.none(), status: "completed" },
          ],
        }),
      );
    }),
  );

  it.effect("phase 6's requested and cancelled-before-grant states read as today's Requested and Withdrawn (D22)", () =>
    Effect.gen(function* () {
      const read = (name: string) => Effect.flatMap(stored(name), ({ json }) => decodeAs(StoredAgentRunState)(json));
      // Phase 6 wrote a requested run with `null` for the three keys only activation supplies.
      const requested = yield* read("AgentRun.requested.state.json");
      expect(requested._tag).toBe("Requested");
      expect(requested).not.toHaveProperty("run.provenance");
      // And a request cancelled before its grant as `Cancelled`, with the same nulls.
      const withdrawn = yield* read("AgentRun.cancelled-requested.state.json");
      expect(withdrawn).toMatchObject({ _tag: "Withdrawn", reason: "no longer needed", run: { lineage: "run_2", parent: O.none() } });
      expect(withdrawn).not.toHaveProperty("run.accountable");
      // Today's forms omit the keys, and a write is today's form.
      const requestedToday = yield* read("AgentRun.requested.phase7.state.json");
      const withdrawnToday = yield* stored("AgentRun.withdrawn.phase7.state.json");
      const withdrawnRead = yield* decodeAs(StoredAgentRunState)(withdrawnToday.json);
      expect(requestedToday).toEqual(requested);
      expect(withdrawnRead).toEqual(withdrawn);
      const written = yield* S.encodeUnknownEffect(S.toCodecJson(StoredAgentRunState))(withdrawn);
      expect(written).toEqual(withdrawnToday.json);
    }),
  );

  it.effect("reading never rewrites stored bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const names = [
        "run_1.history.json",
        "run_1~1.history.json",
        "AgentRun.state.json",
        "AgentRun.requested.state.json",
        "AgentRun.cancelled-requested.state.json",
        "ReserveBudget.receipt.json",
      ];
      const before = yield* Effect.forEach(names, stored, { concurrency: 1 });
      yield* history("run_1.history.json");
      yield* history("run_1~1.history.json");
      for (const { file, bytes } of before) {
        const after = yield* fs.readFileString(file);
        expect(after).toBe(bytes);
      }
      // A write today carries the added keys.
      const [, , completed] = yield* history("run_1~1.history.json");
      const written = yield* S.encodeUnknownEffect(S.toCodecJson(RunCompleted))(completed);
      expect(written).toMatchObject({ released: 0 });
    }),
  );
});
