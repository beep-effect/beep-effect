// fallow-ignore-file unused-file -- spawned crash-probe fixture entry resolved by path at runtime
import { Confidence } from "@beep/epistemic-domain";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  TextAnchor,
  TextAnchorVerificationReceipt,
} from "@beep/provenance";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { Option, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClaimBody, EvidenceBatch, EvidenceClaim, ExtractOutcome, makeBatchId, makeClaimId } from "@/schema/Evidence";
import { ChunkId, DocumentId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { EventBody, makeProvenanceEventId, ProvenanceEvent } from "@/schema/Provenance";

const [mode] = A.drop(process.argv, 2);
if (mode !== "fixture") {
  process.stderr.write("Expected fixture mode.\n");
  process.exit(2);
}

const document = DocumentId.make(Str.repeat(64)("d"));
const chunk = ChunkId.make(Str.repeat(64)("e"));
const model = ModelIdentity.make({
  artifactHash: Sha256Hex.make(Str.repeat(64)("f")),
  name: "crash-probe-extractor",
  provider: "anthropic",
  revision: "crash-probe-v1",
  taskType: "extraction",
});
const anchor = TextAnchor.make({
  endChar: NonNegativeInt.make(6),
  quote: "Effect",
  startChar: NonNegativeInt.make(0),
});
const body = ClaimBody.cases.Entity.make({
  cluster: Option.none(),
  endChar: anchor.endChar,
  entityType: "software",
  kind: "Entity",
  label: "Effect",
  quote: anchor.quote,
  startChar: anchor.startChar,
});
const claim = EvidenceClaim.make({
  body,
  cacheKey: Option.none(),
  chunk,
  confidence: Confidence.make(1),
  document,
  id: Result.getOrThrow(makeClaimId({ body, chunk, document, method: "hosted-langextract", model })),
  method: "hosted-langextract",
  model,
  receipt: TextAnchorVerificationReceipt.make({
    anchor,
    source: SourceTextIdentity.make({
      extractor: SourceTextExtractor.make({ name: "identity-utf8", version: "1" }),
      locator: PosixPath.make("documents/crash-probe.md"),
      normalizationVersion: "raw/1",
      scopeRef: "semantica-canary",
      sourceDigest: SourceTextDigest.make(`sha256:${document}`),
      sourceRef: document,
      textDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("a")}`),
    }),
  }),
});
const batch = EvidenceBatch.make({
  claims: [claim],
  degraded: [],
  document,
  id: Result.getOrThrow(makeBatchId({ document, inputs: [chunk], method: "hosted-langextract", model })),
  inputs: [chunk],
  lossy: [],
  method: "hosted-langextract",
  model,
});
const outcome = ExtractOutcome.cases.Extracted.make({ batch, outcome: "Extracted" });
const eventBody = EventBody.cases.Extracted.make({ batch: batch.id, kind: "Extracted", model });
const prev = Option.none();
const event = ProvenanceEvent.make({
  body: eventBody,
  id: Result.getOrThrow(makeProvenanceEventId({ body: eventBody, prev })),
  prev,
});
const Fixture = S.Struct({ event: S.String, outcome: S.String });
const fixture = S.encodeSync(S.fromJsonString(Fixture))({
  event: S.encodeSync(S.fromJsonString(ProvenanceEvent))(event),
  outcome: S.encodeSync(S.fromJsonString(ExtractOutcome))(outcome),
});

process.stdout.write(`${fixture}\n`);
