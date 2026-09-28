// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { Effect, Exit, FileSystem, HashSet, Layer, Path, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ReasonerLive } from "@/layers/ReasonerLive";
import { sha256TextSync } from "@/schema/Digest";
import {
  CrashProjectionInput,
  GEntailmentExpectation,
  makeRdfStatement,
  RDFS_RULES,
  RdfTriple,
} from "@/schema/Reasoning";

const decodeCrashProjectionInputJson = S.decodeEffect(S.fromJsonString(CrashProjectionInput));
const decodeGEntailmentExpectationJson = S.decodeEffect(S.fromJsonString(GEntailmentExpectation));
const isSha256Hex = S.is(Sha256Hex);

import { it } from "@beep/test-runner";
import { assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import { Reasoner } from "@/services/Reasoner";

const statement = (subject: string, predicate: string, object: string) =>
  Result.getOrThrow(makeRdfStatement(RdfTriple.make({ object, predicate, subject })));

const runReasoner = Effect.fn("ReasoningTest.runReasoner")(function* (
  asserted: ReadonlyArray<ReturnType<typeof statement>>
) {
  const reasoner = yield* Reasoner;
  const result = yield* reasoner.close(asserted);
  yield* reasoner.validate(result);
  return result;
});
const rdfType = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";
const domain = "<http://www.w3.org/2000/01/rdf-schema#domain>";
const range = "<http://www.w3.org/2000/01/rdf-schema#range>";
const subClass = "<http://www.w3.org/2000/01/rdf-schema#subClassOf>";
const subProperty = "<http://www.w3.org/2000/01/rdf-schema#subPropertyOf>";
const broader = "<http://www.w3.org/2004/02/skos/core#broaderTransitive>";
const tripleEquivalence = S.toEquivalence(S.Array(RdfTriple));
const inline = (value: string): string => `base64:${Buffer.from(value).toString("base64")}`;
const n3 = (value: RdfTriple): string => `${value.subject} ${value.predicate} ${value.object}.`;
const normalizeProof = (proof: string): string =>
  `${Str.trim(Str.replace(/https:\/\/eyereasoner\.github\.io\/\.well-known\/genid\/[^#>]+#/gu, "urn:eye:proof#")(proof))}\n`;

describe("C2 declarative reasoner", () => {
  it.layer(ReasonerLive, { timeout: "30 seconds" })((it) => {
    it.effect("executes all six rho-df rules plus SKOS transitivity and validates every event", () =>
      Effect.gen(function* () {
        const result = yield* runReasoner([
          statement("<urn:p>", domain, "<urn:C>"),
          statement("<urn:p>", range, "<urn:D>"),
          statement("<urn:s>", "<urn:p>", "<urn:o>"),
          statement("<urn:p>", subProperty, "<urn:q>"),
          statement("<urn:q>", subProperty, "<urn:r>"),
          statement("<urn:C>", subClass, "<urn:E>"),
          statement("<urn:E>", subClass, "<urn:F>"),
          statement("<urn:a>", broader, "<urn:b>"),
          statement("<urn:b>", broader, "<urn:c>"),
        ]);
        const rules = HashSet.fromIterable(A.map(result.events, (event) => event.rule));
        pipe(
          A.every(RDFS_RULES, (rule) => HashSet.has(rules, rule.id)),
          assertTrue
        );
        pipe(
          A.some(
            result.derived,
            (derived) =>
              Str.Equivalence(derived.subject, "<urn:s>") &&
              Str.Equivalence(derived.predicate, rdfType) &&
              Str.Equivalence(derived.object, "<urn:C>")
          ),
          assertTrue
        );
        pipe(
          A.every(result.events, (event) => event.proof.root === event.conclusion),
          assertTrue
        );
      })
    );
  });

  it.layer(Layer.merge(ReasonerLive, BunServices.layer), { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("matches every committed conclusion and bounded restricted EYE proof", () =>
      Effect.gen(function* () {
        const expectation = yield* Effect.promise(() =>
          Bun.file("fixtures/gold/v1/g-entailment-rdfs.json").text()
        ).pipe(Effect.flatMap(decodeGEntailmentExpectationJson));
        const rules = yield* Effect.promise(() => Bun.file("fixtures/gold/v1/g-entailment-rdfs.n3").text());
        expect(sha256TextSync(rules)).toBe(expectation.rulesSha256);
        const processSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        yield* Effect.forEach(
          expectation.cases,
          Effect.fnUntraced(function* (testCase) {
            const result = yield* runReasoner(
              A.map(testCase.asserted, (value) => statement(value.subject, value.predicate, value.object))
            );
            const actual = A.map(result.derived, (value) =>
              RdfTriple.make({ object: value.object, predicate: value.predicate, subject: value.subject })
            );
            pipe(tripleEquivalence(actual, testCase.expectedDerived), assertTrue);
            const proof = O.getOrThrow(A.head(testCase.proofs));
            const data = `${A.join(A.map(testCase.asserted, n3), "\n")}\n`;
            const query = `{ ${n3(proof.conclusion)} } => { ${n3(proof.conclusion)} }.\n`;
            const output = yield* processSpawner
              .string(
                ChildProcess.make(
                  "bun",
                  [
                    "run",
                    "test/helpers/EyeOracleChild.ts",
                    "fixtures/gold/v1/g-entailment-rdfs.n3",
                    inline(data),
                    inline(query),
                    "proof",
                  ],
                  { cwd: process.cwd(), stderr: "pipe", stdout: "pipe" }
                )
              )
              .pipe(Effect.timeout("30 seconds"));
            expect(Buffer.byteLength(output)).toBeLessThanOrEqual(1_048_576);
            expect(output).toContain("r:Inference");
            expect(output).toContain("r:evidence");
            expect(output).toContain("r:rule");
            expect(sha256TextSync(normalizeProof(output))).toBe(proof.eyeProofDigest);
          }),
          { concurrency: 1, discard: true }
        );
      })
    );
  });

  // RuntimeProbeChild closes its scoped ledger services before emitting the commit
  // marker and killing itself. This proves recovery of post-close committed state,
  // not recovery from an open transaction or an unflushed database.
  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect(
      "recovers projection-relevant state committed before SIGKILL",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const ledgerRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-c2-crash-" });
          const processSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
          const fixture = yield* processSpawner.string(
            ChildProcess.make("bun", ["run", "test/helpers/CrashProbeChild.ts", "fixture"], {
              cwd: process.cwd(),
              stderr: "pipe",
              stdout: "pipe",
            })
          );
          const input = yield* decodeCrashProjectionInputJson(fixture);
          expect(input.outcomes).toHaveLength(2);
          expect(input.events).toHaveLength(2);
          const inputPath = path.join(ledgerRoot, "projection-input.json");
          yield* fs.writeFileString(inputPath, fixture);
          const recover = processSpawner
            .string(
              ChildProcess.make(
                "bun",
                ["run", "src/canary/RuntimeProbeChild.ts", "recover", ledgerRoot, Str.repeat(64)("c"), "replay"],
                { cwd: process.cwd(), stderr: "pipe", stdout: "pipe" }
              )
            )
            .pipe(Effect.timeout("30 seconds"), Effect.map(Str.trim));
          const emptyDigest = yield* recover;
          const crash = yield* ChildProcess.make(
            "bun",
            ["run", "src/canary/RuntimeProbeChild.ts", "crash", ledgerRoot, Str.repeat(64)("c"), "replay", inputPath],
            { cwd: process.cwd(), stderr: "pipe", stdout: "pipe" }
          );
          const [crashOutput, crashExit] = yield* Effect.all(
            [Stream.mkString(Stream.decodeText(crash.stdout)), Effect.exit(crash.exitCode)],
            { concurrency: "unbounded" }
          ).pipe(Effect.timeout("30 seconds"));
          expect(crashOutput).toContain("projection-state-committed");
          pipe(crashExit, Exit.isFailure, assertTrue);
          const recoveredDigest = yield* recover;
          const repeatedDigest = yield* recover;
          pipe(isSha256Hex(recoveredDigest), assertTrue);
          expect(recoveredDigest).not.toBe(emptyDigest);
          expect(repeatedDigest).toBe(recoveredDigest);
        }),
      120_000
    );
  });
});
