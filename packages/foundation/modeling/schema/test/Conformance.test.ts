import { fcRuns } from "@beep/fc-runs";
import {
  Annotation,
  annotate,
  collectAnnotations,
  collectAnnotationsResult,
  Enforcement,
  Invariant,
  makeAnnotation,
  makeAnnotationResult,
  Policy,
  Report,
  Revision,
  revisionLabel,
} from "@beep/schema/Conformance";
import { URLStr } from "@beep/schema/URL";
import { describe, expect, it } from "@effect/vitest";
import { pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const InvariantEnforcementArbitrary = S.toArbitrary(Enforcement)(fc);
const ConformancePolicyArbitrary = S.toArbitrary(Policy)(fc);
const SpecificationRevisionArbitrary = S.toArbitrary(Revision)(fc);

const annotationInput = {
  sources: [
    {
      id: "example-spec",
      title: "Example Specification",
      role: "primarySpecification",
      canonicalUrl: "https://example.com/spec",
      revision: { kind: "release", version: "1.0" },
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  ],
  profiles: [
    {
      id: "example",
      title: "Example",
      version: "1.0",
      description: "Example conformance profile.",
      sourceIds: ["example-spec"],
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
      references: [{ sourceId: "example-spec", section: "Rule" }],
    },
  ],
} satisfies typeof Annotation.Encoded;

describe("Conformance", () => {
  it("validates and attaches referentially consistent annotations", () => {
    const annotation = makeAnnotation(annotationInput);
    const Child = annotate(annotationInput)(S.String);
    const Root = annotate(S.Array(Child), annotationInput);
    const collected = collectAnnotations(Root);

    expect(annotation.profiles[0]?.id).toBe("example");
    expect(collected).toHaveLength(2);
    expect(collected[0]?.invariants[0]?.id).toBe("example.rule");
  });

  it("types the annotation key and validates raw AST payloads before exposing them", () => {
    // @ts-expect-error The registered annotation key rejects scalar payloads.
    const Scalar = S.String.annotate({ conformance: "not-a-registry" });
    const Invalid = S.String.annotate({
      // @ts-expect-error Direct attachment requires metadata validated and branded by Annotation.
      conformance: {
        sources: ["not-a-source"],
        profiles: ["not-a-profile"],
        invariants: ["not-an-invariant"],
      },
    });

    const collectedResult = collectAnnotationsResult(Invalid);
    const annotationResult = makeAnnotationResult({ sources: [], profiles: [], invariants: [] });

    expect(Scalar).toBeDefined();
    expect(Result.isFailure(collectedResult)).toBe(true);
    if (Result.isFailure(collectedResult)) {
      expect(collectedResult.failure).toBeInstanceOf(S.SchemaError);
    }
    expect(() => collectAnnotations(Invalid)).toThrow(S.SchemaError);
    expect(Result.isFailure(annotationResult)).toBe(true);
    if (Result.isFailure(annotationResult)) {
      expect(annotationResult.failure).toBeInstanceOf(S.SchemaError);
    }
  });

  it("returns a schema failure when a Suspend thunk throws during annotation traversal", () => {
    const Broken = S.suspend((): S.Codec<string> => {
      throw new Error("boom");
    });

    const result = collectAnnotationsResult(Broken);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(S.SchemaError);
    }
    expect(() => collectAnnotations(Broken)).toThrow(S.SchemaError);
  });

  it("rejects duplicate identifiers and dangling references", () => {
    const duplicateSource = {
      ...annotationInput.sources[0],
      title: "Duplicate Specification",
    };
    const duplicateResult = S.decodeResult(Annotation)({
      ...annotationInput,
      sources: [annotationInput.sources[0], duplicateSource],
    });
    const danglingResult = S.decodeResult(Annotation)({
      ...annotationInput,
      profiles: [{ ...annotationInput.profiles[0], sourceIds: ["missing-source"] }],
    });

    expect(Result.isFailure(duplicateResult)).toBe(true);
    expect(Result.isFailure(danglingResult)).toBe(true);
    expect(() =>
      makeAnnotation({
        ...annotationInput,
        sources: [annotationInput.sources[0], duplicateSource],
      })
    ).toThrow(S.SchemaError);
  });

  it("rejects duplicate profile selections and references outside a selecting profile", () => {
    const secondarySource = {
      ...annotationInput.sources[0],
      id: "secondary-spec",
      title: "Secondary Specification",
      contentSha256: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    };
    const duplicateSelection = S.decodeResult(Annotation)({
      ...annotationInput,
      profiles: [
        {
          ...annotationInput.profiles[0],
          sourceIds: ["example-spec", "example-spec"],
          invariantIds: ["example.rule", "example.rule"],
        },
      ],
    });
    const outsideProfile = S.decodeResult(Annotation)({
      ...annotationInput,
      sources: [annotationInput.sources[0], secondarySource],
      invariants: [
        {
          ...annotationInput.invariants[0],
          references: [{ sourceId: "secondary-spec", section: "Rule" }],
        },
      ],
    });

    expect(Result.isFailure(duplicateSelection)).toBe(true);
    expect(Result.isFailure(outsideProfile)).toBe(true);
  });

  it("rejects enforcement evidence that contradicts decidability", () => {
    const invariant = annotationInput.invariants[0];
    const invalidDescriptors = [
      {
        ...invariant,
        decidability: "typeLevel",
        enforcement: [{ kind: "runtime", validator: "Example.validate" }],
      },
      {
        ...invariant,
        decidability: "localRuntime",
        enforcement: [{ kind: "test", suite: "Example.test", oracle: "fixture" }],
      },
      {
        ...invariant,
        decidability: "undecidable",
        enforcement: [{ kind: "runtime", validator: "Example.validate" }],
      },
      {
        ...invariant,
        decidability: "externalAuthority",
        enforcement: [
          { kind: "runtime", validator: "Example.validate" },
          { kind: "test", suite: "Example.test", oracle: "fixture" },
        ],
      },
      {
        ...invariant,
        decidability: "externalAuthority",
        enforcement: [
          { kind: "runtime", validator: "Example.validate" },
          { kind: "documented", rationale: "The authority remains decisive." },
        ],
      },
      {
        ...invariant,
        decidability: "undecidable",
        enforcement: [
          { kind: "staticAnalysis", rule: "example/rule" },
          { kind: "documented", rationale: "The condition cannot be decided locally." },
        ],
      },
      {
        ...invariant,
        enforcement: [
          { kind: "runtime", validator: "Example.validate" },
          { kind: "notEnforced", gap: "No validator is available." },
        ],
      },
      {
        ...invariant,
        testIds: ["example.test", "example.test"],
      },
      {
        ...invariant,
        references: [invariant.references[0], invariant.references[0]],
      },
      {
        ...invariant,
        enforcement: [invariant.enforcement[0], invariant.enforcement[0]],
      },
    ];

    expect(
      A.every(invalidDescriptors, (descriptor) => Result.isFailure(S.decodeUnknownResult(Invariant)(descriptor)))
    ).toBe(true);

    expect(
      Result.isSuccess(
        S.decodeResult(Invariant)({
          ...invariant,
          decidability: "externalAuthority",
          enforcement: [{ kind: "notEnforced", gap: "The authority must decide this condition." }],
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        S.decodeResult(Invariant)({
          ...invariant,
          references: [
            { sourceId: "example-spec", section: "Rule" },
            { sourceId: "example-spec", section: "Different section" },
          ],
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        S.decodeResult(Invariant)({
          ...invariant,
          enforcement: [
            { kind: "runtime", validator: "Example.validate" },
            { kind: "runtime", validator: "Example.validateFallback" },
          ],
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        S.decodeResult(Invariant)({
          ...invariant,
          decidability: "contextualRuntime",
          enforcement: [{ kind: "documented", rationale: "The caller supplies the deciding context." }],
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        S.decodeResult(Invariant)({
          ...invariant,
          decidability: "undecidable",
          enforcement: [
            { kind: "documented", rationale: "This mathematical condition is documented for consumers." },
            { kind: "notEnforced", gap: "No finite local procedure can decide the condition." },
          ],
        })
      )
    ).toBe(true);
    expect(
      A.every(
        [
          "@beep/html Effect Schema decode boundary",
          "inspectConformance and resolveScriptState",
          "decodePandocJsonStrict,encodePandocJson",
          "Heading.validateOutline()",
        ],
        (validator) => Result.isFailure(S.decodeResult(Enforcement)({ kind: "runtime", validator }))
      )
    ).toBe(true);
    expect(
      Result.isSuccess(S.decodeResult(Enforcement)({ kind: "runtime", validator: "Heading.validateOutline" }))
    ).toBe(true);
  });

  it("exposes exhaustive helpers for semantically distinct variants", () => {
    const enforcement = Enforcement.cases.runtime.make({ validator: "Example.validate" });
    const policy = Policy.cases.lossless.make({
      profileIds: ["example"],
      reportOn: ["must"],
      unknownRepresentation: "preserve",
    });
    const report = Report.cases.conforming.make({
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule"],
    });
    const revision = Revision.cases.release.make({ version: "1.0" });

    expect(
      Enforcement.match(enforcement, {
        typeLevel: ({ mechanism }) => mechanism,
        runtime: ({ validator }) => validator,
        staticAnalysis: ({ rule }) => rule,
        test: ({ suite }) => suite,
        documented: ({ rationale }) => rationale,
        notEnforced: ({ gap }) => gap,
      })
    ).toBe("Example.validate");
    expect(policy.mode).toBe("lossless");
    expect(report.status).toBe("conforming");
    expect(revisionLabel(revision)).toBe("release:1.0");
  });

  it("requires immutable Git object ids and valid calendar dates for revision pins", () => {
    const invalidRevisions = [
      { kind: "gitCommit", repository: "https://example.com/repository.git", commit: "main" },
      { kind: "gitCommit", repository: "https://example.com/repository.git", commit: "abc123" },
      {
        kind: "gitCommit",
        repository: "https://example.com/repository.git",
        commit: "1ED08F66DF016A18C6D7D56BD97AA778912CB37B",
      },
      { kind: "datedSnapshot", date: "banana" },
      { kind: "datedSnapshot", date: "2026-02-30" },
      { kind: "retrievedSnapshot", retrievedOn: "2026-13-01" },
    ];

    expect(A.every(invalidRevisions, (revision) => Result.isFailure(S.decodeUnknownResult(Revision)(revision)))).toBe(
      true
    );
    expect(
      Result.isSuccess(
        S.decodeResult(Revision)({
          kind: "gitCommit",
          repository: "https://example.com/repository.git",
          commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
        })
      )
    ).toBe(true);
    expect(Result.isSuccess(S.decodeResult(Revision)({ kind: "datedSnapshot", date: "2024-02-29" }))).toBe(true);
  });

  it("formats every immutable source revision kind", () => {
    const commit = Revision.cases.gitCommit.make({
      repository: URLStr.make("https://example.com/repository.git"),
      commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
    });
    const datedSnapshot = Revision.cases.datedSnapshot.make({ date: "2026-08-31" });
    const registryVersion = Revision.cases.registryVersion.make({ registry: "Example Registry", version: "2.0 rc1" });
    const retrievedSnapshot = Revision.cases.retrievedSnapshot.make({ retrievedOn: "2026-08-30" });
    const packageRevision = Revision.cases.packageRevision.make({ packageName: "@beep/md", version: "0.0.0" });

    expect(revisionLabel(commit)).toBe(
      "gitCommit:https%3A%2F%2Fexample.com%2Frepository.git#1ed08f66df016a18c6d7d56bd97aa778912cb37b"
    );
    expect(revisionLabel(datedSnapshot)).toBe("datedSnapshot:2026-08-31");
    expect(revisionLabel(registryVersion)).toBe("registryVersion:Example%20Registry@2.0%20rc1");
    expect(revisionLabel(retrievedSnapshot)).toBe("retrievedSnapshot:2026-08-30");
    expect(revisionLabel(packageRevision)).toBe("packageRevision:%40beep%2Fmd@0.0.0");
  });

  it("round-trips schema-derived conformance variants", () => {
    const report = Report.cases.conforming.make({
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule"],
    });

    fc.assert(
      fc.property(
        InvariantEnforcementArbitrary,
        ConformancePolicyArbitrary,
        SpecificationRevisionArbitrary,
        (enforcement, policy, revision) => {
          expect(
            pipe(S.encodeResult(Enforcement)(enforcement), Result.flatMap(S.decodeUnknownResult(Enforcement)))
          ).toEqual(Result.succeed(enforcement));
          expect(pipe(S.encodeResult(Policy)(policy), Result.flatMap(S.decodeUnknownResult(Policy)))).toEqual(
            Result.succeed(policy)
          );
          expect(pipe(S.encodeResult(Report)(report), Result.flatMap(S.decodeUnknownResult(Report)))).toEqual(
            Result.succeed(report)
          );
          expect(pipe(S.encodeResult(Revision)(revision), Result.flatMap(S.decodeUnknownResult(Revision)))).toEqual(
            Result.succeed(revision)
          );
        }
      ),
      fcRuns(50)
    );
  });

  it("requires issues for non-conforming reports", () => {
    const result = S.decodeUnknownResult(Report)({
      status: "nonConforming",
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule"],
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("requires unique report identifiers and issues drawn from checked invariants", () => {
    const uncheckedIssue = {
      status: "nonConforming",
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule"],
      issues: [
        {
          kind: "violation",
          invariantId: "example.unchecked",
          strength: "must",
          message: "This issue was not part of the checked set.",
        },
      ],
    };
    const duplicateIds = {
      status: "indeterminate",
      profileIds: ["example", "example"],
      checkedInvariantIds: ["example.external", "example.external"],
      issues: [
        {
          kind: "indeterminate",
          invariantId: "example.external",
          message: "External authority was unavailable.",
          reason: "Offline.",
        },
      ],
    };

    expect(Result.isFailure(S.decodeUnknownResult(Report)(uncheckedIssue))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Report)(duplicateIds))).toBe(true);
    expect(() =>
      Report.cases.nonConforming.make({
        profileIds: ["example"],
        checkedInvariantIds: ["example.rule"],
        issues: [
          {
            kind: "violation",
            invariantId: "example.unchecked",
            strength: "must",
            path: [],
            message: "This issue was not part of the checked set.",
            reference: O.none(),
          },
        ],
      })
    ).toThrow();
  });

  it("constructs an indeterminate report when every issue names a checked invariant", () => {
    const report = Report.cases.indeterminate.make({
      profileIds: ["example"],
      checkedInvariantIds: ["example.external"],
      issues: [
        {
          kind: "indeterminate",
          invariantId: "example.external",
          path: ["value"],
          message: "The external condition could not be decided.",
          reason: "The authority was unavailable.",
          reference: O.none(),
        },
      ],
    });

    expect(report.status).toBe("indeterminate");
    expect(report.issues[0]?.path).toEqual(["value"]);
  });

  it("retains indeterminate outcomes alongside definite violations", () => {
    const report = Report.cases.nonConforming.make({
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule", "example.external"],
      issues: [
        {
          kind: "violation",
          invariantId: "example.rule",
          strength: "must",
          path: [],
          message: "The checked value violates the local rule.",
          reference: O.none(),
        },
      ],
      indeterminateIssues: [
        {
          kind: "indeterminate",
          invariantId: "example.external",
          path: [],
          message: "The external condition was not available.",
          reason: "External authority was offline.",
          reference: O.none(),
        },
      ],
    });

    expect(report.status).toBe("nonConforming");
    expect(report.issues).toHaveLength(1);
    expect(report.indeterminateIssues).toHaveLength(1);
  });
});
