import { semanticSpecificationsFromConformance } from "@beep/rdf/SemanticSchemaConformance";
import {
  annotateSemanticSchema,
  collectSemanticSchemaMetadata,
  collectSemanticSchemaMetadataResult,
  getSemanticSchemaMetadata,
  getSemanticSchemaMetadataResult,
  makeSemanticSchemaMetadata,
  makeSemanticSchemaMetadataResult,
  SemanticSchemaSpecification,
} from "@beep/rdf/SemanticSchemaMetadata";
import { makeAnnotation } from "@beep/schema/Conformance";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata";
import type { Annotation } from "@beep/schema/Conformance";

const semanticMetadata = {
  kind: "identifier",
  canonicalName: "RootIdentifier",
  overview: "Root identifier metadata.",
  status: "stable",
  specifications: [{ name: "Example Profile", disposition: "informative" }],
  equivalenceBasis: "String equality.",
} satisfies typeof SemanticSchemaMetadata.Encoded;

const conformanceAnnotation = {
  sources: [
    {
      id: "primary-spec",
      title: "Primary Specification",
      role: "primarySpecification",
      canonicalUrl: "https://example.com/spec",
      revision: { kind: "release", version: "1.0" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "best-practice",
      title: "Best Practice Guide",
      role: "bestPractice",
      canonicalUrl: "https://example.com/guide",
      revision: { kind: "datedSnapshot", date: "2026-08-30" },
      contentSha256: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    },
  ],
  profiles: [
    {
      id: "example",
      title: "Example",
      version: "1.0",
      description: "Example conformance profile.",
      sourceIds: ["primary-spec", "best-practice"],
      invariantIds: ["example.rule"],
    },
  ],
  invariants: [
    {
      id: "example.rule",
      title: "Example rule",
      statement: "The value satisfies the example rule.",
      strength: "must",
      scope: "value",
      decidability: "localRuntime",
      enforcement: [{ kind: "runtime", validator: "Example.validate" }],
      references: [{ sourceId: "primary-spec" }, { sourceId: "best-practice" }],
    },
  ],
} satisfies typeof Annotation.Encoded;

const revisionAnnotation = {
  sources: [
    {
      id: "git-source",
      title: "Git Source",
      role: "primarySpecification",
      canonicalUrl: "https://example.com/git",
      revision: {
        kind: "gitCommit",
        repository: "https://example.com/repository.git",
        commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      license: "CC-BY-4.0",
      scope: "Sections 1-3",
    },
    {
      id: "release-source",
      title: "Release Source",
      role: "normativeDependency",
      canonicalUrl: "https://example.com/release",
      revision: { kind: "release", version: "pkg@1" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "dated-source",
      title: "Dated Source",
      role: "conformanceCorpus",
      canonicalUrl: "https://example.com/dated",
      revision: { kind: "datedSnapshot", date: "2026-08-30" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "registry-source",
      title: "Registry Source",
      role: "registry",
      canonicalUrl: "https://example.com/registry",
      revision: { kind: "registryVersion", registry: "example@registry", version: "1:2" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "retrieved-source",
      title: "Retrieved Source",
      role: "bestPractice",
      canonicalUrl: "https://example.com/retrieved",
      revision: { kind: "retrievedSnapshot", retrievedOn: "2026-08-30" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "package-source",
      title: "Package Source",
      role: "implementationReference",
      canonicalUrl: "https://example.com/package",
      revision: { kind: "packageRevision", packageName: "pkg", version: "1" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  ],
  profiles: [
    {
      id: "revision-profile",
      title: "Revision Profile",
      version: "1.0",
      description: "Exercises every supported revision identity.",
      sourceIds: [
        "git-source",
        "release-source",
        "dated-source",
        "registry-source",
        "retrieved-source",
        "package-source",
      ],
      invariantIds: ["revision.rule"],
    },
  ],
  invariants: [
    {
      id: "revision.rule",
      title: "Revision rule",
      statement: "Every registered authority retains its exact revision identity.",
      strength: "must",
      scope: "value",
      decidability: "localRuntime",
      enforcement: [{ kind: "runtime", validator: "semanticSpecificationsFromConformance" }],
      references: [
        { sourceId: "git-source" },
        { sourceId: "release-source" },
        { sourceId: "dated-source" },
        { sourceId: "registry-source" },
        { sourceId: "retrieved-source" },
        { sourceId: "package-source" },
      ],
    },
  ],
} satisfies typeof Annotation.Encoded;

describe("semantic schema conformance", () => {
  it("preserves the legacy first-result accessor and exposes all nested metadata", () => {
    const Child = annotateSemanticSchema(S.String, {
      ...semanticMetadata,
      canonicalName: "ChildIdentifier",
    });
    const Root = annotateSemanticSchema(S.Array(Child), semanticMetadata);

    expect(A.map(collectSemanticSchemaMetadata(Root), ({ canonicalName }) => canonicalName)).toEqual([
      "RootIdentifier",
      "ChildIdentifier",
    ]);
    expect(O.map(getSemanticSchemaMetadata(Root), ({ canonicalName }) => canonicalName)).toEqual(
      O.some("RootIdentifier")
    );
    expect(
      pipe(getSemanticSchemaMetadataResult(Root), Result.map(O.map(({ canonicalName }) => canonicalName)))
    ).toEqual(Result.succeed(O.some("RootIdentifier")));
  });

  it("validates collected annotation payloads before exposing them", () => {
    const Invalid = S.String.annotate({
      semanticSchemaMetadata: "not-metadata" as unknown as SemanticSchemaMetadata,
    });

    const collectedResult = collectSemanticSchemaMetadataResult(Invalid);
    const metadataResult = makeSemanticSchemaMetadataResult({ kind: "unknown" });

    expect(Result.isFailure(collectedResult)).toBe(true);
    if (Result.isFailure(collectedResult)) {
      expect(collectedResult.failure).toBeInstanceOf(S.SchemaError);
    }
    expect(() => collectSemanticSchemaMetadata(Invalid)).toThrow(S.SchemaError);
    expect(Result.isFailure(metadataResult)).toBe(true);
    if (Result.isFailure(metadataResult)) {
      expect(metadataResult.failure).toBeInstanceOf(S.SchemaError);
    }
    expect(() => makeSemanticSchemaMetadata({ ...semanticMetadata, canonicalName: "" })).toThrow(S.SchemaError);
  });

  it("returns a schema failure when a Suspend thunk throws during metadata traversal", () => {
    const Broken = S.suspend((): S.Codec<string> => {
      throw new Error("boom");
    });

    const result = collectSemanticSchemaMetadataResult(Broken);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(S.SchemaError);
    }
    expect(() => collectSemanticSchemaMetadata(Broken)).toThrow(S.SchemaError);
  });

  it("projects source order, revision labels, and normative disposition", () => {
    const specifications = semanticSpecificationsFromConformance(makeAnnotation(conformanceAnnotation));

    expect(A.map(specifications, ({ name }) => name)).toEqual(["Primary Specification", "Best Practice Guide"]);
    expect(A.map(specifications, ({ version }) => version)).toEqual([
      O.some("release:1.0"),
      O.some("datedSnapshot:2026-08-30"),
    ]);
    expect(A.map(specifications, ({ disposition }) => disposition)).toEqual(["normative", "informative"]);
    expect(A.map(specifications, ({ sourceId }) => sourceId)).toEqual([
      O.some("primary-spec"),
      O.some("best-practice"),
    ]);
  });

  it("retains every provenance field and distinguishes all revision variants", () => {
    const specifications = semanticSpecificationsFromConformance(makeAnnotation(revisionAnnotation));
    const labels = A.map(specifications, ({ version }) => O.getOrThrow(version));

    expect(labels).toEqual([
      "gitCommit:https%3A%2F%2Fexample.com%2Frepository.git#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "release:pkg%401",
      "datedSnapshot:2026-08-30",
      "registryVersion:example%40registry@1%3A2",
      "retrievedSnapshot:2026-08-30",
      "packageRevision:pkg@1",
    ]);
    expect(A.dedupe(labels)).toHaveLength(6);
    expect(A.map(specifications, ({ sourceId }) => O.getOrThrow(sourceId))).toEqual(
      revisionAnnotation.profiles[0].sourceIds
    );
    expect(A.map(specifications, ({ sourceRole }) => O.getOrThrow(sourceRole))).toEqual([
      "primarySpecification",
      "normativeDependency",
      "conformanceCorpus",
      "registry",
      "bestPractice",
      "implementationReference",
    ]);
    expect(A.map(specifications, ({ revision }) => O.getOrThrow(revision).kind)).toEqual([
      "gitCommit",
      "release",
      "datedSnapshot",
      "registryVersion",
      "retrievedSnapshot",
      "packageRevision",
    ]);
    expect(A.map(specifications, ({ revision }) => ({ ...O.getOrThrow(revision) }))).toEqual(
      A.map(revisionAnnotation.sources, ({ revision }) => revision)
    );
    expect(specifications[0]?.contentSha256).toEqual(
      O.some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    );
    expect(specifications[0]?.license).toEqual(O.some("CC-BY-4.0"));
    expect(specifications[0]?.scope).toEqual(O.some("Sections 1-3"));
    expect(specifications[1]?.license).toEqual(O.none());

    const roundTrip = pipe(
      S.encodeResult(SemanticSchemaSpecification)(specifications[0]!),
      Result.flatMap(S.decodeUnknownResult(SemanticSchemaSpecification))
    );
    expect(roundTrip).toEqual(Result.succeed(specifications[0]!));
  });
});
