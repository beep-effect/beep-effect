import {
  hasRemoteTurboCacheArgs,
  isTurboCacheControlArg,
  LocalOnlyTurboCache,
  localOnlyTurboCacheArgs,
  RemoteReadTurboCache,
  resolveTurboCachePlan,
  TurboCacheEnvironment,
  TurboCacheMode,
  TurboCachePlan,
  turboCacheEnvironmentNeedsSecretSession,
  turboCachePlanArgs,
  turboCachePlanNeedsSecretSession,
  turboCacheValueSourceFor,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import type { TurboCacheEnvName, TurboCacheValueSource } from "@beep/repo-cli/test/SharedInternals";

const REMOTE_READ_MODE = TurboCacheMode.Enum.LocalWriteRemoteRead;
const LOCAL_ONLY_ARG = `--cache=${TurboCacheMode.Enum.LocalOnly}`;
const REMOTE_READ_ARG = `--cache=${REMOTE_READ_MODE}`;

const environmentWith = (token: TurboCacheValueSource, cache: string): TurboCacheEnvironment =>
  TurboCacheEnvironment.make({ api: "literal", token, team: "literal", cache });

// The fully configured workstation posture: a 1Password-backed read token, a
// literal endpoint and team, and the sanctioned read-only cache mode.
const completeEnvironment = environmentWith("secret-reference", REMOTE_READ_MODE);

const incompleteEnvironments: ReadonlyArray<readonly [TurboCacheEnvName, TurboCacheEnvironment]> = [
  ["TURBO_API", TurboCacheEnvironment.make({ token: "secret-reference", team: "literal", cache: REMOTE_READ_MODE })],
  ["TURBO_TOKEN", TurboCacheEnvironment.make({ api: "literal", team: "literal", cache: REMOTE_READ_MODE })],
  ["TURBO_TEAM", TurboCacheEnvironment.make({ api: "literal", token: "secret-reference", cache: REMOTE_READ_MODE })],
  ["TURBO_CACHE", TurboCacheEnvironment.make({ api: "literal", token: "secret-reference", team: "literal" })],
];

const localPlan = (environment: TurboCacheEnvironment, args: ReadonlyArray<string> = A.empty()) =>
  resolveTurboCachePlan(environment, { args, ci: false });

describe("turbo cache plan resolution", () => {
  it("honors a complete remote-read configuration", () => {
    const plan = localPlan(completeEnvironment);

    expect(plan).toEqual(RemoteReadTurboCache.make({ mode: REMOTE_READ_MODE, requiresSecretSession: true }));
    expect(turboCachePlanArgs(plan)).toEqual([REMOTE_READ_ARG]);
    expect(turboCachePlanNeedsSecretSession(plan)).toBe(true);
  });

  it("needs no 1Password session when every configured value is literal", () => {
    const plan = localPlan(environmentWith("literal", REMOTE_READ_MODE));

    expect(plan).toEqual(RemoteReadTurboCache.make({ mode: REMOTE_READ_MODE, requiresSecretSession: false }));
    expect(turboCachePlanNeedsSecretSession(plan)).toBe(false);
    expect(turboCachePlanArgs(plan)).toEqual([REMOTE_READ_ARG]);
  });

  it.each(incompleteEnvironments)("falls back to local-only without %s", (name, environment) => {
    const plan = localPlan(environment);

    expect(plan).toEqual(LocalOnlyTurboCache.make({ reason: "incomplete-remote-config", missing: [name] }));
    expect(turboCachePlanArgs(plan)).toEqual([LOCAL_ONLY_ARG]);
    expect(turboCachePlanNeedsSecretSession(plan)).toBe(false);
  });

  it("reports every missing quad member at once", () => {
    expect(localPlan(TurboCacheEnvironment.make({ team: "literal" }))).toEqual(
      LocalOnlyTurboCache.make({
        reason: "incomplete-remote-config",
        missing: ["TURBO_API", "TURBO_TOKEN", "TURBO_CACHE"],
      })
    );
  });

  it("treats a blank cache mode as missing", () => {
    expect(localPlan(environmentWith("secret-reference", "   "))).toEqual(
      LocalOnlyTurboCache.make({ reason: "incomplete-remote-config", missing: ["TURBO_CACHE"] })
    );
  });

  it.each(["local:rw", "remote:r", "local:rw,remote:rw", "remote:rw", "op://vault/item/field"])(
    "falls back to local-only for the unsupported posture %s",
    (cache) => {
      const plan = localPlan(environmentWith("secret-reference", cache));

      expect(plan).toEqual(LocalOnlyTurboCache.make({ reason: "unsupported-cache-mode", missing: [] }));
      expect(turboCachePlanArgs(plan)).toEqual([LOCAL_ONLY_ARG]);
    }
  );

  it("tolerates surrounding whitespace in the sanctioned posture", () => {
    expect(localPlan(environmentWith("secret-reference", `  ${REMOTE_READ_MODE}  `))).toEqual(
      RemoteReadTurboCache.make({ mode: REMOTE_READ_MODE, requiresSecretSession: true })
    );
  });

  it.each(["--cache=local:rw", "--no-cache", "--force", "--force=true", "--remote-only", "--remote-cache-read-only"])(
    "leaves argv untouched when the caller passes %s",
    (arg) => {
      const plan = localPlan(completeEnvironment, ["--filter=@beep/schema", arg]);

      expect(plan._tag).toBe("caller-controlled");
      expect(turboCachePlanArgs(plan)).toEqual([]);
      expect(turboCachePlanNeedsSecretSession(plan)).toBe(false);
    }
  );

  it("leaves CI untouched even with a complete configuration", () => {
    const plan = resolveTurboCachePlan(completeEnvironment, { args: A.empty(), ci: true });

    expect(plan._tag).toBe("caller-controlled");
    expect(turboCachePlanArgs(plan)).toEqual([]);
  });

  it("prefers the CI verdict over an explicit cache argument", () => {
    expect(resolveTurboCachePlan(completeEnvironment, { args: ["--force"], ci: true })).toEqual(
      S.decodeSync(TurboCachePlan)({ _tag: "caller-controlled", reason: "ci" })
    );
  });
});

describe("turbo cache control arguments", () => {
  it.each(["--filter=@beep/schema", "--concurrency=3", "--summarize", "check", "--cache-dir=.turbo"])(
    "does not treat %s as cache control",
    (arg) => {
      expect(isTurboCacheControlArg(arg)).toBe(false);
    }
  );

  it("recognizes every cache-control spelling", () => {
    const controls = [
      "--no-cache",
      "--force",
      "--force=false",
      "--remote-only",
      "--remote-only=true",
      "--remote-cache-read-only",
      "--remote-cache-read-only=true",
      "--cache=local:rw",
    ];

    expect(A.filter(controls, isTurboCacheControlArg)).toEqual(controls);
  });
});

describe("run-time local-only degradation", () => {
  it("reports whether the checkout's credentials need an op run session", () => {
    expect(turboCacheEnvironmentNeedsSecretSession(completeEnvironment)).toBe(true);
    expect(turboCacheEnvironmentNeedsSecretSession(environmentWith("literal", REMOTE_READ_MODE))).toBe(false);
    expect(turboCacheEnvironmentNeedsSecretSession(TurboCacheEnvironment.make({}))).toBe(false);
  });

  it("classifies both value sources", () => {
    expect(turboCacheValueSourceFor(true)).toBe("secret-reference");
    expect(turboCacheValueSourceFor(false)).toBe("literal");
  });

  it("detects arguments that request remote cache access", () => {
    expect(hasRemoteTurboCacheArgs(["turbo", "run", "check", REMOTE_READ_ARG])).toBe(true);
    expect(hasRemoteTurboCacheArgs(["turbo", "run", "check", LOCAL_ONLY_ARG])).toBe(false);
    expect(hasRemoteTurboCacheArgs(["bun", "run", "beep", "quality", "tsgo-rules"])).toBe(false);
  });

  it("downgrades a remote posture when the 1Password session is unavailable", () => {
    expect(localOnlyTurboCacheArgs(["turbo", "run", "check", REMOTE_READ_ARG, "--concurrency=3"])).toEqual([
      "turbo",
      "run",
      "check",
      LOCAL_ONLY_ARG,
      "--concurrency=3",
    ]);
  });

  it("leaves local-only and cache-free invocations unchanged", () => {
    const localArgs = ["turbo", "run", "check", LOCAL_ONLY_ARG];
    const forcedArgs = ["turbo", "run", "build", "--force"];

    expect(localOnlyTurboCacheArgs(localArgs)).toEqual(localArgs);
    expect(localOnlyTurboCacheArgs(forcedArgs)).toEqual(forcedArgs);
  });
});
