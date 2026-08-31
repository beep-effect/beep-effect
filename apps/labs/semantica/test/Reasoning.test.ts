// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Exit, FileSystem, HashSet, Layer, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import { ReasonerLive } from "@/layers/ReasonerLive";
import { sha256TextSync } from "@/schema/Digest";
import { GEntailmentExpectation, makeRdfStatement, RDFS_RULES, RdfTriple } from "@/schema/Reasoning";
import { Reasoner } from "@/services/Reasoner";

const statement = (subject: string, predicate: string, object: string) =>
  Result.getOrThrow(makeRdfStatement(RdfTriple.make({ object, predicate, subject })));

const runReasoner = (asserted: ReadonlyArray<ReturnType<typeof statement>>) =>
  Effect.scoped(
    Layer.build(ReasonerLive).pipe(
      Effect.flatMap((context) =>
        Reasoner.pipe(
          Effect.flatMap((reasoner) =>
            reasoner.close(asserted).pipe(Effect.tap((result) => reasoner.validate(result)))
          ),
          Effect.provide(context)
        )
      )
    )
  );

const withBunServices = <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
  Effect.scoped(Layer.build(BunServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
  it("executes all six rho-df rules plus SKOS transitivity and validates every event", () =>
    Effect.runPromise(
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
        expect(A.every(RDFS_RULES, (rule) => HashSet.has(rules, rule.id))).toBe(true);
        expect(
          A.some(
            result.derived,
            (derived) =>
              Str.Equivalence(derived.subject, "<urn:s>") &&
              Str.Equivalence(derived.predicate, rdfType) &&
              Str.Equivalence(derived.object, "<urn:C>")
          )
        ).toBe(true);
        expect(A.every(result.events, (event) => event.proof.root === event.conclusion)).toBe(true);
      })
    ));

  it("matches every committed conclusion and bounded restricted EYE proof", () =>
    Effect.runPromise(
      withBunServices(
        Effect.gen(function* () {
          const expectation = yield* Effect.promise(() =>
            Bun.file("fixtures/gold/v1/g-entailment-rdfs.json").text()
          ).pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(GEntailmentExpectation))));
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
              expect(tripleEquivalence(actual, testCase.expectedDerived)).toBe(true);
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
      )
    ));

  it("rebuilds an identical projection after SIGKILL at the ledger checkpoint", () =>
    Effect.runPromise(
      withBunServices(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const ledgerRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-c2-crash-" });
            const processSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
            const crash = yield* ChildProcess.make(
              "bun",
              ["run", "test/helpers/CrashProbeChild.ts", "commit", ledgerRoot],
              { cwd: process.cwd(), stderr: "pipe", stdout: "pipe" }
            );
            const [crashOutput, crashExit] = yield* Effect.all(
              [Stream.mkString(Stream.decodeText(crash.stdout)), Effect.exit(crash.exitCode)],
              { concurrency: "unbounded" }
            ).pipe(Effect.timeout("30 seconds"));
            expect(crashOutput).toContain("ledger-committed");
            expect(Exit.isFailure(crashExit)).toBe(true);
            const recover = processSpawner
              .string(
                ChildProcess.make("bun", ["run", "test/helpers/CrashProbeChild.ts", "recover", ledgerRoot], {
                  cwd: process.cwd(),
                  stderr: "pipe",
                  stdout: "pipe",
                })
              )
              .pipe(Effect.timeout("30 seconds"), Effect.map(Str.trim));
            const first = yield* recover;
            const second = yield* recover;
            expect(S.is(Sha256Hex)(first)).toBe(true);
            expect(second).toBe(first);
          })
        )
      )
    ));
});
