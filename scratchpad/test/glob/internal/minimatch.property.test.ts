import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import { Minimatch as Oracle } from "minimatch";
import { Minimatch, MinimatchError, GLOBSTAR, braceExpand, escape, unescape, type ParseReturn } from "../../../effected/glob/internal/minimatch.ts";

const runs = { arbitrary: fcRuns(100) };
const segment = Arbitrary.schema(S.Literals(["a", "b", "*", "**", "?", "[ab]", ".a", "..", ".", ""]));
const paths = S.Literals(["a", "b", "c", ".a", ".", "..", ""]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("/")));
const patterns = S.Literals(["a", "b", "*", "**", "?", "[ab]", ".a", ""]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("/")));

// Serialize a compiled segment using its retained source. Literal segments
// need escaping, while regex segments retain the glob spelling in _glob.
const stringifySegment = (parsed: ParseReturn): string => {
  if (parsed === false) return assert.fail("a generated valid segment must compile");
  if (parsed === GLOBSTAR) return "**";
  if (P.isString(parsed)) return escape(parsed);
  const source = parsed._glob;
  assertDefined(source);
  return source;
};

describe("minimatch property floor", () => {
  it.effect.prop("MinimatchError decoding an encoded error never fails and preserves its fields", [Arbitrary.schema(MinimatchError)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(MinimatchError)(value);
    const decoded = yield* S.decodeEffect(MinimatchError)(encoded);
    assert.isTrue(S.toEquivalence(MinimatchError)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(MinimatchError)(decoded), encoded);
  }), runs);
  it.effect.prop("path normalization is idempotent and parsing joined normalized segments is faithful", [paths], ([path]) => Effect.sync(() => {
    const matcher = new Minimatch("*", { optimizationLevel: 2 });
    const normalized = matcher.levelTwoFileOptimize(path);
    assert.deepStrictEqual(matcher.levelTwoFileOptimize([...normalized]), normalized);
    assert.deepStrictEqual(matcher.levelTwoFileOptimize(A.join(normalized, "/")), normalized);
  }), runs);
  it.effect.prop("compiled glob serialization preserves matching and agrees with the README upstream oracle", [patterns, paths, Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Boolean)], ([pattern, path, dot, nocase]) => Effect.sync(() => {
    const matcher = new Minimatch(pattern, { dot, nocase });
    const reparsed = new Minimatch(matcher.pattern, { dot, nocase });
    assert.strictEqual(reparsed.match(path), matcher.match(path));
    assert.strictEqual(matcher.match(path), new Oracle(pattern, { dot, nocase, platform: "linux" }).match(path));
    assert.deepStrictEqual(braceExpand(matcher.pattern), braceExpand(reparsed.pattern));
  }), runs);
  it.effect.prop("segment parse/stringify fidelity and formatting idempotence preserve candidate acceptance", [segment, paths], ([pattern, path]) => Effect.sync(() => {
    const matcher = new Minimatch(pattern);
    const parsed = matcher.parse(pattern);
    const formatted = stringifySegment(parsed);
    const reparsed = matcher.parse(formatted);
    assert.strictEqual(stringifySegment(reparsed), formatted);
    assert.deepStrictEqual(reparsed, parsed);
    assert.strictEqual(new Minimatch(formatted).match(path), matcher.match(path));
    const re = matcher.makeRe();
    assert.strictEqual(matcher.makeRe(), re);
    if (re !== false) {
      const decoded = new RegExp(re.source, re.flags);
      assert.strictEqual(decoded.source, re.source);
      assert.strictEqual(decoded.flags, re.flags);
      assert.strictEqual(decoded.test(path), re.test(path));
    }
  }), runs);
  it.effect.prop("brace expansion is idempotent and serializing its alternatives preserves matching", [Arbitrary.schema(S.Literals(["a", "b", "c"]))], ([literal]) => Effect.sync(() => {
    const pattern = `{${literal},x}/file.{ts,js}`;
    const expanded = braceExpand(pattern);
    assert.deepStrictEqual(A.flatMap(expanded, (pattern) => braceExpand(pattern)), expanded);
    const reparsed = new Minimatch(`{${A.join(expanded, ",")}}`);
    const original = new Minimatch(pattern);
    for (const candidate of [...expanded, "other/file.ts", `${literal}/file.css`]) {
      assert.strictEqual(reparsed.match(candidate), original.match(candidate));
    }
  }), runs);
  it.effect.prop("escaped literal parsing preserves the original text and reformatting is idempotent", [Arbitrary.schema(S.String)], ([literal]) => Effect.sync(() => {
    const formatted = escape(literal);
    assert.strictEqual(unescape(formatted), literal);
    assert.strictEqual(escape(unescape(formatted)), formatted);
  }), runs);
});
