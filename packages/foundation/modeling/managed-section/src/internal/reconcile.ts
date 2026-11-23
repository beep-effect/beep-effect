import { $ManagedSectionId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PlacedSection, Section } from "../Section.ts";
import { Eol, SectionDialect, SectionRenderError } from "../SectionDialect.ts";
import { SyncOutcome } from "../SectionOutcome.ts";
import { identityOf } from "./scan.ts";

const $I = $ManagedSectionId.create("internal/reconcile");

/**
 * Plain input to the pure reconciliation core; every field remains required.
 *
 * **Example** (Validate complete reconciliation input)
 *
 * ```ts
 * import { ReconcileInput } from "@beep/managed-section/internal/reconcile";
 * import { SectionDialect } from "@beep/managed-section/SectionDialect";
 * import * as S from "effect/Schema";
 *
 * const input = { text: "Notes\n", placed: [], declared: [], dialect: SectionDialect.default, eol: "\n" };
 * console.log(S.is(ReconcileInput)(input)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReconcileInput extends S.Opaque<ReconcileInput, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe($I.annoteKey("ReconcileInput.text", { description: "The exact source document." })),
    placed: S.Array(S.suspend(() => PlacedSection)).pipe(
      $I.annoteKey("ReconcileInput.placed", { description: "Sections with their source spans." })
    ),
    declared: S.Array(S.suspend(() => Section)).pipe(
      $I.annoteKey("ReconcileInput.declared", { description: "Declared sections, already line-ending normalized." })
    ),
    dialect: S.suspend(() => SectionDialect).pipe(
      $I.annoteKey("ReconcileInput.dialect", { description: "The marker vocabulary to render with." })
    ),
    eol: Eol.pipe($I.annoteKey("ReconcileInput.eol", { description: "The document line ending." })),
  }).pipe($I.annoteSchema("ReconcileInput", { description: "The complete input to managed-section reconciliation." }))
) {}

/**
 * Shared plain output authority for public and internal reconciliation results.
 *
 * **Example** (Validate an unchanged reconciliation result)
 *
 * ```ts
 * import { ReconcileOutput } from "@beep/managed-section/internal/reconcile";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ReconcileOutput)({ text: "Notes\n", outcomes: [], changed: false })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReconcileOutput extends S.Opaque<ReconcileOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe($I.annoteKey("ReconcileOutput.text", { description: "The document as it should now read." })),
    outcomes: S.Array(S.suspend(() => SyncOutcome)).pipe(
      $I.annoteKey("ReconcileOutput.outcomes", {
        description: "One outcome per declared section, in declaration order.",
      })
    ),
    changed: S.Boolean.pipe(
      $I.annoteKey("ReconcileOutput.changed", { description: "Whether output text differs from the source." })
    ),
  }).pipe(
    $I.annoteSchema("ReconcileOutput", {
      description: "The resulting text, per-section outcomes and byte-change indicator.",
    })
  )
) {}

type Item =
  | { readonly kind: "text"; readonly value: string }
  | { kind: "section"; readonly identity: string; readonly raw: string; render: string | undefined };

type SlotItem = Extract<Item, { kind: "section" }>;

type BlocksByAnchorItemIndex = MutableHashMap.MutableHashMap<number, Array<string>>;

const identityOfSection = (section: Section): string => identityOf(section.key, section.commentStyle);

const renderDeclared = (
  declared: ReadonlyArray<Section>,
  dialect: SectionDialect,
  eol: Eol
): Result.Result<MutableHashMap.MutableHashMap<string, string>, SectionRenderError> => {
  const rendered = MutableHashMap.empty<string, string>();
  for (const section of declared) {
    const identity = identityOfSection(section);
    if (MutableHashMap.has(rendered, identity)) {
      return Result.fail(SectionRenderError.make({ reason: "duplicateDeclaration", key: section.key }));
    }
    const result = dialect.render(section, eol);
    if (Result.isFailure(result)) {
      return Result.fail(result.failure);
    }
    MutableHashMap.set(rendered, identity, result.success);
  }
  return Result.succeed(rendered);
};

const outcomeFor = (onDisk: MutableHashMap.MutableHashMap<string, PlacedSection>, section: Section): SyncOutcome => {
  const current = MutableHashMap.get(onDisk, identityOfSection(section));
  if (O.isNone(current)) {
    return SyncOutcome.Created({ section });
  }
  return Equal.equals(current.value.section, section)
    ? SyncOutcome.Unchanged({ section })
    : SyncOutcome.Updated({ before: current.value.section, after: section });
};

const splitDocument = (text: string, placed: ReadonlyArray<PlacedSection>): Array<Item> => {
  const items: Array<Item> = [];
  let cursor = 0;
  for (const entry of placed) {
    items.push({ kind: "text", value: Str.slice(cursor, entry.start)(text) });
    items.push({
      kind: "section",
      identity: identityOfSection(entry.section),
      raw: Str.slice(entry.start, entry.end)(text),
      render: undefined,
    });
    cursor = entry.end;
  }
  items.push({ kind: "text", value: Str.slice(cursor)(text) });
  return items;
};

const assignSlots = (
  items: ReadonlyArray<Item>,
  declared: ReadonlyArray<Section>,
  onDisk: MutableHashMap.MutableHashMap<string, PlacedSection>,
  rendered: MutableHashMap.MutableHashMap<string, string>
): MutableHashMap.MutableHashMap<number, number> => {
  const targets = MutableHashSet.fromIterable(A.map(declared, identityOfSection));
  const slots: Array<readonly [number, SlotItem]> = [];
  A.forEach(items, (item, index) => {
    if (item.kind === "section" && MutableHashSet.has(targets, item.identity)) {
      slots.push([index, item]);
    }
  });
  const itemIndexByDeclared = MutableHashMap.empty<number, number>();
  let slotCursor = 0;
  A.forEach(declared, (section, declaredIndex) => {
    const identity = identityOfSection(section);
    if (!MutableHashMap.has(onDisk, identity) || slotCursor >= slots.length) {
      return;
    }
    const [itemIndex, item] = A.getUnsafe(slots, slotCursor);
    item.render = O.getOrUndefined(MutableHashMap.get(rendered, identity));
    MutableHashMap.set(itemIndexByDeclared, declaredIndex, itemIndex);
    slotCursor += 1;
  });
  return itemIndexByDeclared;
};

const nearestAnchorsInLinearPassExcludingRenderingAndOutput = (
  count: number,
  itemIndexByDeclared: MutableHashMap.MutableHashMap<number, number>,
  step: 1 | -1
): Array<number | undefined> => {
  const anchors: Array<number | undefined> = [];
  let anchor: number | undefined;
  for (let index = step === 1 ? 0 : count - 1; index >= 0 && index < count; index += step) {
    anchors[index] = anchor;
    anchor = O.getOrUndefined(MutableHashMap.get(itemIndexByDeclared, index)) ?? anchor;
  }
  return anchors;
};

const pushInto: {
  (map: BlocksByAnchorItemIndex, anchor: number, value: string): void;
  (anchor: number, value: string): (map: BlocksByAnchorItemIndex) => void;
} = dual(3, (map: BlocksByAnchorItemIndex, anchor: number, value: string): void => {
  const list = O.getOrElse(MutableHashMap.get(map, anchor), (): Array<string> => []);
  list.push(value);
  MutableHashMap.set(map, anchor, list);
});

interface Placement {
  readonly afterAnchor: BlocksByAnchorItemIndex;
  readonly appended: Array<string>;
  readonly beforeAnchor: BlocksByAnchorItemIndex;
}

const placeMissing = (
  declared: ReadonlyArray<Section>,
  onDisk: MutableHashMap.MutableHashMap<string, PlacedSection>,
  rendered: MutableHashMap.MutableHashMap<string, string>,
  itemIndexByDeclared: MutableHashMap.MutableHashMap<number, number>
): Placement => {
  const predecessor = nearestAnchorsInLinearPassExcludingRenderingAndOutput(declared.length, itemIndexByDeclared, 1);
  const successor = nearestAnchorsInLinearPassExcludingRenderingAndOutput(declared.length, itemIndexByDeclared, -1);
  const placement: Placement = {
    beforeAnchor: MutableHashMap.empty<number, Array<string>>(),
    afterAnchor: MutableHashMap.empty<number, Array<string>>(),
    appended: [],
  };
  A.forEach(declared, (section, declaredIndex) => {
    const identity = identityOfSection(section);
    if (MutableHashMap.has(onDisk, identity)) {
      return;
    }
    const block = O.getOrThrow(MutableHashMap.get(rendered, identity));
    const next = successor[declaredIndex];
    const previous = predecessor[declaredIndex];
    if (next !== undefined) {
      pushInto(placement.beforeAnchor, next, block);
    } else if (previous !== undefined) {
      pushInto(placement.afterAnchor, previous, block);
    } else {
      placement.appended.push(block);
    }
  });
  return placement;
};

const blocksAt = (map: BlocksByAnchorItemIndex, index: number): ReadonlyArray<string> =>
  O.getOrElse(MutableHashMap.get(map, index), (): ReadonlyArray<string> => []);

const assemble = (items: ReadonlyArray<Item>, placement: Placement, eol: Eol): string => {
  const parts: Array<string> = [];
  A.forEach(items, (item, index) => {
    if (item.kind === "text") {
      parts.push(item.value);
      return;
    }
    for (const block of blocksAt(placement.beforeAnchor, index)) {
      parts.push(block, eol, eol);
    }
    parts.push(item.render ?? item.raw);
    for (const block of blocksAt(placement.afterAnchor, index)) {
      parts.push(eol, eol, block);
    }
  });
  return A.join(parts, "");
};

const missingTwoBreakSeparator = (output: string, eol: Eol): string => {
  if (O.isSome(Str.match(/(?:\r?\n){2}$/)(output))) {
    return "";
  }
  return Str.endsWith("\n")(output) ? eol : eol + eol;
};

const appendBlocks = (output: string, appended: ReadonlyArray<string>, eol: Eol): string =>
  A.reduce(appended, output, (text, block) =>
    text === "" ? `${block}${eol}` : `${text}${missingTwoBreakSeparator(text, eol)}${block}${eol}`
  );

/**
 * Fits declared sections into existing document slots while preserving surrounding text and foreign sections.
 *
 * **Details**
 *
 * All declarations are rendered before output is assembled. Duplicate declarations and
 * rendering refusals return a typed failure rather than a partial result. Existing
 * declared sections are assigned to their existing slots in declaration order. Missing
 * sections go before the nearest present successor, otherwise after the nearest present
 * predecessor, otherwise at the end. Outcomes follow declaration order; `changed`
 * compares output bytes with the source, so reordering can change text even when
 * section contents are unchanged.
 *
 * **Example** (Keep a document unchanged without declarations)
 *
 * ```ts
 * import { ReconcileInput, reconcile } from "@beep/managed-section/internal/reconcile";
 * import { SectionDialect } from "@beep/managed-section/SectionDialect";
 * import * as Result from "effect/Result";
 *
 * const result = reconcile(
 *   ReconcileInput.make({ text: "Notes\n", placed: [], declared: [], dialect: SectionDialect.default, eol: "\n" })
 * );
 * console.log(Result.isSuccess(result) && result.success.text === "Notes\n") // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const reconcile = (input: ReconcileInput): Result.Result<ReconcileOutput, SectionRenderError> => {
  const { text, placed, declared, dialect, eol } = input;
  const renderedResult = renderDeclared(declared, dialect, eol);
  if (Result.isFailure(renderedResult)) {
    return Result.fail(renderedResult.failure);
  }
  const rendered = renderedResult.success;

  const onDisk = MutableHashMap.empty<string, PlacedSection>();
  for (const entry of placed) {
    MutableHashMap.set(onDisk, identityOfSection(entry.section), entry);
  }

  const outcomes = A.map(declared, (section) => outcomeFor(onDisk, section));
  const items = splitDocument(text, placed);
  const itemIndexByDeclared = assignSlots(items, declared, onDisk, rendered);
  const placement = placeMissing(declared, onDisk, rendered, itemIndexByDeclared);
  const output = appendBlocks(assemble(items, placement, eol), placement.appended, eol);

  return Result.succeed(ReconcileOutput.make({ text: output, outcomes, changed: output !== text }));
};
