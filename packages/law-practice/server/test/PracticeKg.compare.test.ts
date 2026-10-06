import { DuckDbConnectionOptions } from "@beep/duckdb";
import {
  diffPracticeKgMatterTables,
  PracticeKgBundleDiff,
  PracticeKgDocketNumbersChange,
  PracticeKgMatterDocketRow,
  PracticeKgMatterRow,
  PracticeKgMatterTables,
  PracticeKgMatterTablesComparison,
  readPracticeKgMatterTables,
  withDuckDb,
  writeMatterTables,
} from "@beep/law-practice-server";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";

const matter = (familyKey: string, family: string, docketCount: number) =>
  PracticeKgMatterRow.make({
    attributionSource: "text-reference",
    client: "11111",
    clientName: "Example Client",
    docketCount,
    documentCount: docketCount * 2,
    epistemicStatus: "derived-from-official-records",
    family,
    familyKey,
  });

const docket = (
  docketKey: string,
  docket: string,
  familyKey: string,
  applicationNumbers: ReadonlyArray<string>,
  patentNumbers: ReadonlyArray<string> = []
) =>
  PracticeKgMatterDocketRow.make({
    applicationNumbers,
    docket,
    docketKey,
    documentCount: 2,
    epistemicStatus: "derived-from-official-records",
    familyKey,
    patentNumbers,
  });

const diff = (base: PracticeKgMatterTables, next: PracticeKgMatterTables) =>
  diffPracticeKgMatterTables(PracticeKgMatterTablesComparison.make({ base, next }));

// Rows in key order, as the reader returns them.
const base = PracticeKgMatterTables.make({
  dockets: [
    docket("11111.12345EP", "12345EP", "11111.12345", ["EP20000001"]),
    docket("11111.12345US", "12345US", "11111.12345", ["16/000,001"], ["10,000,001"]),
    docket("11111.23456US", "23456US", "11111.23456", ["16/000,002"]),
  ],
  matters: [matter("11111.12345", "12345", 2), matter("11111.23456", "23456", 1)],
});

const fullerWithOneLoss = PracticeKgMatterTables.make({
  dockets: [
    docket("11111.12345EP", "12345EP", "11111.12345", ["EP20000001"]),
    docket("11111.12345US", "12345US", "11111.12345", ["16/000,001", "16/000,003"]),
    docket("11111.34567US", "34567US", "11111.34567", ["16/000,004"]),
  ],
  matters: [matter("11111.12345", "12345", 2), matter("11111.34567", "34567", 1)],
});

const additionsOnly = PracticeKgMatterTables.make({
  dockets: [
    ...base.dockets,
    docket("11111.23456EP", "23456EP", "11111.23456", ["EP20000002"]),
    docket("11111.34567US", "34567US", "11111.34567", ["16/000,004"], ["10,000,004"]),
  ],
  matters: [...base.matters, matter("11111.34567", "34567", 1)],
});

describe("practice KG bundle compare", () => {
  it("reports nothing when the tables are the same", () => {
    const same = diff(base, base);
    expect(same).toStrictEqual(
      PracticeKgBundleDiff.make({
        docketsAdded: [],
        docketsRemoved: [],
        lost: false,
        mattersAdded: [],
        mattersRemoved: [],
        numbersChanged: [],
      })
    );
    assertFalse(same.lost);
  });

  it("names the matter, the docket, and the patent a fuller rebuild lost, beside what it gained", () => {
    const lossy = diff(base, fullerWithOneLoss);
    expect(lossy).toStrictEqual(
      PracticeKgBundleDiff.make({
        docketsAdded: ["11111.34567US"],
        docketsRemoved: ["11111.23456US"],
        lost: true,
        mattersAdded: ["11111.34567"],
        mattersRemoved: ["11111.23456"],
        numbersChanged: [
          PracticeKgDocketNumbersChange.make({
            applicationNumbersAdded: ["16/000,003"],
            applicationNumbersRemoved: [],
            docketKey: "11111.12345US",
            familyKey: "11111.12345",
            patentNumbersAdded: [],
            patentNumbersRemoved: ["10,000,001"],
          }),
        ],
      })
    );
    assertTrue(lossy.lost);
  });

  it("does not count additions as a loss, and reports a withdrawn number even when every key survives", () => {
    const gained = diff(base, additionsOnly);
    expect([gained.lost, gained.mattersAdded, gained.docketsAdded, gained.numbersChanged]).toStrictEqual([
      false,
      ["11111.34567"],
      ["11111.23456EP", "11111.34567US"],
      [],
    ]);

    const renumbered = PracticeKgMatterTables.make({
      dockets: [
        docket("11111.12345EP", "12345EP", "11111.12345", ["EP20000001"]),
        docket("11111.12345US", "12345US", "11111.12345", ["16/000,001"]),
        docket("11111.23456US", "23456US", "11111.23456", ["16/000,002"]),
      ],
      matters: base.matters,
    });
    const withdrawn = diff(base, renumbered);
    expect([withdrawn.lost, withdrawn.mattersRemoved, withdrawn.docketsRemoved]).toStrictEqual([true, [], []]);
    expect(withdrawn.numbersChanged.map((change) => [change.docketKey, change.patentNumbersRemoved])).toStrictEqual([
      ["11111.12345US", ["10,000,001"]],
    ]);
  });

  it.layer(Layer.fresh(NodeServices.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "reads back the tables the writer stored, so a bundle diffed against itself is empty",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-compare-" });
        const databasePath = path.join(directory, "practice.duckdb");

        yield* writeMatterTables(databasePath)(base);
        const read = yield* readPracticeKgMatterTables.pipe(
          withDuckDb(DuckDbConnectionOptions.make({ databaseOptions: { access_mode: "READ_ONLY" }, databasePath }))
        );

        expect(read).toStrictEqual(base);
        assertFalse(diff(read, base).lost);
        expect(diff(read, fullerWithOneLoss).mattersRemoved).toStrictEqual(["11111.23456"]);
      })
    );
  });
});
