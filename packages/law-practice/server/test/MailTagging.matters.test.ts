/**
 * The practice-KG matter directory over a real DuckDB file seeded through the
 * bundle's own matter-table writer. Every matter, docket, and address is
 * synthetic.
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  PracticeKgMatterDocketRow,
  PracticeKgMatterRow,
  PracticeKgMatterTables,
  writeMatterTables,
} from "@beep/law-practice-server";
import {
  MailTaggingStateConfig,
  MailTaggingStateLocation,
  MatterDirectoryPracticeKg,
} from "@beep/law-practice-server/MailTagging";
import { MailTaggingPortError, MailTaggingStateError, MatterDirectory } from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { oneRun, Platform, serviceOf, temporaryDirectory, writeText } from "./MailTagging.adapters.fixture.ts";
import type { PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";

type MatterSeed = {
  readonly familyKey: string;
  readonly client: string | null;
  readonly clientName?: string;
  readonly status?: PracticeKgEpistemicStatus;
};

const matter = (seed: MatterSeed) =>
  PracticeKgMatterRow.make({
    attributionSource: "official-record",
    client: seed.client,
    clientName: seed.clientName ?? null,
    docketCount: 1,
    documentCount: 1,
    epistemicStatus: seed.status ?? "derived-from-official-records",
    family: "10001",
    familyKey: seed.familyKey,
  });

type DocketSeed = {
  readonly familyKey: string;
  readonly docket: string;
  readonly applicationNumbers?: ReadonlyArray<string>;
  readonly patentNumbers?: ReadonlyArray<string>;
};

const docket = (seed: DocketSeed) =>
  PracticeKgMatterDocketRow.make({
    applicationNumbers: seed.applicationNumbers ?? [],
    docket: seed.docket,
    docketKey: `${seed.familyKey}${Str.slice(5)(seed.docket)}`,
    documentCount: 1,
    epistemicStatus: "derived-from-official-records",
    familyKey: seed.familyKey,
    patentNumbers: seed.patentNumbers ?? [],
  });

// Store format 3: `client_name` is set on the first matter and null on the rest.
// Two taggable matters, one without a client number, one recycled, and one whose keys are not usable tokens.
const tables = PracticeKgMatterTables.make({
  matters: [
    matter({ familyKey: "1234.10001", client: "1234", clientName: "Example Client" }),
    matter({ familyKey: "1234.20002", client: "1234", status: "candidate-unreviewed" }),
    matter({ familyKey: "30003", client: null }),
    matter({ familyKey: "5678.40004", client: "5678", status: "recycled-unverified" }),
    matter({ familyKey: "56 78.50005", client: "56 78" }),
  ],
  dockets: [
    docket({
      familyKey: "1234.10001",
      docket: "10001US01",
      applicationNumbers: ["16123456", "PCT/US2026/012345"],
      patentNumbers: ["10123456", "US10123456B2"],
    }),
    docket({ familyKey: "1234.10001", docket: "10001EP02" }),
    docket({ familyKey: "30003", docket: "30003US01", applicationNumbers: ["15000001"] }),
    docket({ familyKey: "5678.40004", docket: "40004US01" }),
  ],
});

const directoryOver = (databasePath: string, stateDirectory: string) =>
  serviceOf(MatterDirectory)(
    MatterDirectoryPracticeKg.pipe(
      Layer.provide(
        Layer.merge(
          DuckDb.makeNodeLayer(
            DuckDbConnectionOptions.make({ databaseOptions: { access_mode: "READ_ONLY" }, databasePath })
          ),
          Layer.succeed(MailTaggingStateLocation, MailTaggingStateConfig.make({ stateDirectory }))
        )
      )
    )
  );

const seeded = Effect.gen(function* () {
  const path = yield* Path.Path;
  const directory = yield* temporaryDirectory;
  const databasePath = path.join(directory, "practice.duckdb");
  yield* writeMatterTables(databasePath)(tables);
  return { directory, databasePath };
});

const snapshotOf = (bundle: { readonly directory: string; readonly databasePath: string }) =>
  oneRun(Effect.flatMap(directoryOver(bundle.databasePath, bundle.directory), (directory) => directory.snapshot));

const overlay = `[
  { "familyKey": "1234.10001", "addresses": ["Counsel@Acme.Example.Test"], "domains": ["acme.example.test"] },
  { "familyKey": "1234.10001", "addresses": ["shared@acme.example.test", "counsel@acme.example.test"] },
  { "familyKey": "1234.20002", "addresses": ["shared@acme.example.test"] },
  { "familyKey": "9999.99999", "addresses": ["nobody@example.test"] }
]`;

describe("MailTagging practice-KG matter directory", () => {
  it.layer(Platform, { timeout: "60 seconds" })("snapshot", (it) => {
    it.effect(
      "indexes matters with a client number and a verified family, and leaves the rest unattributed",
      Effect.fnUntraced(function* () {
        const index = yield* snapshotOf(yield* seeded);

        expect(
          A.map(index.entries, (entry) => [
            entry.matterKey,
            entry.clientKey,
            entry.docketNumbers,
            entry.applicationNumbers,
            entry.patentNumbers,
            entry.contactAddresses,
            entry.contactDomains,
          ])
        ).toStrictEqual([
          [
            "1234.10001",
            "1234",
            ["10001EP02", "1234.10001EP02", "10001US01", "1234.10001US01"],
            ["16123456"],
            ["10123456"],
            [],
            [],
          ],
          ["1234.20002", "1234", [], [], [], [], []],
        ]);
        expect(
          A.map(index.unattributed, (unattributed) => [
            unattributed.familyKeys,
            unattributed.docketNumbers,
            unattributed.applicationNumbers,
          ])
        ).toStrictEqual([
          [["30003"], ["30003US01"], ["15000001"]],
          [[], [], []],
          [["5678.40004"], ["40004US01", "5678.40004US01"], []],
        ]);
      })
    );

    it.effect(
      "merges the contact overlay by family key and loads an address listed under two matters as written",
      Effect.fnUntraced(function* () {
        const bundle = yield* seeded;
        yield* writeText(bundle.directory, "matter-contacts.json", overlay);
        const index = yield* snapshotOf(bundle);

        expect(
          A.map(index.entries, (entry) => [entry.matterKey, entry.contactAddresses, entry.contactDomains])
        ).toStrictEqual([
          ["1234.10001", ["counsel@acme.example.test", "shared@acme.example.test"], ["acme.example.test"]],
          ["1234.20002", ["shared@acme.example.test"], []],
        ]);
      })
    );

    it.effect(
      "fails closed on an overlay that does not decode, naming the file only",
      Effect.fnUntraced(function* () {
        const bundle = yield* seeded;
        yield* writeText(
          bundle.directory,
          "matter-contacts.json",
          '[{"familyKey":"1234.10001","addresses":["nobody"]}]'
        );
        const error = yield* Effect.flip(snapshotOf(bundle));

        assertInstanceOf(error, MailTaggingStateError);
        expect([error.store, error.failure, error.file, O.getOrNull(error.line)]).toStrictEqual([
          "matter-contacts",
          "corrupt",
          "matter-contacts.json",
          null,
        ]);
      })
    );

    it.effect(
      "reads a bundle whose matters table has no client_name column",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const directory = yield* temporaryDirectory;
        const databasePath = path.join(directory, "format-2.duckdb");
        yield* oneRun(
          Effect.flatMap(
            serviceOf(DuckDb)(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))),
            (db) =>
              db.runMany([
                "CREATE TABLE matters (family_key VARCHAR, client VARCHAR, epistemic_status VARCHAR)",
                "INSERT INTO matters VALUES ('1234.10001', '1234', 'derived-from-official-records'), ('30003', NULL, 'mention-derived')",
                "CREATE TABLE matter_dockets (docket_key VARCHAR, docket VARCHAR, family_key VARCHAR, application_numbers VARCHAR[], patent_numbers VARCHAR[])",
                "INSERT INTO matter_dockets VALUES ('1234.10001US01', '10001US01', '1234.10001', ['16123456'], [])",
              ])
          )
        );
        const index = yield* snapshotOf({ directory, databasePath });

        expect(A.map(index.entries, (entry) => [entry.matterKey, entry.applicationNumbers])).toStrictEqual([
          ["1234.10001", ["16123456"]],
        ]);
        expect(A.map(index.unattributed, (unattributed) => unattributed.familyKeys)).toStrictEqual([["30003"]]);
      })
    );

    it.effect(
      "treats a row that arrives without its null columns as unattributed and without numbers",
      Effect.fnUntraced(function* () {
        const directory = yield* temporaryDirectory;
        const rows = (statement: string) =>
          Str.includes("FROM matters")(statement)
            ? [
                { familyKey: "1234.10001", client: "1234", epistemicStatus: "derived-from-official-records" },
                { familyKey: "30003", epistemicStatus: "mention-derived" },
              ]
            : [
                { familyKey: "1234.10001", docket: "10001US01", docketKey: "1234.10001US01", patentNumbers: null },
                { familyKey: "30003", docket: "30003US01", docketKey: "30003US01", applicationNumbers: "15000001" },
              ];
        const dropped = yield* serviceOf(MatterDirectory)(
          MatterDirectoryPracticeKg.pipe(
            Layer.provide(
              Layer.merge(
                Layer.mock(DuckDb)({ query: (statement) => Effect.succeed(rows(statement)) }),
                Layer.succeed(MailTaggingStateLocation, MailTaggingStateConfig.make({ stateDirectory: directory }))
              )
            )
          )
        );
        const index = yield* dropped.snapshot;

        expect(
          A.map(index.entries, (entry) => [entry.matterKey, entry.applicationNumbers, entry.patentNumbers])
        ).toStrictEqual([["1234.10001", [], []]]);
        expect(
          A.map(index.unattributed, (unattributed) => [unattributed.familyKeys, unattributed.applicationNumbers])
        ).toStrictEqual([[["30003"], ["15000001"]]]);
      })
    );

    it.effect(
      "reports a bundle without matter tables as a typed port failure",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const directory = yield* temporaryDirectory;
        const databasePath = path.join(directory, "empty.duckdb");
        yield* oneRun(
          Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))).pipe(Effect.asVoid)
        );
        const error = yield* Effect.flip(snapshotOf({ directory, databasePath }));

        assertInstanceOf(error, MailTaggingPortError);
        expect([error.port, error.operation, error.reason]).toStrictEqual([
          "MatterDirectory",
          "snapshot",
          "matters table unreadable",
        ]);
      })
    );
  });
});
