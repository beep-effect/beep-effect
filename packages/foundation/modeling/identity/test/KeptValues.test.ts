import { fcRuns } from "@beep/fc-runs";
import { IRI } from "@beep/identity/Iri";
import {
  $I as $BeepId,
  $EpistemicId,
  $QaId,
  $SemanticaId,
  $SemanticFoundationId,
  $SemanticWebId,
  $SkillContractId,
} from "@beep/identity/packages";
import { iri, mint, mintEncoded, namespace } from "@beep/identity/Registry";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import snapshot from "../registry/term-snapshot.json" with { type: "json" };

const runs = { arbitrary: fcRuns(100) };
const isIri = S.is(IRI);

const Segment = S.String.check(
  S.isNonEmpty(),
  S.makeFilter((segment: string) => !Str.startsWith("/")(segment) && !Str.endsWith("/")(segment))
);

const $QaEvidence = $QaId.create("evidence");
const $QaJudgeSchemas = $BeepId.create("schemas");
const graphIdentity = $BeepId.create("practice-kg");

describe("kept internal values preserve stored composer bytes and stable instance namespaces", () => {
  it("declares the claim gate terms and instance base with their stored bytes", () => {
    expect(iri("epistemic:Claim"), "packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts").toBe(
      $EpistemicId.create("Claim").iri
    );
    expect(iri("epistemic:hasEvidenceQuote")).toBe($EpistemicId.create("hasEvidenceQuote").iri);
    expect(iri("epistemic:claim")).toBe($EpistemicId.create("claim").iri);
    expect(mintEncoded("epistemic:claim", "fixture key/1")).toBe(
      `${$EpistemicId.create("claim").iri}/${encodeURIComponent("fixture key/1")}`
    );
  });

  it("declares the XMP namespace recorded media carry", () => {
    expect(
      namespace("beepQA").iri,
      "packages/drivers/exiftool/src/ExiftoolConfig.ts: BEEP_QA_XMP_NAMESPACE_URI and its prefix"
    ).toBe(`${$QaId.create("1.0").iri}/`);
    expectTypeOf(namespace("beepQA").iri).toEqualTypeOf<"https://beep-effect.com/ns/qa/1.0/">();
    expect(iri("beepQA:sessionId")).toBe("https://beep-effect.com/ns/qa/1.0/sessionId");
  });

  it("declares the versioned QA predicate types, receipts and verifier", () => {
    for (const name of [
      "cited-event-id-exists",
      "declared-round-coherent",
      "evidence-cross-check",
      "judge-output-inventory",
    ] as const) {
      expect(
        iri(`qa:evidence/${name}/v2`),
        "packages/tooling/tool/cli/src/commands/Qa/JudgeContract.ts and CitedArtifactExistsGate.ts"
      ).toBe($QaEvidence.create(`${name}/v2`).iri);
    }
    expect(iri("qa:evidence/cited-artifact-exists/v2")).toBe($QaId.create("evidence/cited-artifact-exists/v2").iri);
    for (const name of ["accepted", "delivered", "persisted", "recovery-attempt", "semantically-applied"] as const) {
      expect(iri(`qa:receipts/${name}/v2`)).toBe($QaId.create(`receipts/${name}/v2`).iri);
    }
    expect(iri("qa:verifiers/judge-settlement/v1")).toBe($QaId.create("verifiers/judge-settlement/v1").iri);
    expect(iri("contracts:qa-inventory/v1")).toBe($BeepId.create("contracts").create("qa-inventory/v1").iri);
    expect(iri("schemas:qa-judge-input/v1")).toBe($QaJudgeSchemas.create("qa-judge-input/v1").iri);
    expect(iri("schemas:qa-judge-settlement/v1")).toBe($QaJudgeSchemas.create("qa-judge-settlement/v1").iri);
  });

  it("declares the skill-contract evidence predicate types", () => {
    expect(
      iri("skill-contract:evidence/failure/v2"),
      "packages/foundation/modeling/skill-contract/src/{Recovery,EvidenceReceipt,GateCertificate}.ts"
    ).toBe($SkillContractId.create("evidence/failure/v2").iri);
    expect(iri("skill-contract:evidence/gate-summary/v2")).toBe(
      $SkillContractId.create("evidence/gate-summary/v2").iri
    );
    expect(iri("skill-contract:evidence/gate-certificate/v1")).toBe(
      $SkillContractId.create("evidence/gate-certificate/v1").iri
    );
  });

  it("declares the document annotation, taxonomy and identity RDF terms", () => {
    expect(iri("document:pattern"), "packages/foundation/modeling/rdf/src/Adapters/DocumentAnnotation.ts").toBe(
      $BeepId.create("document/pattern").iri
    );
    expect(iri("document:citation")).toBe($BeepId.create("document/citation").iri);
    expect(
      iri("documents-taxonomy:legal-document"),
      "packages/documents/domain/src/values/Taxonomy/Taxonomy.seed.ts"
    ).toBe($BeepId.create("documents/taxonomy/legal-document").iri);
    expect(
      iri("identity-rdf:identifier"),
      "packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts"
    ).toBe($SemanticWebId.create("identity/identifier").iri);
    expect(iri("identity-rdf:curie")).toBe($SemanticWebId.create("identity/curie").iri);
  });

  it("declares the practice KG graph bases, one per node kind", () => {
    const kinds = ["client", "docket_family", "docket", "application", "patent", "document", "email_archive"] as const;
    for (const kind of kinds) {
      expect(iri(`practice-kg:${kind}`), "packages/law-practice/server/src/PracticeKg.projections.ts: graphIri").toBe(
        graphIdentity.create(kind).iri
      );
    }
  });

  it("declares the instance namespaces of the ontology seeds and the labs", () => {
    expect(
      namespace("semantic-foundation").iri,
      "packages/foundation/modeling/ontology/src/{Vocabulary,SemanticFoundation}.seed.ts and friends"
    ).toBe(`${$SemanticFoundationId.iri}/`);
    expect(mint("semantic-foundation", "taxonomy", "legal-intake")).toBe(
      $SemanticFoundationId.create("taxonomy/legal-intake").iri
    );
    expect(namespace("semantica").iri, "apps/labs/semantica/src/layers/RdfProjectionLive.ts: BASE").toBe(
      `${$SemanticaId.iri}/`
    );
    expect(
      namespace("lejeune").iri,
      "apps/labs/lejeune-bolt-workbench/src/runtime/Projections.ts: LEJEUNE_ONTOLOGY_NAMESPACE"
    ).toBe(`${$BeepId.create("lejeune").create("ontology").iri}/`);
  });

  it("publishes every kept namespace IRI in the term snapshot", () => {
    const prefixes = [
      "beepQA",
      "contracts",
      "document",
      "documents-taxonomy",
      "epistemic",
      "identity-rdf",
      "lejeune",
      "practice-kg",
      "qa",
      "schemas",
      "semantic-foundation",
      "semantica",
      "skill-contract",
    ] as const;
    for (const prefix of prefixes) {
      expect(snapshot.terms).toContain(namespace(prefix).iri);
      expect(A.some(snapshot.namespaces, (row) => row.prefix === prefix && row.iri === namespace(prefix).iri)).toBe(
        true
      );
    }
  });

  it.prop(
    "mints composer bytes under a kept instance base and refuses bytes invalid in an IRI",
    [Segment, Segment],
    ([kind, key]) => {
      const sameBytes = (minted: () => string, composed: string) =>
        isIri(composed) ? expect(minted()).toBe(composed) : expect(minted).toThrow();
      sameBytes(() => mint("practice-kg:client", key), graphIdentity.create("client").create(key).iri);
      sameBytes(() => mint("semantic-foundation", kind, key), $SemanticFoundationId.create(kind).create(key).iri);
    },
    runs
  );
});
