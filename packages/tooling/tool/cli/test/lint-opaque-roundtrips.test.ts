import { Git, GitCommandError } from "@beep/git/Git";
import { detectOpaqueRoundtrips, lintOpaqueRoundtripsCommand } from "@beep/repo-cli/commands/Lint/OpaqueRoundtrips";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import { Project } from "ts-morph";
import { NodeTestLayer } from "./support/CommandTest.ts";

const detect = (body: string) => {
  const project = new Project({ tsConfigFilePath: "test/tsconfig.json", skipAddingFilesFromTsConfig: true });
  const source = project.createSourceFile(
    "test/__opaque_roundtrip_fixture.test.ts",
    `
    import * as S from "effect/Schema";
    import * as Result from "effect/Result";
    import * as Arbitrary from "effect/Arbitrary";
    import * as FastCheck from "effect/testing/FastCheck";
    class Value extends S.Opaque<Value, { readonly brand: unique symbol }>()(S.Struct({ value: S.String })) {}
    const Plain = S.Struct({ value: S.String });
    const expect = (actual: unknown) => ({ toStrictEqual: (expected: unknown) => undefined });
    ${body}
  `
  );
  const program = project.getProgram().compilerObject;
  return detectOpaqueRoundtrips(program)([source.compilerNode]);
};

// Compiler programs are isolated in memory; no fixture is written into the repository.
describe("opaque-roundtrips", () => {
  it.effect(
    "reports raw generated Opaque samples compared with decoded values",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      FastCheck.assert(FastCheck.property(Arbitrary.schema(Value), (sample) => {
        const decoded = Result.getOrThrow(S.decodeUnknownResult(Value)(sample));
        expect(decoded).toStrictEqual(sample);
      }));
    `)
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]?.opaque).toEqual(["Value"]);
      expect(findings[0]?.text).toBe("expect(decoded).toStrictEqual(sample)");
    })
  );

  it.effect(
    "reports a hoisted Arbitrary passed by name",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      const arb = Arbitrary.schema(Value);
      FastCheck.assert(FastCheck.property(arb, (sample) => {
        const decoded = Result.getOrThrow(S.decodeUnknownResult(Value)(sample));
        expect(decoded).toStrictEqual(sample);
      }));
    `)
      );
      expect(A.map(findings, (finding) => finding.opaque)).toEqual([["Value"]]);
    })
  );

  it.effect(
    "reports samples from a hoisted array of arbitraries",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      const arbitraries = [Arbitrary.schema(Value)] as const;
      const prop = (arbs: typeof arbitraries, run: (values: readonly [Value]) => void) => run;
      prop(arbitraries, ([sample]) => {
        const decoded = Result.getOrThrow(S.decodeUnknownResult(Value)(sample));
        expect(decoded).toStrictEqual(sample);
      });
    `)
      );
      expect(findings).toHaveLength(1);
    })
  );

  it.effect(
    "reports a sample rebound through a const alias",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      FastCheck.assert(FastCheck.property(Arbitrary.schema(Value), (sample) => {
        const decoded = Result.getOrThrow(S.decodeUnknownResult(Value)(sample));
        const alias = sample;
        expect(decoded).toStrictEqual(alias);
      }));
    `)
      );
      expect(findings).toHaveLength(1);
    })
  );

  it.effect(
    "reports a sample rebound through a destructuring alias",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      FastCheck.assert(FastCheck.property(Arbitrary.schema(S.Tuple([Value])), (pair) => {
        const [first] = pair;
        expect(Result.getOrThrow(S.decodeUnknownResult(Value)(first))).toStrictEqual(first);
      }));
    `)
      );
      expect(findings).toHaveLength(1);
    })
  );

  it.effect(
    "keeps the call boundary for aliases built through a call",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      const identity = <A>(value: A): A => value;
      FastCheck.assert(FastCheck.property(Arbitrary.schema(Value), (sample) => {
        const decoded = Result.getOrThrow(S.decodeUnknownResult(Value)(sample));
        const fresh = identity(sample);
        expect(decoded).toStrictEqual(fresh);
      }));
    `)
      );
      expect(findings).toHaveLength(0);
    })
  );

  it.effect(
    "accepts samples normalised with make",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      FastCheck.assert(FastCheck.property(Arbitrary.schema(Value), (sample) => {
        expect(Result.getOrThrow(S.decodeUnknownResult(Value)(sample))).toStrictEqual(Value.make(sample));
      }));
    `)
      );
      expect(findings).toHaveLength(0);
    })
  );

  it.effect(
    "accepts comparisons against a literal empty array",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      FastCheck.assert(FastCheck.property(Arbitrary.schema(Value), (sample) => {
        const decoded = Value.make(sample);
        expect([decoded]).toStrictEqual([]);
      }));
    `)
      );
      expect(findings).toHaveLength(0);
    })
  );

  it.effect(
    "accepts non-Opaque struct roundtrips",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      FastCheck.assert(FastCheck.property(Arbitrary.schema(Plain), (sample) => {
        expect(Result.getOrThrow(S.decodeUnknownResult(Plain)(sample))).toStrictEqual(sample);
      }));
    `)
      );
      expect(findings).toHaveLength(0);
    })
  );

  it.effect(
    "walks unions, intersections, arrays, tuples, and nested properties on either assertion side",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      class Other extends S.Opaque<Other, { readonly brand: unique symbol }>()(S.Struct({ other: S.String })) {}
      const property = (...args: ReadonlyArray<unknown>) => undefined;
      property(Arbitrary.schema(Value), (sample: Value | Other) => {
        expect(sample).toStrictEqual({});
      });
      property(Arbitrary.schema(Value), (sample: Value & { extra: string }) => {
        expect({}).toStrictEqual(sample);
      });
      property(Arbitrary.schema(Value), (sample: ReadonlyArray<Value>) => {
        expect(sample).toStrictEqual([]);
      });
      property(Arbitrary.schema(Value), (sample: readonly [Value, Other?]) => {
        expect([]).toStrictEqual(sample);
      });
      property(Arbitrary.schema(Value), (sample: { outer: { inner: Value } }) => {
        expect(sample).toStrictEqual({});
      });
    `)
      );
      expect(findings).toHaveLength(5);
      expect(A.map(findings, (finding) => finding.opaque)).toEqual([
        ["Other", "Value"],
        ["Value"],
        ["Value"],
        ["Other", "Value"],
        ["Value"],
      ]);
    })
  );

  it.effect(
    "collects destructured parameters and functions one call argument deep",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      const property = (...args: ReadonlyArray<unknown>) => undefined;
      const wrap = (callback: unknown) => callback;
      property(Arbitrary.schema(Value), ({ value: sample }: { value: Value }) => {
        expect(sample).toStrictEqual(Value.make(sample));
      });
      property(Arbitrary.schema(Value), wrap(function ([, sample]: readonly [string, Value]) {
        expect(Value.make(sample)).toStrictEqual(sample);
      }));
      property(Arbitrary.schema(Value), function (sample: Value) {
        expect(Value.make(sample)).toStrictEqual(sample);
      });
      // A non-function argument and a nested non-function leave the scope unchanged.
      property(Arbitrary.schema(Value), wrap("literal"));
    `)
      );
      expect(findings).toHaveLength(3);
      expect(A.map(findings, (finding) => finding.opaque)).toEqual([["Value"], ["Value"], ["Value"]]);
    })
  );

  it.effect(
    "skips brand properties, cycles, and types beyond depth eight",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      const property = (...args: ReadonlyArray<unknown>) => undefined;
      type Recursive = { next?: Recursive; value: Value };
      type Branded = { brand: Value; text: string };
      property(Arbitrary.schema(Value), (sample: Branded) => {
        expect(sample).toStrictEqual({ text: "x" });
      });
      property(Arbitrary.schema(Value), (sample: Recursive) => {
        expect(sample).toStrictEqual({});
      });
      property(Arbitrary.schema(Value), (sample: { a: { b: { c: { d: { e: { f: { g: { h: Value } } } } } } } }) => {
        expect(sample).toStrictEqual({});
      });
      property(Arbitrary.schema(Value), (sample: { a: { b: { c: { d: { e: { f: { g: { h: { i: Value } } } } } } } } }) => {
        expect(sample).toStrictEqual({});
      });
    `)
      );
      // The brand-only and over-depth values contain raw samples but no traversable Opaque type.
      expect(findings).toHaveLength(2);
      expect(A.map(findings, (finding) => finding.opaque)).toEqual([["Value"], ["Value"]]);
    })
  );

  it.effect(
    "preserves strict assertion matching, sample scope, and call boundaries",
    Effect.fnUntraced(function* () {
      const findings = yield* Effect.sync(() =>
        detect(`
      const sample = Value.make({ value: "outside" });
      expect(Value.make(sample)).toStrictEqual(sample);
      const property = (...args: ReadonlyArray<unknown>) => undefined;
      property(Arbitrary.schema(Value), (sample: Value) => {
        expect(sample).toStrictEqual(sample);
        expect(Value.make(sample)).toStrictEqual(Value.make(sample));
        expect(sample.value).toStrictEqual("literal");
        expect(sample).toStrictEqual();
        expect().toStrictEqual(sample);
        expect(sample).toEqual(Value.make(sample));
        other(sample).toStrictEqual(Value.make(sample));
        object.expect(sample).toStrictEqual(Value.make(sample));
        object.toStrictEqual(sample);
        expect(sample)["toStrictEqual"](Value.make(sample));
        expect({ sample, again: sample }).toStrictEqual(Value.make(sample));
        expect(sample).toStrictEqual(identity(sample));
      });
      property(Value, (sample: Value) => {
        expect(Value.make(sample)).toStrictEqual(sample);
      });
    `)
      );
      expect(findings).toHaveLength(2);
      expect(A.map(findings, (finding) => finding.opaque)).toEqual([["Value"], ["Value"]]);
    })
  );
});

// The scan lists tracked test files through the kit (W7b, SPEC D-19): git's exit code and a git that never ran each
// keep the command's own error.
const runCommand = Command.runWith(lintOpaqueRoundtripsCommand, { version: "0.0.0" });
const scanFailure = (error: GitCommandError) =>
  runCommand([]).pipe(
    Effect.provideService(Git, Git.makeTest({ lsFiles: () => Effect.fail(error) })),
    Effect.flip,
    Effect.map((failure) => (P.hasProperty(failure, "message") ? String(failure.message) : String(failure)))
  );

it.layer(NodeTestLayer, { timeout: "30 seconds" })("opaque-roundtrips git listing", (it) => {
  it.effect(
    "names git's exit code, or the listing a git that never ran",
    Effect.fnUntraced(function* () {
      const exited = yield* scanFailure(
        GitCommandError.make({ kind: "failed", args: ["ls-files"], cwd: ".", exitCode: 128, stderr: "fatal" })
      );
      expect(exited).toContain("exited 128");
      const unspawned = yield* scanFailure(
        GitCommandError.make({ kind: "failed", args: ["ls-files"], cwd: ".", stderr: "", detail: "spawn ENOENT" })
      );
      expect(unspawned).toContain("git ls-files");
    })
  );
});
