import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { provideSpawner } from "./support/ScriptedProcess.ts";

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

import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";

Bun.env.BEEP_SI_BOOL_YES = "YES";
Bun.env.BEEP_SI_BOOL_BAD = "maybe";

import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  booleanEnvValue,
  canUseTurboCacheSecretSession,
  clearTurboCacheSecretSessionVerdictsForTesting,
  configStringEqualsSync,
  configStringOption,
  configStringOptionSync,
  envValue,
  intEnvValue,
  isUnresolvedSecretReference,
  readOptionalConfigString,
  readOptionalRedactedConfigString,
  readTurboCacheEnvironment,
  renderTurboEnvironmentHealthWarnings,
  resolveTurboCacheStep,
  turboCacheSecretSessionEnvironment,
  turboEnvExtendsAmbient,
  turboEnvironmentHealthWarnings,
  turboEnvOverrides,
} from "@beep/repo-cli-kit/cli/EnvConfig";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli-kit/cli/Jsonc";
import {
  localOnlyTurboCacheArgs,
  RemoteReadTurboCache,
  resolveTurboCachePlan,
  TurboCacheEnvironment,
  TurboCacheMode,
  TurboEnvironmentHealthWarning,
  turboCachePlanArgs,
} from "@beep/repo-cli-kit/cli/TurboCache";
import { QualityTaskStep } from "@beep/repo-cli-kit/process/StepExec";
import { decodeOrFail, JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { ScriptResult } from "@beep/commands/ScriptedSpawner";

class SharedInternalsTestError extends S.TaggedError<SharedInternalsTestError, { readonly brand: unique symbol }>()(
  "SharedInternalsTestError",
  {
    message: S.String,
  }
) {}

it.layer(Layer.merge(BunCrypto.layer, Path.layer), { timeout: "10 seconds" })((it) => {
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
        const decode = decodeOrFail(Point, (error) => SharedInternalsTestError.make({ message: `bad: ${error._tag}` }));
        const exit = yield* Effect.exit(decode("not json"));
        expect(exit._tag).toBe("Failure");
        expect(yield* decode('{"x":3,"y":4}')).toEqual({ x: 3, y: 4 });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("Jsonc editing", { concurrent: false }, () => {
    it("modifies a value while preserving comments and formatting", () => {
      const source = '{\n  // keep me\n  "a": 1,\n  "b": 2\n}';
      const next = applyJsoncModification(JsoncModification.make({ content: source, path: ["a"], value: 42 }));
      expect(Str.includes("// keep me")(next)).toBe(true);
      expect(Str.includes('"a": 42')(next)).toBe(true);
      expect(Str.includes('"b": 2')(next)).toBe(true);
    });

    // Parity pins: the bytes jsonc-parser 3.3.1 `modify` + `applyEdits` produced for the same
    // requests before R3b moved the facade onto @beep/jsonc.
    it("appends, deletes and creates exactly as jsonc-parser did", () => {
      const source = '{\n  "workspaces": ["a"], // keep\n  "b": {}\n}\n';
      expect(
        applyJsoncModification(
          JsoncModification.make({ content: source, path: ["workspaces", 1], value: "c", isArrayInsertion: true })
        )
      ).toBe('{\n  "workspaces": [\n    "a",\n    "c"\n  ], // keep\n  "b": {}\n}\n');
      expect(applyJsoncModification(JsoncModification.make({ content: source, path: ["b"], value: undefined }))).toBe(
        '{\n  "workspaces": [\n    "a"\n  ]\n}\n'
      );
      expect(
        applyJsoncModification(JsoncModification.make({ content: source, path: ["b", "x"], value: { y: [] } }))
      ).toBe('{\n  "workspaces": ["a"], // keep\n  "b": {\n    "x": {\n      "y": []\n    }\n  }\n}\n');
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

  describe("turboEnvOverrides", { concurrent: false }, () => {
    const OP_REFERENCE = "op://vault/item/credential";
    const REMOTE_READ = "local:rw,remote:r";

    const withTurboEnv = (env: Record<string, string>) =>
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

    const overridesFor = (env: Record<string, string>, command: string, args: ReadonlyArray<string>) =>
      turboEnvOverrides(command, args, env).pipe(withTurboEnv(env));

    it.effect("sanitizes native Turbo binaries and their cache-only secret-session wrappers", () =>
      Effect.gen(function* () {
        const environment = { TURBO_TOKEN: OP_REFERENCE, APPLICATION_TOKEN: OP_REFERENCE };
        for (const command of ["turbo", "/repo/node_modules/.bin/turbo"]) {
          const direct = yield* overridesFor(environment, command, ["run", "docgen"]);
          expect(direct).toHaveProperty("TURBO_TOKEN", undefined);
          expect(direct).toHaveProperty("APPLICATION_TOKEN", undefined);
          expect(direct).toHaveProperty("TURBO_CACHE", "local:rw");
          const args = ["run", "--", command, "run", "docgen"];
          const wrapped = yield* overridesFor(environment, "op", args);
          expect(wrapped).toHaveProperty("TURBO_TOKEN", OP_REFERENCE);
          expect(wrapped).not.toHaveProperty("APPLICATION_TOKEN");
          expect(turboEnvExtendsAmbient("op", args)).toBe(false);
        }
      })
    );

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

    it.effect("resolves signing references only through the cache secret session", () =>
      Effect.gen(function* () {
        const environment = { TURBO_REMOTE_CACHE_SIGNATURE_KEY: OP_REFERENCE, APPLICATION_TOKEN: OP_REFERENCE };
        const direct = yield* overridesFor(environment, "bunx", ["turbo", "run", "check"]);
        expect(direct).toHaveProperty("TURBO_REMOTE_CACHE_SIGNATURE_KEY", undefined);
        const wrapped = yield* overridesFor(environment, "op", ["run", "--", "bunx", "turbo", "run", "check"]);
        expect(wrapped).toHaveProperty("TURBO_REMOTE_CACHE_SIGNATURE_KEY", OP_REFERENCE);
        expect(wrapped).not.toHaveProperty("APPLICATION_TOKEN");
      })
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
    // The nth spawn takes the nth reply (the last one repeats); the spawn is recorded before the script runs.
    const sessionWith = Effect.fn("sessionWith")(function* (
      env: Record<string, string>,
      replies: ReadonlyArray<ScriptResult.Encoded>
    ) {
      clearTurboCacheSecretSessionVerdictsForTesting();
      const spawner: ScriptedSpawner = ScriptedSpawner.make(() =>
        A.get(replies, spawner.spawns.length - 1).pipe(
          O.orElse(() => A.last(replies)),
          O.getOrElse((): ScriptResult.Encoded => ({ exit: 1 }))
        )
      );
      const usable = yield* Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown(env)
      )(canUseTurboCacheSecretSession("/repo")).pipe(provideSpawner(spawner));
      return { usable, spawned: spawner.spawns.length };
    });

    it.effect("resolves native Turbo references once and fails closed without changing step metadata", () =>
      Effect.gen(function* () {
        const environment = {
          TURBO_API: "http://127.0.0.1:9427",
          TURBO_TOKEN: "op://fixture/cache/bearer",
          TURBO_TEAM: "fixture",
          TURBO_CACHE: "local:rw,remote:rw",
          BEEP_TURBO_TRUSTED_WRITER: "true",
          APPLICATION_REFERENCE: "op://fixture/application/secret",
        };
        const step = QualityTaskStep.make({
          label: "native docgen",
          command: "/repo/node_modules/.bin/turbo",
          args: ["run", "docgen", "--cache=local:rw,remote:rw"],
          cwd: "/repo",
          captureTimeoutMillis: 1234,
          env: { SAFE_LITERAL: "fixture" },
        });
        for (const exitCode of [0, 78]) {
          clearTurboCacheSecretSessionVerdictsForTesting();
          const spawner = ScriptedSpawner.make(() => ({ exit: exitCode }));
          const result = yield* resolveTurboCacheStep(step, environment).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ CI: "false" })),
            provideSpawner(spawner)
          );
          expect(spawner.spawns.length).toBe(1);
          expect(result.cwd).toBe(step.cwd);
          expect(result.captureTimeoutMillis).toBe(1234);
          expect(result.env?.SAFE_LITERAL).toBe("fixture");
          if (exitCode === 0) {
            expect(result.command).toBe("op");
            expect(result.args).toEqual(["run", "--", step.command, ...step.args]);
            expect(result.env?.TURBO_TOKEN).toBe(environment.TURBO_TOKEN);
            expect(result.env?.APPLICATION_REFERENCE).toBeUndefined();
          } else {
            expect(result.command).toBe(step.command);
            expect(result.args).toEqual(["run", "docgen", "--cache=local:rw"]);
          }
        }
      })
    );

    it.effect("does not open a secret session for literal credentials, local-only Turbo or other commands", () =>
      Effect.gen(function* () {
        // Own double: a never-spawn guard dies on any spawn; ScriptedSpawner has no defect outcome.
        const spawner = ChildProcessSpawner.make(() => Effect.die("an unnecessary secret session was opened"));
        for (const step of [
          QualityTaskStep.make({ label: "git", command: "git", args: ["status"], cwd: "/repo" }),
          QualityTaskStep.make({
            label: "local",
            command: "turbo",
            args: ["run", "build", "--cache=local:rw"],
            cwd: "/repo",
          }),
          QualityTaskStep.make({
            label: "literal",
            command: "turbo",
            args: ["run", "build", "--cache=local:rw,remote:r"],
            cwd: "/repo",
          }),
        ]) {
          expect(
            yield* resolveTurboCacheStep(step, {
              TURBO_API: "https://cache.example.test",
              TURBO_TOKEN: "fixture-literal",
              TURBO_TEAM: "fixture",
              TURBO_CACHE: "local:rw,remote:r",
            }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
          ).toBe(step);
        }
      })
    );

    it.effect("caches the resolvability verdict once per CLI run", () =>
      Effect.gen(function* () {
        clearTurboCacheSecretSessionVerdictsForTesting();
        const spawner = ScriptedSpawner.make(() => ({}));
        const probe = Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        )(canUseTurboCacheSecretSession("/repo/cache-once")).pipe(provideSpawner(spawner));
        expect(yield* probe).toBe(true);
        expect(yield* probe).toBe(true);
        expect(spawner.spawns.length).toBe(1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a session under CI without probing the op CLI", () =>
      Effect.gen(function* () {
        expect(yield* sessionWith({ CI: "true" }, [{}])).toEqual({
          usable: false,
          spawned: 0,
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("requires the cache references to resolve", () =>
      Effect.gen(function* () {
        expect(yield* sessionWith({}, [{}])).toEqual({
          usable: true,
          spawned: 1,
        });
        expect(yield* sessionWith({}, [{ exit: 1 }])).toEqual({
          usable: false,
          spawned: 1,
        });
        expect(yield* sessionWith({ CI: "false" }, [{ exit: 1 }])).toEqual({
          usable: false,
          spawned: 1,
        });
        const probeFailure = PlatformError.badArgument({
          module: "ChildProcess",
          method: "spawn",
          description: "reference probe failed",
        });
        expect(yield* sessionWith({}, [probeFailure])).toEqual({
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
        // The spawn is recorded before the script runs, so the last record carries this child's environment.
        const spawner: ScriptedSpawner = ScriptedSpawner.make((_command, args) => ({
          exit:
            A.some(args, Str.startsWith("--env-file=")) ||
            O.exists(A.last(spawner.spawns), (spawn) => spawn.env?.STALE_DATABASE_URL === staleReference)
              ? 1
              : 0,
        }));

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
        ).pipe(provideSpawner(spawner));

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
        const warningText = renderTurboEnvironmentHealthWarnings(result.warnings).pipe(O.getOrThrow);
        expect(warningText).toContain("STALE_DATABASE_URL");
        expect(warningText).not.toContain(staleReference);

        const spawned = spawner.spawns;
        expect(spawned[0]?.args).toEqual(["run", "--", "true"]);
        expect(spawned[0]?.env?.STALE_DATABASE_URL).toBeUndefined();
        expect(spawned[0]?.env?.TURBO_TOKEN).toBe(environment.TURBO_TOKEN);
        const wholeFileProbe = A.findFirst(spawned, ({ args }) => A.some(args, Str.startsWith("--env-file="))).pipe(
          O.getOrThrow
        );
        expect(wholeFileProbe.args).toEqual(["run", "--env-file=/repo/correct-quad/.env", "--", "true"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it("summarizes many environment-health warnings on one value-free line", () => {
      const warningsFor = A.map((variableName: string) => TurboEnvironmentHealthWarning.make({ variableName }));
      const names = ["ONE_KEY", "TWO_KEY", "THREE_KEY", "FOUR_KEY", "FIVE_KEY", "SIX_KEY", "SEVEN_KEY"];

      assertNone(renderTurboEnvironmentHealthWarnings([]));

      const many = renderTurboEnvironmentHealthWarnings(warningsFor(names)).pipe(O.getOrThrow);
      expect(Str.split(many, "\n")).toHaveLength(1);
      expect(many).toContain("7 .env variables have unavailable 1Password references");
      expect(many).toContain("ONE_KEY, TWO_KEY, THREE_KEY, FOUR_KEY, FIVE_KEY, and 2 more");
      expect(many).not.toContain("SIX_KEY");
      expect(many).toContain("TURBO_API, TURBO_TOKEN, TURBO_TEAM, and TURBO_CACHE");

      const few = renderTurboEnvironmentHealthWarnings(warningsFor(A.take(names, 2))).pipe(O.getOrThrow);
      expect(few).toContain("2 .env variables have unavailable 1Password references (ONE_KEY, TWO_KEY)");
    });

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
        const spawner = ScriptedSpawner.make(() => ({}));
        const warningsWith = (repoRoot: string, fileSystemLayer: FileSystem.FileSystem) =>
          Effect.provideService(
            FileSystem.FileSystem,
            fileSystemLayer
          )(turboEnvironmentHealthWarnings(repoRoot, {})).pipe(provideSpawner(spawner));

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
        // The spawn is recorded before the script runs, so the last record carries this child's environment.
        const spawner: ScriptedSpawner = ScriptedSpawner.make(() => ({
          exit: O.exists(A.last(spawner.spawns), (spawn) => spawn.env?.TURBO_TOKEN === brokenReference) ? 1 : 0,
        }));

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
        ).pipe(provideSpawner(spawner));

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
        expect(yield* sessionWith({}, [failure])).toEqual({ usable: false, spawned: 1 });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
