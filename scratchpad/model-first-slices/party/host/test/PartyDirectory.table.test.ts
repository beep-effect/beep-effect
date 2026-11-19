import { expect, it } from "@effect/vitest";
import { DirectoryRow } from "@proto/party-contract/Directory/FindParties.read";
import { PartyDirectoryRowsV0, PartyDirectoryRowTables, PartyDirectoryTables } from "@proto/party-host/Directory/PartyDirectory.table";
import * as PartySchema from "@proto/party-host/Party.schema";
import { PartyDirectoryGeneration } from "@proto/party-model/Directory/PartyDirectory.handler";
import { getTableName, isTable } from "drizzle-orm";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// The directory's tables are derived from the row's meaning, which stays in the contract: the row
// model's json form is the read contract, its generations are the ones the build declares, and the
// schema module drizzle-kit reads holds exactly the declared tables.

it("the row model's json form describes the same value as the read contract", () => {
  const contract = S.toJsonSchemaDocument(DirectoryRow);
  const json = S.toJsonSchemaDocument(PartyDirectoryRowsV0.json);
  // The variant adds only its own title.
  expect(json).toEqual({ ...contract, schema: { ...contract.schema, title: expect.any(String) } });
});

it.effect.prop("any directory row encodes and decodes the same through the row model and the read contract", [DirectoryRow], ([row]) =>
  Effect.gen(function* () {
    const viaContract = yield* S.encodeEffect(DirectoryRow)(row);
    const viaModel = yield* S.encodeEffect(PartyDirectoryRowsV0.json)(row);
    expect(viaModel).toEqual(viaContract);
    const back = yield* S.decodeEffect(PartyDirectoryRowsV0.json)(viaContract);
    const backContract = yield* S.decodeEffect(DirectoryRow)(viaContract);
    expect(back).toEqual(backContract);
    // A stored form without `absorbed` reads empty through both.
    const { absorbed: _absorbed, ...bare } = viaContract;
    const bareModel = yield* S.decodeEffect(PartyDirectoryRowsV0.json)(bare);
    const bareContract = yield* S.decodeEffect(DirectoryRow)(bare);
    expect(bareModel).toEqual(bareContract);
  }),
);

it("the declared row tables hold the generation the build writes, each named for its generation", () => {
  const declared = R.toEntries(PartyDirectoryRowTables);
  expect(A.map(declared, ([generation]) => generation)).toContain(`${PartyDirectoryGeneration}`);
  A.forEach(declared, ([generation, { table }]) => expect(getTableName(table)).toBe(`party_directory_rows_v_${generation}`));
});

it("the schema module exports exactly the declared tables, the same objects the adapter queries", () => {
  const exported = A.filter(R.values(PartySchema), isTable);
  const declared = [...A.map(R.values(PartyDirectoryRowTables), ({ table }) => table), PartyDirectoryTables.positions, PartyDirectoryTables.active];
  expect(exported).toHaveLength(declared.length);
  A.forEach(declared, (table) => expect(exported).toContain(table));
});
