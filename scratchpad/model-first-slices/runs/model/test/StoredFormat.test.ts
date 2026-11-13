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
import { AgentRun, AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import { SessionRuns } from "@proto/runs-model/Run/SessionRuns.view";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
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
const stored = (name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = yield* path.fromFileUrl(new URL(`./stored/${name}`, import.meta.url));
    const bytes = yield* fs.readFileString(file);
    return { file, bytes, json: yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(bytes) };
  });
const decodeEvent = (json: unknown) => decodeAs(StoredEvent)(json);
const history = (name: string) =>
  Effect.flatMap(stored(name), ({ json }) => Effect.forEach(json as ReadonlyArray<unknown>, decodeEvent));

const { given, state, view } = Story;
const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

it.effect("phase 2's run events read with today's defaults; state, receipt with reply and provenance decode", () =>
  Effect.gen(function* () {
    const first = yield* history("run_1.history.json");
    expect(first[6]).toMatchObject({ _tag: "RunContinued", parent: null, reservations: [], remaining: 88 });
    const next = yield* history("run_1~1.history.json");
    expect(next[0]).toMatchObject({ _tag: "ContinuationOpened", parent: null, reservations: [], allowance: 88 });
    expect(next[2]).toMatchObject({ _tag: "RunCompleted", released: 0 });

    const running = yield* Effect.flatMap(stored("AgentRun.state.json"), ({ json }) => decodeAs(AgentRunState)(json));
    expect(running).toMatchObject({ _tag: "Running", run: { budget: { reserved: 30 }, reservations: [{ reservation: "r2", units: 30 }] } });

    const receipt = (yield* stored("ReserveBudget.receipt.json")).json as {
      readonly events: ReadonlyArray<unknown>;
      readonly reply: unknown;
    };
    expect(yield* Effect.forEach(receipt.events, decodeEvent)).toMatchObject([{ _tag: "BudgetReserved", units: 30 }]);
    expect(yield* decodeAs(ReserveBudget.reply!)(receipt.reply)).toEqual({ remaining: 58 });

    const provenance = yield* Effect.flatMap(stored("Provenance.json"), ({ json }) => decodeAs(Provenance)(json));
    expect(provenance.root).toEqual({ _tag: "Agent", run: "run_1", accountable: "p_req" });
  }).pipe(Effect.provide(NodeServices.layer)),
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
          run: { lineage: "run_1", parent: null, budget: { allowance: 88, reserved: 0 }, reservations: [] },
        }),
      ),
      view(SessionRuns, SessionId.make("session_1"), {
        runs: [
          { run: RunId.make("run_1"), previous: null, parent: null, status: "continued" },
          { run: RunId.make("run_1~1"), previous: RunId.make("run_1"), parent: null, status: "completed" },
        ],
      }),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("reading never rewrites stored bytes", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = ["run_1.history.json", "run_1~1.history.json", "AgentRun.state.json", "ReserveBudget.receipt.json"];
    const before = yield* Effect.forEach(names, stored);
    yield* history("run_1.history.json");
    yield* history("run_1~1.history.json");
    for (const { file, bytes } of before) expect(yield* fs.readFileString(file)).toBe(bytes);
    // A write today carries the added keys.
    const [, , completed] = yield* history("run_1~1.history.json");
    expect(yield* S.encodeUnknownEffect(S.toCodecJson(RunCompleted))(completed)).toMatchObject({ released: 0 });
  }).pipe(Effect.provide(NodeServices.layer)),
);
