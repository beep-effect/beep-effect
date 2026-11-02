/** Fixed qualification subject with a data-only survey mode. Never import it in the responsive parent. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as Effect from "effect/Effect";
import { makeCitationRegexTranslator } from "../../../packages/law-practice/server/src/internal/Citation/RegexTranslator.ts";

const translateOnly = process.argv.length === 3 && process.argv[2] === "--translate-only";
assert.ok(process.argv.length === 2 || translateOnly);

const fixture = (name, digest) => {
  const raw = readFileSync(
    fileURLToPath(new URL(`../../../packages/law-practice/use-cases/test/fixtures/eyecite/${name}`, import.meta.url))
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), digest);
  return JSON.parse(raw.toString("utf8"));
};
const operations = fixture("operation-cases.json", "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1");
const facts = fixture("regex-character-facts.json", "9dec7f6a29162fd6b479cf083546bf07655c23437a362f034d4ff72a1adb59c0");
assert.equal(operations.commit, "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e");
assert.equal(facts.oracleCommit, operations.commit);
let phase = "setup";
await Effect.runPromise(
  Effect.gen(function* () {
    const translator = yield* makeCitationRegexTranslator((yield* defaultCitationEnginePolicy).limits);
    let instances = 0;
    let maxUtf16 = 0;
    let codePointChecks = 0;
    let captureMatches = 0;
    phase = "compile";
    for (const [identity, artifact] of Object.entries(operations.artifacts)) {
      if (artifact.kind !== "tokenizer-extractors") continue;
      assert.equal(createHash("sha256").update(artifact.payload).digest("hex"), identity);
      for (const entry of JSON.parse(artifact.payload)) {
        const translated = yield* translator.translate({ pattern: entry.fields.regex, flags: entry.fields.flags });
        // Compile only. Family-specific matching/timing qualification is separate.
        if (!translateOnly) new RegExp(translated.pattern, translated.flags);
        instances++;
        maxUtf16 = Math.max(maxUtf16, translated.pattern.length);
      }
    }
    assert.equal(instances, 13610);
    if (translateOnly) {
      process.stdout.write(`${JSON.stringify({ instances, maxUtf16, translateOnly })}\n`);
      return;
    }
    phase = "scalar";
    for (const [escape, name] of [
      ["d", "digitClass"],
      ["s", "spaceClass"],
      ["w", "wordClass"],
      [null, null],
    ]) {
      const translated = yield* translator.translate({
        pattern: escape === null ? "[a-z]" : `\\${escape}`,
        flags: escape === null ? 2 : 0,
      });
      const native = new RegExp(translated.pattern, translated.flags);
      const intervals =
        name === null ? facts.asciiIgnoreCasePoints.map((point) => [point, point]) : facts.intervals[name];
      let cursor = 0;
      let matches = 0;
      for (let point = 0; point < 0x110000; point++) {
        while (cursor < intervals.length && intervals[cursor][1] < point) cursor++;
        const expected = cursor < intervals.length && intervals[cursor][0] <= point;
        native.lastIndex = 0;
        const actual = native.test(String.fromCodePoint(point));
        assert.equal(actual, expected, "single-code-point class mismatch");
        if (actual) matches++;
        codePointChecks++;
      }
      assert.equal(matches, name === null ? 56 : facts.observations[name].points);
    }
    phase = "capture";
    for (const row of facts.cases) {
      // These controlled texts use BMP characters, so source point spans and
      // native UTF-16 spans coincide. Astral span conversion remains separate.
      assert.equal(Array.from(row.text).length, row.text.length);
      const translated = yield* translator.translate({ pattern: row.pattern, flags: row.flags });
      const matches = [...row.text.matchAll(new RegExp(translated.pattern, translated.flags))].map((match) => ({
        values: Array.from(match, (value) => value ?? null),
        spans: Array.from(match.indices, (span) => span ?? [-1, -1]),
        named: Object.fromEntries(Object.entries(match.groups ?? {}).map(([key, value]) => [key, value ?? null])),
      }));
      assert.deepEqual(matches, row.matches);
      captureMatches += matches.length;
    }
    process.stdout.write(
      `${JSON.stringify({ instances, maxUtf16, codePointChecks, cases: facts.cases.length, captureMatches })}\n`
    );
  })
).catch(() => {
  process.stdout.write(`${JSON.stringify({ outcome: "failure", phase })}\n`);
  process.exitCode = 1;
});
