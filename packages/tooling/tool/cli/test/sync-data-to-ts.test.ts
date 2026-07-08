import { syncDataToTsCommand } from "@beep/repo-cli/commands/SyncDataToTs";
import {
  fetchSource,
  formatJson,
  ISO3166_AUTH_HEADER_ENV,
  ISO3166_PART1_CSV_URL_ENV,
  ISO3166_PART2_CSV_URL_ENV,
  ISO3166_SOURCE_URL,
  ISO4217_SOURCE_URL,
  outputFile,
  parseCsvSource,
  SyncDataTargetProjection,
  sourceMetadata,
  syncDataTargets,
} from "@beep/repo-cli/test/SyncDataToTs";
import { A, O } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { Cause, ConfigProvider, Effect, Exit, FileSystem, Layer, Path, Runtime } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import type { SyncDataTarget } from "@beep/repo-cli/test/SyncDataToTs";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const runSyncDataToTsCommand = Command.runWith(syncDataToTsCommand, { version: "0.0.0" });
const CommandTestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer, NodeCrypto.layer);
const generatedOutputPath = "packages/foundation/primitive/data/src/generated/iso4217.ts" as const;
const iso3166GeneratedOutputPath = "packages/foundation/primitive/data/src/generated/iso3166.ts" as const;
const iso3166CanonicalOutputPath = "packages/foundation/primitive/data/src/generated/iso3166.data.json" as const;
const csvGeneratedOutputPath = "packages/foundation/primitive/data/src/generated/test-csv.ts" as const;
const csvCanonicalOutputPath = "packages/foundation/primitive/data/src/generated/test-csv.data.json" as const;
const csvFixtureSourceUrl = "https://example.com/test.csv" as const;
const iso3166Part1FixtureSourceUrl = "https://private.example.test/iso3166-1.csv" as const;
const iso3166Part2FixtureSourceUrl = "https://private.example.test/iso3166-2.csv" as const;

const expectReportedExit = (exit: Exit.Exit<unknown, unknown>, exitCode = 1) => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(exitCode);
    expect(Runtime.getErrorReported(error)).toBe(false);
  }
};

const iso4217XmlFixture = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ISO_4217 Pblshd="2026-01-01">
  <CcyTbl>
    <CcyNtry>
      <CtryNm>AMERICAN SAMOA</CtryNm>
      <CcyNm>US Dollar</CcyNm>
      <Ccy>USD</Ccy>
      <CcyNbr>840</CcyNbr>
      <CcyMnrUnts>2</CcyMnrUnts>
    </CcyNtry>
    <CcyNtry>
      <CtryNm>UNITED STATES OF AMERICA (THE)</CtryNm>
      <CcyNm>US Dollar</CcyNm>
      <Ccy>USD</Ccy>
      <CcyNbr>840</CcyNbr>
      <CcyMnrUnts>2</CcyMnrUnts>
    </CcyNtry>
    <CcyNtry>
      <CtryNm>BOND MARKETS UNIT EUROPEAN COMPOSITE UNIT (EURCO)</CtryNm>
      <CcyNm IsFund="true">Bond Markets Unit European Composite Unit (EURCO)</CcyNm>
      <Ccy>XBA</Ccy>
      <CcyNbr>955</CcyNbr>
      <CcyMnrUnts>N.A.</CcyMnrUnts>
    </CcyNtry>
    <CcyNtry>
      <CtryNm>ZIMBABWE</CtryNm>
      <CcyNm>Zimbabwe Gold</CcyNm>
      <Ccy>ZWG</Ccy>
      <CcyNbr>924</CcyNbr>
      <CcyMnrUnts>2</CcyMnrUnts>
    </CcyNtry>
    <CcyNtry>
      <CtryNm>ANTARCTICA</CtryNm>
      <CcyNm>No universal currency</CcyNm>
    </CcyNtry>
  </CcyTbl>
</ISO_4217>
`;

const csvFixture = `code,name,notes
USD,US Dollar,"Used in, multiple countries"
EUR,Euro,"Line 1
Line 2"
`;

const iso3166Part1CsvFixture = `"Alpha-2 code","Alpha-3 code","Numeric code","English short name"
US,USA,840,United States
GB,GBR,826,United Kingdom
CA,CAN,124,Canada
`;

const iso3166Part2CsvFixture = `"Code","Name","Type","Parent subdivision"
US-CA,California,State,
US-NY,New York,State,
GB-ENG,England,Country,
CA-BC,British Columbia,Province,
`;

const makeWebHandlerClient = (handler: (request: Request) => Promise<Response>) =>
  HttpClient.make((request, url) =>
    Effect.tryPromise({
      try: () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const response = yield* Effect.promise(() =>
              Promise.resolve(
                handler(
                  new Request(url.toString(), {
                    method: request.method,
                    headers: request.headers,
                  })
                )
              )
            );
            return HttpClientResponse.fromWeb(request, response);
          })
        ),
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        }),
    })
  );

const makeTextFixtureClient = (sourceUrl: string, content: string, contentType: string) =>
  makeWebHandlerClient((request) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return request.url === sourceUrl
          ? new Response(content, {
              status: 200,
              headers: {
                "content-type": contentType,
              },
            })
          : new Response("missing", { status: 404 });
      })
    )
  );

const makeIso4217Client = () => makeTextFixtureClient(ISO4217_SOURCE_URL, iso4217XmlFixture, "application/xml");

const makeCsvFixtureClient = () => makeTextFixtureClient(csvFixtureSourceUrl, csvFixture, "text/csv");

const makeIso3166Client = () =>
  makeWebHandlerClient((request) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const authorized = request.headers.get("authorization") === "Bearer test-token";

        if (!authorized) {
          return new Response("unauthorized", { status: 401 });
        }

        if (request.url === iso3166Part1FixtureSourceUrl) {
          return new Response(iso3166Part1CsvFixture, {
            status: 200,
            headers: { "content-type": "text/csv" },
          });
        }

        if (request.url === iso3166Part2FixtureSourceUrl) {
          return new Response(iso3166Part2CsvFixture, {
            status: 200,
            headers: { "content-type": "text/csv" },
          });
        }

        return new Response("missing", { status: 404 });
      })
    )
  );

const provideIso4217Client = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(HttpClient.HttpClient, makeIso4217Client()));

const provideCsvFixtureClient = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(HttpClient.HttpClient, makeCsvFixtureClient()));

const provideIso3166Client = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(HttpClient.HttpClient, makeIso3166Client()));

const withEnv = <A, E, R>(
  entries: Readonly<Record<string, string>>,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const current = yield* ConfigProvider.ConfigProvider;
    const testEnv = ConfigProvider.fromEnv({ env: entries });

    return yield* use.pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.orElse(testEnv, current))
    );
  });

const withTempRepoCommand = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      process.chdir(tmpDir);
      yield* fs.makeDirectory(path.join(tmpDir, ".git"), { recursive: true });

      return { fs, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(CommandTestLayer));

const withRegisteredTarget = <A, E, R>(target: SyncDataTarget, use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const targets = syncDataTargets as unknown as Array<SyncDataTarget>;
      A.appendInPlace(targets, target);
      return targets;
    }),
    () => use,
    (targets) =>
      Effect.sync(() => {
        const index = O.getOrUndefined(A.findFirstIndex(targets, (candidate) => candidate.id === target.id));

        if (index !== undefined) {
          A.spliceInPlace(targets, { start: index, deleteCount: 1 });
        }
      })
  );

const readOutputFile = Effect.fn("SyncDataToTsTest.readOutputFile")(function* (outputPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(process.cwd(), outputPath);
  return yield* fs.readFileString(absolutePath);
});

const outputFileExists = Effect.fn("SyncDataToTsTest.outputFileExists")(function* (outputPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.exists(path.join(process.cwd(), outputPath));
});

const writeOutputFile = Effect.fn("SyncDataToTsTest.writeOutputFile")(function* (outputPath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(process.cwd(), outputPath);
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const readGeneratedFile = readOutputFile(generatedOutputPath);
const generatedFileExists = outputFileExists(generatedOutputPath);
const writeGeneratedFile = (content: string) => writeOutputFile(generatedOutputPath, content);

const csvTarget: SyncDataTarget = {
  id: "test-csv",
  access: "public",
  description: "Fixture CSV target used to verify sync-data-to-ts CSV parsing.",
  sourceUrls: [csvFixtureSourceUrl],
  acquire: Effect.gen(function* () {
    const source = yield* fetchSource("test-csv", "fixture-csv", csvFixtureSourceUrl);
    const rows = yield* parseCsvSource("test-csv", source);
    const canonical = {
      columns: rows.columns ?? [],
      rows,
    };

    return SyncDataTargetProjection.make({
      files: [
        outputFile(csvGeneratedOutputPath, formatJson(canonical)),
        outputFile(csvCanonicalOutputPath, formatJson(canonical)),
      ],
      canonicalPath: csvCanonicalOutputPath,
      canonical,
      recordCount: rows.length,
      summary: `${rows.length} csv rows`,
      sources: [sourceMetadata(source)],
    });
  }).pipe(Effect.withSpan("SyncDataToTsTest.acquireCsv")),
};

describe("sync-data-to-ts", { concurrent: false }, () => {
  it("writes the generated ISO 4217 module in write mode", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runSyncDataToTsCommand(["--target", "iso4217"]);

        const content = yield* readGeneratedFile;
        const logs = yield* TestConsole.logLines;

        expect(content).toContain(`export const CurrencyCodeDataPublished = "2026-01-01" as const;`);
        expect(content).toContain(`code: "USD"`);
        expect(content).toContain(`digits: 0`);
        expect(content).toContain(`currency: "Zimbabwe Gold"`);
        expect(content).toContain(`"American Samoa"`);
        expect(content).toContain(`"United States Of America (The)"`);
        expect(content).not.toContain("No universal currency");
        expect(logs).toContain(
          "sync-data-to-ts: updated iso4217 -> packages/foundation/primitive/data/src/generated/iso4217.ts (3 currency entries published 2026-01-01)"
        );
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(provideIso4217Client, withTempRepoCommand)
    ));

  it("does not write files in dry-run mode", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runSyncDataToTsCommand(["--target", "iso4217", "--dry-run"]);

        const exists = yield* generatedFileExists;
        const logs = yield* TestConsole.logLines;

        expect(exists).toBe(false);
        expect(logs).toContain(
          "sync-data-to-ts: would update iso4217 -> packages/foundation/primitive/data/src/generated/iso4217.ts (3 currency entries published 2026-01-01)"
        );
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(provideIso4217Client, withTempRepoCommand)
    ));

  it("fails check mode on drift without modifying the file", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* writeGeneratedFile("stale-content\n");

        const exit = yield* Effect.exit(runSyncDataToTsCommand(["--target", "iso4217", "--check"]));

        const content = yield* readGeneratedFile;
        const errors = yield* TestConsole.errorLines;

        expectReportedExit(exit);
        expect(content).toBe("stale-content\n");
        expect(errors).toContain(
          'sync-data-to-ts: Detected drift in 1 target(s): iso4217. Run "bun run beep sync-data-to-ts --all" to refresh generated files.'
        );
      }).pipe(provideIso4217Client, withTempRepoCommand)
    ));

  it("becomes a no-op when the generated file is already current", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runSyncDataToTsCommand(["--target", "iso4217"]);
        yield* runSyncDataToTsCommand(["--target", "iso4217"]);

        const logs = yield* TestConsole.logLines;

        expect(logs).toContain("sync-data-to-ts: wrote 0 of 1 target(s)");
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(provideIso4217Client, withTempRepoCommand)
    ));

  it("parses CSV targets with the canonical @beep/schema CSV implementation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runSyncDataToTsCommand(["--target", "test-csv"]);

        const content = yield* readOutputFile(csvGeneratedOutputPath);
        const sidecar = yield* readOutputFile(csvCanonicalOutputPath);

        expect(content).toContain(`"columns": [`);
        expect(content).toContain(`"code": "USD"`);
        expect(content).toContain(`"notes": "Used in, multiple countries"`);
        expect(content).toContain(`"notes": "Line 1\\nLine 2"`);
        expect(sidecar).toBe(content);
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(provideCsvFixtureClient, withTempRepoCommand, (effect) => withRegisteredTarget(csvTarget, effect))
    ));

  it("writes the authenticated ISO 3166 module without leaking private source URLs", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runSyncDataToTsCommand(["--target", "iso3166"]);

        const content = yield* readOutputFile(iso3166GeneratedOutputPath);
        const sidecar = yield* readOutputFile(iso3166CanonicalOutputPath);
        const logs = yield* TestConsole.logLines;

        expect(content).toContain(`alpha2: "US"`);
        expect(content).toContain(`alpha3: "USA"`);
        expect(content).toContain(`flagEmoji: "🇺🇸"`);
        expect(content).toContain(`code: "US-CA"`);
        expect(content).toContain(`type: "State"`);
        expect(content).toContain(ISO3166_SOURCE_URL);
        expect(content).not.toContain(iso3166Part1FixtureSourceUrl);
        expect(content).not.toContain(iso3166Part2FixtureSourceUrl);
        expect(sidecar).not.toContain(iso3166Part1FixtureSourceUrl);
        expect(sidecar).not.toContain(iso3166Part2FixtureSourceUrl);
        expect(logs).toContain(
          "sync-data-to-ts: updated iso3166 -> packages/foundation/primitive/data/src/generated/iso3166.ts (3 country entries and 4 subdivision entries)"
        );
        expect(process.exitCode ?? 0).toBe(0);
      }).pipe(provideIso3166Client, withTempRepoCommand, (effect) =>
        withEnv(
          {
            [ISO3166_PART1_CSV_URL_ENV]: iso3166Part1FixtureSourceUrl,
            [ISO3166_PART2_CSV_URL_ENV]: iso3166Part2FixtureSourceUrl,
            [ISO3166_AUTH_HEADER_ENV]: "Authorization: Bearer test-token",
          },
          effect
        )
      )
    ));
});
