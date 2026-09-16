import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PRODUCER, RecordNumber, RecordState } from "@/session/Session.schema";
import { packet, reviewPassage, screenPassages, sessionPassage, sources, supersessionPassage } from "@/session/session";

const isState = S.is(RecordState);
const isRecordNumber = S.is(RecordNumber);

const allRecords = A.flatMap(screenPassages, (passage) => passage.records);

const spanExists = (source: string, span: string): boolean =>
  O.isSome(A.findFirst(sources, (artifact) => artifact.no === source && A.some(artifact.spans, (s) => s.id === span)));

describe("Terminal of Record session", () => {
  it("uses only instrument-vocabulary state words and numbered record addresses", () => {
    for (const record of allRecords) {
      expect(isState(record.state), record.no).toBe(true);
      expect(isRecordNumber(record.no), record.no).toBe(true);
      expect(isState(record.receipt.state), record.no).toBe(true);
    }
  });

  it("resolves every evidence reference to a real source span", () => {
    const recordRefs = A.flatMap(allRecords, (record) => record.evidence);
    const packetRefs = A.flatMap(packet.sections, (section) => A.flatMap(section.entries, (entry) => entry.evidence));
    const unresolved = A.filter(A.appendAll(recordRefs, packetRefs), (ref) => !spanExists(ref.source, ref.span));

    expect(unresolved).toEqual([]);
  });

  it("names the deterministic fixture producer on every receipt", () => {
    for (const record of allRecords) {
      expect(record.receipt.producer).toBe(PRODUCER);
    }
    expect(packet.receipt.producer).toBe(PRODUCER);
  });

  it("rests the hero cursor on CLM 0101 with span S2 lit and no inspector open", () => {
    expect(sessionPassage.cursor).toBe("CLM 0101");
    expect(sessionPassage.defaultOpen).toBeUndefined();
    expect(sessionPassage.litSpan?.span).toBe("S2");
  });

  it("ghosts the superseded intent with its date instead of deleting it", () => {
    const prior = O.getOrThrow(A.findFirst(supersessionPassage.records, (r) => r.no === "CLM 0099"));

    expect(prior.state).toBe("SUPERSEDED");
    expect(prior.supersededBy).toBe("CLM 0103");
    expect(prior.supersededOn).toBe("2026-04-14");
    expect(prior.priorState).toBe("ACCEPTED (SCOPED)");
    expect(supersessionPassage.chain).toMatchObject({ from: "CLM 0099", to: "CLM 0103" });
  });

  it("keeps the rejected candidate on the record and the draft pending at the gate", () => {
    const rejected = O.getOrThrow(A.findFirst(reviewPassage.records, (r) => r.no === "CLM 0104"));
    const draft = O.getOrThrow(A.findFirst(reviewPassage.records, (r) => r.no === "DRF 0301"));

    expect(rejected.state).toBe("REJECTED");
    expect(rejected.note).toBe("Not supported by span S3.");
    expect(draft.state).toBe("PENDING");
    expect(reviewPassage.gate?.state).toBe("PENDING");
  });

  it("lists the packet exclusions fixture-verbatim", () => {
    expect(packet.excluded).toEqual([
      "No portfolio accounting or custodian state is included.",
      "No external money movement instruction is included.",
      "No accepted financial recommendation is included.",
    ]);
    expect(packet.sections.map((section) => section.heading)).toEqual([
      "WHAT CHANGED",
      "CURRENT GOALS AND CONSTRAINTS",
      "OPEN DECISIONS",
      "IN YOUR COURT",
      "SOURCE-BACKED QUESTIONS",
    ]);
  });
});
