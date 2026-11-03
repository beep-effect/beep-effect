/** Fixed qualification subject with a data-only survey mode. Never import it in the responsive parent. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as Effect from "effect/Effect";
import { makeCitationRegexAlphabet } from "../../../packages/law-practice/server/src/internal/Citation/RegexAlphabet.ts";
import { makeCitationRegexInput } from "../../../packages/law-practice/server/src/internal/Citation/RegexInput.ts";
import { makeCitationRegexProgram } from "../../../packages/law-practice/server/src/internal/Citation/RegexProgram.ts";
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
const inventory = fixture("regex-inventory.json", "b0e75c4cd10ee153aeafe4f1b40750415c7f32ca0fabaaadc740b9f69f35fa83");
const programFacts = fixture(
  "regex-program-facts.json",
  "58403e7805b85f7eb19892ea3fadbb165f4c367a28759ada557ae41d4cd3e0bf"
);
let phase = "setup";
let instance = 0;
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
    phase = "program";
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const compiler = yield* makeCitationRegexProgram(limits);
    const programAlphabet = yield* makeCitationRegexAlphabet(limits);
    const patternInput = yield* makeCitationRegexInput(limits, "pattern");
    const sourceInput = yield* makeCitationRegexInput(limits);
    const descriptorVector = [];
    let programInstances = 0;
    let programMaxUtf16 = 0;
    const fieldsById = new Map();
    for (const [identity, artifact] of Object.entries(operations.artifacts)) {
      if (artifact.kind !== "tokenizer-extractors") continue;
      JSON.parse(artifact.payload).forEach((entry, index) => fieldsById.set(`${identity}::${index}`, entry.fields));
    }
    for (const row of inventory.extractorInstances) {
      instance = programInstances;
      const fields = fieldsById.get(row.id);
      assert.ok(fields);
      const native = (yield* patternInput.prepareText(fields.regex, () => Effect.void)).value.storage;
      const program = yield* compiler.compile(native, fields.flags);
      assert.ok(program.minimumWidthFloor > 0);
      assert.equal(program.repeatedCaptures, false);
      assert.equal(program.nullableMultiRepeat, false);
      descriptorVector.push([
        row.id,
        program.groups,
        Object.entries(program.names).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        program.minimumWidthFloor,
      ]);
      const encoded = yield* programAlphabet.prepare(program.sets, { width: 1, bytes: new Uint8Array(0) });
      const pattern = yield* compiler.render(program, encoded);
      new RegExp(pattern, encoded.flags);
      programInstances++;
      programMaxUtf16 = Math.max(programMaxUtf16, pattern.length);
    }
    assert.equal(programInstances, 13610);
    assert.equal(
      createHash("sha256").update(JSON.stringify(descriptorVector)).digest("hex"),
      programFacts.instanceDescriptorVectorSha256
    );
    let programCaptureMatches = 0;
    phase = "program-capture";
    for (const row of facts.cases) {
      const program = yield* compiler.compile(
        (yield* patternInput.prepareText(row.pattern, () => Effect.void)).value.storage,
        row.flags
      );
      const encoded = yield* programAlphabet.prepare(
        program.sets,
        (yield* sourceInput.prepareText(row.text, () => Effect.void)).value.storage
      );
      const pattern = yield* compiler.render(program, encoded);
      const points = Array.from(row.text);
      const matches = [...encoded.source.matchAll(new RegExp(pattern, encoded.flags))].map((match) => ({
        values: Array.from(match.indices, (span) => (span ? points.slice(...span).join("") : null)),
        spans: Array.from(match.indices, (span) => span ?? [-1, -1]),
        named: Object.fromEntries(
          Object.entries(match.indices.groups ?? {}).map(([key, span]) => [
            key,
            span ? points.slice(...span).join("") : null,
          ])
        ),
      }));
      assert.deepEqual(matches, row.matches);
      programCaptureMatches += matches.length;
    }
    const pointBytes = new Uint8Array(20);
    const pointView = new DataView(pointBytes.buffer);
    [0x1d7ce, 0xd835, 0xdfce, 48, 0x1d7ce].forEach((point, index) => pointView.setUint32(index * 4, point, true));
    for (const [native, spans] of [
      [{ width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) }, [[1, 3]]],
      [
        { width: 4, bytes: new Uint8Array([0xce, 0xd7, 1, 0]) },
        [
          [0, 1],
          [4, 5],
        ],
      ],
    ]) {
      const program = yield* compiler.compile(native, 0);
      const encoded = yield* programAlphabet.prepare(program.sets, { width: 4, bytes: pointBytes });
      const pattern = yield* compiler.render(program, encoded);
      const matches = [...encoded.source.matchAll(new RegExp(pattern, encoded.flags))].map((match) => match.indices[0]);
      assert.deepEqual(matches, spans);
      programCaptureMatches += matches.length;
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
    phase = "alphabet";
    const atomRanges = [facts.intervals.digitClass, facts.intervals.spaceClass, facts.intervals.wordClass, []];
    for (const point of facts.asciiIgnoreCasePoints) {
      const prior = atomRanges[3].at(-1);
      if (prior && prior[1] + 1 === point) prior[1] = point;
      else atomRanges[3].push([point, point]);
    }
    const sets = {
      atoms: atomRanges.length,
      intervals: atomRanges.flatMap((ranges, atom) => ranges.map(([start, end]) => ({ atom, start, end }))),
    };
    const alphabet = yield* makeCitationRegexAlphabet((yield* defaultCitationEnginePolicy).limits);
    const cursors = atomRanges.map(() => 0);
    let alphabetPointChecks = 0;
    for (let first = 0; first < 0x110000; first += 0x10000) {
      const last = Math.min(first + 0x10000, 0x110000);
      const width = last <= 0x10000 ? 2 : 4;
      const bytes = new Uint8Array((last - first) * width);
      const view = new DataView(bytes.buffer);
      for (let point = first; point < last; point++) {
        if (width === 2) view.setUint16((point - first) * width, point, true);
        else view.setUint32((point - first) * width, point, true);
      }
      const encoded = yield* alphabet.prepare(sets, { width, bytes });
      assert.equal(encoded.source.length, last - first);
      assert.equal(encoded.pythonLength, last - first);
      for (let atom = 0; atom < atomRanges.length; atom++) {
        const native = new RegExp(encoded.atoms[atom], encoded.flags);
        const ranges = atomRanges[atom];
        for (let point = first; point < last; point++) {
          while (cursors[atom] < ranges.length && ranges[cursors[atom]][1] < point) cursors[atom]++;
          const expected = cursors[atom] < ranges.length && ranges[cursors[atom]][0] <= point;
          native.lastIndex = 0;
          assert.equal(native.test(encoded.source[point - first]), expected, "encoded atomic predicate mismatch");
          alphabetPointChecks++;
        }
      }
    }
    const capturePoints = [0x1d7ce, 0xd835, 0xdfce, 48, 0x1d7ce];
    const captureBytes = new Uint8Array(capturePoints.length * 4);
    const captureView = new DataView(captureBytes.buffer);
    capturePoints.forEach((point, index) => captureView.setUint32(index * 4, point, true));
    const captureAlphabet = yield* alphabet.prepare(sets, { width: 4, bytes: captureBytes });
    const alphabetSpans = [
      ...captureAlphabet.source.matchAll(new RegExp(`(?<value>${captureAlphabet.atoms[0]}+)`, captureAlphabet.flags)),
    ].map((match) => match.indices.groups.value);
    assert.deepEqual(alphabetSpans, [
      [0, 1],
      [3, 5],
    ]);
    const alphabetCaptureMatches = alphabetSpans.length;
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
      `${JSON.stringify({ instances, maxUtf16, codePointChecks, alphabetPointChecks, alphabetCaptureMatches, programInstances, programMaxUtf16, programCaptureMatches, cases: facts.cases.length, captureMatches })}\n`
    );
  })
).catch(() => {
  process.stdout.write(`${JSON.stringify({ outcome: "failure", phase, instance })}\n`);
  process.exitCode = 1;
});
