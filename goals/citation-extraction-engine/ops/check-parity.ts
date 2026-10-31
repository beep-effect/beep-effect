/** Fixed portable evidence composition; audit success never establishes parity. */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class ParityCheckError extends S.TaggedError<ParityCheckError, { readonly brand: unique symbol }>()(
  "CitationParityCheckError",
  { message: S.String },
  { description: "Portable citation command argument, evidence or completion failure." }
) {}

const reject = (message: string) => Effect.fail(ParityCheckError.make({ message }));

const program = Effect.gen(function* () {
  const args = A.drop(process.argv, 2);
  const audit = A.contains(args, "--audit");
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner;
  const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  let fixtures = path.join(root, "packages/law-practice/use-cases/test/fixtures/eyecite");
  let evidence = path.join(root, "goals/citation-extraction-engine/history/evidence");
  const seen: Array<string> = [];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === undefined || A.contains(seen, flag)) return yield* reject("Duplicate parity option.");
    seen.push(flag);
    if (flag === "--audit") continue;
    const value = args[++index];
    if ((flag !== "--fixtures" && flag !== "--evidence") || value === undefined || Str.startsWith("--")(value))
      return yield* reject("Usage: citation:parity-check [--audit] [--fixtures path] [--evidence path]");
    if (flag === "--fixtures") fixtures = path.resolve(value);
    else evidence = path.resolve(value);
  }
  const checks = [
    ["discovery", "check-discovery.ts", [path.join(evidence, "oracle-discovery.json")]],
    ["operations", "check-operations.ts", [path.join(fixtures, "operation-cases.json")]],
    [
      "cleaner-pipeline",
      "check-cleaner-pipeline.ts",
      [path.join(fixtures, "cleaner-pipeline.json"), path.join(fixtures, "operation-cases.json")],
    ],
    ["assertions", "check-assertions.ts", [path.join(fixtures, "assertion-cases.json")]],
    ["ledgers", "check-ledgers.ts", [fixtures, ...(audit ? [] : ["--complete"])]],
    [
      "donors",
      "check-typescript-donors.ts",
      [path.join(fixtures, "typescript-extensions.json"), ...(audit ? [] : ["--complete"])],
    ],
    ["vocabulary", "check-vocabulary-mapping.ts", [path.join(fixtures, "vocabulary-mapping.json")]],
    ["safety-contract", "check-safety-contract.ts", [evidence]],
    [
      "supplemental",
      "check-supplemental.ts",
      ["--fixtures", fixtures, "--evidence", evidence, ...(audit ? ["--audit"] : [])],
    ],
    ["divergences", "check-divergences.ts", ["--fixtures", fixtures, ...(audit ? ["--audit"] : [])]],
    [
      "regex-benchmarks",
      "check-regex-benchmarks.ts",
      ["--fixtures", fixtures, "--evidence", evidence, ...(audit ? ["--audit"] : [])],
    ],
  ] as const;
  const results = yield* Effect.forEach(
    checks,
    ([name, script, argv]) =>
      spawner
        .exitCode(
          ChildProcess.make(
            process.execPath,
            ["run", path.join(root, "goals/citation-extraction-engine/ops", script), ...argv],
            {
              cwd: root,
              stdin: "ignore",
              stdout: "ignore",
              stderr: "ignore",
            }
          )
        )
        .pipe(
          Effect.timeout(Duration.minutes(2)),
          Effect.map((code) => code === 0),
          Effect.catchCause(() => Effect.succeed(false)),
          Effect.tap((passed) => Console.log(`${passed ? "PASS" : "FAIL"} ${name}`))
        ),
    { concurrency: 2 }
  );

  // Trusted, fixed repository paths only. Evidence never supplies executable commands.
  const finalVerifiers = ["check-target-parity.ts"];
  const finalResults = yield* Effect.forEach(
    finalVerifiers,
    (script) =>
      Effect.gen(function* () {
        const file = path.join(root, "goals/citation-extraction-engine/ops", script);
        if (!(yield* fs.exists(file))) {
          yield* Console.log(`PENDING ${script}`);
          return false;
        }
        if (audit) {
          yield* Console.log(`NOT RUN IN AUDIT ${script}`);
          return false;
        }
        return yield* spawner
          .exitCode(
            ChildProcess.make(process.execPath, ["run", file, "--fixtures", fixtures, "--evidence", evidence], {
              cwd: root,
              stdin: "ignore",
              stdout: "ignore",
              stderr: "ignore",
            })
          )
          .pipe(
            Effect.timeout(Duration.minutes(2)),
            Effect.map((code) => code === 0),
            Effect.catchCause(() => Effect.succeed(false)),
            Effect.tap((passed) => Console.log(`${passed ? "PASS" : "FAIL"} ${script}`))
          );
      }),
    { concurrency: 1 }
  );
  if (!A.every(results, Boolean)) return yield* reject("Citation evidence component validation failed.");
  if (audit) {
    yield* Console.log(
      "Citation evidence audit passed: 11 components; completion proof remains open. This is not a parity verdict."
    );
    return;
  }
  if (!A.every(finalResults, Boolean))
    return yield* reject("Citation parity incomplete: required final proof verifiers are missing or failed.");
  yield* Console.log(
    "Citation portable parity checks passed. Repository quality and hosted delivery gates remain separate."
  );
});

// @effect-diagnostics-next-line strictEffectProvide:off -- This file is the package command process entry point.
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)));
