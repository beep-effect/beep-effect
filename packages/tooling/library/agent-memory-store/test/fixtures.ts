import {
  ClaimGateViolation,
  ContentHash,
  HoldId,
  LineageId,
  MemoryFilePath,
  MemoryGateViolation,
  NodeId,
  OccurrenceAnchor,
  RevisionId,
} from "@beep/agent-memory-store";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity, TextAnchor } from "@beep/provenance";
import { PosixPath, Sha256Hex } from "@beep/schema";

export const nodeId = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f");
export const otherNodeId = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e80");
export const contentHash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
export const revisionA = RevisionId.make("1111111111111111111111111111111111111111111111111111111111111111");
export const revisionB = RevisionId.make("2222222222222222222222222222222222222222222222222222222222222222");
export const revisionC = RevisionId.make("3333333333333333333333333333333333333333333333333333333333333333");
export const folderDigest = Sha256Hex.make("4444444444444444444444444444444444444444444444444444444444444444");
export const filePath = MemoryFilePath.make("notes/decisions.md");
export const holdId = HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e90");
export const author = LineageId.make("session-42");

const digest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

export const anchor = OccurrenceAnchor.make({
  source: SourceTextIdentity.make({
    scopeRef: "memory",
    sourceRef: "notes",
    locator: PosixPath.make("notes/decisions.md"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "markdown", version: "1" }),
    normalizationVersion: "1",
  }),
  unit: "utf16",
  anchor: TextAnchor.make({ startChar: 6, endChar: 10, quote: "fact" }),
});

export const missingPredecessor = MemoryGateViolation.make({
  code: "insertAfterMissingNode",
  violation: ClaimGateViolation.make({
    focusNode: nodeId,
    path: "afterNodeId",
    message: "The node this insert follows never reached the log.",
    severity: "violation",
  }),
});

export const staleRevision = MemoryGateViolation.make({
  code: "staleExpectedRevision",
  violation: ClaimGateViolation.make({
    focusNode: nodeId,
    path: "expectedRevision",
    message: "The node moved on since the export.",
    severity: "violation",
  }),
});
