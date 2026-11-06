/** Validate portable assertion/loop observations without the live Python suite. */
import { CitationOracleAssertions, CitationOracleDiscovery } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const sha256 = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const reject = (reason: string) => Effect.fail(new Error(`Assertion evidence invalid: ${reason}`));
const refs = (value: unknown): ReadonlyArray<string> => {
  if (A.isArray(value)) return A.flatMap(value, refs);
  if (!P.isObject(value)) return [];
  return A.flatMap(R.toEntries(value), ([key, entry]) =>
    key === "artifactSha256" || key === "extractorsSha256" ? [P.isString(entry) ? entry : "invalid"] : refs(entry)
  );
};
const same = S.toEquivalence(S.Json);
const LiteralGroupKey = S.fromJsonString(S.Tuple([S.String, S.Array(S.String), S.String]));
const program = Effect.gen(function* () {
  const text = yield* Effect.tryPromise(() =>
    Bun.file(
      process.argv[2] ??
        new URL("../../../packages/law-practice/use-cases/test/fixtures/eyecite/assertion-cases.json", import.meta.url)
    ).text()
  );
  const encoded = yield* S.decodeUnknownEffect(S.fromJsonString(S.toEncoded(CitationOracleAssertions)))(text);
  for (const [name, expected] of [
    ["export-assertions.py", encoded.exporterSha256],
    ["export-operations.py", encoded.normalizerSha256],
  ]) {
    const bytes = yield* Effect.tryPromise(() => Bun.file(new URL(`./${name}`, import.meta.url)).bytes());
    if (sha256(bytes) !== expected) return yield* reject("exporter hash mismatch");
  }
  if (
    !A.every(encoded.events, (row) => sha256(row.payload) === row.normalizedSha256) ||
    !A.every(R.toEntries(encoded.artifacts), ([hash, row]) => sha256(row.payload) === hash)
  )
    return yield* reject("payload hash mismatch");
  const report = yield* S.decodeEffect(CitationOracleAssertions)(encoded);
  const discoveryText = yield* Effect.tryPromise(() =>
    Bun.file(new URL("../history/evidence/oracle-discovery.json", import.meta.url)).text()
  );
  const discovery = yield* S.decodeUnknownEffect(S.fromJsonString(CitationOracleDiscovery))(discoveryText);
  const independent = R.fromEntries(A.map(discovery.runtime.assertionEvents, (row) => [row.id, row] as const));
  if (
    A.length(report.events) !== A.length(discovery.runtime.assertionEvents) ||
    !A.every(report.events, (row) => {
      const other = independent[row.id];
      return (
        other !== undefined &&
        row.test === other.test &&
        row.declarationId === other.declarationId &&
        row.ordinal === other.ordinal &&
        row.assertion === other.assertion
      );
    })
  )
    return yield* reject("independent assertion discovery mismatch");
  const sourceRows = [
    ...report.source.declarations,
    ...report.source.functions,
    ...report.source.loops,
    ...report.source.literalParameters,
    ...report.source.fixtureGuards,
  ];
  if (
    !A.every(sourceRows, (row) =>
      A.some(discovery.sourceFiles, (file) => file.path === row.path && file.sha256 === row.sourceSha256)
    )
  )
    return yield* reject("source hash mismatch");
  const functions = R.fromEntries(A.map(report.source.functions, (row) => [row.id, row] as const));
  const loops = R.fromEntries(A.map(report.source.loops, (row) => [row.id, row] as const));
  const parameters = R.fromEntries(A.map(report.source.literalParameters, (row) => [row.id, row] as const));
  const declarations = R.fromEntries(A.map(report.source.declarations, (row) => [row.id, row] as const));
  const declared = A.filter(discovery.sourceRows, (row) => row.kind === "caseDeclaration");
  if (
    A.length(declared) !== A.length(report.source.declarations) ||
    !A.every(declared, (row) => {
      const other = declarations[row.id];
      return other !== undefined && other.path === row.path && other.line === row.line && other.column === row.column;
    })
  )
    return yield* reject("independent declaration mismatch");
  if (
    !A.every([...report.source.declarations, ...report.source.loops, ...report.source.fixtureGuards], (row) => {
      const owner = functions[row.functionId];
      return owner !== undefined && owner.path === row.path && owner.line <= row.line && owner.endLine >= row.line;
    })
  )
    return yield* reject("source function ownership mismatch");
  for (const row of report.source.literalParameters) {
    for (const item of row.items)
      if (sha256(item.expression) !== item.expressionSha256) return yield* reject("literal expression hash mismatch");
  }
  const iterations: Record<string, (typeof report.iterations)[number]> = {};
  const ordinalCounts: Record<string, number> = {};
  const literalGroups: Record<string, { parameter: string; indexes: Array<number> }> = {};
  const seenLoops: Record<string, boolean> = {};
  for (const row of report.iterations) {
    const loop = loops[row.loopId];
    const owner = functions[row.functionId];
    const ordinalKey = `${row.test}::${row.functionId}::${row.invocationOrdinal}::${row.loopId}`;
    const next = (ordinalCounts[ordinalKey] ?? 0) + 1;
    ordinalCounts[ordinalKey] = next;
    if (
      loop === undefined ||
      owner === undefined ||
      loop.functionId !== row.functionId ||
      row.invocationOrdinal < 1 ||
      row.ordinal !== next ||
      row.id !== `${ordinalKey}::${row.ordinal}` ||
      row.indexWithinParent < 1 ||
      (loop.literalParameterId !== undefined && loop.literalParameterId !== row.literalParameterId)
    )
      return yield* reject("iteration identity or ordinal mismatch");
    if (
      !A.every(row.parentIterationIds, (id) => {
        const parent = iterations[id];
        const parentLoop = parent === undefined ? undefined : loops[parent.loopId];
        return (
          parent !== undefined &&
          parentLoop !== undefined &&
          parent.test === row.test &&
          parent.functionId === row.functionId &&
          parent.invocationOrdinal === row.invocationOrdinal &&
          parentLoop.line < loop.line &&
          parentLoop.endLine >= loop.endLine
        );
      }) ||
      A.length(A.dedupe(row.parentIterationIds)) !== A.length(row.parentIterationIds)
    )
      return yield* reject("iteration parent mismatch");
    iterations[row.id] = row;
    seenLoops[row.loopId] = true;
    if (row.literalParameterId !== undefined) {
      if (parameters[row.literalParameterId] === undefined) return yield* reject("unknown literal parameter");
      const key = yield* S.encodeEffect(LiteralGroupKey)([ordinalKey, row.parentIterationIds, row.literalParameterId]);
      const group = literalGroups[key] ?? { parameter: row.literalParameterId, indexes: [] };
      group.indexes.push(row.indexWithinParent);
      literalGroups[key] = group;
    }
  }
  if (!A.every(report.source.loops, (row) => seenLoops[row.id] === true))
    return yield* reject("unobserved source loop");
  if (
    !A.every(
      R.values(literalGroups),
      (group) =>
        group.indexes.length === parameters[group.parameter]!.itemCount &&
        A.every(group.indexes, (value, index) => value === index + 1)
    )
  )
    return yield* reject("literal loop coverage mismatch");
  const eventCounts: Record<string, number> = {};
  for (const row of report.events) {
    const key = `${row.test}::${row.declarationId}`;
    const next = (eventCounts[key] ?? 0) + 1;
    eventCounts[key] = next;
    if (row.ordinal !== next) return yield* reject("assertion ordinal mismatch");
    const payload = row.payload.value;
    if (
      payload.context.frames[0]?.functionId !== declarations[row.declarationId]!.functionId ||
      !A.every(
        payload.context.frames,
        (frame) =>
          functions[frame.functionId] !== undefined &&
          frame.invocationOrdinal > 0 &&
          A.every(frame.iterationIds, (id) => {
            const iteration = iterations[id];
            return (
              iteration !== undefined &&
              iteration.test === row.test &&
              iteration.functionId === frame.functionId &&
              iteration.invocationOrdinal === frame.invocationOrdinal
            );
          })
      )
    )
      return yield* reject("assertion producer context mismatch");
    const relation = payload.relation;
    const valid = (() => {
      switch (row.assertion) {
        case "assertEqual":
        case "assertListEqual":
          return relation.kind === "comparison" && relation.equal;
        case "assertNotEqual":
          return relation.kind === "comparison" && !relation.equal;
        case "assertTrue":
          return relation.kind === "truth" && relation.truth;
        case "assertFalse":
          return relation.kind === "truth" && !relation.truth;
        case "assertIsNone":
          return relation.kind === "none" && relation.isNone;
        case "assertIn":
          return relation.kind === "membership" && relation.contains;
        case "assert_not_called":
          return relation.kind === "mock" && relation.callCount === 0;
        case "assertResolution":
          return relation.kind === "helper-invocation";
        case "assertRaises":
          return relation.kind === "raises" && same(relation.expectedType, relation.actualType);
      }
    })();
    if (!valid) return yield* reject("assertion relation mismatch");
    const [left, right] = payload.operands;
    if (
      relation.kind === "comparison" &&
      left !== undefined &&
      right !== undefined &&
      left.kind !== "value" &&
      right.kind !== "value" &&
      left.kind === right.kind &&
      relation.equal !== (left.identitySlot === right.identitySlot)
    )
      return yield* reject("identity comparison mismatch");
  }
  const payloads = [
    ...A.map(report.events, (row) => row.payload.value),
    ...A.map(report.iterations, (row) => row.bindings),
    ...A.map(R.values(report.artifacts), (row) => row.payload.value),
  ];
  const references = yield* Effect.forEach(A.dedupe(A.flatMap(payloads, refs)), (reference) =>
    S.decodeUnknownEffect(Sha256Hex)(reference)
  );
  if (
    !A.every(references, (hash) => report.artifacts[hash] !== undefined) ||
    !A.every(R.keys(report.artifacts), (hash) => A.contains(references, hash))
  )
    return yield* reject("unaccounted artifact reference");
  yield* Console.log(
    `Validated ${report.events.length} assertions, ${report.iterations.length} iterations and ${R.size(literalGroups)} literal loop runs.`
  );
});
Effect.runPromise(
  program.pipe(
    Effect.catchCause(() =>
      Console.error("Assertion oracle validation failed; inspect the source, hashes and accounting controls.").pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    )
  )
);
