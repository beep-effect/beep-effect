/** Validate the committed P0 discovery artifact through the public test codec. */
import { CitationOracleDiscovery } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const program = Effect.gen(function* () {
  const text = yield* Effect.tryPromise(() =>
    Bun.file(process.argv[2] ?? new URL("../history/evidence/oracle-discovery.json", import.meta.url)).text()
  );
  const report = yield* S.decodeUnknownEffect(S.fromJsonString(CitationOracleDiscovery))(text);
  const exporter = yield* Effect.tryPromise(() => Bun.file(new URL("./audit-oracle.py", import.meta.url)).bytes());
  const exporterHash = new Bun.CryptoHasher("sha256").update(exporter).digest("hex");
  if (report.exporterSha256 !== exporterHash) {
    return yield* Effect.fail(new Error("Discovery exporter hash does not match the retained source"));
  }
  yield* Console.log(
    `Discovery valid: ${A.length(report.sourceRows)} source rows, ${report.runtime.testsRun} methods, ` +
      `${A.length(report.runtime.assertionEvents)} assertion events. Semantic parity remains unproved.`
  );
});

Effect.runPromise(
  program.pipe(
    Effect.catch(() =>
      Effect.gen(function* () {
        yield* Console.error("Citation oracle discovery validation failed; inspect the report, pin and exporter hash.");
        process.exitCode = 1;
      })
    )
  )
);
