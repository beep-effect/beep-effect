import {
  $AgentsDomainId,
  $AgentsUseCasesId,
  $EpistemicDomainId,
  $LawPracticeDomainId,
  $OntologyId,
  $WorkspaceDomainId,
  make,
} from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type {
  // biome-ignore lint/suspicious/noDeprecatedImports: Compatibility coverage for the retained public alias.
  HttpApiEncoding,
  IdentityComposer,
  IdentityString,
  IdentitySymbol,
  ModuleSegmentValue,
  SegmentValue,
  TitleFromIdentifier,
} from "@beep/identity";
import type { TaggedErrorClassFromFields } from "@beep/schema";
import type * as Equivalence from "effect/Equivalence";

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly version?: 1 | undefined;
    }
  }
}

describe("Identity", () => {
  it("preserves literal types for make, compose, string, and symbol", () => {
    const $BeepId = make("beep").$BeepId;
    const { $SchemaId } = $BeepId.compose("schema");
    const { $EntitiesId } = $SchemaId.compose("entities");
    const tenantId = $EntitiesId.make("Tenant");
    const serviceId = $SchemaId`TenantService`;

    expect($BeepId).type.toBeAssignableTo<IdentityComposer<"@beep", undefined, undefined>>();
    expect($SchemaId).type.toBeAssignableTo<IdentityComposer<"@beep/schema", undefined, undefined>>();
    expect(tenantId).type.toBe<IdentityString<"@beep/schema/entities/Tenant">>();
    expect(serviceId).type.toBe<IdentityString<`@beep/schema/${string}`>>();
    expect($SchemaId.string()).type.toBe<IdentityString<"@beep/schema">>();
    expect($SchemaId.symbol()).type.toBe<IdentitySymbol<"@beep/schema">>();
  });

  it("preserves literal types for professional runtime package composers", () => {
    expect($WorkspaceDomainId).type.toBeAssignableTo<IdentityComposer<"@beep/workspace-domain">>();
    expect($EpistemicDomainId).type.toBeAssignableTo<IdentityComposer<"@beep/epistemic-domain">>();
    expect($AgentsDomainId).type.toBeAssignableTo<IdentityComposer<"@beep/agents-domain">>();
    expect($AgentsUseCasesId).type.toBeAssignableTo<IdentityComposer<"@beep/agents-use-cases">>();
    expect($LawPracticeDomainId).type.toBeAssignableTo<IdentityComposer<"@beep/law-practice-domain">>();
  });

  it("preserves literal types for annote and derived titles", () => {
    const { $SchemaId } = make("beep").$BeepId.compose("schema");
    const annotation = $SchemaId.annote("tenant_profile-name", {
      default: { version: 1 as const },
      description: "Tenant schema",
      version: 1 as const,
    });

    expect<TitleFromIdentifier<"tenant_profile-name">>().type.toBe<"Tenant Profile Name">();
    expect(annotation.schemaId).type.toBe<IdentitySymbol<"@beep/schema/tenant_profile-name">>();
    expect(annotation.identifier).type.toBe<IdentityString<"@beep/schema/tenant_profile-name">>();
    expect(annotation.title).type.toBe<"Tenant Profile Name">();
    expect(annotation.default).type.toBe<{ readonly version: 1 }>();
    expect(annotation.version).type.toBe<1>();
  });

  it("types nested annote identifiers as full composed identity strings", () => {
    const $I = $OntologyId.create("Ontology.models");
    const annotation = $I.annote("OWLClass", {
      description: "Regression model for ontology class annotations.",
    });

    expect(annotation.schemaId).type.toBe<IdentitySymbol<"@beep/ontology/Ontology.models/OWLClass">>();
    expect(annotation.identifier).type.toBe<IdentityString<"@beep/ontology/Ontology.models/OWLClass">>();
    expect(annotation.title).type.toBe<"OWLClass">();
  });

  it("types annoteSchema and annoteHttp like schema annotators", () => {
    const { $SchemaId } = make("beep").$BeepId.compose("schema");
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- compatibility coverage for the retained public alias
    const textEncoding = { _tag: "Text", contentType: "text/plain" } as const satisfies HttpApiEncoding;
    const schemaAnnotated = S.String.pipe(
      $SchemaId.annoteSchema("tenant_profile-name", {
        default: "tenant",
        description: "Tenant schema",
        version: 1 as const,
      })
    );
    const httpAnnotated = S.String.pipe(
      $SchemaId.annoteHttp("TextResponse", {
        description: "Text response payload",
        httpApiStatus: 202,
        "~httpApiEncoding": textEncoding,
      })
    );
    const Event = S.Union([
      S.Struct({
        kind: S.tag("close"),
        code: S.Finite,
      }),
      S.Struct({
        kind: S.tag("message"),
        text: S.String,
      }),
    ]).pipe(S.toTaggedUnion("kind"));
    const eventAnnotated = Event.pipe(
      $SchemaId.annoteSchema("SocketEvent", {
        description: "Socket event union.",
      })
    );
    const stringWithStatics = Object.assign(S.String.annotate({}), {
      empty: "" as const,
    });
    const stringWithStaticsAnnotated = stringWithStatics.pipe($SchemaId.annoteSchema("StringWithStatics"));

    expect(schemaAnnotated).type.toBe<typeof S.String>();
    expect(httpAnnotated).type.toBe<typeof S.String>();
    expect(eventAnnotated.cases.message).type.toBe<typeof Event.cases.message>();
    expect(eventAnnotated.match).type.toBe<typeof Event.match>();
    expect(stringWithStaticsAnnotated.empty).type.toBe<"">();
  });

  it("types annoteClass for whole-argument class annotations", () => {
    const { $SchemaId } = make("beep").$BeepId.compose("schema");
    const CircuitOpenErrorFields = {
      resetTimeoutMs: S.Finite,
    } satisfies S.Struct.Fields;
    const CircuitOpenErrorFieldsStruct = S.TaggedStruct("CircuitOpenError", CircuitOpenErrorFields);
    const makeCircuitOpenError = (input: typeof CircuitOpenErrorFieldsStruct.Type): CircuitOpenError =>
      CircuitOpenError.make({ resetTimeoutMs: input.resetTimeoutMs });

    // Whole-argument contextual typing infers TP but leaves Schema["Type"] as unknown.
    // @ts-expect-error!
    const contextualAnnotations: S.Annotations.Declaration<
      CircuitOpenError,
      readonly [typeof CircuitOpenErrorFieldsStruct]
    > = $SchemaId.annoteClass("CircuitOpenError", {
      description: "Contextual inference does not recover the declared schema type.",
    });
    void contextualAnnotations;

    const CircuitOpenErrorBase: TaggedErrorClassFromFields<
      CircuitOpenError,
      "CircuitOpenError",
      typeof CircuitOpenErrorFields
    > = TaggedErrorClass<CircuitOpenError>($SchemaId`CircuitOpenError`)(
      "CircuitOpenError",
      CircuitOpenErrorFields,
      $SchemaId.annoteClass<S.declare<CircuitOpenError>, readonly [typeof CircuitOpenErrorFieldsStruct]>(
        "CircuitOpenError",
        {
          description: "Failure raised when a circuit breaker rejects work while open.",
          toArbitrary: ([from]) => {
            expect(from).type.toBe<S.Annotations.ToArbitrary.TypeParameter<typeof CircuitOpenErrorFieldsStruct.Type>>();

            return () => ({
              arbitrary: from.arbitrary.map(makeCircuitOpenError),
              terminal: from.terminal?.map(makeCircuitOpenError),
            });
          },
          toEquivalence: ([sameFields]) => {
            expect(sameFields).type.toBe<Equivalence.Equivalence<typeof CircuitOpenErrorFieldsStruct.Type>>();

            return () => true;
          },
        }
      )
    );

    class CircuitOpenError extends CircuitOpenErrorBase {}

    expect(CircuitOpenError.make({ resetTimeoutMs: 1 })).type.toBe<CircuitOpenError>();
  });

  it("supports ergonomic and strict annoteKey typing", () => {
    const { $SchemaId } = make("beep").$BeepId.compose("schema");
    type MyClass = {
      readonly field1: string;
      readonly nested: {
        readonly count: number;
      };
    };

    const ergonomicAnnotated = S.String.pipe(
      $SchemaId.annoteKey("MyClass.field1", {
        default: "tenant",
        messageMissingKey: "Field1 is required",
      })
    );
    const strictAnnotated = S.String.pipe(
      $SchemaId.annoteKey<MyClass>()("MyClass.field1", {
        default: "tenant",
        messageMissingKey: "Field1 is required",
      })
    );
    const strictNestedAnnotated = S.Finite.pipe(
      $SchemaId.annoteKey<MyClass>()("MyClass.nested.count", {
        default: 1,
      })
    );

    expect(ergonomicAnnotated).type.toBe<typeof S.String>();
    expect(strictAnnotated).type.toBe<typeof S.String>();
    expect(strictNestedAnnotated).type.toBe<typeof S.Finite>();

    // @ts-expect-error!
    $SchemaId.annoteKey<MyClass>()("MyClass.missing", {
      default: "tenant",
    });

    // @ts-expect-error!
    S.String.pipe(
      $SchemaId.annoteKey<MyClass>()("MyClass.nested.count", {
        default: 1,
      })
    );
  });

  it("types the key entrypoint against the closed vocabulary", () => {
    const { $PatentId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.compose("patent");

    const borrowed = S.String.pipe($PatentId.key("skos:prefLabel"));
    const reversed = S.Array(S.String).pipe($PatentId.key("^rdfs:subClassOf"));
    const owned = S.NonEmptyString.pipe($PatentId.key({ description: "Claim text." }));

    expect(borrowed).type.toBe<typeof S.String>();
    expect(reversed).type.toBeAssignableTo<S.Top>();
    expect(owned).type.toBe<typeof S.NonEmptyString>();

    // @ts-expect-error!
    $PatentId.key("skos:prefLabl");

    // @ts-expect-error!
    $PatentId.key("nope:term");
  });

  it("types the class entrypoint with owned identity literals and the skos marker", () => {
    const { $PatentId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.compose("patent");
    const annotation = $PatentId.class("Claim", { description: "A patent claim.", skos: "concept" });

    expect(annotation.identifier).type.toBe<IdentityString<"@beep/patent/Claim">>();
    expect(annotation.title).type.toBe<"Claim">();
    expect(annotation.skosClassification).type.toBeAssignableTo<"concept" | "conceptScheme" | undefined>();

    // @ts-expect-error!
    $PatentId.class("Claim", { skos: "collection" });
  });

  it("supports base normalization while preserving keys/literals", () => {
    const fromPrefixed = make("@beep/schema").$SchemaId;
    const fromAt = make("@schema").$SchemaId;

    expect(fromPrefixed.string()).type.toBe<IdentityString<"@beep/schema">>();
    expect(fromAt.string()).type.toBe<IdentityString<"@beep/schema">>();
  });

  it("supports create + Context.Service class keys", () => {
    const $BeepId = make("beep").$BeepId;
    const $I = $BeepId.create("module");
    const $PathI = $BeepId.create("lib/graphiti/client");

    interface FsUtilsShape {
      readonly cwd: () => string;
    }

    class FsUtils extends Context.Service<FsUtils, FsUtilsShape>()($I`MyService`) {}

    expect(FsUtils.key).type.toBe<IdentityString<`@beep/module/${string}`>>();
    expect($PathI).type.toBeAssignableTo<IdentityComposer<"@beep/lib/graphiti/client", undefined, undefined>>();
  });

  it("enforces segment invariants at compile time", () => {
    expect<SegmentValue<"schema">>().type.toBe<"schema">();
    expect<SegmentValue<"/schema">>().type.toBe<never>();
    expect<SegmentValue<"schema/">>().type.toBe<never>();
    expect<ModuleSegmentValue<"schema_core">>().type.toBe<"schema_core">();
    expect<ModuleSegmentValue<"1schema">>().type.toBe<never>();
  });

  it("supports template tags for dynamic module names", () => {
    const $BeepId = make("beep").$BeepId;
    const $I = $BeepId.create("module");

    expect($I`1bad`).type.toBe<IdentityString<`@beep/module/${string}`>>();
  });
});
