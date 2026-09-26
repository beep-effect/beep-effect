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
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeAnnotationResult = S.decodeResult(Annotation);
const decodeEnforcementResult = S.decodeResult(Enforcement);
const decodeInvariantResult = S.decodeResult(Invariant);
const decodeRevisionResult = S.decodeResult(Revision);
const decodeUnknownEnforcementResult = S.decodeUnknownResult(Enforcement);
const decodeUnknownInvariantResult = S.decodeUnknownResult(Invariant);
const decodeUnknownPolicyResult = S.decodeUnknownResult(Policy);
const decodeUnknownReportResult = S.decodeUnknownResult(Report);
const decodeUnknownRevisionResult = S.decodeUnknownResult(Revision);
const encodeEnforcementResult = S.encodeResult(Enforcement);
const encodePolicyResult = S.encodeResult(Policy);
const encodeReportResult = S.encodeResult(Report);
const encodeRevisionResult = S.encodeResult(Revision);

const InvariantEnforcementArbitrary = Arbitrary.schema(Enforcement);
const ConformancePolicyArbitrary = Arbitrary.schema(Policy);
const SpecificationRevisionArbitrary = Arbitrary.schema(Revision);

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
      conformance: {
        // @ts-expect-error Direct attachment requires metadata validated and branded by Annotation.
        sources: ["not-a-source"],
        profiles: ["not-a-profile"],
        invariants: ["not-an-invariant"],
      },
    });

    const collectedResult = collectAnnotationsResult(Invalid);
    const annotationResult = makeAnnotationResult({ sources: [], profiles: [], invariants: [] });

    expect(Scalar).toBeDefined();
    pipe(collectedResult, Result.isFailure, assertTrue);
    if (Result.isFailure(collectedResult)) {
      expect(collectedResult.failure).toBeInstanceOf(S.SchemaError);
    }
    expect(() => collectAnnotations(Invalid)).toThrow(S.SchemaError);
    pipe(annotationResult, Result.isFailure, assertTrue);
    if (Result.isFailure(annotationResult)) {
      expect(annotationResult.failure).toBeInstanceOf(S.SchemaError);
    }
  });

  it("returns a schema failure when a Suspend thunk throws during annotation traversal", () => {
    const Broken = S.suspend((): S.Codec<string> => {
      throw new Error("boom");
    });

    const result = collectAnnotationsResult(Broken);

    pipe(result, Result.isFailure, assertTrue);
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
    const duplicateResult = decodeAnnotationResult({
      ...annotationInput,
      sources: [annotationInput.sources[0], duplicateSource],
    });
    const danglingResult = decodeAnnotationResult({
      ...annotationInput,
      profiles: [{ ...annotationInput.profiles[0], sourceIds: ["missing-source"] }],
    });

    pipe(duplicateResult, Result.isFailure, assertTrue);
    pipe(danglingResult, Result.isFailure, assertTrue);
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
    const duplicateSelection = decodeAnnotationResult({
      ...annotationInput,
      profiles: [
        {
          ...annotationInput.profiles[0],
          sourceIds: ["example-spec", "example-spec"],
          invariantIds: ["example.rule", "example.rule"],
        },
      ],
    });
    const outsideProfile = decodeAnnotationResult({
      ...annotationInput,
      sources: [annotationInput.sources[0], secondarySource],
      invariants: [
        {
          ...annotationInput.invariants[0],
          references: [{ sourceId: "secondary-spec", section: "Rule" }],
        },
      ],
    });

    pipe(duplicateSelection, Result.isFailure, assertTrue);
    pipe(outsideProfile, Result.isFailure, assertTrue);
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

    A.forEach(invalidDescriptors, (descriptor, index) => {
      pipe(decodeUnknownInvariantResult(descriptor), Result.isFailure, (failed) =>
        assertTrue(failed, `Invalid invariant descriptor ${index}: ${JSON.stringify(descriptor)}`)
      );
    });

    pipe(
      decodeInvariantResult({
        ...invariant,
        decidability: "externalAuthority",
        enforcement: [{ kind: "notEnforced", gap: "The authority must decide this condition." }],
      }),
      Result.isSuccess,
      assertTrue
    );
    pipe(
      decodeInvariantResult({
        ...invariant,
        references: [
          { sourceId: "example-spec", section: "Rule" },
          { sourceId: "example-spec", section: "Different section" },
        ],
      }),
      Result.isSuccess,
      assertTrue
    );
    pipe(
      decodeInvariantResult({
        ...invariant,
        enforcement: [
          { kind: "runtime", validator: "Example.validate" },
          { kind: "runtime", validator: "Example.validateFallback" },
        ],
      }),
      Result.isSuccess,
      assertTrue
    );
    pipe(
      decodeInvariantResult({
        ...invariant,
        decidability: "contextualRuntime",
        enforcement: [{ kind: "documented", rationale: "The caller supplies the deciding context." }],
      }),
      Result.isSuccess,
      assertTrue
    );
    pipe(
      decodeInvariantResult({
        ...invariant,
        decidability: "undecidable",
        enforcement: [
          { kind: "documented", rationale: "This mathematical condition is documented for consumers." },
          { kind: "notEnforced", gap: "No finite local procedure can decide the condition." },
        ],
      }),
      Result.isSuccess,
      assertTrue
    );
    A.forEach(
      [
        "@beep/html Effect Schema decode boundary",
        "inspectConformance and resolveScriptState",
        "decodePandocJsonStrict,encodePandocJson",
        "Heading.validateOutline()",
      ],
      (validator) => {
        pipe(decodeEnforcementResult({ kind: "runtime", validator }), Result.isFailure, (failed) =>
          assertTrue(failed, `Invalid runtime validator: ${validator}`)
        );
      }
    );
    pipe(
      decodeEnforcementResult({ kind: "runtime", validator: "Heading.validateOutline" }),
      Result.isSuccess,
      assertTrue
    );
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

    A.forEach(invalidRevisions, (revision, index) => {
      pipe(decodeUnknownRevisionResult(revision), Result.isFailure, (failed) =>
        assertTrue(failed, `Invalid revision ${index}: ${JSON.stringify(revision)}`)
      );
    });
    pipe(
      decodeRevisionResult({
        kind: "gitCommit",
        repository: "https://example.com/repository.git",
        commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
      }),
      Result.isSuccess,
      assertTrue
    );
    pipe(decodeRevisionResult({ kind: "datedSnapshot", date: "2024-02-29" }), Result.isSuccess, assertTrue);
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

  {
    const report = Report.cases.conforming.make({
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule"],
    });
    it.effect.prop(
      "round-trips schema-derived conformance variants",
      [InvariantEnforcementArbitrary, ConformancePolicyArbitrary, SpecificationRevisionArbitrary],
      Effect.fnUntraced(function* ([enforcement, policy, revision]) {
        assertSuccess(
          pipe(encodeEnforcementResult(enforcement), Result.flatMap(decodeUnknownEnforcementResult)),
          enforcement
        );
        assertSuccess(pipe(encodePolicyResult(policy), Result.flatMap(decodeUnknownPolicyResult)), policy);
        assertSuccess(pipe(encodeReportResult(report), Result.flatMap(decodeUnknownReportResult)), report);
        assertSuccess(pipe(encodeRevisionResult(revision), Result.flatMap(decodeUnknownRevisionResult)), revision);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }

  it("requires issues for non-conforming reports", () => {
    const result = decodeUnknownReportResult({
      status: "nonConforming",
      profileIds: ["example"],
      checkedInvariantIds: ["example.rule"],
    });

    pipe(result, Result.isFailure, assertTrue);
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

    pipe(decodeUnknownReportResult(uncheckedIssue), Result.isFailure, assertTrue);
    pipe(decodeUnknownReportResult(duplicateIds), Result.isFailure, assertTrue);
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
