/**
 * Lossless maps between an item and its CTRF test and SARIF result forms. No
 * emitter is built here; the maps prove the model projects to both formats
 * and back without losing a field.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Item, ItemDetail, Location } from "./Item.ts";
import { fingerprint, ItemKey } from "./ItemKey.ts";
import { optionalSlot } from "./internal/slots.ts";
import { Count, DurationMs, Position, Text } from "./Scalars.ts";
import { FailureKind, HistoryLabel, ItemOutcome, Severity } from "./Vocabulary.ts";

const $I = $GateReportId.create("Interchange");

/**
 * The item fields both formats carry outside their native fields.
 *
 * **Example** (Read the extension fields)
 *
 * ```ts
 * import { ItemExtension } from "@beep/gate-report/Interchange";
 *
 * console.log("key" in ItemExtension.fields); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ItemExtension extends S.Opaque<ItemExtension, { readonly brand: unique symbol }>()(
  S.Struct({
    key: ItemKey,
    unit: Text,
    path: S.Array(S.String),
    name: S.String,
    column: optionalSlot(Position),
    diff: optionalSlot(S.String),
    stack: optionalSlot(S.String),
    code: optionalSlot(Text),
    rule: optionalSlot(Text),
    severity: optionalSlot(Severity),
    failureKind: optionalSlot(FailureKind),
    signature: optionalSlot(Text),
    attempts: optionalSlot(ItemOutcome.pipe(S.NonEmptyArray)),
    durationMs: optionalSlot(DurationMs),
    label: optionalSlot(HistoryLabel),
    detailed: S.Boolean,
  }).pipe(
    $I.annoteSchema("ItemExtension", {
      description: "The item fields CTRF and SARIF carry in their extension bags.",
    })
  )
) {}

/**
 * CTRF test statuses.
 *
 * **Example** (Guard a status)
 *
 * ```ts
 * import { CtrfStatus } from "@beep/gate-report/Interchange";
 *
 * console.log(CtrfStatus.is.other("other")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CtrfStatus = LiteralKit(["passed", "failed", "skipped", "pending", "other"]).pipe(
  $I.annoteSchema("CtrfStatus", {
    description: "The CTRF test status vocabulary.",
  })
);

/**
 * Type of {@link CtrfStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type CtrfStatus = typeof CtrfStatus.Type;

/**
 * The CTRF test fields an item maps to, with the remainder in `extra`.
 *
 * **Example** (Read a test's status field)
 *
 * ```ts
 * import { CtrfTest } from "@beep/gate-report/Interchange";
 *
 * console.log("status" in CtrfTest.fields); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CtrfTest extends S.Opaque<CtrfTest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    status: CtrfStatus,
    duration: DurationMs,
    filePath: optionalSlot(Text),
    line: optionalSlot(Position),
    message: optionalSlot(S.String),
    trace: optionalSlot(S.String),
    suite: S.Array(S.String),
    retries: Count,
    flaky: S.Boolean,
    extra: ItemExtension,
  }).pipe(
    $I.annoteSchema("CtrfTest", {
      description: "A CTRF test as an item maps to it.",
    })
  )
) {}

/**
 * SARIF result levels.
 *
 * **Example** (Guard a level)
 *
 * ```ts
 * import { SarifLevel } from "@beep/gate-report/Interchange";
 *
 * console.log(SarifLevel.is.none("none")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SarifLevel = LiteralKit(["none", "note", "warning", "error"]).pipe(
  $I.annoteSchema("SarifLevel", {
    description: "The SARIF result level vocabulary.",
  })
);

/**
 * Type of {@link SarifLevel}.
 *
 * @category models
 * @since 0.0.0
 */
export type SarifLevel = typeof SarifLevel.Type;

/**
 * SARIF result kinds used by the map.
 *
 * **Example** (Guard a kind)
 *
 * ```ts
 * import { SarifKind } from "@beep/gate-report/Interchange";
 *
 * console.log(SarifKind.is.review("review")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SarifKind = LiteralKit(["pass", "fail", "review", "notApplicable"]).pipe(
  $I.annoteSchema("SarifKind", {
    description: "The SARIF result kinds an item outcome maps to.",
  })
);

/**
 * Type of {@link SarifKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type SarifKind = typeof SarifKind.Type;

/**
 * A SARIF physical location: the artifact URI and the region's start.
 *
 * **Example** (Build a location)
 *
 * ```ts
 * import { SarifLocation } from "@beep/gate-report/Interchange";
 *
 * const location = SarifLocation.make({ uri: "src/a.ts", startLine: 3, startColumn: 7 });
 * console.log(location.uri); // src/a.ts
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SarifLocation extends S.Opaque<SarifLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    uri: Text,
    startLine: Position,
    startColumn: Position,
  }).pipe(
    $I.annoteSchema("SarifLocation", {
      description: "A SARIF physical location flattened to the artifact URI and the region's start.",
    })
  )
) {}

/**
 * The SARIF result fields an item maps to, with the remainder in
 * `properties`.
 *
 * **Example** (Read a result's rule field)
 *
 * ```ts
 * import { SarifResult } from "@beep/gate-report/Interchange";
 *
 * console.log("ruleId" in SarifResult.fields); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SarifResult extends S.Opaque<SarifResult, { readonly brand: unique symbol }>()(
  S.Struct({
    ruleId: optionalSlot(Text),
    level: SarifLevel,
    kind: SarifKind,
    message: S.String,
    locations: S.Array(SarifLocation),
    partialFingerprints: S.Record(S.String, S.String),
    properties: ItemExtension,
  }).pipe(
    $I.annoteSchema("SarifResult", {
      description: "A SARIF result as an item maps to it.",
    })
  )
) {}

const extensionOf = (item: Item): ItemExtension =>
  ItemExtension.make({
    key: item.key,
    unit: item.unit,
    path: item.path,
    name: item.name,
    column: O.map(item.location, (location) => location.column),
    diff: O.flatMap(item.detail, (detail) => detail.diff),
    stack: O.flatMap(item.detail, (detail) => detail.stack),
    code: item.code,
    rule: item.rule,
    severity: item.severity,
    failureKind: item.failureKind,
    signature: item.signature,
    attempts: item.attempts,
    durationMs: item.durationMs,
    label: item.label,
    detailed: O.isSome(item.detail),
  });

const detailOf = (message: string, extension: ItemExtension): O.Option<ItemDetail> =>
  extension.detailed ? ItemDetail.makeOption({ message, diff: extension.diff, stack: extension.stack }) : O.none();

const itemOf = (extension: ItemExtension, parts: Pick<Item, "outcome" | "location" | "detail">): Item =>
  Item.make({
    key: extension.key,
    unit: extension.unit,
    path: extension.path,
    name: extension.name,
    code: extension.code,
    rule: extension.rule,
    severity: extension.severity,
    failureKind: extension.failureKind,
    signature: extension.signature,
    attempts: extension.attempts,
    durationMs: extension.durationMs,
    label: extension.label,
    ...parts,
  });

const isFlaky = (attempts: O.Option<A.NonEmptyReadonlyArray<ItemOutcome>>): boolean =>
  O.exists(attempts, (outcomes) => A.contains(outcomes, "failed") && A.contains(outcomes, "passed"));

/**
 * Map an item to a CTRF test.
 *
 * **Example** (Map a passed test)
 *
 * ```ts
 * import { toCtrf } from "@beep/gate-report/Interchange";
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "a.test.ts", fullName: "x" }),
 *   unit: "a.test.ts", path: [], name: "x", outcome: "passed",
 * });
 * console.log(toCtrf(item).status); // passed
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toCtrf = (item: Item): CtrfTest =>
  CtrfTest.make({
    name: item.name,
    status: ItemOutcome.match(item.outcome, {
      passed: (): CtrfStatus => "passed",
      failed: (): CtrfStatus => "failed",
      warned: (): CtrfStatus => "other",
      skipped: (): CtrfStatus => "skipped",
    }),
    duration: O.getOrElse(item.durationMs, () => 0),
    filePath: O.map(item.location, (location) => location.file),
    line: O.map(item.location, (location) => location.line),
    message: O.map(item.detail, (detail) => detail.message),
    trace: O.flatMap(item.detail, (detail) => detail.stack),
    suite: item.path,
    retries: pipe(
      item.attempts,
      O.map((attempts) => attempts.length - 1),
      O.getOrElse(() => 0)
    ),
    flaky: isFlaky(item.attempts),
    extra: extensionOf(item),
  });

/**
 * Map a CTRF test back to its item.
 *
 * **Example** (Round-trip an item)
 *
 * ```ts
 * import { fromCtrf, toCtrf } from "@beep/gate-report/Interchange";
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "a.test.ts", fullName: "x" }),
 *   unit: "a.test.ts", path: [], name: "x", outcome: "warned",
 * });
 * console.log(fromCtrf(toCtrf(item)).outcome); // warned
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const fromCtrf = (test: CtrfTest): Item =>
  itemOf(test.extra, {
    outcome: CtrfStatus.match(test.status, {
      passed: (): ItemOutcome => "passed",
      failed: (): ItemOutcome => "failed",
      other: (): ItemOutcome => "warned",
      skipped: (): ItemOutcome => "skipped",
      pending: (): ItemOutcome => "skipped",
    }),
    location: O.map(O.all({ file: test.filePath, line: test.line, column: test.extra.column }), (location) =>
      Location.make(location)
    ),
    detail: detailOf(
      O.getOrElse(test.message, () => ""),
      test.extra
    ),
  });

const ITEM_KEY_FINGERPRINT = "gateReport/itemKey/v1";

/**
 * Map an item to a SARIF result.
 *
 * **Details**
 *
 * The rule id is the item's TS code or lint rule, the level its severity
 * (`none` without one), the kind its outcome, the region its location, and
 * `partialFingerprints` carries the item key's fingerprint.
 *
 * **Example** (Map a type error)
 *
 * ```ts
 * import { toSarif } from "@beep/gate-report/Interchange";
 * import { Item } from "@beep/gate-report/Item";
 * import { DiagnosticKeyInput, diagnosticKey } from "@beep/gate-report/ItemKey";
 * import * as O from "effect/Option";
 *
 * const item = Item.make({
 *   key: diagnosticKey(DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message: "Type 'a' is not assignable." })),
 *   unit: "src/a.ts", path: [], name: "Type 'a' is not assignable.", outcome: "failed",
 *   code: O.some("TS2322"), severity: O.some("error"),
 * });
 * console.log(toSarif(item).level); // error
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toSarif = (item: Item): SarifResult =>
  SarifResult.make({
    ruleId: O.orElse(item.code, () => item.rule),
    level: pipe(
      item.severity,
      O.map((severity): SarifLevel => severity),
      O.getOrElse((): SarifLevel => "none")
    ),
    kind: ItemOutcome.match(item.outcome, {
      passed: (): SarifKind => "pass",
      failed: (): SarifKind => "fail",
      warned: (): SarifKind => "review",
      skipped: (): SarifKind => "notApplicable",
    }),
    message: pipe(
      item.detail,
      O.map((detail) => detail.message),
      O.getOrElse(() => item.name)
    ),
    locations: A.fromOption(
      O.map(item.location, (location) =>
        SarifLocation.make({ uri: location.file, startLine: location.line, startColumn: location.column })
      )
    ),
    partialFingerprints: { [ITEM_KEY_FINGERPRINT]: fingerprint(item.key) },
    properties: extensionOf(item),
  });

/**
 * Map a SARIF result back to its item.
 *
 * **Example** (Round-trip a type error)
 *
 * ```ts
 * import { fromSarif, toSarif } from "@beep/gate-report/Interchange";
 * import { Item } from "@beep/gate-report/Item";
 * import { DiagnosticKeyInput, diagnosticKey } from "@beep/gate-report/ItemKey";
 * import * as O from "effect/Option";
 *
 * const item = Item.make({
 *   key: diagnosticKey(DiagnosticKeyInput.make({ file: "src/a.ts", code: "TS2322", message: "Type 'a' is not assignable." })),
 *   unit: "src/a.ts", path: [], name: "Type 'a' is not assignable.", outcome: "failed",
 *   code: O.some("TS2322"), severity: O.some("error"),
 * });
 * console.log(O.getOrNull(fromSarif(toSarif(item)).severity)); // error
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const fromSarif = (result: SarifResult): Item =>
  itemOf(result.properties, {
    outcome: SarifKind.match(result.kind, {
      pass: (): ItemOutcome => "passed",
      fail: (): ItemOutcome => "failed",
      review: (): ItemOutcome => "warned",
      notApplicable: (): ItemOutcome => "skipped",
    }),
    location: O.map(A.head(result.locations), (location) =>
      Location.make({ file: location.uri, line: location.startLine, column: location.startColumn })
    ),
    detail: detailOf(result.message, result.properties),
  });
