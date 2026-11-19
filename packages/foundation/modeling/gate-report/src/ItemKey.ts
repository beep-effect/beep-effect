/**
 * The stable identity of an item across runs: file plus full name for a test,
 * file plus code or rule plus message shape for a diagnostic, and the unit
 * plus fault kind for a failure no single item owns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { optionalSlot } from "./internal/slots.ts";
import { Text } from "./Scalars.ts";
import { FailureKind } from "./Vocabulary.ts";

const $I = $GateReportId.create("ItemKey");

/**
 * The ordinal of a repeated diagnostic occurrence within one run, from 2.
 *
 * **Details**
 *
 * The first occurrence of a diagnostic key carries no ordinal, so a key and
 * its fingerprint stay the same across runs whenever a diagnostic occurs once.
 *
 * **Example** (Check an ordinal)
 *
 * ```ts
 * import { Occurrence } from "@beep/gate-report/ItemKey";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Occurrence)(2)); // true
 * console.log(S.is(Occurrence)(1)); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Occurrence = S.Int.check(S.isGreaterThanOrEqualTo(2)).pipe(
  $I.annoteSchema("Occurrence", {
    description: "The ordinal of a repeated diagnostic occurrence within one run, from 2; the first has none.",
  })
);

/**
 * Type of {@link Occurrence}.
 *
 * @category models
 * @since 0.0.0
 */
export type Occurrence = typeof Occurrence.Type;

/**
 * The key of an item: a tagged union over tests, diagnostics and faults.
 *
 * **Details**
 *
 * A test key carries the file, so same-named tests in two files stay
 * distinct (upstream's flat `fullName` map collides). A diagnostic key carries
 * the message shape, with quoted literals and numbers normalized out, so a
 * diagnostic keeps its key when a line moves or a type name changes. Two
 * diagnostics with the same file, code and shape at different locations in
 * one run are told apart by `occurrence`, which the reducer assigns: absent
 * for the first, 2 and up for the rest.
 *
 * **Example** (Build a test key)
 *
 * ```ts
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 *
 * const key = ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: "math > adds" });
 * console.log(key._tag); // TestKey
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ItemKey = S.TaggedUnion({
  TestKey: { file: Text, fullName: S.String },
  DiagnosticKey: { file: Text, code: Text, shape: S.String, occurrence: optionalSlot(Occurrence) },
  FaultKey: { unit: Text, kind: FailureKind, name: S.String },
}).pipe(
  $I.annoteSchema("ItemKey", {
    description: "The stable identity of an item across runs.",
  })
);

/**
 * Type of {@link ItemKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type ItemKey = typeof ItemKey.Type;

const firstLine = flow(Str.split("\n"), A.headNonEmpty, Str.trimEnd);

/**
 * The shape of a diagnostic message: its first line with quoted literals and
 * numbers normalized out.
 *
 * **Example** (Normalize a type error message)
 *
 * ```ts
 * import { messageShape } from "@beep/gate-report/ItemKey";
 *
 * console.log(messageShape("Type 'string' is not assignable to type 'number'."));
 * // Type <s> is not assignable to type <s>.
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const messageShape: (message: string) => string = flow(
  firstLine,
  Str.replace(/'[^']*'|"[^"]*"|`[^`]*`/gu, "<s>"),
  Str.replace(/\d+/gu, "<n>"),
  Str.replace(/\s+/gu, " "),
  Str.trim
);

/**
 * What a diagnostic key is built from: the file, the TS code or lint rule,
 * and the message.
 *
 * **Example** (Build an input)
 *
 * ```ts
 * import { DiagnosticKeyInput } from "@beep/gate-report/ItemKey";
 *
 * const input = DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message: "Type 'a' is not assignable." });
 * console.log(input.code); // TS2322
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DiagnosticKeyInput extends S.Opaque<DiagnosticKeyInput, { readonly brand: unique symbol }>()(
  S.Struct({
    file: Text,
    code: Text,
    message: S.String,
  }).pipe(
    $I.annoteSchema("DiagnosticKeyInput", {
      description: "The file, TS code or lint rule, and message a diagnostic key is built from.",
    })
  )
) {}

/**
 * Build the key of a diagnostic from its file, its TS code or lint rule, and
 * its message.
 *
 * **Example** (Key a type error)
 *
 * ```ts
 * import { DiagnosticKeyInput, diagnosticKey } from "@beep/gate-report/ItemKey";
 *
 * const key = diagnosticKey(
 *   DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message: "Type 'a' is not assignable to type 'b'." })
 * );
 * console.log(key.shape); // Type <s> is not assignable to type <s>.
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const diagnosticKey = (input: DiagnosticKeyInput): typeof ItemKey.cases.DiagnosticKey.Type =>
  ItemKey.cases.DiagnosticKey.make({ file: input.file, code: input.code, shape: messageShape(input.message) });

const field = (value: string): string => `|${value.length}:${value}`;

const encodeKey = (tag: string, fields: ReadonlyArray<string>): string => `${tag}${A.join(A.map(fields, field), "")}`;

const occurrenceSuffix: (occurrence: O.Option<Occurrence>) => string = flow(
  O.map((ordinal) => `#${ordinal}`),
  O.getOrElse(() => "")
);

/**
 * The key as one string, the fingerprint SARIF and CTRF carry and the index a
 * record reader keys on.
 *
 * **Details**
 *
 * The fingerprint is the key tag followed by each field as `|<length>:<text>`,
 * lengths in UTF-16 code units, and `#<ordinal>` for a repeated diagnostic
 * occurrence. Every field can be read back by its length, so the encoding is
 * injective: two keys have the same fingerprint exactly when they are equal,
 * whatever characters their fields contain.
 *
 * **Example** (Fingerprint a key)
 *
 * ```ts
 * import { ItemKey, fingerprint } from "@beep/gate-report/ItemKey";
 *
 * const key = ItemKey.cases.TestKey.make({ file: "a.ts", fullName: "x" });
 * console.log(fingerprint(key).startsWith("test")); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const fingerprint: (key: ItemKey) => string = ItemKey.match({
  TestKey: (key) => encodeKey("test", [key.file, key.fullName]),
  DiagnosticKey: (key) =>
    `${encodeKey("diagnostic", [key.file, key.code, key.shape])}${occurrenceSuffix(key.occurrence)}`,
  FaultKey: (key) => encodeKey("fault", [key.unit, key.kind, key.name]),
});

/**
 * The history series an item belongs to: gate, subject, item key and branch.
 *
 * **Details**
 *
 * Widens upstream's `test_history` key (project, module path, full name) with
 * the gate and the branch, so a red test on a lane never relabels the same
 * test on `main`. The store that reads it is the history goal's.
 *
 * **Example** (Build a series key)
 *
 * ```ts
 * import { ItemKey, SeriesKey } from "@beep/gate-report/ItemKey";
 *
 * const series = SeriesKey.make({
 *   gate: "test",
 *   subject: "@beep/glob",
 *   item: ItemKey.cases.TestKey.make({ file: "a.ts", fullName: "x" }),
 *   branch: "main",
 * });
 * console.log(series.branch); // main
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SeriesKey extends S.Opaque<SeriesKey, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    item: ItemKey,
    branch: Text,
  }).pipe(
    $I.annoteSchema("SeriesKey", {
      description: "The history series of one item: gate, subject, item key and branch.",
    })
  )
) {}
