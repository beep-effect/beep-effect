import { $SchemaId } from "@beep/identity";
import { CSV } from "@beep/schema/Csv";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const $I = $SchemaId.create("csv_test");

const PositiveCsvNumber = S.FiniteFromString.check(S.isGreaterThan(0));

class UserRow extends S.Class<UserRow>($I`UserRow`)(
  {
    id: PositiveCsvNumber,
    first_name: S.String,
    last_name: S.String,
    address: S.String,
  },
  $I.annote("UserRow", {
    description: "CSV user row used in tests.",
  })
) {}

class OptionalUserRow extends S.Class<OptionalUserRow>($I`OptionalUserRow`)(
  {
    id: PositiveCsvNumber,
    first_name: S.String,
    nickname: S.optionalKey(S.String),
  },
  $I.annote("OptionalUserRow", {
    description: "CSV user row with an optional encoded field.",
  })
) {}

class NullableUserRow extends S.Class<NullableUserRow>($I`NullableUserRow`)(
  {
    id: PositiveCsvNumber,
    nickname: S.NullOr(S.String),
  },
  $I.annote("NullableUserRow", {
    description: "CSV user row with a nullable encoded field.",
  })
) {}

class InvalidNumberRow extends S.Class<InvalidNumberRow>($I`InvalidNumberRow`)(
  {
    id: S.Finite,
    name: S.String,
  },
  $I.annote("InvalidNumberRow", {
    description: "CSV row with a non-string boundary number field.",
  })
) {}

describe("CSV", () => {
  const userRowArbitrary = S.toArbitrary(UserRow);

  it.effect(
    "decodes headered CSV text into typed row arrays",
    Effect.fnUntraced(function* () {
      const csv = CSV(UserRow);
      const rows = yield* S.decodeUnknownEffect(csv)(
        "id,first_name,last_name,address\n1,Ada,Lovelace,London\n2,Grace,Hopper,New York"
      );

      expect(rows).toHaveLength(2);
      expect(rows[0]).toBeInstanceOf(UserRow);
      expect(rows[0].id).toBe(1);
      expect(rows[1].last_name).toBe("Hopper");
    })
  );

  it.effect(
    "maps input columns by header name even when the file order differs",
    Effect.fnUntraced(function* () {
      const csv = CSV(UserRow);
      const rows = yield* S.decodeUnknownEffect(csv)(
        "address,last_name,id,first_name\nLondon,Lovelace,1,Ada\nNew York,Hopper,2,Grace"
      );

      expect(rows[0].first_name).toBe("Ada");
      expect(rows[0].address).toBe("London");
      expect(rows[1].id).toBe(2);
    })
  );

  it.effect(
    "supports delimiter, quoting, trimming, skipRows, skipLines, and maxRows",
    Effect.fnUntraced(function* () {
      const csv = CSV(UserRow, {
        delimiter: ";",
        maxRows: 1,
        quote: '"',
        skipLines: 1,
        skipRows: 1,
        trim: true,
      });

      const rows = yield* S.decodeUnknownEffect(csv)(
        '# comment to skip entirely\nid;first_name;last_name;address\n1; Ada ;Lovelace;"London, UK"\n2;Grace;Hopper;"New\nYork"'
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(2);
      expect(rows[0].address).toBe("New\nYork");
    })
  );

  it.effect(
    "supports curried options, empty documents, and short non-strict rows",
    Effect.fnUntraced(function* () {
      const csv = CSV({ trim: true })(OptionalUserRow);

      expect(yield* S.decodeUnknownEffect(csv)("")).toEqual([]);

      const rows = yield* S.decodeUnknownEffect(csv)("id, first_name, nickname\n1, Ada");

      expect(rows).toHaveLength(1);
      const [row] = rows as ReadonlyArray<OptionalUserRow>;
      expect(row).toBeInstanceOf(OptionalUserRow);
      if (row === undefined) {
        return;
      }
      expect(row.id).toBe(1);
      expect(row.first_name).toBe("Ada");
      expect(row.nickname).toBe("");
    })
  );

  it.effect(
    "encodes rows back to branded CSV text in schema field order",
    Effect.fnUntraced(function* () {
      const csv = CSV(UserRow);
      const rows = [
        UserRow.make({
          address: "London, UK",
          first_name: "Ada",
          id: 1,
          last_name: "Lovelace",
        }),
      ];

      const encoded = yield* S.encodeEffect(csv)(rows);

      expect(encoded).toBe('id,first_name,last_name,address\n1,Ada,Lovelace,"London, UK"');

      const roundTrip = yield* S.decodeUnknownEffect(csv)(encoded);
      expect(roundTrip[0].address).toBe("London, UK");
      expect(roundTrip[0].id).toBe(1);
    })
  );

  it("round-trips schema-derived rows through the CSV codec", () => {
    const csv = CSV(UserRow);

    fc.assert(
      fc.property(fc.array(userRowArbitrary, { maxLength: 5 }), (rows) => {
        const encoded = S.encodeSync(csv)(rows);
        const decoded = S.decodeUnknownSync(csv)(encoded);

        expect(decoded).toEqual(rows);
      }),
      { numRuns: 25 }
    );
  });

  it.effect(
    "renders missing optional encoded fields as empty cells",
    Effect.fnUntraced(function* () {
      const csv = CSV(OptionalUserRow);
      const rows = [
        OptionalUserRow.make({
          first_name: "Ada",
          id: 1,
        }),
      ];

      const encoded = yield* S.encodeEffect(csv)(rows);

      expect(encoded).toBe("id,first_name,nickname\n1,Ada,");
    })
  );

  it.effect(
    "renders nullable encoded fields as empty cells",
    Effect.fnUntraced(function* () {
      const csv = CSV(NullableUserRow);
      const rows = [
        NullableUserRow.make({
          id: 1,
          nickname: null,
        }),
      ];

      const encoded = yield* S.encodeEffect(csv)(rows);

      expect(encoded).toBe("id,nickname\n1,");
    })
  );

  it.effect(
    "rejects duplicate headers",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.decodeUnknownEffect(CSV(UserRow))("id,id,last_name,address\n1,2,Lovelace,London")
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);
        expect(rendered).toContain("Duplicate headers found [id]");
      }
    })
  );

  it.effect(
    "rejects missing or unexpected headers",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.decodeUnknownEffect(CSV(UserRow))("id,first_name,address,unexpected\n1,Ada,London,nope")
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);
        expect(rendered).toContain("CSV header mismatch");
        expect(rendered).toContain("missing: last_name");
        expect(rendered).toContain("unexpected: unexpected");
      }
    })
  );

  it.effect(
    "reports missing-only and unexpected-only header mismatches",
    Effect.fnUntraced(function* () {
      const missingOnly = yield* Effect.exit(
        S.decodeUnknownEffect(CSV(UserRow))("id,first_name,last_name\n1,Ada,Lovelace")
      );
      const unexpectedOnly = yield* Effect.exit(
        S.decodeUnknownEffect(CSV(UserRow))("id,first_name,last_name,address,unexpected\n1,Ada,Lovelace,London,nope")
      );

      expect(Exit.isFailure(missingOnly)).toBe(true);
      if (Exit.isFailure(missingOnly)) {
        const rendered = Cause.pretty(missingOnly.cause);
        expect(rendered).toContain("CSV header mismatch");
        expect(rendered).toContain("missing: address");
      }

      expect(Exit.isFailure(unexpectedOnly)).toBe(true);
      if (Exit.isFailure(unexpectedOnly)) {
        const rendered = Cause.pretty(unexpectedOnly.cause);
        expect(rendered).toContain("CSV header mismatch");
        expect(rendered).toContain("unexpected: unexpected");
      }
    })
  );

  it.effect(
    "rejects row length mismatches when strict column handling is enabled",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.decodeUnknownEffect(CSV(UserRow, { strictColumnHandling: true }))(
          "id,first_name,last_name,address\n1,Ada,Lovelace"
        )
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);
        expect(rendered).toContain("Column header mismatch expected: 4 columns got: 3");
      }
    })
  );

  it.effect(
    "rejects extra row cells even without strict column handling",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.decodeUnknownEffect(CSV(UserRow))("id,first_name,last_name,address\n1,Ada,Lovelace,London,extra")
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);
        expect(rendered).toContain("Column header mismatch expected: 4 columns got: 5");
      }
    })
  );

  it.effect(
    "fails when the row schema does not model a CSV text boundary",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(S.decodeUnknownEffect(CSV(InvalidNumberRow))("id,name\n1,Ada"));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);
        expect(rendered).toContain("Expected number");
      }
    })
  );

  it.effect(
    "fails to encode non-string-compatible field output",
    Effect.fnUntraced(function* () {
      const csv = CSV(InvalidNumberRow);
      const rows = [InvalidNumberRow.make({ id: 1, name: "Ada" })];
      const result = yield* Effect.exit(S.encodeEffect(csv)(rows));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);
        expect(rendered).toContain("Encoded CSV field 'id' must be a string-compatible value.");
      }
    })
  );
});
