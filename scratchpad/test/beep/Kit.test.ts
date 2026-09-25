import { assert, describe, it } from "@effect/vitest";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { toPgTable } from "@beep/effect-drizzle/pg";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  KitFieldError,
  Model,
  NonNegativeInt,
  StableId,
  UnitInterval,
  UtcTimestamp,
  accountGeneration,
  accountGenerationDefault,
  bool,
  boundedText,
  confidence,
  nonNegativeInt,
  nonNegativeIntCheck,
  optionalBool,
  optionalBoundedText,
  optionalConfidence,
  optionalNonNegativeInt,
  optionalStableId,
  optionalText,
  optionalTimestamp,
  optionalUserId,
  stableId,
  stableIdCheck,
  text,
  textBoundsCheck,
  timestamp,
  timestampDefaultNow,
  unitIntervalCheck,
  userId,
} from "../../beep/Kit.ts";

const isKitFieldError = S.is(KitFieldError);

const dialect = new PgDialect();

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const problemOf = (run: () => void): string => {
  const attempted = Result.try({
    try: run,
    catch: (error) => error,
  });
  if (Result.isFailure(attempted) && isKitFieldError(attempted.failure)) return attempted.failure.problem;
  return "absent";
};

class RequiredRow extends Model<RequiredRow>("RequiredRow")(
  {
    id: stableId("id"),
    uid: userId("uid"),
    title: text("title"),
    label: boundedText("label", { minLength: 1, maxLength: 8, pattern: "^[a-z0-9_]+$" }),
    createdAt: timestamp("created_at"),
    confidence: confidence("confidence"),
    attempt: nonNegativeInt("attempt"),
    accountGeneration: accountGeneration("account_generation"),
    enabled: bool("enabled"),
  },
  (columns) => [
    stableIdCheck("id")(columns.id),
    textBoundsCheck("label", { minLength: 1, maxLength: 8, pattern: "^[a-z0-9_]+$" })(columns.label),
    unitIntervalCheck("confidence")(columns.confidence),
    nonNegativeIntCheck("attempt")(columns.attempt),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
  ],
) {}

const decodeRequiredRow = S.decodeEffect(RequiredRow);

class OptionalRow extends Model<OptionalRow>("OptionalRow")(
  {
    parentId: optionalStableId("parent_id"),
    uid: optionalUserId("uid"),
    note: optionalText("note"),
    summary: optionalBoundedText("summary", { maxLength: 4 }),
    updatedAt: optionalTimestamp("updated_at"),
    dueConfidence: optionalConfidence("due_confidence"),
    attempt: optionalNonNegativeInt("attempt"),
    archived: optionalBool("archived"),
  },
  (columns) => [
    stableIdCheck("parent_id")(columns.parentId),
    textBoundsCheck("summary", { maxLength: 4 })(columns.summary),
    unitIntervalCheck("due_confidence")(columns.dueConfidence),
    nonNegativeIntCheck("attempt")(columns.attempt),
  ],
) {}

const decodeOptionalRow = S.decodeEffect(OptionalRow);
const encodeOptionalRow = S.encodeEffect(OptionalRow);

const presentOptional = {
  parentId: "parent-1",
  uid: "user-1",
  note: "hello",
  summary: "abcd",
  updatedAt: "2020-01-02T03:04:05.000Z",
  dueConfidence: 1,
  attempt: 2,
  archived: false,
};

describe("shared schemas", () => {
  it("accepts a stable id and rejects empty, punctuation-first, and overlong ids", () => {
    assert.strictEqual(decode(StableId, "A.b:c-d_1"), "A.b:c-d_1");
    assert.strictEqual(decodeFails(StableId, ""), true);
    assert.strictEqual(decodeFails(StableId, ".a"), true);
    assert.strictEqual(decodeFails(StableId, "has space"), true);
    assert.strictEqual(decodeFails(StableId, "a".repeat(129)), true);
  });

  it("accepts the closed unit interval and rejects outside values", () => {
    assert.strictEqual(decode(UnitInterval, 0), 0);
    assert.strictEqual(decode(UnitInterval, 1), 1);
    assert.strictEqual(decodeFails(UnitInterval, -0.1), true);
    assert.strictEqual(decodeFails(UnitInterval, 1.1), true);
  });

  it("accepts zero and rejects negatives and fractional counters", () => {
    assert.strictEqual(decode(NonNegativeInt, 0), 0);
    assert.strictEqual(decodeFails(NonNegativeInt, -1), true);
    assert.strictEqual(decodeFails(NonNegativeInt, 1.5), true);
  });

  it("decodes a UTC timestamp string", () => {
    const decoded = decode(UtcTimestamp, "2020-01-02T03:04:05.000Z");
    assert.strictEqual(DateTime.formatIso(decoded), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(decodeFails(UtcTimestamp, "not-a-date"), true);
  });

  it("derives an arbitrary for every exported schema", () => {
    const schemas = [StableId, UnitInterval, NonNegativeInt, UtcTimestamp, KitFieldError];
    A.forEach(schemas, (schema) => {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    });
  });
});

describe("required columns", () => {
  const input = {
    id: "goal-1",
    uid: "user-1",
    title: "Notes",
    label: "ab_c",
    createdAt: "2020-01-02T03:04:05.000Z",
    confidence: 0.5,
    attempt: 2,
    accountGeneration: 3,
    enabled: true,
  };

  it("decodes present values", () => {
    const decoded = Effect.runSync(decodeRequiredRow(input));
    assert.strictEqual(decoded.id, "goal-1");
    assert.strictEqual(decoded.uid, "user-1");
    assert.strictEqual(decoded.title, "Notes");
    assert.strictEqual(decoded.label, "ab_c");
    assert.strictEqual(DateTime.formatIso(decoded.createdAt), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(decoded.confidence, 0.5);
    assert.strictEqual(decoded.attempt, 2);
    assert.strictEqual(decoded.accountGeneration, 3);
    assert.strictEqual(decoded.enabled, true);
  });

  it("rejects each constrained branch", () => {
    assert.strictEqual(decodeFails(RequiredRow, { ...input, id: ".nope" }), true);
    assert.strictEqual(decodeFails(RequiredRow, { ...input, label: "ABC" }), true);
    assert.strictEqual(decodeFails(RequiredRow, { ...input, label: "" }), true);
    assert.strictEqual(decodeFails(RequiredRow, { ...input, confidence: 2 }), true);
    assert.strictEqual(decodeFails(RequiredRow, { ...input, attempt: -1 }), true);
    assert.strictEqual(decodeFails(RequiredRow, { ...input, accountGeneration: -1 }), true);
  });
});

describe("optional columns", () => {
  it("decodes present values", () => {
    const decoded = Effect.runSync(decodeOptionalRow(presentOptional));
    assert.strictEqual(O.isSome(decoded.parentId) && decoded.parentId.value, "parent-1");
    assert.strictEqual(O.isSome(decoded.uid) && decoded.uid.value, "user-1");
    assert.strictEqual(O.isSome(decoded.note) && decoded.note.value, "hello");
    assert.strictEqual(O.isSome(decoded.summary) && decoded.summary.value, "abcd");
    assert.strictEqual(
      O.isSome(decoded.updatedAt) && DateTime.formatIso(decoded.updatedAt.value),
      "2020-01-02T03:04:05.000Z",
    );
    assert.strictEqual(O.isSome(decoded.dueConfidence) && decoded.dueConfidence.value, 1);
    assert.strictEqual(O.isSome(decoded.attempt) && decoded.attempt.value, 2);
    assert.strictEqual(O.isSome(decoded.archived) && decoded.archived.value, false);
    const encoded = Effect.runSync(encodeOptionalRow(decoded));
    assert.strictEqual(encoded.updatedAt, "2020-01-02T03:04:05.000Z");
    assert.strictEqual(encoded.parentId, "parent-1");
    assert.strictEqual(encoded.dueConfidence, 1);
    assert.strictEqual(encoded.archived, false);
  });

  it("decodes null and missing keys as None and encodes None as null", () => {
    const fromNull = Effect.runSync(decodeOptionalRow({
      parentId: null,
      uid: null,
      note: null,
      summary: null,
      updatedAt: null,
      dueConfidence: null,
      attempt: null,
      archived: null,
    }));
    const fromMissing = Effect.runSync(decodeOptionalRow({}));
    const made = OptionalRow.make({});
    const encoded = Effect.runSync(encodeOptionalRow(made));
    for (const row of [fromNull, fromMissing, made]) {
      assert.strictEqual(O.isNone(row.parentId), true);
      assert.strictEqual(O.isNone(row.uid), true);
      assert.strictEqual(O.isNone(row.note), true);
      assert.strictEqual(O.isNone(row.summary), true);
      assert.strictEqual(O.isNone(row.updatedAt), true);
      assert.strictEqual(O.isNone(row.dueConfidence), true);
      assert.strictEqual(O.isNone(row.attempt), true);
      assert.strictEqual(O.isNone(row.archived), true);
    }
    assert.strictEqual(encoded.parentId, null);
    assert.strictEqual(encoded.uid, null);
    assert.strictEqual(encoded.note, null);
    assert.strictEqual(encoded.summary, null);
    assert.strictEqual(encoded.updatedAt, null);
    assert.strictEqual(encoded.dueConfidence, null);
    assert.strictEqual(encoded.attempt, null);
    assert.strictEqual(encoded.archived, null);
  });

  it("rejects a present undefined and an overlong optional summary", () => {
    assert.strictEqual(decodeFails(OptionalRow, { note: undefined }), true);
    assert.strictEqual(decodeFails(OptionalRow, { summary: "abcde" }), true);
  });

  it("derives arbitraries for optional field schemas", () => {
    const schemas = [
      optionalStableId("parent_id").schema,
      optionalUserId("uid").schema,
      optionalText("note").schema,
      optionalBoundedText("summary", { maxLength: 4 }).schema,
      optionalTimestamp("updated_at").schema,
      optionalConfidence("due_confidence").schema,
      optionalNonNegativeInt("attempt").schema,
      optionalBool("archived").schema,
    ];
    A.forEach(schemas, (schema) => {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    });
  });
});

describe("constructor defaults", () => {
  it("fills account generation with zero only at construction", () => {
    class Row extends Model<Row>("GenerationRow")({
      accountGeneration: accountGenerationDefault("account_generation"),
    }) {}
    assert.strictEqual(Row.make({}).accountGeneration, 0);
    assert.strictEqual(decodeFails(Row, {}), true);
    assert.strictEqual(decode(Row, { accountGeneration: 4 }).accountGeneration, 4);
  });

  it("fills a timestamp with the current UTC instant only at construction", () => {
    class Row extends Model<Row>("StampRow")({
      createdAt: timestampDefaultNow("created_at"),
    }) {}
    assert.strictEqual(DateTime.isUtc(Row.make({}).createdAt), true);
    assert.strictEqual(decodeFails(Row, {}), true);
  });
});

describe("factory rejections", () => {
  it("rejects each unsupported pattern and bound branch", () => {
    assert.strictEqual(
      problemOf(() => boundedText("title", { pattern: "(?=a)" })),
      "lookaround",
    );
    assert.strictEqual(
      problemOf(() => boundedText("title", { pattern: "(?!a)" })),
      "lookaround",
    );
    assert.strictEqual(
      problemOf(() => boundedText("title", { pattern: "\\d+" })),
      "backslash",
    );
    assert.strictEqual(
      problemOf(() => boundedText("title", { pattern: "[" })),
      "invalid-pattern",
    );
    assert.strictEqual(
      problemOf(() => boundedText("title", {})),
      "empty-bounds",
    );
    assert.strictEqual(
      problemOf(() => boundedText("title", { minLength: -1 })),
      "bound",
    );
    assert.strictEqual(
      problemOf(() => boundedText("title", { minLength: 4, maxLength: 1 })),
      "min-above-max",
    );
    assert.strictEqual(
      problemOf(() => textBoundsCheck("Bad", { maxLength: 1 })),
      "check-name",
    );
  });
});

describe("pipeable factories", () => {
  it("builds the same fields and checks when the bounds come first", () => {
    const labelBounds = { minLength: 1, maxLength: 8, pattern: "^[a-z0-9_]+$" };
    class PipeRow extends Model<PipeRow>("PipeRow")(
      {
        label: pipe("label", boundedText(labelBounds)),
        summary: pipe("summary", optionalBoundedText({ maxLength: 4 })),
      },
      (columns) => [
        pipe("label", textBoundsCheck(labelBounds))(columns.label),
        textBoundsCheck({ maxLength: 4 })("summary")(columns.summary),
      ],
    ) {}
    const decoded = decode(PipeRow, { label: "ok_1", summary: null });
    assert.strictEqual(decoded.label, "ok_1");
    assert.strictEqual(O.isNone(decoded.summary), true);
    assert.strictEqual(decodeFails(PipeRow, { label: "Bad!" }), true);
    assert.strictEqual(decodeFails(PipeRow, { label: "ok", summary: "abcde" }), true);
    const [label, summary] = getTableConfig(PipeRow.pipe(toPgTable)).checks;
    assert.strictEqual(label?.name, "label_text");
    assert.strictEqual(summary?.name, "summary_text");
    assert.strictEqual(
      label && dialect.sqlToQuery(label.value).sql,
      `char_length("pipe_row"."label") >= 1 and char_length("pipe_row"."label") <= 8 and "pipe_row"."label" ~ '^[a-z0-9_]+$'`,
    );
    assert.strictEqual(summary && dialect.sqlToQuery(summary.value).sql, `char_length("pipe_row"."summary") <= 4`);
  });

  it("rejects bad bounds and names once the column name arrives", () => {
    assert.strictEqual(
      problemOf(() => boundedText({})("title")),
      "empty-bounds",
    );
    assert.strictEqual(
      problemOf(() => optionalBoundedText({ pattern: "(?=a)" })("summary")),
      "lookaround",
    );
    assert.strictEqual(
      problemOf(() => textBoundsCheck({ maxLength: 1 })("Bad")),
      "check-name",
    );
  });
});

describe("sql metadata", () => {
  it("keeps snake_case names, nullability, and parameter-free checks", () => {
    assert.strictEqual(RequiredRow.sql.columns.createdAt.columnName, "created_at");
    assert.strictEqual(RequiredRow.sql.columns.accountGeneration.columnName, "account_generation");
    assert.strictEqual(RequiredRow.sql.columns.id.primaryKey, false);
    const required = getTableConfig(RequiredRow.pipe(toPgTable));
    const optional = getTableConfig(OptionalRow.pipe(toPgTable));
    const requiredNames = A.map(required.checks, (check) => check.name);
    const optionalNames = A.map(optional.checks, (check) => check.name);
    for (const name of ["id_sid", "label_text", "confidence_unit", "attempt_nn", "account_generation_nn"]) {
      assert.strictEqual(A.some(requiredNames, (candidate) => candidate === name), true);
    }
    for (const name of ["parent_id_sid", "summary_text", "due_confidence_unit", "attempt_nn"]) {
      assert.strictEqual(A.some(optionalNames, (candidate) => candidate === name), true);
    }
    for (const check of [...required.checks, ...optional.checks]) {
      assert.deepStrictEqual(dialect.sqlToQuery(check.value).params, []);
    }
    const idColumn = A.findFirst(required.columns, (column) => column.name === "id");
    const noteColumn = A.findFirst(optional.columns, (column) => column.name === "note");
    assert.strictEqual(O.isSome(idColumn) && idColumn.value.notNull, true);
    assert.strictEqual(O.isSome(noteColumn) && noteColumn.value.notNull, false);
  });
});
