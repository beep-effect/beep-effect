/**
 * The practice-KG matter directory over a real DuckDB file seeded through the
 * bundle's own matter-table and correspondent-table writers (store format 4).
 * Every matter, docket, contact, and address is synthetic.
 */
import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  PracticeKgContactAddressRow,
  PracticeKgContactClientLinkRow,
  PracticeKgCorrespondentRow,
  PracticeKgCorrespondentTables,
  PracticeKgMatterDocketRow,
  PracticeKgMatterRow,
  PracticeKgMatterTables,
  writeMatterTables,
  writePracticeKgCorrespondentTables,
} from "@beep/law-practice-server";
import {
  MailTaggingStateConfig,
  MailTaggingStateLocation,
  MatterContactEvidenceSetting,
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

const matter = (seed) =>
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
const docket = (seed) =>
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
const contact = (seed) =>
  PracticeKgContactAddressRow.make({
    address: seed.address,
    contactId: seed.contactId,
    displayName: "Example Contact",
    isPracticeAddress: seed.isPracticeAddress ?? false,
    organization: null,
    roleAddress: seed.roleAddress ?? false,
  });
const link = (contactId, familyKey, source = "attorney-answer") =>
  PracticeKgContactClientLinkRow.make({ clientNumber: "1234", contactId, evidence: "fixture", familyKey, source });
const filed = (address, isPracticeAddress) =>
  PracticeKgCorrespondentRow.make({
    address,
    ccCount: 0,
    contactId: null,
    displayName: null,
    epistemicStatus: "mention-derived",
    familyKey: "1234.10001",
    firstAt: null,
    fromCount: 5,
    isPracticeAddress,
    lastAt: null,
    messageCount: 5,
    roleAddress: false,
    toCount: 0,
  });
// Store format 4 correspondents. Only counsel@ and the quoted address resolve `unique`; every other one is a trap.
const correspondents = PracticeKgCorrespondentTables.make({
  addresses: [
    contact({ address: "counsel@acme.example.test", contactId: "c-counsel" }),
    contact({ address: "'quoted@acme.example.test'", contactId: "c-quoted" }),
    contact({ address: "docketing@acme.example.test", contactId: "c-role", roleAddress: true }),
    contact({ address: "attorney@practice.example.test", contactId: "c-practice", isPracticeAddress: true }),
    contact({ address: "relay@practice.example.test", contactId: "c-relay" }),
    contact({ address: "inferred@acme.example.test", contactId: "c-inferred" }),
    contact({ address: "shared@acme.example.test", contactId: "c-shared-1" }),
    contact({ address: "shared@acme.example.test", contactId: "c-shared-2" }),
    contact({ address: "split@acme.example.test", contactId: "c-split" }),
    contact({ address: "numbered@acme.example.test", contactId: "c-numbered" }),
    contact({ address: "not an address", contactId: "c-broken" }),
    contact({ address: "unlinked@acme.example.test", contactId: "c-unlinked" }),
    // Spelling traps: the practice flag is filed under the lowercase spelling, and one address owned by two
    // contacts under two spellings is shared.
    contact({ address: "Cased@Firm.example.test", contactId: "c-cased" }),
    contact({ address: "Twin@acme.example.test", contactId: "c-twin-1" }),
    contact({ address: "'twin@acme.example.test'", contactId: "c-twin-2" }),
    // One contact under two spellings is still one owner; a quoted practice address that filed mail never
    // flagged is still the practice's own, by its domain.
    contact({ address: "'Counsel@acme.example.test'", contactId: "c-counsel" }),
    contact({ address: "'paralegal@practice.example.test'", contactId: "c-quoted-practice" }),
  ],
  links: [
    link("c-counsel", "1234.10001"),
    link("c-quoted", "1234.10001", "attorney-pc-folder"),
    link("c-role", "1234.10001"),
    link("c-practice", "1234.10001"),
    link("c-relay", "1234.10001"),
    link("c-inferred", "1234.10001", "org-name-match"),
    link("c-shared-1", "1234.10001"),
    link("c-shared-2", "1234.10001"),
    link("c-split", "1234.10001"),
    link("c-split", "1234.20002"),
    link("c-numbered", "1234.00053"),
    link("c-broken", "1234.10001"),
    link("c-cased", "1234.10001"),
    link("c-twin-1", "1234.10001"),
    link("c-twin-2", "1234.10001"),
    link("c-quoted-practice", "1234.10001"),
  ],
  // A candidate by message count, and practice addresses that only filed email marks as such.
  correspondents: [
    filed("inferred@acme.example.test", false),
    filed("relay@practice.example.test", true),
    filed("cased@firm.example.test", true),
  ],
});
const directoryOver = (bundle) =>
  serviceOf(MatterDirectory)(
    MatterDirectoryPracticeKg.pipe(
      Layer.provide(
        Layer.mergeAll(
          DuckDb.makeNodeLayer(
            DuckDbConnectionOptions.make({
              databaseOptions: { access_mode: "READ_ONLY" },
              databasePath: bundle.databasePath,
            })
          ),
          Layer.succeed(MailTaggingStateLocation, MailTaggingStateConfig.make({ stateDirectory: bundle.directory })),
          Layer.succeed(MatterContactEvidenceSetting, bundle.evidence ?? "kg")
        )
      )
    )
  );
const seeded = Effect.gen(function* () {
  const path = yield* Path.Path;
  const directory = yield* temporaryDirectory;
  const databasePath = path.join(directory, "practice.duckdb");
  yield* writeMatterTables(databasePath)(tables);
  yield* writePracticeKgCorrespondentTables(databasePath)(correspondents);
  return { directory, databasePath };
});
const snapshotOf = (bundle) => oneRun(Effect.flatMap(directoryOver(bundle), (directory) => directory.snapshot));
const contactsOf = (bundle) =>
  Effect.map(snapshotOf(bundle), (index) =>
    A.map(index.entries, (entry) => [entry.matterKey, entry.contactAddresses, entry.contactDomains])
  );
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
        const index = yield* snapshotOf({ ...(yield* seeded), evidence: "off" });
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
      "adds the overlay after the graph's addresses and loads an address listed under two matters as written",
      Effect.fnUntraced(function* () {
        const bundle = yield* seeded;
        yield* writeText(bundle.directory, "matter-contacts.json", overlay);
        const index = yield* snapshotOf(bundle);
        expect(
          A.map(index.entries, (entry) => [entry.matterKey, entry.contactAddresses, entry.contactDomains])
        ).toStrictEqual([
          [
            "1234.10001",
            ["counsel@acme.example.test", "quoted@acme.example.test", "shared@acme.example.test"],
            ["acme.example.test"],
          ],
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
        const index = yield* snapshotOf({ directory, databasePath, evidence: "off" });
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
        const rows = (statement) =>
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
      "attaches only the addresses the graph resolves unique to a matter, normalized, and no domain",
      Effect.fnUntraced(function* () {
        expect(yield* contactsOf(yield* seeded)).toStrictEqual([
          ["1234.10001", ["counsel@acme.example.test", "quoted@acme.example.test"], []],
          ["1234.20002", [], []],
        ]);
      })
    );
    it.effect(
      "attaches no contact at all and never reads the overlay when contact evidence is off",
      Effect.fnUntraced(function* () {
        const bundle = yield* seeded;
        yield* writeText(bundle.directory, "matter-contacts.json", "not json");
        expect(yield* contactsOf({ ...bundle, evidence: "off" })).toStrictEqual([
          ["1234.10001", [], []],
          ["1234.20002", [], []],
        ]);
      })
    );
    it.effect(
      "reports a format 3 bundle without correspondent tables as a typed port failure when contact evidence is on",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const directory = yield* temporaryDirectory;
        const databasePath = path.join(directory, "format-3.duckdb");
        yield* writeMatterTables(databasePath)(tables);
        const error = yield* Effect.flip(snapshotOf({ directory, databasePath }));
        assertInstanceOf(error, MailTaggingPortError);
        expect([error.port, error.operation, error.reason]).toStrictEqual([
          "MatterDirectory",
          "snapshot",
          "correspondent tables unreadable",
        ]);
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
