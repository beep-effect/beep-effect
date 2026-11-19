// Every exported schema, and the machine's state, generates only values it accepts (schema-first rule SF-7).

import { CsvDiagnostic } from "@beep/csv/CsvDiagnostic.schema";
import { CsvCodecOptions, CsvReadOptions, CsvWriteOptions } from "@beep/csv/CsvOptions.schema";
import { CsvByteOffset, CsvIndex, CsvTextSpan } from "@beep/csv/CsvPosition.schema";
import { CsvRead } from "@beep/csv/CsvRead.schema";
import { CsvRecordSlice, CsvTable } from "@beep/csv/CsvTable.schema";
import { MachineState } from "@beep/csv/internal/machine";
import { describe, expect, it } from "@effect/vitest";
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
  CsvDiagnostic,
  CsvReadOptions,
  CsvWriteOptions,
  CsvCodecOptions,
  CsvRead,
  MachineState,
};

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true);
      },
      runs
    );
  }
});
