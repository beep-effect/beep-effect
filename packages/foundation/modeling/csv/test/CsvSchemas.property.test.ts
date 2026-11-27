import { CsvDiagnostic } from "@beep/csv/CsvDiagnostic.schema";
import { CsvParseError } from "@beep/csv/CsvError.errors";
import { CsvCodecOptions, CsvReadOptions, CsvWriteOptions } from "@beep/csv/CsvOptions.schema";
import { CsvByteOffset, CsvIndex, CsvTextSpan } from "@beep/csv/CsvPosition.schema";
import { CsvRead } from "@beep/csv/CsvRead.schema";
import { CsvHeaderRow, CsvRecordSlice, CsvTable } from "@beep/csv/CsvTable.schema";
import { MachineConfig, MachineModeName, MachineState } from "@beep/csv/internal/machine";
import { Prepared, Start } from "@beep/csv/internal/start";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const runs = { arbitrary: { runs: 50 } };
const schemas = {
  CsvIndex,
  CsvByteOffset,
  CsvTextSpan,
  CsvTable,
  CsvRecordSlice,
  CsvHeaderRow,
  CsvDiagnostic,
  CsvReadOptions,
  CsvWriteOptions,
  CsvCodecOptions,
  CsvRead,
  CsvParseError,
  MachineConfig,
  MachineModeName,
  MachineState,
  Start,
  Prepared,
};

describe("each listed schema generates only valid values (SF-7): the roots, whose fields hold every other exported schema, the header row, the parse error and the engine's schemas", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        assertTrue(S.is(schema)(value));
      },
      runs
    );
  }
});

describe("CsvReadOptions JSON Schema key annotations", () => {
  it("emits the limits key annotation in toJsonSchemaDocument because annotateKey runs before withDecodingDefaultTypeKey", () => {
    expect(S.toJsonSchemaDocument(CsvReadOptions).definitions).toMatchObject({
      "@beep/csv/CsvOptions/CsvReadOptions": {
        properties: { limits: { allOf: expect.arrayContaining([{ description: "The caps" }]) } },
      },
    });
  });
});
