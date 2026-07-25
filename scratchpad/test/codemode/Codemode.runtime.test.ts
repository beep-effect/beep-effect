import { A, R } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Random } from "effect";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import * as CodeMode from "../../codemode/Codemode.service.ts";
import * as OpenAPI from "../../codemode/openapi/index.ts";

describe("CodeMode runtime", () => {
  it.effect(
    "preserves JavaScript truthiness through conditionals, logical expressions, and loops",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let iterations = 0
          do { iterations += 1 } while (0)
          return [
            false ? "wrong" : "false",
            0 && "wrong",
            "" || "fallback",
            null ?? "fallback",
            false ?? "kept",
            iterations
          ]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make("false", 0, "fallback", "fallback", false, 1));
      }
    })
  );

  it.effect(
    "preserves logical assignment truthiness and short-circuit results",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let zero = 0
          let one = 1
          let empty = ""
          const orResult = zero ||= 2
          const andResult = one &&= 3
          const skippedResult = empty &&= 4
          return [zero, one, empty, orResult, andResult, skippedResult]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make(2, 3, "", 2, 3, ""));
      }
    })
  );

  it.effect(
    "keeps empty arrays empty across boundary copying",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          const [first, fallback = 2, ...tail] = [1]
          return [first, fallback, tail, "a,b".split(undefined, 0)]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make(1, 2, A.empty(), A.empty()));
      }
    })
  );

  it.effect(
    "rejects constant assignment and opaque references with guest-visible errors",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let constantError
          let stringError
          let updateError
          try { const value = 1; value = 2 } catch (error) { constantError = error.name }
          const opaque = () => 1
          try { "abc".includes(opaque) } catch (error) { stringError = error.message }
          try { opaque++ } catch (error) { updateError = error.message }
          return [constantError, stringError, updateError]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(
          result.value,
          A.make(
            "TypeError",
            "String.includes expects argument 1 to be a data value.",
            "'++' requires a data value."
          )
        );
      }
    })
  );

  it.effect(
    "reads Math.random from the Effect Random service",
    Effect.fnUntraced(function* () {
      const deterministicRandom: typeof Random.Random.Service = {
        nextDoubleUnsafe: () => 0.125,
        nextIntUnsafe: () => 7,
      };
      const result = yield* CodeMode.execute({ code: "return Math.random()" }).pipe(
        Effect.provideService(Random.Random, deterministicRandom)
      );

      assert.strictEqual(result.ok, true);
      if (result.ok === true) assert.strictEqual(result.value, 0.125);
    })
  );

  it.effect(
    "reads Date.now and constructs no-argument Dates from the Effect clock",
    Effect.fnUntraced(function* () {
      const epochMillis = 1_700_000_000_000;
      yield* TestClock.setTime(epochMillis);
      const result = yield* CodeMode.execute({
        code: "return [Date.now(), new Date().getTime()]",
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make(epochMillis, epochMillis));
      }
    })
  );

  it.effect(
    "dispatches primitive coercions through the name-tagged schema union",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          const date = new Date(0)
          const map = new Map()
          return [
            Boolean(date),
            Number(date),
            isFinite(date),
            isNaN(map),
            Number(),
            String(),
            parseInt("ff", 16),
            parseFloat("1.5x")
          ]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make(true, 0, true, true, 0, "", 255, 1.5));
      }
    })
  );

  it.effect(
    "consumes URI Results and keeps malformed URI failures guest-catchable",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let malformed
          try { decodeURIComponent("%") } catch (error) { malformed = error.name }
          return [encodeURIComponent("a b"), malformed]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make("a%20b", "URIError"));
      }
    })
  );

  it.effect(
    "keeps JSON and RegExp native failures in the typed guest error channel",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let parseError
          let regexpError
          try { JSON.parse("{") } catch (error) { parseError = error.name }
          try { "value".match("[") } catch (error) { regexpError = error.name }
          return [parseError, regexpError]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make("SyntaxError", "SyntaxError"));
      }
    })
  );

  it.effect(
    "evaluates every finite binary family without operand assertions",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let value = 2
          value **= 3
          return [
            "a" + 1,
            "10" < "2",
            "10" < 2,
            7 >>> 1,
            "key" in { key: true },
            value
          ]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make("a1", true, false, 3, true, 8));
      }
    })
  );

  it.effect(
    "preserves invalid Date recovery without constructing a native host Date",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          const value = new Date(NaN)
          const returned = value.setUTCFullYear(2024, 0, 2)
          return [
            returned === value.getTime(),
            value.getUTCFullYear(),
            value.getUTCMonth(),
            value.getUTCDate()
          ]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make(true, 2024, 0, 2));
      }
    })
  );

  it.effect(
    "keeps custom iterator identity and reads return only when closing",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          let closed = "none"
          const iterator = {
            next: () => ({ done: false, value: 1 }),
            return: () => { closed = "old"; return { done: true } }
          }
          const iterable = {
            [Symbol.iterator]: () => iterator
          }
          for (const value of iterable) {
            iterator.return = () => { closed = "new"; return { done: true } }
            break
          }
          return closed
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) assert.strictEqual(result.value, "new");
    })
  );

  it.effect(
    "keeps promise handles reference-hashed inside Effect collections",
    Effect.fnUntraced(function* () {
      const result = yield* CodeMode.execute({
        code: `
          const settled = await Promise.allSettled([Promise.reject(new Error("boom"))])
          return [settled[0].reason instanceof Error, settled[0].reason.message]
        `,
      });

      assert.strictEqual(result.ok, true);
      if (result.ok === true) {
        assert.deepEqual(result.value, A.make(true, "boom"));
      }
    })
  );

  it.effect(
    "returns a typed invalid-limits failure",
    Effect.fnUntraced(function* () {
      const error = yield* CodeMode.resolveExecutionLimits({ timeoutMs: 0 }).pipe(Effect.flip);

      assert.strictEqual(S.is(CodeMode.InvalidExecutionLimits)(error), true);
      assert.strictEqual(error._tag, "InvalidExecutionLimits");
    })
  );
});

describe("OpenAPI adapter", () => {
  it.effect(
    "decodes raw input into a Toolkit, handlers Layer, and skipped-operation report",
    Effect.fnUntraced(function* () {
      const result = yield* OpenAPI.fromSpec({
        spec: {
          openapi: "3.1.0",
          info: { title: "Users", version: "1.0.0" },
          paths: {
            "/users/{id}": {
              get: {
                operationId: "getUser",
                parameters: [
                  {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                  },
                ],
                responses: {
                  "200": {
                    description: "User",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: { id: { type: "string" } },
                          required: ["id"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        baseUrl: "https://api.example.test",
      });

      expect(R.keys(result.toolkit.tools)).toEqual(A.make("getUser"));
      expect(result.skipped).toEqual(A.empty());
      assert.strictEqual(S.is(OpenAPI.FromSpecResult)(result), true);
    })
  );

  it.effect(
    "fails malformed adapter options with a schema-owned error",
    Effect.fnUntraced(function* () {
      const error = yield* OpenAPI.fromSpec({ spec: null }).pipe(Effect.flip);

      assert.strictEqual(S.is(OpenAPI.InvalidOpenApiOptions)(error), true);
      assert.strictEqual(error._tag, "InvalidOpenApiOptions");
    })
  );
});
