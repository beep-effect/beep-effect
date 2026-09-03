// Effect's default ConfigProvider snapshots the ambient environment once, at
// the first config read in this (isolated) test file. Set the values the
// synchronous readers observe before any test triggers that first read.
// `Bun.env` is the same live object the default `ConfigProvider.fromEnv()`
// reads, so seeding it here preserves the snapshot behaviour these readers rely
// on without touching `process.env` directly.
Bun.env.BEEP_SI_STR = "value";
Bun.env.BEEP_SI_INT_POS = "42";
Bun.env.BEEP_SI_INT_NEG = "-5";
Bun.env.BEEP_SI_INT_BAD = "notnum";
Bun.env.BEEP_SI_BOOL_NO = "no";
Bun.env.BEEP_SI_BOOL_YES = "YES";
Bun.env.BEEP_SI_BOOL_BAD = "maybe";

import {
  applyJsoncModification,
  booleanEnvValue,
  canUseTurboCacheSecretSession,
  clearTurboCacheSecretSessionVerdictsForTesting,
  configStringEqualsSync,
  configStringOption,
  configStringOptionSync,
  cursorArgs,
  decodeOrFail,
  decodeSchemaFirstPolicyFindingLine,
  encodeSchemaFirstPolicyFinding,
  envValue,
  escapeRegexChar,
  GhPageInfo,
  GhPrView,
  globMatches,
  globPatternToRegExp,
  intEnvValue,
  isUnresolvedSecretReference,
  JsonStringCodec,
  jsonText,
  localOnlyTurboCacheArgs,
  nextCursor,
  RemoteReadTurboCache,
  readOptionalConfigString,
  readOptionalRedactedConfigString,
  readTurboCacheEnvironment,
  renderSchemaFirstPolicyFindingLine,
  renderTurboEnvironmentHealthWarning,
  resolveTurboCachePlan,
  SchemaFirstPolicyFinding,
  SchemaFirstPolicyIssuePrefix,
  SchemaFirstPolicySeverity,
  TurboCacheEnvironment,
  TurboCacheMode,
  turboCachePlanArgs,
  turboCacheSecretSessionEnvironment,
  turboEnvExtendsAmbient,
  turboEnvironmentHealthWarnings,
  turboEnvOverrides,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Data, Effect, FileSystem, Layer, Path, Redacted, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

class SharedInternalsTestError extends Data.TaggedError("SharedInternalsTestError")<{
  readonly message: string;
}> {}

describe("SchemaFirstPolicyFinding wire contract", () => {
  const line = (finding: SchemaFirstPolicyFinding): string =>
    Effect.runSync(renderSchemaFirstPolicyFindingLine(finding));

  it("round-trips the emitter's warning finding unchanged", () => {
    const finding = SchemaFirstPolicyFinding.make({
      category: "schema-first-policy",
      ruleId: "SFV4-defaults",
      severity: "warning",
      file: "packages/example/src/Widget.ts",
      line: 12,
      symbol: "Widget",
      message: "Prefer schema defaults.",
      remediation: "Apply S.withConstructorDefault.",
    });
    const rendered = line(finding);
    expect(rendered.startsWith(SchemaFirstPolicyIssuePrefix)).toBe(true);
    const decoded = decodeSchemaFirstPolicyFindingLine(rendered);
    expect(O.isSome(decoded)).toBe(true);
    if (O.isSome(decoded)) {
      expect(decoded.value.severity).toBe("warning");
      expect(decoded.value.ruleId).toBe("SFV4-defaults");
      expect(decoded.value.remediation).toBe("Apply S.withConstructorDefault.");
      expect(decoded.value.line).toBe(12);
    }
  });

  it("round-trips an error finding", () => {
    const finding = SchemaFirstPolicyFinding.make({
      category: "schema-first-policy",
      ruleId: "schema-first-inventory",
      severity: "error",
      file: "a.ts",
      message: "m",
      remediation: "r",
    });
    const decoded = decodeSchemaFirstPolicyFindingLine(line(finding));
    expect(O.map(decoded, (f) => f.severity)).toEqual(O.some("error"));
  });

  it("represents both the 'warn' and 'warning' severity spellings", () => {
    expect(SchemaFirstPolicySeverity.is.warn("warn")).toBe(true);
    expect(SchemaFirstPolicySeverity.is.warning("warning")).toBe(true);
    const warnLine = `${SchemaFirstPolicyIssuePrefix}${JSON.stringify({
      category: "schema-first-policy",
      ruleId: "native-runtime",
      severity: "warn",
      file: "a.ts",
      message: "m",
    })}`;
    const decoded = decodeSchemaFirstPolicyFindingLine(warnLine);
    expect(O.map(decoded, (f) => f.severity)).toEqual(O.some("warn"));
  });

  it("decodes a line with severity and remediation omitted", () => {
    const bare = `${SchemaFirstPolicyIssuePrefix}${JSON.stringify({
      category: "schema-first-policy",
      ruleId: "r",
      file: "a.ts",
      message: "m",
    })}`;
    const decoded = decodeSchemaFirstPolicyFindingLine(bare);
    expect(O.isSome(decoded)).toBe(true);
    if (O.isSome(decoded)) {
      expect(decoded.value.severity).toBeUndefined();
      expect(decoded.value.remediation).toBeUndefined();
    }
  });

  it("drops non-matching and malformed lines", () => {
    expect(O.isNone(decodeSchemaFirstPolicyFindingLine("plain output line"))).toBe(true);
    expect(O.isNone(decodeSchemaFirstPolicyFindingLine(`${SchemaFirstPolicyIssuePrefix}{not json`))).toBe(true);
  });

  it("encodes to compact JSON with no prefix", () => {
    const json = Effect.runSync(
      encodeSchemaFirstPolicyFinding(
        SchemaFirstPolicyFinding.make({
          category: "schema-first-policy",
          ruleId: "r",
          file: "a.ts",
          message: "m",
        })
      )
    );
    expect(json.startsWith("{")).toBe(true);
    expect(json.includes(SchemaFirstPolicyIssuePrefix)).toBe(false);
  });
});

describe("JsonStringCodec", () => {
  const Point = S.Struct({ x: S.Finite, y: S.Finite });
  const codec = JsonStringCodec(Point);

  it("round-trips a value through JSON text", () => {
    const text = Effect.runSync(codec.encode({ x: 1, y: 2 }));
    expect(Effect.runSync(codec.decode(text))).toEqual({ x: 1, y: 2 });
  });

  it("decodeOption yields None on malformed input", () => {
    expect(O.isNone(codec.decodeOption("nope"))).toBe(true);
    expect(O.isSome(codec.decodeOption('{"x":1,"y":2}'))).toBe(true);
  });

  it("decodeOrFail maps schema errors to a domain error", () => {
    const decode = decodeOrFail(Point, (error) => new SharedInternalsTestError({ message: `bad: ${error._tag}` }));
    const exit = Effect.runSyncExit(decode("not json"));
    expect(exit._tag).toBe("Failure");
    expect(Effect.runSync(decode('{"x":3,"y":4}'))).toEqual({ x: 3, y: 4 });
  });
});

describe("GlobPattern", () => {
  it("compiles ** across segments and * within a segment", () => {
    const re = globPatternToRegExp("src/**/*.ts");
    expect(re.test("src/a/b/c.ts")).toBe(true);
    expect(re.test("src/a.ts")).toBe(true);
    expect(re.test("src/a/b.tsx")).toBe(false);
    expect(re.test("other/a.ts")).toBe(false);
  });

  it("matches a single segment wildcard without crossing slashes", () => {
    const re = globPatternToRegExp("src/*.ts");
    expect(re.test("src/a.ts")).toBe(true);
    expect(re.test("src/a/b.ts")).toBe(false);
  });

  it("escapes regex metacharacters literally", () => {
    expect(escapeRegexChar(".")).toBe("\\.");
    expect(globPatternToRegExp("a.b").test("a.b")).toBe(true);
    expect(globPatternToRegExp("a.b").test("axb")).toBe(false);
  });

  it("globMatches curries a predicate", () => {
    const matchesTests = globMatches("**/*.test.ts");
    expect(matchesTests("src/a.test.ts")).toBe(true);
    expect(matchesTests("src/a.ts")).toBe(false);
  });
});

describe("Jsonc editing", () => {
  it("modifies a value while preserving comments and formatting", () => {
    const source = '{\n  // keep me\n  "a": 1,\n  "b": 2\n}';
    const next = applyJsoncModification({ content: source, path: ["a"], value: 42 });
    expect(next.includes("// keep me")).toBe(true);
    expect(next.includes('"a": 42')).toBe(true);
    expect(next.includes('"b": 2')).toBe(true);
  });

  it("formats with 2-space indentation", () => {
    const formatted = jsonText('{"a":1,"b":{"c":2}}');
    expect(formatted.includes('  "a": 1')).toBe(true);
    expect(formatted.includes('    "c": 2')).toBe(true);
  });
});

describe("EnvConfig readers", () => {
  const UNSET = "BEEP_SI_DEFINITELY_UNSET";

  it("configStringOptionSync reads present and absent snapshot values", () => {
    expect(configStringOptionSync("BEEP_SI_STR")).toEqual(O.some("value"));
    expect(O.isNone(configStringOptionSync(UNSET))).toBe(true);
  });

  it("configStringEqualsSync compares present and absent snapshot values", () => {
    expect(configStringEqualsSync("BEEP_SI_STR", "value")).toBe(true);
    expect(configStringEqualsSync("value")("BEEP_SI_STR")).toBe(true);
    expect(configStringEqualsSync("BEEP_SI_STR", "other")).toBe(false);
    expect(configStringEqualsSync(UNSET, "value")).toBe(false);
  });

  it("envValue returns the value or falls back", () => {
    expect(envValue("BEEP_SI_STR", "fallback")).toBe("value");
    expect(envValue(UNSET, "fallback")).toBe("fallback");
  });

  it("intEnvValue parses positive integers only", () => {
    expect(intEnvValue("BEEP_SI_INT_POS", 180)).toBe(42);
    expect(intEnvValue("BEEP_SI_INT_NEG", 180)).toBe(180);
    expect(intEnvValue("BEEP_SI_INT_BAD", 180)).toBe(180);
    expect(intEnvValue(UNSET, 180)).toBe(180);
  });

  it("booleanEnvValue recognizes true/false spellings", () => {
    expect(booleanEnvValue("BEEP_SI_BOOL_NO", true)).toBe(false);
    expect(booleanEnvValue("BEEP_SI_BOOL_YES", false)).toBe(true);
    expect(booleanEnvValue("BEEP_SI_BOOL_BAD", true)).toBe(true);
    expect(booleanEnvValue(UNSET, false)).toBe(false);
  });

  it.effect(
    "Effect readers re-read the ambient provider on each call (no module-load capture)",
    Effect.fnUntraced(function* () {
      const withProvider = (value: string) =>
        provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TOKEN: value })))(
          readOptionalConfigString("TOKEN")
        );
      expect(yield* withProvider("first")).toEqual(O.some("first"));
      expect(yield* withProvider("second")).toEqual(O.some("second"));
      const missing = provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({})))(
        configStringOption("TOKEN")
      );
      expect(O.isNone(yield* missing)).toBe(true);
    })
  );

  it("classifies unresolved op:// secret references", () => {
    expect(isUnresolvedSecretReference("op://vault/item/field")).toBe(true);
    expect(isUnresolvedSecretReference("postgres://localhost")).toBe(false);
    expect(isUnresolvedSecretReference(undefined)).toBe(false);
  });
});

describe("Github plumbing", () => {
  const codec = JsonStringCodec(GhPrView);

  it("GhPrView decodes the narrow monitor payload", () => {
    const view = Effect.runSync(codec.decode(JSON.stringify({ number: 7, headRefName: "feat", state: "OPEN" })));
    expect(view.number).toBe(7);
    expect(view.url).toBeUndefined();
    expect(view.isDraft).toBeUndefined();
  });

  it("GhPrView decodes the wide closeout payload", () => {
    const view = Effect.runSync(
      codec.decode(
        JSON.stringify({
          number: 7,
          headRefName: "feat",
          state: "OPEN",
          url: "https://github.com/o/r/pull/7",
          headRefOid: "abc123",
          isDraft: false,
        })
      )
    );
    expect(view.url).toBe("https://github.com/o/r/pull/7");
    expect(view.isDraft).toBe(false);
    expect(view.headRefOid).toBe("abc123");
  });

  it("cursorArgs builds the -F cursor pair only when present", () => {
    expect(cursorArgs(O.some("abc"))).toEqual(["-F", "cursor=abc"]);
    expect(cursorArgs(O.none())).toEqual([]);
  });

  it("nextCursor completes pagination when there is no next page", () => {
    const result = Effect.runSync(
      nextCursor({
        pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: false }),
        label: "comments",
        onMissingCursor: (label) => new SharedInternalsTestError({ message: label }),
      })
    );
    expect(O.isNone(result)).toBe(true);
  });

  it("nextCursor yields the next cursor when a page follows", () => {
    const result = Effect.runSync(
      nextCursor({
        pageInfo: GhPageInfo.make({ endCursor: "next", hasNextPage: true }),
        label: "comments",
        onMissingCursor: (label) => new SharedInternalsTestError({ message: label }),
      })
    );
    expect(result).toEqual(O.some("next"));
  });

  it("nextCursor fails when another page has no end cursor", () => {
    const exit = Effect.runSyncExit(
      nextCursor({
        pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: true }),
        label: "comments",
        onMissingCursor: (label) => new SharedInternalsTestError({ message: `${label} missing cursor` }),
      })
    );
    expect(exit._tag).toBe("Failure");
  });
});

describe("turboEnvOverrides", () => {
  const OP_REFERENCE = "op://vault/item/credential";
  const REMOTE_READ = "local:rw,remote:r";

  const withTurboEnv = (env: Record<string, string>) =>
    provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)));

  const overridesFor = (
    env: Record<string, string>,
    command: string,
    args: ReadonlyArray<string>
  ): Record<string, string | undefined> => Effect.runSync(withTurboEnv(env)(turboEnvOverrides(command, args, env)));

  const opRunArgs = (turboArgs: ReadonlyArray<string>): ReadonlyArray<string> => [
    "run",
    "--",
    "bunx",
    "turbo",
    ...turboArgs,
  ];

  it("returns nothing for a non-turbo command", () => {
    expect(overridesFor({}, "git", ["status"])).toEqual({});
    expect(overridesFor({}, "bunx", ["vitest", "run"])).toEqual({});
    expect(overridesFor({}, "op", ["run", "--", "bun", "run", "build"])).toEqual({});
  });

  it("guards the TUI on a direct turbo spawn with resolved credentials", () => {
    expect(
      overridesFor({ TURBO_TOKEN: "resolved", TURBO_TEAM: "beep", TURBO_CACHE: REMOTE_READ }, "bunx", [
        "turbo",
        "run",
        "check",
      ])
    ).toEqual({ TURBO_UI: "false" });
  });

  it("scrubs unresolved references and pins the cache posture on a direct spawn", () => {
    expect(
      overridesFor(
        { TURBO_API: OP_REFERENCE, TURBO_TOKEN: OP_REFERENCE, TURBO_TEAM: "beep", TURBO_CACHE: REMOTE_READ },
        "bunx",
        ["turbo", "run", "check"]
      )
    ).toStrictEqual({
      TURBO_UI: "false",
      TURBO_API: undefined,
      TURBO_TOKEN: undefined,
      TURBO_CACHE: "local:rw",
    });
  });

  it("gives a wrapped spawn only Turbo secret references and a non-extending environment", () => {
    const environment = {
      PATH: "/fixture/bin",
      SAFE_LITERAL: "fixture-value",
      TURBO_API: "op://fixture-vault/turbo/api",
      TURBO_TOKEN: "op://fixture-vault/turbo/token",
      TURBO_TEAM: "op://fixture-vault/turbo/team",
      TURBO_CACHE: REMOTE_READ,
      UNRELATED_SECRET: "op://fixture-vault/unrelated/secret",
    };
    const sanitized = {
      PATH: "/fixture/bin",
      SAFE_LITERAL: "fixture-value",
      TURBO_API: "op://fixture-vault/turbo/api",
      TURBO_TOKEN: "op://fixture-vault/turbo/token",
      TURBO_TEAM: "op://fixture-vault/turbo/team",
      TURBO_CACHE: REMOTE_READ,
    };
    const args = opRunArgs(["run", "check"]);

    expect(turboCacheSecretSessionEnvironment(environment)).toStrictEqual(sanitized);
    expect(overridesFor(environment, "op", args)).toStrictEqual({ ...sanitized, TURBO_UI: "false" });
    expect(turboEnvExtendsAmbient("op", args)).toBe(false);
  });

  it("recognizes a wrapped spawn whose turbo arguments contain their own separator", () => {
    const args = opRunArgs(["run", "coverage", "--", "--maxWorkers=1"]);

    expect(overridesFor({}, "op", args)).toEqual({ TURBO_UI: "false" });
    expect(turboEnvExtendsAmbient("op", args)).toBe(false);
  });
});

// Every classification arm is reachable from an explicit record, so the
// file's measured coverage no longer depends on which Turbo posture the host
// process happens to carry (ship-velocity B9).
describe("readTurboCacheEnvironment", () => {
  const REMOTE_READ = "local:rw,remote:r";

  it("classifies literal values and unresolved references per name", () => {
    expect(
      readTurboCacheEnvironment({
        TURBO_API: "https://cache.example.test",
        TURBO_TOKEN: "op://fixture-vault/turbo/token",
        TURBO_TEAM: "team_fixture",
        TURBO_CACHE: REMOTE_READ,
      })
    ).toStrictEqual(
      TurboCacheEnvironment.make({ api: "literal", token: "secret-reference", team: "literal", cache: REMOTE_READ })
    );
  });

  it("treats blank, whitespace, and missing names as absent", () => {
    expect(
      readTurboCacheEnvironment({ TURBO_API: "", TURBO_TOKEN: "   ", TURBO_TEAM: undefined, TURBO_CACHE: "" })
    ).toStrictEqual(TurboCacheEnvironment.make({}));
    expect(readTurboCacheEnvironment({})).toStrictEqual(TurboCacheEnvironment.make({}));
  });

  it("trims the cache posture and ignores unrelated names", () => {
    expect(
      readTurboCacheEnvironment({ TURBO_CACHE: ` ${REMOTE_READ} `, UNRELATED: "op://fixture-vault/other/value" })
    ).toStrictEqual(TurboCacheEnvironment.make({ cache: REMOTE_READ }));
  });
});

describe("readOptionalRedactedConfigString", () => {
  it.effect(
    "wraps a configured value in Redacted and reports a missing key as none",
    Effect.fnUntraced(function* () {
      const present = yield* provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TOKEN: "secret" })))(
        readOptionalRedactedConfigString("TOKEN")
      );
      expect(O.map(present, Redacted.value)).toEqual(O.some("secret"));

      const missing = yield* provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({})))(
        readOptionalRedactedConfigString("TOKEN")
      );
      expect(O.isNone(missing)).toBe(true);
    })
  );
});

describe("canUseTurboCacheSecretSession", () => {
  const stubHandle = (exitCode: number) =>
    ChildProcessSpawner.makeHandle({
      all: Stream.empty,
      exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
      getInputFd: () => Sink.drain,
      getOutputFd: () => Stream.empty,
      isRunning: Effect.succeed(false),
      kill: () => Effect.void,
      pid: ChildProcessSpawner.ProcessId(1),
      stderr: Stream.empty,
      stdin: Sink.drain,
      stdout: Stream.empty,
      unref: Effect.succeed(Effect.void),
    });

  const sessionWith = Effect.fn("sessionWith")(function* (
    env: Record<string, string>,
    spawns: ReadonlyArray<Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>>
  ) {
    clearTurboCacheSecretSessionVerdictsForTesting();
    const spawned = yield* Ref.make(0);
    const spawner = ChildProcessSpawner.make(() =>
      Ref.getAndUpdate(spawned, (count) => count + 1).pipe(
        Effect.flatMap((index) => spawns[index] ?? spawns[spawns.length - 1] ?? Effect.succeed(stubHandle(1)))
      )
    );
    const usable = yield* provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))(
      canUseTurboCacheSecretSession("/repo")
    ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
    return { usable, spawned: yield* Ref.get(spawned) };
  });

  it.effect(
    "caches the resolvability verdict once per CLI run",
    Effect.fnUntraced(function* () {
      clearTurboCacheSecretSessionVerdictsForTesting();
      const spawned = yield* Ref.make(0);
      const spawner = ChildProcessSpawner.make(() =>
        Ref.updateAndGet(spawned, (count) => count + 1).pipe(Effect.as(stubHandle(0)))
      );
      const probe = provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({})))(
        canUseTurboCacheSecretSession("/repo/cache-once")
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
      expect(yield* probe).toBe(true);
      expect(yield* probe).toBe(true);
      expect(yield* Ref.get(spawned)).toBe(1);
    })
  );

  it.effect(
    "refuses a session under CI without probing the op CLI",
    Effect.fnUntraced(function* () {
      expect(yield* sessionWith({ CI: "true" }, [Effect.succeed(stubHandle(0))])).toEqual({
        usable: false,
        spawned: 0,
      });
    })
  );

  it.effect(
    "requires the cache references to resolve",
    Effect.fnUntraced(function* () {
      expect(yield* sessionWith({}, [Effect.succeed(stubHandle(0))])).toEqual({
        usable: true,
        spawned: 1,
      });
      expect(yield* sessionWith({}, [Effect.succeed(stubHandle(1))])).toEqual({
        usable: false,
        spawned: 1,
      });
      expect(yield* sessionWith({ CI: "false" }, [Effect.succeed(stubHandle(1))])).toEqual({
        usable: false,
        spawned: 1,
      });
      const probeFailure = PlatformError.badArgument({
        module: "ChildProcess",
        method: "spawn",
        description: "reference probe failed",
      });
      expect(yield* sessionWith({}, [Effect.fail(probeFailure)])).toEqual({
        usable: false,
        spawned: 1,
      });
    })
  );

  it.effect(
    "keeps a correct cache quad remote when an unrelated reference is stale",
    Effect.fnUntraced(function* () {
      const staleReference = "op://fixture-vault/unrelated/missing";
      const environment = {
        TURBO_API: "https://cache.example.test",
        TURBO_TOKEN: "op://fixture-vault/turbo/token",
        TURBO_TEAM: "fixture-team",
        TURBO_CACHE: TurboCacheMode.Enum.LocalWriteRemoteRead,
        STALE_SERVICE_TOKEN: staleReference,
      };
      const envFileFixture = A.join(
        [
          `TURBO_API=${environment.TURBO_API}`,
          `TURBO_TOKEN=${environment.TURBO_TOKEN}`,
          `TURBO_TEAM=${environment.TURBO_TEAM}`,
          `TURBO_CACHE=${environment.TURBO_CACHE}`,
          `STALE_SERVICE_TOKEN=${staleReference}`,
        ],
        "\n"
      );
      const fileSystemLayer = FileSystem.layerNoop({
        exists: () => Effect.succeed(true),
        readFileString: () => Effect.succeed(envFileFixture),
      });
      const spawnedEnvironments = yield* Ref.make<ReadonlyArray<Record<string, string | undefined>>>([]);
      const spawner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("the cache reference fixture never spawns a piped command");
        }
        const childEnvironment = command.options.env ?? {};
        const fails =
          A.some(command.args, Str.startsWith("--env-file=")) ||
          childEnvironment.STALE_SERVICE_TOKEN === staleReference;
        return Ref.update(spawnedEnvironments, A.append(childEnvironment)).pipe(Effect.as(stubHandle(fails ? 1 : 0)));
      });

      clearTurboCacheSecretSessionVerdictsForTesting();
      const result = yield* provideScopedLayer(
        Layer.mergeAll(ConfigProvider.layer(ConfigProvider.fromUnknown(environment)), fileSystemLayer, Path.layer)
      )(
        Effect.gen(function* () {
          const plan = resolveTurboCachePlan(readTurboCacheEnvironment(environment), { args: [], ci: false });
          const usable = yield* canUseTurboCacheSecretSession("/repo/correct-quad", environment);
          const warnings = yield* turboEnvironmentHealthWarnings("/repo/correct-quad", environment);
          return { plan, usable, warnings };
        })
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

      expect(result.plan).toEqual(
        RemoteReadTurboCache.make({
          mode: TurboCacheMode.Enum.LocalWriteRemoteRead,
          requiresSecretSession: true,
        })
      );
      expect(result.usable).toBe(true);
      expect(turboCachePlanArgs(result.plan)).toEqual(["--cache=local:rw,remote:r"]);
      expect(A.map(result.warnings, (warning) => warning.variableName)).toEqual(["STALE_SERVICE_TOKEN"]);
      const warningText = renderTurboEnvironmentHealthWarning(A.head(result.warnings).pipe(O.getOrThrow));
      expect(warningText).toContain("STALE_SERVICE_TOKEN");
      expect(warningText).not.toContain(staleReference);

      const spawned = yield* Ref.get(spawnedEnvironments);
      expect(spawned[0]?.STALE_SERVICE_TOKEN).toBeUndefined();
      expect(spawned[0]?.TURBO_TOKEN).toBe(environment.TURBO_TOKEN);
    })
  );

  it.effect(
    "fails closed when a cache-quad reference is broken",
    Effect.fnUntraced(function* () {
      const brokenReference = "op://fixture-vault/turbo/missing-token";
      const environment = {
        TURBO_API: "https://cache.example.test",
        TURBO_TOKEN: brokenReference,
        TURBO_TEAM: "fixture-team",
        TURBO_CACHE: TurboCacheMode.Enum.LocalWriteRemoteRead,
      };
      const spawner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("the cache reference fixture never spawns a piped command");
        }
        return Effect.succeed(stubHandle(command.options.env?.TURBO_TOKEN === brokenReference ? 1 : 0));
      });

      clearTurboCacheSecretSessionVerdictsForTesting();
      const result = yield* provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(environment)))(
        Effect.gen(function* () {
          const plan = resolveTurboCachePlan(readTurboCacheEnvironment(environment), { args: [], ci: false });
          const usable = yield* canUseTurboCacheSecretSession("/repo/broken-quad", environment);
          return { plan, usable };
        })
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

      expect(result.plan._tag).toBe("remote-read");
      expect(result.usable).toBe(false);
      expect(
        result.usable ? turboCachePlanArgs(result.plan) : localOnlyTurboCacheArgs(turboCachePlanArgs(result.plan))
      ).toEqual(["--cache=local:rw"]);
    })
  );

  it.effect(
    "treats a spawn failure as an unavailable op CLI",
    Effect.fnUntraced(function* () {
      const failure = PlatformError.badArgument({ module: "ChildProcess", method: "spawn", description: "ENOENT" });
      expect(yield* sessionWith({}, [Effect.fail(failure)])).toEqual({ usable: false, spawned: 1 });
    })
  );
});
