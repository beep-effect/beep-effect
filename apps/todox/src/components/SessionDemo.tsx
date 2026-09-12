/**
 * The interactive product demonstration: the deterministic synthetic session
 * rendered as one console, with the record inspector.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import { howItWorks } from "@/content/copy";
import { packet, packetRecords, reviewPassage, SESSION_DATE, screenPassages, sources } from "@/session/session";
import { InspectableRow, InspectorList, RowGroup } from "./InspectorList";
import { ActionName } from "./ReceiptView";
import type { PacketEntry, SessionRecord } from "@/session/Session.schema";

const BRIEF_SECTIONS: ReadonlyArray<string> = ["WHAT CHANGED", "IN YOUR COURT"];

const optionalDetail = (label: string, value: string | undefined): O.Option<readonly [string, string]> =>
  O.map(O.fromUndefinedOr(value), (v) => [label, v] as const);

const latestRecords: HashMap.HashMap<string, SessionRecord> = HashMap.fromIterable(
  A.map(
    A.appendAll(
      A.flatMap(screenPassages, (passage) => passage.records),
      packetRecords
    ),
    (record) => [record.no, record] as const
  )
);

const recordRow = (record: SessionRecord): InspectableRow =>
  InspectableRow.make({
    id: `demo:${record.no}`,
    no: record.no,
    text: record.text,
    state: O.some(record.state),
    actor: record.actor,
    time: record.time,
    evidence: record.evidence,
    receipt: O.some(record.receipt),
    detail: A.getSomes([
      O.some(["FIXTURE ID", record.fixtureId] as const),
      O.some(["PROVENANCE", record.provenance === "fixture" ? "FIXTURE-VERBATIM" : "AUTHORED SYNTHETIC"] as const),
      optionalDetail("PRIOR STATE", record.priorState),
      optionalDetail("SUPERSEDED BY", record.supersededBy),
      optionalDetail("EDITED FROM", record.editedFrom),
      optionalDetail("NOTE", record.note),
    ]),
    postDelayMs: O.none(),
  });

const entryRow =
  (heading: string) =>
  (entry: PacketEntry, index: number): InspectableRow => {
    const primary = A.head(entry.refs);
    const record = O.flatMap(primary, (no) => HashMap.get(latestRecords, no));
    return InspectableRow.make({
      id: `demo:${heading}:${index}`,
      no: O.getOrElse(primary, () => packet.no),
      text: entry.text,
      state: O.map(record, (r) => r.state),
      actor: O.match(record, { onNone: () => "FIXTURE RUNTIME", onSome: (r) => r.actor }),
      time: O.match(record, { onNone: () => "04-14 10:02", onSome: (r) => r.time }),
      evidence: entry.evidence,
      receipt: O.map(record, (r) => r.receipt),
      detail: A.getSomes([
        O.some(["SECTION", heading] as const),
        O.map(record, (r) => ["FIXTURE ID", r.fixtureId] as const),
      ]),
      postDelayMs: O.none(),
    });
  };

/**
 * Renders the session console: source pane, gate, review rows, and the packet
 * sections, all addressable by the inspector.
 *
 * **Example** (Render the demo)
 *
 * ```ts
 * import { SessionDemo } from "@/components/SessionDemo"
 * import { createElement } from "react"
 *
 * console.log(createElement(SessionDemo).type === SessionDemo)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function SessionDemo() {
  const gate = O.fromUndefinedOr(reviewPassage.gate);
  const briefSections = A.filter(packet.sections, (section) => A.contains(BRIEF_SECTIONS, section.heading));
  const groups = A.prepend(
    briefSections.map((section) =>
      RowGroup.make({
        heading: O.some(`BRIEF · ${section.heading}`),
        rows: section.entries.map(entryRow(section.heading)),
      })
    ),
    RowGroup.make({ heading: O.some("REVIEW AT THE GATE"), rows: reviewPassage.records.map(recordRow) })
  );

  return (
    <div className="console" data-session-demo>
      <div className="console__bar">
        <span className="console__label">SYNTHETIC SESSION</span>
        <span>{SESSION_DATE} 10:02</span>
        <span>HOUSEHOLD PARK</span>
        <span>NO CLIENT DATA · NO LIVE MODEL</span>
      </div>
      <div className="console__body">
        <div className="pane">
          {O.match(gate, {
            onNone: () => null,
            onSome: (g) => (
              <div className="gate" data-gate={g.no}>
                <p className="gate__head">
                  <span className="gate__no">{g.no}</span>
                  <span>GATE</span>
                  <span>REVIEWER {g.reviewer}</span>
                  <span>{g.state}</span>
                </p>
                <p className="gate__policy">POLICY BASIS: “{g.policyBasis}”</p>
                <p className="gate__actions">
                  {g.requestedActions.map((action) => (
                    <span key={action}>
                      <ActionName value={action} />
                    </span>
                  ))}
                </p>
              </div>
            ),
          })}
          <InspectorList
            passageId="demo"
            defaultOpen={O.some("demo:CLM 0104")}
            cursor="demo:CLM 0101"
            groups={groups}
            sources={sources}
          />
        </div>
      </div>
      <p className="demo__note console__bar">{howItWorks.syntheticLabel}</p>
    </div>
  );
}
