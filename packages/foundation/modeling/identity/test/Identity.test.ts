import { BaseIdentityInput, make } from "@beep/identity";
import {
  $AgentsDomainId,
  $AgentsUseCasesId,
  $EpistemicDomainId,
  $I,
  $LawPracticeDomainId,
  $OntologyId,
  $SchemaId,
  $WorkspaceDomainId,
} from "@beep/identity/packages";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly version?: 1 | undefined;
    }
  }
}

const getProperty = (value: unknown, key: PropertyKey): unknown =>
  value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;

const getKeyAnnotations = (schema: S.Top, index = 0): unknown =>
  getProperty(
    getProperty(getProperty(getProperty(getProperty(schema.ast, "propertySignatures"), index), "type"), "context"),
    "annotations"
  );

describe("@beep/identity", () => {
  it("builds root identity strings and symbols", () => {
    const $BeepId = make("beep").$BeepId;

    expect($BeepId.string()).toBe("@beep");
    expect($BeepId.symbol()).toBe(Symbol.for("@beep"));
  });

  it("normalizes package constructor bases through the schema codec", () => {
    expect(S.decodeOption(BaseIdentityInput)("@beep/my-pkg")).toEqual(O.some("my-pkg"));
    expect(S.decodeOption(BaseIdentityInput)("@my-pkg")).toEqual(O.some("my-pkg"));
    expect(make("my-pkg").$MyPkgId.string()).toBe("@beep/my-pkg");
    expect(make("@my-pkg").$MyPkgId.string()).toBe("@beep/my-pkg");
    expect(make("@beep/my-pkg").$MyPkgId.string()).toBe("@beep/my-pkg");
  });

  it("round-trips generated base constructor input values", () => {
    fc.assert(
      fc.property(S.toArbitrary(BaseIdentityInput), (base) => {
        const decoded = O.flatMap(S.encodeOption(BaseIdentityInput)(base), S.decodeUnknownOption(BaseIdentityInput));

        expect(O.exists(decoded, (value) => Equal.equals(value, base))).toBe(true);
      })
    );
  });

  it("chains create for single-segment composition", () => {
    const $SchemaId = make("beep").$BeepId.create("schema");
    const entityId = $SchemaId.create("entities").make("Tenant");

    expect(entityId).toBe("@beep/schema/entities/Tenant");
  });

  it("composes variadic segments into tagged module record", () => {
    const $BeepId = make("beep").$BeepId;
    const modules = $BeepId.compose("schema", "errors");

    expect(modules.$SchemaId.string()).toBe("@beep/schema");
    expect(modules.$ErrorsId.string()).toBe("@beep/errors");
    expect(modules.$SchemaId.make("Tenant")).toBe("@beep/schema/Tenant");
  });

  it("composes single segment into tagged module record", () => {
    const $BeepId = make("beep").$BeepId;
    const { $SchemaId } = $BeepId.compose("schema");

    expect($SchemaId.string()).toBe("@beep/schema");
    expect($SchemaId`Entity`).toBe("@beep/schema/Entity");
  });

  it("supports create and template tags", () => {
    const $BeepId = make("beep").$BeepId;
    const $I = $BeepId.create("module");

    expect($I`MyService`).toBe("@beep/module/MyService");
  });

  it("supports create with slash-delimited path segments", () => {
    const $I = make("beep").$BeepId.create("lib/graphiti/client");

    expect($I.make("GraphitiService")).toBe("@beep/lib/graphiti/client/GraphitiService");
  });

  it("creates schema annote and preserves arbitrary extras plus derived title", () => {
    const $SchemaId = make("beep").$BeepId.create("schema");
    const annotation = $SchemaId.annote("tenant_profile-name", {
      default: { version: 1 as const },
      description: "Tenant schema",
      version: 1 as const,
    });

    expect(annotation.schemaId).toBe(Symbol.for("@beep/schema/tenant_profile-name"));
    expect(annotation.identifier).toBe("@beep/schema/tenant_profile-name");
    expect(annotation.title).toBe("Tenant Profile Name");
    expect(annotation.default).toEqual({ version: 1 });
    expect(annotation.description).toBe("Tenant schema");
    expect(annotation.version).toBe(1);
  });

  it("creates class annotations through the same runtime merge path as annote", () => {
    const sameText = (self: string, that: string): boolean => self === that;
    const extras = {
      description: "Tenant class",
      toEquivalence: () => sameText,
    };
    const annotation = $SchemaId.annoteClass<typeof S.String, readonly []>("TenantClass", extras);

    expect(annotation).toEqual($SchemaId.annote("TenantClass", extras));
    expect(annotation.schemaId).toBe(Symbol.for("@beep/schema/TenantClass"));
    expect(annotation.identifier).toBe("@beep/schema/TenantClass");
    expect(annotation.title).toBe("TenantClass");
    expect(annotation.description).toBe("Tenant class");
    expect(annotation.toEquivalence).toBe(extras.toEquivalence);
  });

  it("applies schema annotations via annoteSchema", () => {
    const toArbitrary: S.Annotations.ToArbitrary.Declaration<string, readonly []> = () => (fc) => fc.constant("tenant");
    const schema = S.String.pipe(
      $SchemaId.annoteSchema("tenant_profile-name", {
        default: "tenant",
        description: "Tenant schema",
        toArbitrary,
        version: 1 as const,
      })
    );
    const annotations = S.resolveAnnotations(schema);

    expect(annotations?.schemaId).toBe(Symbol.for("@beep/schema/tenant_profile-name"));
    expect(annotations?.identifier).toBe("@beep/schema/tenant_profile-name");
    expect(annotations?.title).toBe("Tenant Profile Name");
    expect(annotations?.default).toBe("tenant");
    expect(annotations?.description).toBe("Tenant schema");
    expect(annotations?.toArbitrary).toBe(toArbitrary);
    expect(annotations?.version).toBe(1);
  });

  it("composes full annotation identifiers for nested schema composers", () => {
    const $I = $OntologyId.create("Ontology.models");

    class RegressionOWLClass extends S.Class<RegressionOWLClass>($I`OWLClass`)(
      {
        iri: S.String,
      },
      $I.annote("OWLClass", {
        description: "Regression model for ontology class annotations.",
      })
    ) {}

    const classAnnotations = S.resolveAnnotations(RegressionOWLClass);
    const schemaAnnotations = S.resolveAnnotations(
      S.String.pipe(
        $I.annoteSchema("OWLClassLabel", {
          description: "Regression schema annotation.",
        })
      )
    );
    const keyAnnotations = getKeyAnnotations(
      S.Struct({
        iri: S.String.pipe(
          $I.annoteKey<{ readonly iri: string }>()("OWLClass.iri", {
            description: "Regression key annotation.",
          })
        ),
      })
    );
    const httpAnnotations = S.resolveAnnotations(
      S.String.pipe(
        $I.annoteHttp("OWLClassResponse", {
          description: "Regression HTTP annotation.",
          httpApiStatus: 200,
        })
      )
    );

    expect(classAnnotations?.identifier).toBe("@beep/ontology/Ontology.models/OWLClass");
    expect(classAnnotations?.schemaId).toBe(Symbol.for("@beep/ontology/Ontology.models/OWLClass"));
    expect(classAnnotations?.title).toBe("OWLClass");
    expect(schemaAnnotations?.identifier).toBe("@beep/ontology/Ontology.models/OWLClassLabel");
    expect(getProperty(keyAnnotations, "identifier")).toBe("@beep/ontology/Ontology.models/OWLClass.iri");
    expect(httpAnnotations?.identifier).toBe("@beep/ontology/Ontology.models/OWLClassResponse");
  });

  it("preserves tagged-union statics when applying annoteSchema", () => {
    const schema = S.Union([
      S.Struct({
        kind: S.tag("close"),
        code: S.Finite,
      }),
      S.Struct({
        kind: S.tag("message"),
        text: S.String,
      }),
    ]).pipe(
      S.toTaggedUnion("kind"),
      $SchemaId.annoteSchema("SocketEvent", {
        description: "Socket event union.",
      })
    );
    const annotations = S.resolveAnnotations(schema);

    expect(schema.cases.close).toBeDefined();
    expect(schema.cases.message).toBeDefined();
    expect(schema.guards.message({ kind: "message", text: "hello" })).toBe(true);
    expect(schema.isAnyOf(["message"])({ kind: "message", text: "hello" })).toBe(true);
    expect(
      schema.match(
        { kind: "message", text: "hello" },
        {
          close: () => "close",
          message: () => "message",
        }
      )
    ).toBe("message");
    expect(annotations?.identifier).toBe("@beep/schema/SocketEvent");
  });

  it("preserves custom own statics when applying annoteSchema", () => {
    const schema = Object.assign(S.String.annotate({}), {
      empty: "" as const,
    }).pipe($SchemaId.annoteSchema("StringWithStatics"));

    expect(schema.empty).toBe("");
  });

  it("applies key annotations via annoteKey", () => {
    const schema = S.Struct({
      field1: S.String.pipe(
        $SchemaId.annoteKey<{ readonly field1: string }>()("MyClass.field1", {
          description: "Primary field",
          messageMissingKey: "Field1 is required",
        })
      ),
    });
    const annotations = getKeyAnnotations(schema);

    expect(String(S.decodeUnknownExit(schema)({}))).toContain("Field1 is required");
    expect(getProperty(annotations, "schemaId")).toBe(Symbol.for("@beep/schema/MyClass.field1"));
    expect(getProperty(annotations, "identifier")).toBe("@beep/schema/MyClass.field1");
    expect(getProperty(annotations, "title")).toBe("MyClass.field1");
    expect(getProperty(annotations, "description")).toBe("Primary field");
    expect(getProperty(annotations, "messageMissingKey")).toBe("Field1 is required");
  });

  it("applies raw HTTP annotations via annoteHttp", () => {
    const encoding = {
      _tag: "Text",
      contentType: "text/plain",
    } as const;
    const schema = S.String.pipe(
      $SchemaId.annoteHttp("TextResponse", {
        description: "Text response payload",
        httpApiStatus: 202,
        "~httpApiEncoding": encoding,
      })
    );
    const annotations = S.resolveAnnotations(schema);

    expect(annotations?.schemaId).toBe(Symbol.for("@beep/schema/TextResponse"));
    expect(annotations?.identifier).toBe("@beep/schema/TextResponse");
    expect(annotations?.title).toBe("TextResponse");
    expect(annotations?.description).toBe("Text response payload");
    expect(annotations?.httpApiStatus).toBe(202);
    expect(getProperty(annotations, "~httpApiEncoding")).toEqual(encoding);
  });

  it("throws schema validation messages for invalid values", () => {
    const $I = make("beep").$BeepId;
    expect(() => ($I.make as (segment: string) => unknown)("/bad")).toThrow('Identity segments cannot start with "/".');
    expect(() => ($I.create as (segment: string) => unknown)("/bad")).toThrow(
      'Identity segments cannot start with "/".'
    );
    expect(() => ($I.create as (segment: string) => unknown)("bad/")).toThrow('Identity segments cannot end with "/".');
    expect(() => make("-bad")).toThrow(
      "Identity bases must use alphanumeric, hyphen, or underscore characters and start/end with alphanumeric."
    );
  });

  it("rejects interpolations in identity template tags", () => {
    const $I = make("beep").$BeepId.create("module");
    expect(
      () => ($I as unknown as (s: TemplateStringsArray, ...v: ReadonlyArray<unknown>) => unknown)`My${"Svc"}`
    ).toThrow("Identity template tags do not allow interpolations.");
  });

  it("creates consistent identities across derived composers", () => {
    const $BeepId = make("beep").$BeepId;
    const { $SchemaId } = $BeepId.compose("schema");
    const entityId = $SchemaId.make("Entity");
    const serviceId = $SchemaId`Service`;

    expect($BeepId.value).toBe("@beep");
    expect($SchemaId.value).toBe("@beep/schema");
    expect(entityId).toBe("@beep/schema/Entity");
    expect(serviceId).toBe("@beep/schema/Service");
  });

  it("composes nested module records from sub-composers", () => {
    const { $IamServerId } = make("beep").$BeepId.compose("iam-server");
    const { $ReposId, $ServicesId } = $IamServerId.compose("repos", "services");

    expect($ReposId.make("UserRepo")).toBe("@beep/iam-server/repos/UserRepo");
    expect($ServicesId.make("AuthService")).toBe("@beep/iam-server/services/AuthService");
  });

  it("exports package composers with create, template tags, and annote", () => {
    expect($SchemaId.create("entities").make("Tenant")).toBe("@beep/schema/entities/Tenant");
    expect($SchemaId`Service`).toBe("@beep/schema/Service");

    const annotation = $SchemaId.annote("Tenant");
    expect(annotation.schemaId).toBe(Symbol.for("@beep/schema/Tenant"));
    expect(annotation.identifier).toBe("@beep/schema/Tenant");
    expect(annotation.title).toBe("Tenant");

    expect($I.create("custom").make("CustomService")).toBe("@beep/custom/CustomService");
  });

  it("exports professional runtime package composers", () => {
    expect($WorkspaceDomainId.make("ContextPacket")).toBe("@beep/workspace-domain/ContextPacket");
    expect($EpistemicDomainId.make("Evidence")).toBe("@beep/epistemic-domain/Evidence");
    expect($AgentsDomainId.make("Agent")).toBe("@beep/agents-domain/Agent");
    expect($AgentsUseCasesId.make("RuntimeScope")).toBe("@beep/agents-use-cases/RuntimeScope");
    expect($LawPracticeDomainId.make("Matter")).toBe("@beep/law-practice-domain/Matter");
  });
});
