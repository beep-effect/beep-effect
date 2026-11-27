import { REDACTED, Redaction, SECRET_FLAGS } from "@beep/commands/Redaction";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const secret = (value: string) => Redacted.make(value);

describe("Redaction.apply", () => {
  it("replaces every occurrence of a secret's value", () => {
    const text = "token=hunter2 and again hunter2";
    assert.strictEqual(Redaction.apply(text, [secret("hunter2")]), `token=${REDACTED} and again ${REDACTED}`);
  });

  it("leaves text untouched when no secret occurs", () => {
    assert.strictEqual(Redaction.apply("nothing here", [secret("hunter2")]), "nothing here");
  });

  it("returns the input unchanged for an empty secret list", () => {
    assert.strictEqual(Redaction.apply("abc", []), "abc");
  });

  it("IGNORES an empty-string secret instead of shredding the text", () => {
    assert.strictEqual(
      Redaction.apply("abc", [secret("")]),
      "abc",
      "an empty secret would insert the placeholder between every character"
    );
  });

  it("replaces the LONGEST secret first so no fragment survives", () => {
    const result = Redaction.apply("abcd", [secret("ab"), secret("abcd")]);
    assert.strictEqual(result, REDACTED, `shortest-first would rewrite "abcd" via "ab" to "***cd", leaking "cd"`);
  });

  it("treats the secret as a literal, not a pattern", () => {
    assert.strictEqual(
      Redaction.apply("a.c and abc", [secret("a.c")]),
      `${REDACTED} and abc`,
      "a regex-flavored secret is not compiled: `.` matches only a dot"
    );
  });
});

describe("Redaction.applyArgs", () => {
  it("redacts secrets inside argv entries, whole or partial", () => {
    const args = ["--token", "hunter2", "--url=https://u:hunter2@host"];
    assert.deepStrictEqual(Redaction.applyArgs(args, [secret("hunter2")]), [
      "--token",
      REDACTED,
      `--url=https://u:${REDACTED}@host`,
    ]);
  });

  it("is a no-op with no secrets", () => {
    assert.deepStrictEqual(Redaction.applyArgs(["a", "b"], []), ["a", "b"]);
  });
});

describe("Redaction.scrubArgs (heuristic backstop)", () => {
  it("redacts the positional following a secret-bearing flag", () => {
    assert.deepStrictEqual(Redaction.scrubArgs(["publish", "--token", "abc123"]), ["publish", "--token", REDACTED]);
  });

  it("redacts the inline --flag=value form", () => {
    assert.deepStrictEqual(Redaction.scrubArgs(["--token=abc123"]), [`--token=${REDACTED}`]);
  });

  it("redacts the value after an npm registry _authToken key", () => {
    assert.deepStrictEqual(Redaction.scrubArgs(["config", "set", "//registry.npmjs.org/:_authToken", "abc123"]), [
      "config",
      "set",
      "//registry.npmjs.org/:_authToken",
      REDACTED,
    ]);
  });

  it("matches flags case-insensitively", () => {
    assert.deepStrictEqual(Redaction.scrubArgs(["--TOKEN", "abc"]), ["--TOKEN", REDACTED]);
  });

  it("leaves ordinary arguments alone", () => {
    const args = ["status", "--porcelain", "-z"];
    assert.deepStrictEqual(Redaction.scrubArgs(args), args);
  });

  it("does not invent a value when a secret flag is last", () => {
    assert.deepStrictEqual(Redaction.scrubArgs(["--token"]), ["--token"]);
  });

  it("accepts extra caller-supplied flags", () => {
    assert.deepStrictEqual(Redaction.scrubArgs(["--my-key", "v"], { flags: ["--my-key"] }), ["--my-key", REDACTED]);
  });

  it("keeps subsequent scrubbing unchanged when a derived flag set changes", () => {
    const args = ["--totally-public", "visible", "--token", "secret", "--token=secret"];
    const expected = ["--totally-public", "visible", "--token", REDACTED, `--token=${REDACTED}`];
    assert.strictEqual(Redaction.SECRET_FLAGS, SECRET_FLAGS);
    assert.deepStrictEqual(Redaction.scrubArgs(args), expected);

    const derived = HashSet.remove(HashSet.add(Redaction.SECRET_FLAGS, "--totally-public"), "--token");
    assert.isTrue(HashSet.has(derived, "--totally-public"));
    assert.isFalse(HashSet.has(derived, "--token"));
    assert.isFalse(HashSet.has(SECRET_FLAGS, "--totally-public"));
    assert.isTrue(HashSet.has(SECRET_FLAGS, "--token"));
    assert.deepStrictEqual(Redaction.scrubArgs(args), expected);
  });
});

describe("Redaction properties: a counterexample is a leaked credential; `*` secrets can re-form the placeholder", () => {
  const secretWithoutPlaceholderChar = Arbitrary.schema(S.NonEmptyString).pipe(
    Arbitrary.filter((s) => !Str.includes("*")(s))
  );

  it.prop(
    "no secret value survives apply",
    [secretWithoutPlaceholderChar, S.String, S.String],
    ([value, before, after]) => {
      const text = `${before}${value}${after}`;
      return !Str.includes(value)(Redaction.apply(text, [secret(value)]));
    }
  );

  it.prop(
    "no secret value survives applyArgs, in any position",
    [secretWithoutPlaceholderChar, S.Array(S.String)],
    ([value, rest]) => {
      const args = [...rest, value, `prefix-${value}-suffix`];
      return A.every(Redaction.applyArgs(args, [secret(value)]), (arg) => !Str.includes(value)(arg));
    }
  );
});
