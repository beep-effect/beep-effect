/**
 * The record inspector: addressable rows with keyboard cursor navigation, and
 * a split pane that opens the selected record's exact source span beside its
 * receipt. Focus is the terminal cursor; Enter opens, Escape closes; pointer
 * clicks mirror the keys. Without JS the default record renders open.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { $TodoxId } from "@beep/identity";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Atom } from "effect/unstable/reactivity";
import { Receipt, RecordState, SpanRef, spanRefLabel } from "@/session/Session.schema";
import { ReceiptView } from "./ReceiptView";
import { SourcePane } from "./SourcePane";
import type { CSSProperties, KeyboardEvent } from "react";
import type { SourceArtifact } from "@/session/Session.schema";

const $I = $TodoxId.create("components/InspectorList");

/**
 * One inspectable row: what the cursor addresses and what the inspector opens.
 *
 * **Example** (Make a resting row)
 *
 * ```ts
 * import { InspectableRow } from "@/components/InspectorList"
 * import * as O from "effect/Option"
 *
 * const row = InspectableRow.make({
 *   id: "demo:CLM 0101",
 *   no: "CLM 0101",
 *   text: "The Park household needs about $150,000 available by June 3, 2026.",
 *   state: O.some("CANDIDATE"),
 *   actor: "FIXTURE RUNTIME",
 *   time: "09:41",
 *   evidence: [],
 *   receipt: O.none(),
 *   detail: [],
 *   postDelayMs: O.none(),
 * })
 * console.log(row.no, O.getOrNull(row.state))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InspectableRow extends S.Class<InspectableRow>($I`InspectableRow`)(
  {
    id: S.String,
    no: S.String,
    text: S.String,
    state: S.Option(RecordState),
    actor: S.String,
    time: S.String,
    evidence: S.Array(SpanRef),
    receipt: S.Option(Receipt),
    detail: S.Array(S.Tuple([S.String, S.String])),
    postDelayMs: S.Option(S.Finite),
  },
  $I.annote("InspectableRow", { description: "A row the record inspector can address and open." })
) {}

/**
 * A headed group of rows (packet sections) or a single unheaded group.
 *
 * **Example** (Group rows under a heading)
 *
 * ```ts
 * import { InspectableRow, RowGroup } from "@/components/InspectorList"
 * import * as O from "effect/Option"
 *
 * const row = InspectableRow.make({
 *   id: "demo:CLM 0101",
 *   no: "CLM 0101",
 *   text: "Client cash need",
 *   state: O.some("CANDIDATE"),
 *   actor: "FIXTURE RUNTIME",
 *   time: "09:41",
 *   evidence: [],
 *   receipt: O.none(),
 *   detail: [],
 *   postDelayMs: O.none(),
 * })
 * const group = RowGroup.make({ heading: O.some("WHAT CHANGED"), rows: [row] })
 * console.log(group.rows.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RowGroup extends S.Class<RowGroup>($I`RowGroup`)(
  {
    heading: S.Option(S.String),
    rows: S.Array(InspectableRow),
  },
  $I.annote("RowGroup", { description: "Rows under one optional packet heading." })
) {}

const KEY_SEPARATOR = "=>";

const defaultFromKey = (key: string): O.Option<string> =>
  O.filter(A.last(Str.split(key, KEY_SEPARATOR)), Str.isNonEmpty);

const selectionAtom = Atom.family((key: string) => Atom.make<O.Option<string>>(defaultFromKey(key)));

const rowButtons = (root: HTMLElement): ReadonlyArray<HTMLButtonElement> =>
  A.fromIterable(root.querySelectorAll<HTMLButtonElement>("button[data-row]"));

const litSpans = (row: InspectableRow, source: SourceArtifact) =>
  A.map(
    A.filter(row.evidence, (ref) => ref.source === source.no),
    (ref) => ref.span
  );

/**
 * Renders grouped record rows plus the inspector for the selected row.
 *
 * **Example** (Render one row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { InspectableRow, InspectorList, RowGroup } from "@/components/InspectorList"
 * import { sources } from "@/session/session"
 * import { createElement } from "react"
 *
 * const row = InspectableRow.make({
 *   id: "demo:CLM 0101",
 *   no: "CLM 0101",
 *   text: "The Park household needs about $150,000 available by June 3, 2026.",
 *   state: O.some("CANDIDATE"),
 *   actor: "FIXTURE RUNTIME",
 *   time: "09:41",
 *   evidence: [],
 *   receipt: O.none(),
 *   detail: [],
 *   postDelayMs: O.none(),
 * })
 * const groups = [RowGroup.make({ heading: O.none(), rows: [row] })]
 * const list = createElement(InspectorList, {
 *   passageId: "demo",
 *   defaultOpen: O.some(row.id),
 *   cursor: row.id,
 *   groups,
 *   sources,
 * })
 * console.log(list.props.passageId)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function InspectorList({
  passageId,
  defaultOpen,
  cursor,
  groups,
  sources,
  label = "Records",
}: {
  readonly passageId: string;
  readonly defaultOpen: O.Option<string>;
  readonly cursor: string;
  readonly groups: ReadonlyArray<RowGroup>;
  readonly sources: ReadonlyArray<SourceArtifact>;
  readonly label?: string;
}) {
  const atom = selectionAtom(`${passageId}${KEY_SEPARATOR}${O.getOrElse(defaultOpen, () => "")}`);
  const selection = useAtomValue(atom);
  const setSelection = useAtomSet(atom);
  const inspectorId = `${passageId}-inspector`;
  const rows = A.flatMap(groups, (group) => group.rows);
  const openRow = O.flatMap(selection, (id) => A.findFirst(rows, (row) => row.id === id));

  const toggle = (id: string): void =>
    setSelection(
      O.match(selection, {
        onNone: () => O.some(id),
        onSome: (current) => (current === id ? O.none() : O.some(id)),
      })
    );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const buttons = rowButtons(event.currentTarget);
    const active = event.currentTarget.ownerDocument.activeElement;
    const index = A.findFirstIndex(buttons, (button) => button === active);
    if (O.isNone(index)) {
      return;
    }
    const focusAt = (next: number): void =>
      O.match(A.get(buttons, next), {
        onNone: () => undefined,
        onSome: (button) => {
          event.preventDefault();
          button.focus();
        },
      });
    Match.value(event.key).pipe(
      Match.when("ArrowDown", () => focusAt(index.value + 1)),
      Match.when("ArrowUp", () => focusAt(index.value - 1)),
      Match.when("Home", () => focusAt(0)),
      Match.when("End", () => focusAt(buttons.length - 1)),
      Match.when("Escape", () => {
        event.preventDefault();
        setSelection(O.none());
      }),
      Match.orElse(() => undefined)
    );
  };

  return (
    <div className="rowsets" onKeyDown={onKeyDown} data-inspector-list={passageId}>
      {groups.map((group, groupIndex) => (
        <div className="packet__section" key={O.getOrElse(group.heading, () => `group-${groupIndex}`)}>
          {O.match(group.heading, {
            onNone: () => null,
            onSome: (heading) => <h3 className="packet__heading">{heading}</h3>,
          })}
          {groupIndex === 0 ? (
            <div className="rows__head" aria-hidden="true">
              <span>REC</span>
              <span>RECORD</span>
              <span>STATE</span>
              <span>TIME</span>
            </div>
          ) : null}
          <ol className="rows" aria-label={O.getOrElse(group.heading, () => label)}>
            {group.rows.map((row) => {
              const isOpen = O.exists(openRow, (open) => open.id === row.id);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="row"
                    data-row={row.id}
                    data-cursor={row.id === cursor ? "" : undefined}
                    data-state={O.getOrUndefined(row.state)}
                    data-actor={row.actor}
                    data-post={O.isSome(row.postDelayMs) ? "" : undefined}
                    style={O.match(row.postDelayMs, {
                      onNone: () => undefined,
                      onSome: (ms) => ({ "--post-delay": `${ms}ms` }) as CSSProperties,
                    })}
                    aria-expanded={isOpen}
                    aria-controls={inspectorId}
                    onClick={() => toggle(row.id)}
                  >
                    <span className="row__no">{row.no}</span>
                    <span className="row__text">{row.text}</span>
                    <span className="row__meta">
                      <span className="row__state">{O.getOrElse(row.state, () => "—")}</span>
                      <span className="row__time">{row.time}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      <p className="row__cursorhint" aria-hidden="true">
        ↑ ↓ MOVE CURSOR · ENTER OPEN RECORD · ESC CLOSE
      </p>
      {O.match(openRow, {
        onNone: () => (
          <p className="inspector__closed" id={inspectorId}>
            INSPECTOR CLOSED · SELECT A RECORD TO OPEN ITS SOURCE SPAN AND RECEIPT
          </p>
        ),
        onSome: (row) => {
          const source = O.flatMap(A.head(row.evidence), (ref) => A.findFirst(sources, (s) => s.no === ref.source));
          return (
            <div className="inspector" id={inspectorId} role="region" aria-label={`Record inspector: ${row.no}`}>
              <div className="pane">
                <p className="inspector__title">
                  SOURCE SPAN · <strong>{A.join(A.map(row.evidence, spanRefLabel), " ")}</strong>
                </p>
                {O.match(source, {
                  onNone: () => <p className="inspector__detail">SOURCE UNAVAILABLE</p>,
                  onSome: (artifact) => <SourcePane artifact={artifact} lit={litSpans(row, artifact)} dimOthers />,
                })}
              </div>
              <div className="pane">
                <p className="inspector__title">
                  RECEIPT · <strong>{row.no}</strong>
                </p>
                {O.match(row.receipt, {
                  onNone: () => (
                    <p className="inspector__detail">NO RECEIPT · A SOURCE-BACKED QUESTION, NOT A RECORD</p>
                  ),
                  onSome: (receipt) => <ReceiptView receipt={receipt} />,
                })}
                <p className="inspector__detail">
                  {row.detail.map(([key, value]) => (
                    <span key={key}>
                      {key} {value}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          );
        },
      })}
    </div>
  );
}
