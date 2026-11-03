/** Fixed qualification subject with a data-only survey mode. Never import it in the responsive parent. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { versions } from "node:process";
import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { makeCitationRegexAlphabet } from "../../../packages/law-practice/server/src/internal/Citation/RegexAlphabet.ts";
import { makeCitationRegexDescriptorRegistry } from "../../../packages/law-practice/server/src/internal/Citation/RegexDescriptors.ts";
import { makeCitationRegexInput } from "../../../packages/law-practice/server/src/internal/Citation/RegexInput.ts";
import { makeCitationRegexProgram } from "../../../packages/law-practice/server/src/internal/Citation/RegexProgram.ts";
import { makeCitationRegexResult } from "../../../packages/law-practice/server/src/internal/Citation/RegexResult.ts";
import { makeCitationRegexTranslator } from "../../../packages/law-practice/server/src/internal/Citation/RegexTranslator.ts";
import { makeCitationRegexEvaluation } from "../../../packages/law-practice/server/src/internal/Citation/RegexWorkerEvaluation.ts";
import { CitationRegexWorkerJob } from "../../../packages/law-practice/server/src/internal/Citation/RegexWorkerProtocol.ts";
import { CitationRegexWorkerStartup } from "../../../packages/law-practice/server/src/internal/Citation/RegexWorkerRpc.ts";

const option = process.argv[2];
const translateOnly = option === "--translate-only";
const baselineOnly = option === "--baseline";
const witnessSmoke = option === "--witness-smoke";
const programShard = option?.startsWith("--program-shard=")
  ? Number(option.slice("--program-shard=".length))
  : undefined;
assert.ok(
  process.argv.length === 2 ||
    ((process.argv.length === 3 || process.argv.length === 4) &&
      (translateOnly ||
        baselineOnly ||
        witnessSmoke ||
        (Number.isInteger(programShard) && programShard >= 0 && programShard < 16)))
);

// The bundled Node subject receives the original trusted source location so
// digest-bound fixtures and producer files resolve identically under both runtimes.
const sourceLocation = new URL(process.argv[3] ?? import.meta.url);
assert.equal(sourceLocation.protocol, "file:");
const runtime = versions.bun ? "bun" : "node";
const runtimeVersion = versions.bun ?? versions.node;
const fixture = (name, digest) => {
  const raw = readFileSync(
    fileURLToPath(new URL(`../../../packages/law-practice/use-cases/test/fixtures/eyecite/${name}`, sourceLocation))
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
  "5b93d0172fc9a24f364a89d2ccaab193506b68c10458f962857badb630d32d52"
);
const witnesses = fixture(
  "regex-match-witnesses.json",
  "5967ecb29a91966896395287932688b4bfbc91f15d2d0b8231911aa517f48060"
);
assert.equal(witnesses.oracleCommit, operations.commit);
assert.equal(witnesses.sources.operationsSha256, "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1");
assert.equal(witnesses.instances, 13610);
assert.equal(witnesses.matches, 27216);
assert.equal(witnesses.emptyInstances, 13610);
assert.deepEqual(
  witnesses.cases.map((row) => row.id),
  inventory.extractorInstances.map((row) => row.id)
);
assert.equal(createHash("sha256").update(JSON.stringify(witnesses.cases)).digest("hex"), witnesses.vectorSha256);
assert.equal(
  createHash("sha256")
    .update(readFileSync(new URL("./probe-regex-match-witnesses.py", sourceLocation)))
    .digest("hex"),
  witnesses.producerSha256
);
assert.equal(
  createHash("sha256")
    .update(readFileSync(new URL("./probe-regex-compatibility.py", sourceLocation)))
    .digest("hex"),
  witnesses.sourceReaderSha256
);
const witnessesById = new Map(witnesses.cases.map((row) => [row.id, row]));
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
    if (programShard === undefined && !witnessSmoke) {
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
    }
    if (translateOnly) {
      process.stdout.write(`${JSON.stringify({ runtime, runtimeVersion, instances, maxUtf16, translateOnly })}\n`);
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
    let witnessInstances = 0;
    let witnessMatches = 0;
    let witnessEmptyInstances = 0;
    if (!baselineOnly) {
      const shard = programShard === undefined ? undefined : programFacts.qualificationShards[programShard];
      if (programShard !== undefined) {
        assert.ok(shard);
        assert.equal(programFacts.qualificationShards.length, 16);
        assert.equal(shard.index, programShard);
        assert.equal(shard.start, Math.floor((programShard * 13610) / 16));
        assert.equal(shard.end, Math.floor(((programShard + 1) * 13610) / 16));
      }
      if (shard) {
        const expected = witnesses.shards[programShard];
        assert.equal(witnesses.shards.length, 16);
        assert.equal(expected.index, shard.index);
        assert.equal(expected.start, shard.start);
        assert.equal(expected.end, shard.end);
        assert.equal(
          createHash("sha256")
            .update(JSON.stringify(witnesses.cases.slice(shard.start, shard.end)))
            .digest("hex"),
          expected.vectorSha256
        );
      }
      const rows = witnessSmoke
        ? [0, 6800, 13609].map((index) => inventory.extractorInstances[index])
        : shard
          ? inventory.extractorInstances.slice(shard.start, shard.end)
          : inventory.extractorInstances;
      const fieldsById = new Map();
      const registries = new Map();
      for (const [artifact, indices] of Object.entries(programFacts.artifactDescriptorIndices)) {
        if (!rows.some((row) => row.artifactSha256 === artifact)) continue;
        assert.equal(indices.length, 6805);
        registries.set(
          artifact,
          yield* makeCitationRegexDescriptorRegistry(
            limits,
            indices.map((index) => programFacts.descriptors[index])
          )
        );
      }
      const bindingVector = [];
      for (const [identity, artifact] of Object.entries(operations.artifacts)) {
        if (artifact.kind !== "tokenizer-extractors") continue;
        JSON.parse(artifact.payload).forEach((entry, index) => fieldsById.set(`${identity}::${index}`, entry.fields));
      }
      for (const row of rows) {
        instance = programInstances;
        const fields = fieldsById.get(row.id);
        assert.ok(fields);
        const native = (yield* patternInput.prepareText(fields.regex, () => Effect.void)).value.storage;
        const registry = registries.get(row.artifactSha256);
        assert.ok(registry);
        const bound = yield* registry.bind(native, fields.flags);
        const program = bound.program;
        bindingVector.push([row.id, bound.descriptor.patternSha256, fields.flags]);
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
        const witness = witnessesById.get(row.id);
        assert.ok(witness);
        const sourceBytes = new Uint8Array(Buffer.from(witness.sourceWords, "base64"));
        assert.equal(sourceBytes.byteLength, 4 * witness.sourcePoints);
        const preparedSource = yield* sourceInput.prepareUnicode({ width: 4, bytes: sourceBytes }, () => Effect.void);
        assert.equal(preparedSource.layout.pythonLength, witness.sourcePoints);
        assert.equal(preparedSource.layout.utf16Units, witness.sourceUtf16);
        const evaluator = yield* makeCitationRegexEvaluation(
          CitationRegexWorkerStartup.make({ limits, descriptor: bound.descriptor })
        );
        const body = yield* evaluator.evaluate(
          CitationRegexWorkerJob.make({
            mode: "finditer",
            patternWidth: native.width,
            patternBytes: native.bytes,
            sourceWidth: 4,
            sourceBytes,
            flags: fields.flags,
            maxMatches: 8,
          })
        );
        const result = yield* makeCitationRegexResult(limits, program.groups, witness.sourcePoints);
        const completed = yield* result.decode(body, 8);
        assert.equal(completed.matches, witness.captures.length);
        for (let match = 0; match < completed.matches; match++) {
          for (let group = 0; group <= completed.groups; group++) {
            const span = yield* completed.capture(match, group);
            assert.deepEqual(span._tag === "Range" ? [span.start, span.end] : [-1, -1], witness.captures[match][group]);
          }
        }
        const emptyBody = yield* evaluator.evaluate(
          CitationRegexWorkerJob.make({
            mode: "finditer",
            patternWidth: native.width,
            patternBytes: native.bytes,
            sourceWidth: 1,
            sourceBytes: new Uint8Array(0),
            flags: fields.flags,
            maxMatches: 0,
          })
        );
        const emptyResult = yield* makeCitationRegexResult(limits, program.groups, 0);
        assert.equal((yield* emptyResult.decode(emptyBody, 0)).matches, 0);
        witnessEmptyInstances++;
        witnessInstances++;
        witnessMatches += completed.matches;
        programInstances++;
        programMaxUtf16 = Math.max(programMaxUtf16, pattern.length);
      }
      assert.equal(programInstances, witnessSmoke ? 3 : shard ? shard.end - shard.start : 13610);
      if (!witnessSmoke) {
        assert.equal(
          createHash("sha256").update(JSON.stringify(bindingVector)).digest("hex"),
          shard ? shard.bindingVectorSha256 : programFacts.instanceBindingVectorSha256
        );
        assert.equal(
          createHash("sha256").update(JSON.stringify(descriptorVector)).digest("hex"),
          shard ? shard.descriptorVectorSha256 : programFacts.instanceDescriptorVectorSha256
        );
      }
    }
    if (programShard !== undefined || witnessSmoke) {
      process.stdout.write(
        `${JSON.stringify({ runtime, runtimeVersion, instances: 0, maxUtf16: 0, codePointChecks: 0, alphabetPointChecks: 0, alphabetCaptureMatches: 0, programInstances, programMaxUtf16, programCaptureMatches: 0, witnessInstances, witnessMatches, witnessEmptyInstances, cases: 0, captureMatches: 0 })}\n`
      );
      return;
    }
    let programCaptureMatches = 0;
    const collectNative = Effect.fn("Qualification.collectNative")(function* (program, encoded, pattern) {
      const iterator = encoded.source.matchAll(new RegExp(pattern, encoded.flags));
      const result = yield* makeCitationRegexResult(limits, program.groups, encoded.pythonLength);
      const frame = yield* result.collect(
        Effect.sync(() => {
          const next = iterator.next();
          return next.done ? O.none() : O.some(next.value.indices);
        })
      );
      return yield* result.decode(frame.subarray(0, -1));
    });
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
      const collected = yield* collectNative(program, encoded, pattern);
      const matches = [];
      for (let match = 0; match < collected.matches; match++) {
        const spans = [];
        const values = [];
        for (let group = 0; group <= collected.groups; group++) {
          const capture = yield* collected.capture(match, group);
          spans.push(capture._tag === "Range" ? [capture.start, capture.end] : [-1, -1]);
          values.push(capture._tag === "Range" ? points.slice(capture.start, capture.end).join("") : null);
        }
        matches.push({
          values,
          spans,
          named: Object.fromEntries(Object.entries(program.names).map(([name, group]) => [name, values[group]])),
        });
      }
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
      const collected = yield* collectNative(program, encoded, pattern);
      const matches = [];
      for (let match = 0; match < collected.matches; match++) {
        const capture = yield* collected.capture(match, 0);
        assert.equal(capture._tag, "Range");
        matches.push([capture.start, capture.end]);
      }
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
      `${JSON.stringify({ runtime, runtimeVersion, instances, maxUtf16, codePointChecks, alphabetPointChecks, alphabetCaptureMatches, programInstances, programMaxUtf16, programCaptureMatches, witnessInstances, witnessMatches, witnessEmptyInstances, cases: facts.cases.length, captureMatches })}\n`
    );
  }).pipe(Effect.provide(NodeCrypto.layerDigest))
).catch(() => {
  process.stdout.write(`${JSON.stringify({ outcome: "failure", phase, instance })}\n`);
  process.exitCode = 1;
});
