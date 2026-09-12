/**
 * The deterministic Terminal of Record session. Fixed clock, fixed records,
 * fixed dispositions: the page replays this session identically on every
 * visit. Records marked `fixture` are verbatim from the canonical
 * wealth-cash-request fixture; records marked `authored` are synthetic
 * content written for the demonstration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ApprovalGate,
  Chain,
  Packet,
  PacketEntry,
  PacketSection,
  PRODUCER,
  Receipt,
  ScreenPassage,
  SessionRecord,
  SourceArtifact,
  SourceSpan,
  SpanRef,
} from "./Session.schema";

const at = (source: string, span: SpanRef["span"]): SpanRef => SpanRef.make({ source, span });

const POLICY_BASIS =
  "Advisor approval is required before accepting client-intent claims, creating authoritative tasks, or sending a client-facing draft.";

/**
 * The fixed session date printed in every status row.
 *
 * @category constants
 * @since 0.0.0
 */
export const SESSION_DATE = "2026-04-14";

/**
 * SRC 0001 — the incoming email, spans verbatim from the fixture body.
 *
 * @category sources
 * @since 0.0.0
 */
export const emailSource = SourceArtifact.make({
  no: "SRC 0001",
  kind: "EMAIL",
  from: "MIRA PARK",
  to: "TIA ROWAN",
  subject: "Need cash available before June 3",
  dated: `${SESSION_DATE} 09:41`,
  fixtureId: "wealth-cash-email-001",
  provenance: "fixture",
  spans: [
    SourceSpan.make({ id: "S1", text: "Hi Tia,", fixtureId: "wealth-email-001-s1" }),
    SourceSpan.make({
      id: "S2",
      text: "We need to have about $150,000 available by June 3, 2026 for the renovation deposit we mentioned during our last planning call.",
      fixtureId: "wealth-email-001-s2",
    }),
    SourceSpan.make({
      id: "S3",
      text: "I was assuming it could come from the taxable account ending in 4421, but I want to avoid creating a messy tax situation if there is a better way to source it.",
      fixtureId: "wealth-email-001-s3",
    }),
    SourceSpan.make({
      id: "S4",
      text: "Can you review the options and let us know what you recommend before we move anything?",
      fixtureId: "wealth-email-001-s4",
    }),
    SourceSpan.make({
      id: "S5",
      text: "If possible, could we talk this Friday afternoon?",
      fixtureId: "wealth-email-001-s5",
    }),
    SourceSpan.make({ id: "S6", text: "Thanks,\nMira", fixtureId: "wealth-email-001-s6" }),
  ],
});

/**
 * SRC 0000 — the earlier planning-call note (authored) that the superseded
 * intent was drawn from.
 *
 * @category sources
 * @since 0.0.0
 */
export const callNoteSource = SourceArtifact.make({
  no: "SRC 0000",
  kind: "CALL NOTE",
  from: "TIA ROWAN",
  to: "TIA ROWAN",
  subject: "Planning call — renovation deposit",
  dated: "2026-03-06 14:20",
  fixtureId: "wealth-call-note-000",
  provenance: "authored",
  spans: [
    SourceSpan.make({
      id: "S1",
      text: "Mira expects to fund the renovation deposit from the taxable account ending in 4421; amount and date to be confirmed by email.",
      fixtureId: "wealth-call-note-000-s1",
    }),
  ],
});

/**
 * Every source artifact addressable by the record inspector.
 *
 * @category sources
 * @since 0.0.0
 */
export const sources: ReadonlyArray<SourceArtifact> = [emailSource, callNoteSource];

const receipt = (
  candidateRef: string,
  requestedAction: string,
  evidence: ReadonlyArray<SpanRef>,
  state: Receipt["state"],
  time: string
): Receipt =>
  Receipt.make({
    requestedAction,
    reviewer: "TIA ROWAN",
    candidateRef,
    evidence,
    policyBasis: "advisor approval required",
    state,
    time: `${SESSION_DATE} ${time}`,
    producer: PRODUCER,
  });

const CLAIMS = "accept_or_edit_candidate_claims";
const TASKS = "accept_or_edit_candidate_tasks";
const DRAFT = "approve_or_revise_client_email_draft";

const clm0101Candidate = SessionRecord.make({
  no: "CLM 0101",
  kind: "CLM",
  text: "The Park household needs about $150,000 available by June 3, 2026.",
  state: "CANDIDATE",
  actor: "FIXTURE RUNTIME",
  time: "04-14 09:41",
  evidence: [at("SRC 0001", "S2")],
  fixtureId: "claim-wealth-cash-need-001",
  provenance: "fixture",
  confidence: "HIGH",
  receipt: receipt("CLM 0101", CLAIMS, [at("SRC 0001", "S2")], "CANDIDATE", "09:41"),
});

const tsk0201Candidate = SessionRecord.make({
  no: "TSK 0201",
  kind: "TSK",
  text: "Review liquidity and tax-sensitive funding options",
  state: "CANDIDATE",
  actor: "FIXTURE RUNTIME",
  time: "04-14 09:41",
  evidence: [at("SRC 0001", "S2"), at("SRC 0001", "S3")],
  fixtureId: "task-wealth-review-liquidity-001",
  provenance: "fixture",
  receipt: receipt("TSK 0201", TASKS, [at("SRC 0001", "S2"), at("SRC 0001", "S3")], "CANDIDATE", "09:41"),
});

/**
 * Beat 1 — the hero session: a source lands, a span opens, a candidate posts.
 *
 * @category passages
 * @since 0.0.0
 */
export const sessionPassage = ScreenPassage.make({
  id: "session",
  beat: "SOURCE → CANDIDATE",
  clock: `${SESSION_DATE} 09:41`,
  sources: [emailSource],
  litSpan: at("SRC 0001", "S2"),
  records: [clm0101Candidate, tsk0201Candidate],
  cursor: "CLM 0101",
});

/**
 * Beat 3 — supersession: the prior intent ghosts with its date, never deleted.
 *
 * @category passages
 * @since 0.0.0
 */
export const supersessionPassage = ScreenPassage.make({
  id: "supersession",
  beat: "SUPERSESSION",
  clock: `${SESSION_DATE} 09:41`,
  sources: [emailSource, callNoteSource],
  litSpan: at("SRC 0001", "S3"),
  chain: Chain.make({ from: "CLM 0099", to: "CLM 0103" }),
  records: [
    SessionRecord.make({
      no: "CLM 0099",
      kind: "CLM",
      text: "Fund the renovation deposit from taxable ····4421.",
      state: "SUPERSEDED",
      actor: "TIA ROWAN",
      time: "03-06 14:20",
      evidence: [at("SRC 0000", "S1")],
      fixtureId: "claim-wealth-fund-from-taxable-000",
      provenance: "authored",
      priorState: "ACCEPTED (SCOPED)",
      supersededBy: "CLM 0103",
      supersededOn: SESSION_DATE,
      receipt: receipt("CLM 0099", CLAIMS, [at("SRC 0000", "S1")], "SUPERSEDED", "09:41"),
    }),
    SessionRecord.make({
      no: "CLM 0102",
      kind: "CLM",
      text: "Mira assumed the cash could come from the taxable account ending in 4421.",
      state: "CANDIDATE",
      actor: "FIXTURE RUNTIME",
      time: "04-14 09:41",
      evidence: [at("SRC 0001", "S3")],
      fixtureId: "claim-wealth-taxable-account-source-001",
      provenance: "fixture",
      confidence: "HIGH",
      receipt: receipt("CLM 0102", CLAIMS, [at("SRC 0001", "S3")], "CANDIDATE", "09:41"),
    }),
    SessionRecord.make({
      no: "CLM 0103",
      kind: "CLM",
      text: "Mira wants to avoid creating an unfavorable tax situation when sourcing cash.",
      state: "CANDIDATE",
      actor: "FIXTURE RUNTIME",
      time: "04-14 09:41",
      evidence: [at("SRC 0001", "S3")],
      fixtureId: "claim-wealth-tax-sensitivity-001",
      provenance: "fixture",
      confidence: "HIGH",
      receipt: receipt("CLM 0103", CLAIMS, [at("SRC 0001", "S3")], "CANDIDATE", "09:41"),
    }),
  ],
  cursor: "CLM 0099",
  defaultOpen: "CLM 0099",
});

/**
 * Beat 4 — review at the gate: accept, edit, reject; the draft stays pending.
 *
 * @category passages
 * @since 0.0.0
 */
export const reviewPassage = ScreenPassage.make({
  id: "review",
  beat: "REVIEW AT THE GATE",
  clock: `${SESSION_DATE} 10:02`,
  sources: [emailSource],
  gate: ApprovalGate.make({
    no: "GTE 0401",
    reviewer: "TIA ROWAN",
    state: "PENDING",
    policyBasis: POLICY_BASIS,
    requestedActions: [CLAIMS, TASKS, DRAFT],
    fixtureId: "approval-wealth-cash-request-001",
  }),
  records: [
    SessionRecord.make({
      ...clm0101Candidate,
      state: "ACCEPTED (SCOPED)",
      actor: "TIA ROWAN",
      time: "04-14 10:02",
      priorState: "CANDIDATE",
      receipt: receipt("CLM 0101", CLAIMS, [at("SRC 0001", "S2")], "ACCEPTED (SCOPED)", "10:02"),
    }),
    SessionRecord.make({
      no: "CLM 0103",
      kind: "CLM",
      text: "Mira wants to avoid creating an unfavorable tax situation when sourcing cash.",
      state: "ACCEPTED (SCOPED)",
      actor: "TIA ROWAN",
      time: "04-14 10:02",
      evidence: [at("SRC 0001", "S3")],
      fixtureId: "claim-wealth-tax-sensitivity-001",
      provenance: "fixture",
      priorState: "CANDIDATE",
      receipt: receipt("CLM 0103", CLAIMS, [at("SRC 0001", "S3")], "ACCEPTED (SCOPED)", "10:02"),
    }),
    SessionRecord.make({
      no: "CLM 0104",
      kind: "CLM",
      text: "Mira intends to sell the ····4421 position.",
      state: "REJECTED",
      actor: "TIA ROWAN",
      time: "04-14 10:02",
      evidence: [at("SRC 0001", "S3")],
      fixtureId: "claim-wealth-misread-sale-intent-004",
      provenance: "authored",
      priorState: "CANDIDATE",
      note: "Not supported by span S3.",
      receipt: receipt("CLM 0104", CLAIMS, [at("SRC 0001", "S3")], "REJECTED", "10:02"),
    }),
    SessionRecord.make({
      no: "TSK 0202",
      kind: "TSK",
      text: "Confirm Friday 2026-04-17 call with Mira",
      state: "ACCEPTED (SCOPED)",
      actor: "TIA ROWAN",
      time: "04-14 10:02",
      evidence: [at("SRC 0001", "S5")],
      fixtureId: "task-wealth-schedule-friday-call-001",
      provenance: "fixture",
      priorState: "CANDIDATE",
      editedFrom: "Offer Friday afternoon call times",
      receipt: receipt("TSK 0202", TASKS, [at("SRC 0001", "S5")], "ACCEPTED (SCOPED)", "10:02"),
    }),
    SessionRecord.make({
      no: "TSK 0203",
      kind: "TSK",
      text: "Confirm no money movement occurs before advisor review",
      state: "ACCEPTED (SCOPED)",
      actor: "TIA ROWAN",
      time: "04-14 10:02",
      evidence: [at("SRC 0001", "S4")],
      fixtureId: "task-wealth-confirm-no-movement-001",
      provenance: "fixture",
      priorState: "CANDIDATE",
      receipt: receipt("TSK 0203", TASKS, [at("SRC 0001", "S4")], "ACCEPTED (SCOPED)", "10:02"),
    }),
    SessionRecord.make({
      no: "DRF 0301",
      kind: "DRF",
      text: "Re: Need cash available before June 3 — client acknowledgement draft",
      state: "PENDING",
      actor: "FIXTURE RUNTIME",
      time: "04-14 09:41",
      evidence: [at("SRC 0001", "S2"), at("SRC 0001", "S4"), at("SRC 0001", "S5")],
      fixtureId: "draft-wealth-cash-acknowledgement-001",
      provenance: "fixture",
      note: "Never shown as sent. This is the action boundary.",
      receipt: receipt(
        "DRF 0301",
        DRAFT,
        [at("SRC 0001", "S2"), at("SRC 0001", "S4"), at("SRC 0001", "S5")],
        "PENDING",
        "10:02"
      ),
    }),
  ],
  cursor: "CLM 0104",
  defaultOpen: "CLM 0104",
});

const whatChanged = PacketEntry.make({
  text: "Cash need: about $150,000 available by June 3, 2026.",
  refs: ["CLM 0101"],
  evidence: [at("SRC 0001", "S2")],
});

/**
 * Beat 6 — the meeting-preparation packet and its receipt.
 *
 * @category passages
 * @since 0.0.0
 */
export const packet = Packet.make({
  no: "PKT 0501",
  forCall: "2026-04-17",
  fixtureId: "context-wealth-cash-request-001",
  sections: [
    PacketSection.make({
      heading: "WHAT CHANGED",
      entries: [
        whatChanged,
        PacketEntry.make({
          text: "Fund the renovation deposit from taxable ····4421.",
          refs: ["CLM 0099", "CLM 0103"],
          evidence: [at("SRC 0001", "S3")],
        }),
      ],
    }),
    PacketSection.make({
      heading: "CURRENT GOALS AND CONSTRAINTS",
      entries: [
        PacketEntry.make({
          text: "Avoid an unfavorable tax situation when sourcing cash.",
          refs: ["CLM 0103"],
          evidence: [at("SRC 0001", "S3")],
        }),
      ],
    }),
    PacketSection.make({
      heading: "OPEN DECISIONS",
      entries: [
        PacketEntry.make({
          text: "Funding source — under review.",
          refs: ["TSK 0201"],
          evidence: [at("SRC 0001", "S3"), at("SRC 0001", "S4")],
        }),
      ],
    }),
    PacketSection.make({
      heading: "IN YOUR COURT",
      entries: [
        PacketEntry.make({
          text: "Review liquidity and tax-sensitive funding options",
          refs: ["TSK 0201"],
          evidence: [at("SRC 0001", "S2"), at("SRC 0001", "S3")],
        }),
        PacketEntry.make({
          text: "Confirm Friday 2026-04-17 call with Mira",
          refs: ["TSK 0202"],
          evidence: [at("SRC 0001", "S5")],
        }),
        PacketEntry.make({
          text: "Confirm no money movement occurs before advisor review",
          refs: ["TSK 0203"],
          evidence: [at("SRC 0001", "S4")],
        }),
      ],
    }),
    PacketSection.make({
      heading: "SOURCE-BACKED QUESTIONS",
      entries: [
        PacketEntry.make({
          text: "Is June 3 a fixed date, or is there flexibility on the deposit?",
          refs: ["QST 0601"],
          evidence: [at("SRC 0001", "S2")],
        }),
        PacketEntry.make({
          text: "Which alternatives to ····4421 would you consider?",
          refs: ["QST 0602"],
          evidence: [at("SRC 0001", "S3")],
        }),
        PacketEntry.make({
          text: "Hold all movement until after Friday's call?",
          refs: ["QST 0603"],
          evidence: [at("SRC 0001", "S4")],
        }),
      ],
    }),
  ],
  excluded: [
    "No portfolio accounting or custodian state is included.",
    "No external money movement instruction is included.",
    "No accepted financial recommendation is included.",
  ],
  focal: whatChanged,
  receipt: receipt("CLM 0101", CLAIMS, [at("SRC 0001", "S2")], "ACCEPTED (SCOPED)", "10:02"),
});

/**
 * The three record passages in beat order.
 *
 * @category passages
 * @since 0.0.0
 */
export const screenPassages: ReadonlyArray<ScreenPassage> = [sessionPassage, supersessionPassage, reviewPassage];

const QUESTIONS = "accept_or_edit_source_backed_questions";

const question = (no: string, text: string, span: SpanRef["span"]): SessionRecord =>
  SessionRecord.make({
    no,
    kind: "QST",
    text,
    state: "CANDIDATE",
    actor: "FIXTURE RUNTIME",
    time: "04-14 10:02",
    evidence: [at("SRC 0001", span)],
    fixtureId: `question-wealth-${no.slice(4)}`,
    provenance: "authored",
    receipt: receipt(no, QUESTIONS, [at("SRC 0001", span)], "CANDIDATE", "10:02"),
  });

/**
 * Records that first appear in the packet: the three source-backed questions
 * proposed for the advisor to ask, each addressed and receipted like any other
 * candidate.
 *
 * @category passages
 * @since 0.0.0
 */
export const packetRecords: ReadonlyArray<SessionRecord> = [
  question("QST 0601", "Is June 3 a fixed date, or is there flexibility on the deposit?", "S2"),
  question("QST 0602", "Which alternatives to ····4421 would you consider?", "S3"),
  question("QST 0603", "Hold all movement until after Friday's call?", "S4"),
];
