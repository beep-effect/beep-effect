// The Opaque conversion (W4-b, W4-g), pinned as inverted tests.
//
// The lab declared these records as `S.Class`, whose values are instances: a
// plain object failed `S.is`, `make` returned an instance, and `instanceOf`
// was the membership check. As branded `S.Opaque` records the value is a plain
// object: membership is the schema's structural check, and `make` validates
// and COPIES its input, so no caller may rely on reference identity.

import {
  Component,
  ComponentInput,
  Contact,
  CopyrightYears,
  ExternalReference,
  GitHubWorkflowProvenance,
  InTotoStatementInput,
  InTotoSubject,
  InTotoSubjectInput,
  NtiaElement,
  SbomDocument,
  SbomInput,
  SbomJsonOptions,
  SbomMetadata,
  SbomMetadataOptions,
  SigstoreBundle,
  SlsaBuildDefinition,
  SlsaProvenance,
  SlsaRunDetails,
  Supplier,
} from "@beep/sbom";
import { Sha256Digest } from "@beep/sbom/InTotoStatement";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const DIGEST = Result.getOrThrow(Sha256Digest.parseResult(Str.repeat(32)("ab")));

const component = { type: "library", name: "lib", version: "1.0.0" } as const;
const contact = { name: "Ada", email: "ada@example.com" };
const supplier = { name: "Acme", url: ["https://acme.example"], contact: [contact] };
const metadata = { timestamp: "2026-01-01T00:00:00Z", component, supplier, authors: [contact] };
const claims = {
  serverUrl: "https://github.com",
  repository: "acme/app",
  ref: "refs/heads/main",
  sha: "0123456789abcdef0123456789abcdef01234567",
  eventName: "push",
  workflowRef: "acme/app/.github/workflows/release.yml@refs/heads/main",
  jobWorkflowRef: "acme/app/.github/workflows/release.yml@refs/heads/main",
  repositoryId: "1",
  repositoryOwnerId: "2",
  runnerEnvironment: "github-hosted",
  runId: "3",
  runAttempt: "1",
};
const buildDefinition = {
  buildType: "https://actions.github.io/buildtypes/workflow/v1",
  externalParameters: {
    workflow: { ref: "refs/heads/main", repository: "https://github.com/acme/app", path: "x.yml" },
  },
  internalParameters: {
    github: { event_name: "push", repository_id: "1", repository_owner_id: "2", runner_environment: "github-hosted" },
  },
  resolvedDependencies: [{ uri: "git+https://github.com/acme/app@refs/heads/main", digest: { gitCommit: "abc" } }],
};
const runDetails = { builder: { id: "https://github.com/acme/app" }, metadata: { invocationId: "https://x" } };

/** One plain record per converted schema, with its `S.is` guard and `make`. */
const cases: ReadonlyArray<{
  readonly name: string;
  readonly is: (value: unknown) => boolean;
  readonly make: (value: never) => unknown;
  readonly value: object;
}> = [
  {
    name: "ExternalReference",
    is: S.is(ExternalReference),
    make: ExternalReference.make,
    value: { type: "vcs", url: "https://x" },
  },
  { name: "Contact", is: S.is(Contact), make: Contact.make, value: contact },
  { name: "Supplier", is: S.is(Supplier), make: Supplier.make, value: supplier },
  { name: "Component", is: S.is(Component), make: Component.make, value: component },
  { name: "SbomMetadata", is: S.is(SbomMetadata), make: SbomMetadata.make, value: metadata },
  {
    name: "SbomDocument",
    is: S.is(SbomDocument),
    make: SbomDocument.make,
    value: { bomFormat: "CycloneDX", specVersion: "1.6", version: 1, metadata, components: [component] },
  },
  { name: "NtiaElement", is: S.is(NtiaElement), make: NtiaElement.make, value: { id: "timestamp", satisfied: false } },
  {
    name: "SigstoreBundle",
    is: S.is(SigstoreBundle),
    make: SigstoreBundle.make,
    value: { mediaType: "application/x", verificationMaterial: {}, dsseEnvelope: {} },
  },
  {
    name: "SlsaBuildDefinition",
    is: S.is(SlsaBuildDefinition),
    make: SlsaBuildDefinition.make,
    value: buildDefinition,
  },
  { name: "SlsaRunDetails", is: S.is(SlsaRunDetails), make: SlsaRunDetails.make, value: runDetails },
  {
    name: "SlsaProvenance",
    is: S.is(SlsaProvenance),
    make: SlsaProvenance.make,
    value: { buildDefinition, runDetails },
  },
  {
    name: "InTotoSubject",
    is: S.is(InTotoSubject),
    make: InTotoSubject.make,
    value: { name: "w", digest: { sha256: DIGEST } },
  },
  { name: "SbomInput", is: S.is(SbomInput), make: SbomInput.make, value: { root: component, components: [] } },
  { name: "SbomJsonOptions", is: S.is(SbomJsonOptions), make: SbomJsonOptions.make, value: { space: 0 } },
  { name: "SbomMetadataOptions", is: S.is(SbomMetadataOptions), make: SbomMetadataOptions.make, value: { supplier } },
  { name: "ComponentInput", is: S.is(ComponentInput), make: ComponentInput.make, value: { name: "@acme/core" } },
  { name: "CopyrightYears", is: S.is(CopyrightYears), make: CopyrightYears.make, value: { year: 2026 } },
  {
    name: "InTotoStatementInput",
    is: S.is(InTotoStatementInput),
    make: InTotoStatementInput.make,
    value: { subject: [], predicateType: "https://x", predicate: {} },
  },
  {
    name: "InTotoSubjectInput",
    is: S.is(InTotoSubjectInput),
    make: InTotoSubjectInput.make,
    value: { name: "w", digest: DIGEST, predicateType: "https://x", predicate: {} },
  },
  {
    name: "GitHubWorkflowProvenance",
    is: S.is(GitHubWorkflowProvenance),
    make: GitHubWorkflowProvenance.make,
    value: claims,
  },
];

describe("the Opaque records", () => {
  it("cover the 10 member-less classes, 2 static-only records and 8 option and input structs", () => {
    assert.lengthOf(cases, 20);
  });

  for (const { name, is, make, value } of cases) {
    it(`${name}: a plain record of the right shape is a member — S.is is structural`, () => {
      assertTrue(is(value));
    });

    it(`${name}: make validates and copies — the result is equal but never the input`, () => {
      const admitted = make(value as never);
      assert.deepStrictEqual(admitted, value);
      assert.notStrictEqual(admitted, value);
    });
  }

  it("a nested value is copied too, so no caller sees its own object come back", () => {
    const root = Component.make(component);
    const document = SbomDocument.make({ bomFormat: "CycloneDX", specVersion: "1.6", version: 1, components: [root] });
    assert.deepStrictEqual(document.components[0], root);
    assert.notStrictEqual(document.components[0], root);
  });
});
