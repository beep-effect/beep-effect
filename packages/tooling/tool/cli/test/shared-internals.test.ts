import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";

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
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import {
  ConfigProvider,
  Console,
  Data,
  Effect,
  FileSystem,
  flow,
  Layer,
  Path,
  Redacted,
  Ref,
  Sink,
  Stream,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

class SharedInternalsTestError extends Data.TaggedError("SharedInternalsTestError")<{
  readonly message: string;
}> {}

it.layer(Layer.merge(BunCrypto.layer, Path.layer), { timeout: "10 seconds" })((it) => {
  describe("SchemaFirstPolicyFinding wire contract", { concurrent: false }, () => {
    const line = renderSchemaFirstPolicyFindingLine;

    it.effect("round-trips the emitter's warning finding unchanged", () =>
      Effect.gen(function* () {
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
        const rendered = yield* line(finding);
        expect(rendered.startsWith(SchemaFirstPolicyIssuePrefix)).toBe(true);
        const decoded = decodeSchemaFirstPolicyFindingLine(rendered);
        decoded.pipe(O.isSome, assertTrue);
        if (O.isSome(decoded)) {
          expect(decoded.value.severity).toBe("warning");
          expect(decoded.value.ruleId).toBe("SFV4-defaults");
          expect(decoded.value.remediation).toBe("Apply S.withConstructorDefault.");
          expect(decoded.value.line).toBe(12);
        }
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("round-trips an error finding", () =>
      Effect.gen(function* () {
        const finding = SchemaFirstPolicyFinding.make({
          category: "schema-first-policy",
          ruleId: "schema-first-inventory",
          severity: "error",
          file: "a.ts",
          message: "m",
          remediation: "r",
        });
        const decoded = decodeSchemaFirstPolicyFindingLine(yield* line(finding));
        assertSome(
          O.map(decoded, (f) => f.severity),
          "error"
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

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
      assertSome(
        O.map(decoded, (f) => f.severity),
        "warn"
      );
    });

    it("decodes a line with severity and remediation omitted", () => {
      const bare = `${SchemaFirstPolicyIssuePrefix}${JSON.stringify({
        category: "schema-first-policy",
        ruleId: "r",
        file: "a.ts",
        message: "m",
      })}`;
      const decoded = decodeSchemaFirstPolicyFindingLine(bare);
      decoded.pipe(O.isSome, assertTrue);
      if (O.isSome(decoded)) {
        expect(decoded.value.severity).toBeUndefined();
        expect(decoded.value.remediation).toBeUndefined();
      }
    });

    it("drops non-matching and malformed lines", () => {
      decodeSchemaFirstPolicyFindingLine("plain output line").pipe(assertNone);
      decodeSchemaFirstPolicyFindingLine(`${SchemaFirstPolicyIssuePrefix}{not json`).pipe(assertNone);
    });

    it.effect("encodes to compact JSON with no prefix", () =>
      Effect.gen(function* () {
        const json = yield* encodeSchemaFirstPolicyFinding(
          SchemaFirstPolicyFinding.make({
            category: "schema-first-policy",
            ruleId: "r",
            file: "a.ts",
            message: "m",
          })
        );
        expect(json.startsWith("{")).toBe(true);
        expect(json.includes(SchemaFirstPolicyIssuePrefix)).toBe(false);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("JsonStringCodec", { concurrent: false }, () => {
    const Point = S.Struct({ x: S.Finite, y: S.Finite });
    const codec = JsonStringCodec(Point);

    it.effect("round-trips a value through JSON text", () =>
      Effect.gen(function* () {
        const text = yield* codec.encode({ x: 1, y: 2 });
        expect(yield* codec.decode(text)).toEqual({ x: 1, y: 2 });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it("decodeOption yields None on malformed input", () => {
      codec.decodeOption("nope").pipe(assertNone);
      codec.decodeOption('{"x":1,"y":2}').pipe(O.isSome, assertTrue);
    });

    it.effect("decodeOrFail maps schema errors to a domain error", () =>
      Effect.gen(function* () {
        const decode = decodeOrFail(Point, (error) => new SharedInternalsTestError({ message: `bad: ${error._tag}` }));
        const exit = yield* Effect.exit(decode("not json"));
        expect(exit._tag).toBe("Failure");
        expect(yield* decode('{"x":3,"y":4}')).toEqual({ x: 3, y: 4 });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("GlobPattern", { concurrent: false }, () => {
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

  describe("Jsonc editing", { concurrent: false }, () => {
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

  describe("EnvConfig readers", { concurrent: false }, () => {
    const UNSET = "BEEP_SI_DEFINITELY_UNSET";

    it("configStringOptionSync reads present and absent snapshot values", () => {
      assertSome(configStringOptionSync("BEEP_SI_STR"), "value");
      configStringOptionSync(UNSET).pipe(assertNone);
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

    it.effect("Effect readers re-read the ambient provider on each call (no module-load capture)", () =>
      Effect.gen(function* () {
        const withProvider = (value: string) =>
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ TOKEN: value })
          )(readOptionalConfigString("TOKEN"));
        assertSome(yield* withProvider("first"), "first");
        assertSome(yield* withProvider("second"), "second");
        const missing = Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        )(configStringOption("TOKEN"));
        (yield* missing).pipe(assertNone);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it("classifies unresolved op:// secret references", () => {
      expect(isUnresolvedSecretReference("op://vault/item/field")).toBe(true);
      expect(isUnresolvedSecretReference("postgres://user:op://vault/item/password@host/db")).toBe(true);
      expect(isUnresolvedSecretReference("postgres://localhost")).toBe(false);
      expect(isUnresolvedSecretReference(undefined)).toBe(false);
    });
  });

  describe("Github plumbing", { concurrent: false }, () => {
    const codec = JsonStringCodec(GhPrView);

    it.effect("GhPrView decodes the narrow monitor payload", () =>
      Effect.gen(function* () {
        const view = yield* codec.decode('{"number":7,"headRefName":"feat","state":"OPEN"}');
        expect(view.number).toBe(7);
        expect(view.url).toBeUndefined();
        expect(view.isDraft).toBeUndefined();
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("GhPrView decodes the wide closeout payload", () =>
      Effect.gen(function* () {
        const view = yield* codec.decode(
          '{"number":7,"headRefName":"feat","state":"OPEN","url":"https://github.com/o/r/pull/7","headRefOid":"abc123","isDraft":false}'
        );
        expect(view.url).toBe("https://github.com/o/r/pull/7");
        expect(view.isDraft).toBe(false);
        expect(view.headRefOid).toBe("abc123");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it("cursorArgs builds the -F cursor pair only when present", () => {
      expect(cursorArgs(O.some("abc"))).toEqual(["-F", "cursor=abc"]);
      expect(cursorArgs(O.none())).toEqual([]);
    });

    it.effect("nextCursor completes pagination when there is no next page", () =>
      Effect.gen(function* () {
        const result = yield* nextCursor({
          pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: false }),
          label: "comments",
          onMissingCursor: (label) => new SharedInternalsTestError({ message: label }),
        });
        result.pipe(assertNone);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("nextCursor yields the next cursor when a page follows", () =>
      Effect.gen(function* () {
        const result = yield* nextCursor({
          pageInfo: GhPageInfo.make({ endCursor: "next", hasNextPage: true }),
          label: "comments",
          onMissingCursor: (label) => new SharedInternalsTestError({ message: label }),
        });
        assertSome(result, "next");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("nextCursor fails when another page has no end cursor", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          nextCursor({
            pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: true }),
            label: "comments",
            onMissingCursor: (label) => new SharedInternalsTestError({ message: `${label} missing cursor` }),
          })
        );
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("turboEnvOverrides", { concurrent: false }, () => {
    const OP_REFERENCE = "op://vault/item/credential";
    const REMOTE_READ = "local:rw,remote:r";

    const withTurboEnv = (env: Record<string, string>) =>
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

    const overridesFor = (env: Record<string, string>, command: string, args: ReadonlyArray<string>) =>
      turboEnvOverrides(command, args, env).pipe(withTurboEnv(env));

    const opRunArgs = (turboArgs: ReadonlyArray<string>): ReadonlyArray<string> => [
      "run",
      "--",
      "bunx",
      "turbo",
      ...turboArgs,
    ];

    it.effect("returns nothing for a non-turbo command", () =>
      Effect.gen(function* () {
        expect(yield* overridesFor({}, "git", ["status"])).toEqual({});
        expect(yield* overridesFor({}, "bunx", ["vitest", "run"])).toEqual({});
        expect(yield* overridesFor({}, "op", ["run", "--", "bun", "run", "build"])).toEqual({});
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("guards the TUI on a direct turbo spawn with resolved credentials", () =>
      Effect.gen(function* () {
        expect(
          yield* overridesFor({ TURBO_TOKEN: "resolved", TURBO_TEAM: "beep", TURBO_CACHE: REMOTE_READ }, "bunx", [
            "turbo",
            "run",
            "check",
          ])
        ).toEqual({ TURBO_UI: "false" });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("scrubs unresolved references and pins the cache posture on a direct spawn", () =>
      Effect.gen(function* () {
        expect(
          yield* overridesFor(
            { TURBO_API: OP_REFERENCE, TURBO_TOKEN: OP_REFERENCE, TURBO_TEAM: OP_REFERENCE, TURBO_CACHE: REMOTE_READ },
            "bunx",
            ["turbo", "run", "check"]
          )
        ).toStrictEqual({
          TURBO_UI: "false",
          TURBO_API: undefined,
          TURBO_TOKEN: undefined,
          TURBO_TEAM: undefined,
          TURBO_CACHE: "local:rw",
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("unsets unrelated unresolved references on a direct spawn and keeps literals", () =>
      Effect.gen(function* () {
        expect(
          yield* overridesFor(
            {
              PATH: "/fixture/bin",
              SAFE_LITERAL: "fixture-value",
              TURBO_TOKEN: "resolved",
              TURBO_TEAM: "beep",
              TURBO_CACHE: REMOTE_READ,
              UNRELATED_SECRET: "op://fixture-vault/unrelated/secret",
              UNRELATED_DATABASE_URL: "postgres://user:op://fixture-vault/database/password@db.test/database",
            },
            "bunx",
            ["turbo", "run", "build"]
          )
        ).toStrictEqual({
          UNRELATED_SECRET: undefined,
          UNRELATED_DATABASE_URL: undefined,
          TURBO_UI: "false",
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("gives a wrapped spawn only Turbo secret references and a non-extending environment", () =>
      Effect.gen(function* () {
        const environment = {
          PATH: "/fixture/bin",
          SAFE_LITERAL: "fixture-value",
          TURBO_API: "op://fixture-vault/turbo/api",
          TURBO_TOKEN: "op://fixture-vault/turbo/token",
          TURBO_TEAM: "op://fixture-vault/turbo/team",
          TURBO_CACHE: REMOTE_READ,
          UNRELATED_SECRET: "op://fixture-vault/unrelated/secret",
          UNRELATED_DATABASE_URL: "postgres://user:op://fixture-vault/database/password@db.test/database",
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
        expect(yield* overridesFor(environment, "op", args)).toStrictEqual({ ...sanitized, TURBO_UI: "false" });
        expect(turboEnvExtendsAmbient("op", args)).toBe(false);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("recognizes a wrapped spawn whose turbo arguments contain their own separator", () =>
      Effect.gen(function* () {
        const args = opRunArgs(["run", "coverage", "--", "--maxWorkers=1"]);

        expect(yield* overridesFor({}, "op", args)).toEqual({ TURBO_UI: "false" });
        expect(turboEnvExtendsAmbient("op", args)).toBe(false);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  // Every classification arm is reachable from an explicit record, so the
  // file's measured coverage no longer depends on which Turbo posture the host
  // process happens to carry (ship-velocity B9).
  describe("readTurboCacheEnvironment", { concurrent: false }, () => {
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

  describe("readOptionalRedactedConfigString", { concurrent: false }, () => {
    it.effect("wraps a configured value in Redacted and reports a missing key as none", () =>
      Effect.gen(function* () {
        const present = yield* Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ TOKEN: "secret" })
        )(readOptionalRedactedConfigString("TOKEN"));
        assertSome(O.map(present, Redacted.value), "secret");

        const missing = yield* Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        )(readOptionalRedactedConfigString("TOKEN"));
        missing.pipe(assertNone);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("canUseTurboCacheSecretSession", { concurrent: false }, () => {
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
      const usable = yield* Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown(env)
      )(canUseTurboCacheSecretSession("/repo")).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
      return { usable, spawned: yield* Ref.get(spawned) };
    });

    it.effect("caches the resolvability verdict once per CLI run", () =>
      Effect.gen(function* () {
        clearTurboCacheSecretSessionVerdictsForTesting();
        const spawned = yield* Ref.make(0);
        const spawner = ChildProcessSpawner.make(() =>
          Ref.updateAndGet(spawned, (count) => count + 1).pipe(Effect.as(stubHandle(0)))
        );
        const probe = Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        )(canUseTurboCacheSecretSession("/repo/cache-once")).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        expect(yield* probe).toBe(true);
        expect(yield* probe).toBe(true);
        expect(yield* Ref.get(spawned)).toBe(1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a session under CI without probing the op CLI", () =>
      Effect.gen(function* () {
        expect(yield* sessionWith({ CI: "true" }, [Effect.succeed(stubHandle(0))])).toEqual({
          usable: false,
          spawned: 0,
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("requires the cache references to resolve", () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps a correct cache quad remote when an unrelated reference is stale", () =>
      Effect.gen(function* () {
        const staleReference = "postgres://user:op://fixture-vault/unrelated/missing@db.test/database";
        const environment = {
          TURBO_API: "https://cache.example.test",
          TURBO_TOKEN: "op://fixture-vault/turbo/token",
          TURBO_TEAM: "fixture-team",
          TURBO_CACHE: TurboCacheMode.Enum["local:rw,remote:r"],
          STALE_DATABASE_URL: staleReference,
        };
        const envFileFixture = A.join(
          [
            `TURBO_API=${environment.TURBO_API}`,
            `TURBO_TOKEN=${environment.TURBO_TOKEN}`,
            `TURBO_TEAM=${environment.TURBO_TEAM}`,
            `TURBO_CACHE=${environment.TURBO_CACHE}`,
            `STALE_DATABASE_URL=${staleReference}`,
          ],
          "\n"
        );
        const fileSystemLayer = FileSystem.makeNoop({
          exists: () => Effect.succeed(true),
          readFileString: () => Effect.succeed(envFileFixture),
        });
        const spawnedCommands = yield* Ref.make<
          ReadonlyArray<{
            readonly args: ReadonlyArray<string>;
            readonly environment: Record<string, string | undefined>;
          }>
        >([]);
        const spawner = ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) {
            return Effect.die("the cache reference fixture never spawns a piped command");
          }
          const childEnvironment = command.options.env ?? {};
          const fails =
            A.some(command.args, Str.startsWith("--env-file=")) ||
            childEnvironment.STALE_DATABASE_URL === staleReference;
          return Ref.update(spawnedCommands, A.append({ args: command.args, environment: childEnvironment })).pipe(
            Effect.as(stubHandle(fails ? 1 : 0))
          );
        });

        clearTurboCacheSecretSessionVerdictsForTesting();
        const result = yield* flow(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment)),
          Effect.provideService(FileSystem.FileSystem, fileSystemLayer)
        )(
          Effect.gen(function* () {
            const plan = resolveTurboCachePlan(readTurboCacheEnvironment(environment), { args: [], ci: false });
            const usable = yield* canUseTurboCacheSecretSession("/repo/correct-quad", environment);
            const warnings = yield* turboEnvironmentHealthWarnings("/repo/correct-quad", environment);
            const cachedWarnings = yield* turboEnvironmentHealthWarnings("/repo/correct-quad", environment);
            return { cachedWarnings, plan, usable, warnings };
          })
        ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

        expect(result.plan).toEqual(
          RemoteReadTurboCache.make({
            mode: TurboCacheMode.Enum["local:rw,remote:r"],
            requiresSecretSession: true,
          })
        );
        expect(result.usable).toBe(true);
        expect(result.cachedWarnings).toBe(result.warnings);
        expect(turboCachePlanArgs(result.plan)).toEqual(["--cache=local:rw,remote:r"]);
        expect(A.map(result.warnings, (warning) => warning.variableName)).toEqual(["STALE_DATABASE_URL"]);
        const warningText = renderTurboEnvironmentHealthWarning(A.head(result.warnings).pipe(O.getOrThrow));
        expect(warningText).toContain("STALE_DATABASE_URL");
        expect(warningText).not.toContain(staleReference);

        const spawned = yield* Ref.get(spawnedCommands);
        expect(spawned[0]?.args).toEqual(["run", "--", "true"]);
        expect(spawned[0]?.environment.STALE_DATABASE_URL).toBeUndefined();
        expect(spawned[0]?.environment.TURBO_TOKEN).toBe(environment.TURBO_TOKEN);
        const wholeFileProbe = A.findFirst(spawned, ({ args }) => A.some(args, Str.startsWith("--env-file="))).pipe(
          O.getOrThrow
        );
        expect(wholeFileProbe.args).toEqual(["run", "--env-file=/repo/correct-quad/.env", "--", "true"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps environment-health file fallbacks and healthy references non-blocking", () =>
      Effect.gen(function* () {
        const fileSystemError = (method: string, pathOrDescriptor: string) =>
          PlatformError.systemError({
            _tag: "PermissionDenied",
            module: "FileSystem",
            method,
            pathOrDescriptor,
            description: "fixture denied",
          });
        const spawner = ChildProcessSpawner.make(() => Effect.succeed(stubHandle(0)));
        const warningsWith = (repoRoot: string, fileSystemLayer: FileSystem.FileSystem) =>
          Effect.provideService(
            FileSystem.FileSystem,
            fileSystemLayer
          )(turboEnvironmentHealthWarnings(repoRoot, {})).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
          );

        clearTurboCacheSecretSessionVerdictsForTesting();
        const existsFailure = yield* warningsWith(
          "/repo/exists-failure",
          FileSystem.makeNoop({
            exists: (target) => Effect.fail(fileSystemError("exists", target)),
          })
        );
        const readFailure = yield* warningsWith(
          "/repo/read-failure",
          FileSystem.makeNoop({
            exists: () => Effect.succeed(true),
            readFileString: (target) => Effect.fail(fileSystemError("readFileString", target)),
          })
        );
        const referenceFree = yield* warningsWith(
          "/repo/reference-free",
          FileSystem.makeNoop({
            exists: () => Effect.succeed(true),
            readFileString: () => Effect.succeed("PLAIN_VALUE=fixture\n# no secret references"),
          })
        );
        const healthy = yield* warningsWith(
          "/repo/healthy-reference",
          FileSystem.makeNoop({
            exists: () => Effect.succeed(true),
            readFileString: () => Effect.succeed("SERVICE_TOKEN=op://fixture-vault/service/token"),
          })
        );

        expect(existsFailure).toEqual([]);
        expect(readFailure).toEqual([]);
        expect(referenceFree).toEqual([]);
        expect(healthy).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails closed when a cache-quad reference is broken", () =>
      Effect.gen(function* () {
        const brokenReference = "op://fixture-vault/turbo/missing-token";
        const environment = {
          TURBO_API: "https://cache.example.test",
          TURBO_TOKEN: brokenReference,
          TURBO_TEAM: "fixture-team",
          TURBO_CACHE: TurboCacheMode.Enum["local:rw,remote:r"],
        };
        const spawner = ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) {
            return Effect.die("the cache reference fixture never spawns a piped command");
          }
          return Effect.succeed(stubHandle(command.options.env?.TURBO_TOKEN === brokenReference ? 1 : 0));
        });

        clearTurboCacheSecretSessionVerdictsForTesting();
        const result = yield* Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown(environment)
        )(
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
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("treats a spawn failure as an unavailable op CLI", () =>
      Effect.gen(function* () {
        const failure = PlatformError.badArgument({ module: "ChildProcess", method: "spawn", description: "ENOENT" });
        expect(yield* sessionWith({}, [Effect.fail(failure)])).toEqual({ usable: false, spawned: 1 });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
