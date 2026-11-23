import {
  decodeLoadManifestEntry,
  decodeVendorManifestRow,
  VendorDigestUnit,
  vendorDigestUnit,
} from "@beep/ontology/TaxonomyLoader";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const path = "../../../../explorations/legal-ontology-landscape/assets/manifest.jsonl";
const packet = Str.replace(/\/assets\/manifest\.jsonl$/u, "")(path);

it.layer(BunFileSystem.layer)("real exploration manifest", (it) => {
  it.effect("decodes every row without vendor bytes and derives a digest unit for each", (ctx) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      if (!(yield* fs.exists(packet))) {
        return ctx.skip(
          `absent from this checkout (a trimmed checkout may drop the packet): ${Str.replace(/^(?:\.\.\/)+/u, "")(packet)}`
        );
      }
      const content = yield* fs.readFileString(path);
      const lines = A.filter(Str.split(content, "\n"), Str.isNonEmpty);
      const rows = yield* Effect.forEach(lines, (line, index) => decodeVendorManifestRow(path, line, index), {
        concurrency: 1,
      });
      const entries = yield* Effect.forEach(lines, (line, index) => decodeLoadManifestEntry(path, line, index), {
        concurrency: 1,
      });
      const units = A.map(rows, vendorDigestUnit);
      const admitted = A.getSomes(entries);

      expect(A.every(units, S.is(VendorDigestUnit))).toBe(true);
      expect(A.every(rows, (row) => O.isSome(row.sha256))).toBe(true);
      expect(A.map(admitted, (entry) => [entry.id, entry.loadKind])).toEqual([
        ["folio-email-communication", "concept-alignment"],
      ]);
      expect(
        A.map(
          A.filter(rows, (row) => O.contains(row.loadKind, "classification-scheme")),
          (row) => [row.id, vendorDigestUnit(row)]
        )
      ).toEqual([
        ["ipc-scheme-20260101", "archive-entry"],
        ["cpc-scheme-202608", "tree"],
        ["nice-classification-texts-20260101", "archive-entry"],
        ["nice-top-structure-20260101", "archive-entry"],
      ]);
    })
  );
});
