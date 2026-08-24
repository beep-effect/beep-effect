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
  LocalEnvStep,
  localEnvOpRunStep,
  nextCursor,
  readOptionalConfigString,
  renderSchemaFirstPolicyFindingLine,
  SchemaFirstPolicyFinding,
  SchemaFirstPolicyIssuePrefix,
  SchemaFirstPolicySeverity,
  turboEnvOverrides,
  withLocalEnv,
} from "@beep/repo-cli/test/SharedInternals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Data, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

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

  it("localEnvOpRunStep wraps a step in op run", () => {
    const wrapped = localEnvOpRunStep({ label: "test", command: "bun", args: ["test"], cwd: "/repo" });
    expect(wrapped.command).toBe("op");
    expect(wrapped.args).toEqual(["run", "--env-file=.env", "--", "bun", "test"]);
    expect(wrapped.label).toBe("test (op run)");
  });

  it.effect("withLocalEnv leaves an unrequested step unchanged", () => {
    const step = LocalEnvStep.make({ label: "test", command: "bun", args: ["test"], cwd: "/repo" });
    return Effect.gen(function* () {
      expect(yield* withLocalEnv(step).pipe(provideScopedLayer(NodeServices.layer))).toBe(step);
    });
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
  ): Record<string, string | undefined> => Effect.runSync(withTurboEnv(env)(turboEnvOverrides(command, args)));

  const opRunArgs = (turboArgs: ReadonlyArray<string>): ReadonlyArray<string> => [
    "run",
    "--env-file=.env",
    "--",
    "bunx",
    "turbo",
    ...turboArgs,
  ];

  it("returns nothing for a non-turbo command", () => {
    expect(overridesFor({}, "git", ["status"])).toEqual({});
    expect(overridesFor({}, "bunx", ["vitest", "run"])).toEqual({});
    expect(overridesFor({}, "op", ["run", "--env-file=.env", "--", "bun", "run", "build"])).toEqual({});
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

  // Regression guard: `op run` resolves op:// references out of the environment
  // it is handed, not only out of --env-file. Scrubbing them from a wrapped
  // spawn deletes the credential it exists to resolve, leaving the wrapped
  // turbo with none at all.
  it("keeps unresolved references intact for an op run wrapped spawn", () => {
    expect(
      overridesFor(
        { TURBO_API: OP_REFERENCE, TURBO_TOKEN: OP_REFERENCE, TURBO_TEAM: OP_REFERENCE, TURBO_CACHE: REMOTE_READ },
        "op",
        opRunArgs(["run", "check"])
      )
    ).toStrictEqual({ TURBO_UI: "false" });
  });

  it("recognizes a wrapped spawn whose turbo arguments contain their own separator", () => {
    expect(overridesFor({}, "op", opRunArgs(["run", "coverage", "--", "--maxWorkers=1"]))).toEqual({
      TURBO_UI: "false",
    });
  });
});
