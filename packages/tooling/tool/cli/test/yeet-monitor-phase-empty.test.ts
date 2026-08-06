import {
  RepoRunContext,
  runMonitorPhaseForTesting,
  runPublishMonitorAndResultForTesting,
  TurboPlanSnapshot,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type { YeetExecutedStep, YeetVerdictExtrasForTesting } from "@beep/repo-cli/test/Yeet";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);

const context = RepoRunContext.make({
  repoRoot: "/repo",
  cwd: "/repo",
  base: "origin/main",
  head: "HEAD",
  branch: "feat/merge-loop",
  packetDir: ".beep/yeet",
  originalArgv: [],
  turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], packages: [], tasks: [] }),
});

const emptyExtras: YeetVerdictExtrasForTesting = {
  baseFreshness: O.none(),
  mergeReady: O.none(),
  stash: O.none(),
};

// Regression for the publish-without---monitor P0: the planner emits monitor
// steps only under `--monitor`, so every other publish reached the monitor
// phase with an empty step list. The phase decoded the (absent) PR context
// anyway and failed with "Failed to decode pull request number for yeet
// monitor" AFTER the run had fully succeeded, so `yeet publish` exited 1 on
// green. An empty monitor phase must be a no-op.
describe("yeet monitor phase with no planned steps", () => {
  it.effect("completes without decoding a pull request and runs no step", () =>
    Effect.gen(function* () {
      const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());

      yield* runMonitorPhaseForTesting(context, A.empty(), recorder, "yeet publish monitor phase failed.");

      expect(yield* Ref.get(recorder)).toStrictEqual(A.empty());
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("returns the publish result and leaves merge readiness unobserved", () =>
    Effect.gen(function* () {
      const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
      const extras = yield* Ref.make<YeetVerdictExtrasForTesting>(emptyExtras);

      const result = yield* runPublishMonitorAndResultForTesting(context, A.empty(), recorder, extras, false);

      expect(result.committed).toBe(true);
      expect(result.pushed).toBe(true);
      expect(yield* Ref.get(recorder)).toStrictEqual(A.empty());
      // No status snapshot was read, so the verdict must omit mergeReady rather
      // than assert an unobserved answer.
      expect((yield* Ref.get(extras)).mergeReady).toStrictEqual(O.none());
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});
