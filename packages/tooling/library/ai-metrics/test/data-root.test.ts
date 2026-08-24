import {
  AiMetricsDataRootError,
  AiMetricsDataRootInput,
  AiMetricsDataRootSource,
  AiMetricsDeployTarget,
  AiMetricsInstallInput,
  agentEvidenceRoot,
  aiMetricsStateHome,
  aiMetricsStateRoot,
  makeAiMetricsInstallSpec,
  requireAbsoluteAiMetricsDataRoot,
  resolveAiMetricsDataRoot,
} from "@beep/repo-ai-metrics";
import { Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const homeDir = "/home/dev";
const xdgDefaultRoot = `${homeDir}/.local/state/beep/ai-metrics`;
const cloneRelativeRoot = "/work/clone/.beep/ai-metrics";
const decodeDataRootInput = S.decodeUnknownSync(AiMetricsDataRootInput);

const makeDataRootInput = ({
  envDataRoot = O.none<string>(),
  flagDataRoot = O.none<string>(),
  homeDir = O.none<string>(),
  stateHome = O.none<string>(),
  target = AiMetricsDeployTarget.Enum.local,
}: {
  readonly envDataRoot?: O.Option<string>;
  readonly flagDataRoot?: O.Option<string>;
  readonly homeDir?: O.Option<string>;
  readonly stateHome?: O.Option<string>;
  readonly target?: AiMetricsDeployTarget;
} = {}) => AiMetricsDataRootInput.make({ envDataRoot, flagDataRoot, homeDir, stateHome, target });

const resolveRoot = (input: AiMetricsDataRootInput) =>
  O.getOrThrowWith(resolveAiMetricsDataRoot(input), () => new Error("expected a resolvable AI metrics data root"));

describe("@beep/repo-ai-metrics data-root precedence", () => {
  it("prefers the flag over the environment and the XDG default", () => {
    const resolved = resolveRoot(
      makeDataRootInput({
        envDataRoot: O.some("/var/lib/ai-metrics"),
        flagDataRoot: O.some("/srv/store"),
        homeDir: O.some(homeDir),
        stateHome: O.some("/custom/state"),
      })
    );

    expect(resolved.path).toBe("/srv/store");
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum.flag);
  });

  it("prefers the environment over the XDG default when no flag is supplied", () => {
    const resolved = resolveRoot(
      makeDataRootInput({
        envDataRoot: O.some("/var/lib/ai-metrics"),
        homeDir: O.some(homeDir),
      })
    );

    expect(resolved.path).toBe("/var/lib/ai-metrics");
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum.environment);
  });

  it("falls back to the XDG state store for the local target", () => {
    const resolved = resolveRoot(makeDataRootInput({ homeDir: O.some(homeDir) }));

    expect(resolved.path).toBe(xdgDefaultRoot);
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum["xdg-state-home"]);
    expect(resolved.target).toBe(AiMetricsDeployTarget.Enum.local);
  });

  it("honours XDG_STATE_HOME when it is set", () => {
    const resolved = resolveRoot(makeDataRootInput({ homeDir: O.some(homeDir), stateHome: O.some("/custom/state") }));

    expect(resolved.path).toBe("/custom/state/beep/ai-metrics");
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum["xdg-state-home"]);
  });

  it("uses the server-owned root for the dankserver target", () => {
    const resolved = resolveRoot(
      makeDataRootInput({ homeDir: O.some(homeDir), target: AiMetricsDeployTarget.Enum.dankserver })
    );

    expect(resolved.path).toBe("/srv/data/ai-metrics");
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum["target-default"]);
  });

  it("treats blank flag and environment values as absent", () => {
    const resolved = resolveRoot(decodeDataRootInput({ envDataRoot: "", flagDataRoot: "   ", homeDir }));

    expect(resolved.path).toBe(xdgDefaultRoot);
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum["xdg-state-home"]);
  });

  // Resolution carries a relative value through untouched rather than absolutizing it against an
  // ambient directory. `requireAbsoluteAiMetricsDataRoot` is where such a root gets refused, and
  // that refusal is only possible if it is still recognisably relative here.
  it("returns a relative flag value unchanged instead of absolutizing it", () => {
    const resolved = resolveRoot(
      makeDataRootInput({ flagDataRoot: O.some("./store/ai-metrics"), homeDir: O.some(homeDir) })
    );

    expect(resolved.path).toBe("./store/ai-metrics");
    expect(resolved.source).toBe(AiMetricsDataRootSource.Enum.flag);
  });

  it("refuses to anchor the XDG rung at the filesystem root when the home directory is blank or absent", () => {
    const unresolvable = [
      makeDataRootInput(),
      decodeDataRootInput({ homeDir: "" }),
      decodeDataRootInput({ homeDir: "   " }),
      decodeDataRootInput({ homeDir: "", stateHome: "" }),
      decodeDataRootInput({ envDataRoot: "", flagDataRoot: "  ", homeDir: "" }),
    ];

    for (const input of unresolvable) {
      expect(O.isNone(resolveAiMetricsDataRoot(input))).toBe(true);
      expect(O.isNone(aiMetricsStateHome(input))).toBe(true);
    }

    // The dankserver rung and an explicit XDG_STATE_HOME still resolve without a home.
    expect(resolveRoot(decodeDataRootInput({ homeDir: "", stateHome: "/custom/state" })).path).toBe(
      "/custom/state/beep/ai-metrics"
    );
    expect(resolveRoot(decodeDataRootInput({ homeDir: "", target: AiMetricsDeployTarget.Enum.dankserver })).path).toBe(
      "/srv/data/ai-metrics"
    );
  });

  it("never resolves to the clone-relative store for any input combination", () => {
    const inputs = [
      makeDataRootInput({ homeDir: O.some(homeDir) }),
      decodeDataRootInput({ envDataRoot: "", flagDataRoot: "", homeDir }),
      decodeDataRootInput({ homeDir, stateHome: "" }),
      makeDataRootInput({ homeDir: O.some(homeDir), target: AiMetricsDeployTarget.Enum.dankserver }),
      makeDataRootInput({ homeDir: O.some(homeDir), stateHome: O.some("/custom/state") }),
    ];

    for (const input of inputs) {
      const resolved = resolveRoot(input);
      expect(resolved.path).not.toBe(cloneRelativeRoot);
      expect(pipe(resolved.path, Str.startsWith(`${cloneRelativeRoot}/`))).toBe(false);
      expect(resolved.path).not.toContain(".beep/ai-metrics");
    }
  });

  it("keeps the ai-metrics store a sibling of the hook-pulse agent-evidence store", () => {
    const stateHome = O.getOrThrowWith(aiMetricsStateHome({ homeDir }), () => new Error("expected a state home"));
    const metricsRoot = aiMetricsStateRoot(stateHome);
    const evidenceRoot = agentEvidenceRoot(stateHome);

    expect(metricsRoot).toBe(xdgDefaultRoot);
    expect(pipe(metricsRoot, Str.endsWith("/beep/ai-metrics"))).toBe(true);
    expect(metricsRoot).not.toBe(evidenceRoot);
    expect(pipe(metricsRoot, Str.startsWith(`${evidenceRoot}/`))).toBe(false);
    expect(pipe(evidenceRoot, Str.startsWith(`${metricsRoot}/`))).toBe(false);
    expect(metricsRoot).not.toBe(stateHome);
    expect(metricsRoot).not.toBe(`${stateHome}/beep`);
  });

  it.effect("rejects a relative data root and accepts an absolute one", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(requireAbsoluteAiMetricsDataRoot(".beep/ai-metrics"));
      expect(failure).toBeInstanceOf(AiMetricsDataRootError);
      expect(failure.message).toContain("absolute path");

      expect(yield* requireAbsoluteAiMetricsDataRoot(xdgDefaultRoot)).toBe(xdgDefaultRoot);
    })
  );

  it.effect("rejects filesystem roots and invalid paths while accepting supported absolute paths", () =>
    Effect.gen(function* () {
      const rejected = ["/", "C:\\", "\\\\server\\share", "relative/store", "/tmp/invalid\u0000store"];
      const accepted = ["/tmp/ai-metrics", "C:\\state\\ai-metrics", "\\\\server\\share\\ai-metrics"];

      yield* Effect.forEach(
        rejected,
        Effect.fnUntraced(function* (path) {
          const failure = yield* Effect.flip(requireAbsoluteAiMetricsDataRoot(path));
          expect(failure).toBeInstanceOf(AiMetricsDataRootError);
          expect(failure.message).toContain("non-root");
        }),
        { discard: true }
      );
      yield* Effect.forEach(
        accepted,
        Effect.fnUntraced(function* (path) {
          expect(yield* requireAbsoluteAiMetricsDataRoot(path)).toBe(path);
        }),
        { discard: true }
      );
    })
  );

  it.effect("fails an unresolvable local install spec instead of falling back to the clone", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        makeAiMetricsInstallSpec(AiMetricsInstallInput.make({ target: AiMetricsDeployTarget.Enum.local }))
      );

      expect(failure._tag).toBe("AiMetricsInstallConfigurationError");
      expect(failure.message).toContain("clone-relative");
    })
  );

  it.effect("derives the whole storage layout beneath an explicit data root", () =>
    Effect.gen(function* () {
      const spec = yield* makeAiMetricsInstallSpec(AiMetricsInstallInput.make({ dataRoot: O.some("/tmp/x") }));

      expect(spec.storage.dataRoot).toBe("/tmp/x");
      expect(spec.storage.derivedDir).toBe("/tmp/x/derived");
      expect(spec.storage.duckDbPath).toBe("/tmp/x/derived/ai-metrics.duckdb");
      expect(spec.storage.parquetDir).toBe("/tmp/x/derived/parquet");
      expect(spec.storage.rawArchiveDir).toBe("/tmp/x/raw");
    })
  );

  it.effect("resolves the XDG store when the install input carries only a home directory", () =>
    Effect.gen(function* () {
      const spec = yield* makeAiMetricsInstallSpec(AiMetricsInstallInput.make({ homeDir: O.some(homeDir) }));

      expect(spec.storage.dataRoot).toBe(xdgDefaultRoot);
      expect(spec.storage.rawArchiveDir).toBe(`${xdgDefaultRoot}/raw`);
    })
  );
});
