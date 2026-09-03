import * as Identity from "@beep/identity";
import { make } from "@beep/identity";
import * as IdentityPackages from "@beep/identity/packages";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import type {
  DeclarationAnnotationExtras,
  IdentityAnyAnnotationExtras,
  IdentityComposer,
  IdentityString,
  IdentitySymbol,
  KeyAnnotationExtras,
  ModuleSegmentValue,
  SegmentValue,
  TitleFromIdentifier,
} from "@beep/identity";

type ShapeStableTypeOnlyImportSentinel = {
  readonly DeclarationAnnotationExtras: DeclarationAnnotationExtras<unknown>;
  readonly IdentityAnyAnnotationExtras: IdentityAnyAnnotationExtras<unknown>;
  readonly IdentityComposer: IdentityComposer<string>;
  readonly IdentityString: IdentityString<string>;
  readonly IdentitySymbol: IdentitySymbol<string>;
  readonly KeyAnnotationExtras: KeyAnnotationExtras<unknown>;
  readonly ModuleSegmentValue: ModuleSegmentValue<"shape-stable">;
  readonly SegmentValue: SegmentValue<"shape-stable">;
  readonly TitleFromIdentifier: TitleFromIdentifier<"shape-stable">;
};

const currentRootTypeOnlyNamedImports = [
  "DeclarationAnnotationExtras",
  "IdentityAnyAnnotationExtras",
  "IdentityComposer",
  "IdentityString",
  "IdentitySymbol",
  "KeyAnnotationExtras",
  "ModuleSegmentValue",
  "SegmentValue",
  "TitleFromIdentifier",
] as const satisfies ReadonlyArray<keyof ShapeStableTypeOnlyImportSentinel>;

const currentRootRuntimeNamedImports = [
  "$AcpId",
  "$AgentsDomainId",
  "$AgentsServerId",
  "$AgentsUseCasesId",
  "$AiProviderCliId",
  "$AnthropicId",
  "$ApiTransportId",
  "$BoxId",
  "$ColorsId",
  "$DiscordId",
  "$DrizzleId",
  "$EcfrId",
  "$EditorId",
  "$EpistemicDomainId",
  "$FileProcessingId",
  "$GovinfoId",
  "$HtmlId",
  "$HubspotId",
  "$LangExtractId",
  "$LawPracticeDomainId",
  "$LawPracticeUseCasesId",
  "$LibpffId",
  "$M365Id",
  "$MdId",
  "$NlpId",
  "$NlpMcpId",
  "$NlpProcessingId",
  "$OipWebId",
  "$OnepasswordCliId",
  "$OntologyId",
  "$OpenaiCompatId",
  "$PandocAstId",
  "$PgliteId",
  "$PhoenixId",
  "$PostgresId",
  "$ProfessionalDesktopId",
  "$RepoCliId",
  "$RepoConfigsId",
  "$RepoDocgenId",
  "$RepoUtilsId",
  "$RunpodId",
  "$SanityId",
  "$SchemaId",
  "$ScratchpadId",
  "$SemanticWebId",
  "$SharedDomainId",
  "$TikaId",
  "$UiId",
  "$UsptoId",
  "$VeniceAiId",
  "$WinkId",
  "$WorkspaceDomainId",
  "$WorkspaceServerId",
  "$XaiId",
  "make",
] as const;

const currentPackagesRuntimeNamedImports = [
  "$AgentsDomainId",
  "$AgentsUseCasesId",
  "$AiSyncId",
  "$ArchitectureLabClientId",
  "$ArchitectureLabConfigId",
  "$ArchitectureLabDomainId",
  "$ArchitectureLabProofId",
  "$ArchitectureLabServerId",
  "$ArchitectureLabUiId",
  "$ArchitectureLabUseCasesId",
  "$ChalkId",
  "$EpistemicDomainId",
  "$EpistemicUseCasesId",
  "$FaceDetectionId",
  "$FfmpegId",
  "$FirecrawlId",
  "$I",
  "$InfraId",
  "$LawPracticeDomainId",
  "$LawPracticeUseCasesId",
  "$LexicalSchemaId",
  "$M365McpId",
  "$McpKitId",
  "$ObservabilityId",
  "$OipWebId",
  "$OntologyId",
  "$ProfessionalDesktopId",
  "$ProvenanceId",
  "$RdfId",
  "$RepoAiMetricsId",
  "$RepoCliId",
  "$RepoDocgenId",
  "$RepoUtilsId",
  "$SchemaId",
  "$SemanticWebId",
  "$SharedDomainId",
  "$TestUtilsId",
  "$UsptoMcpId",
  "$UtilsId",
  "$WorkspaceDomainId",
  "$WorkspaceUseCasesId",
] as const;

const expectedPackageComposerIdentities = {
  $I: "@beep",
  $DataId: "@beep/data",
  $IdentityId: "@beep/identity",
  $SchemaId: "@beep/schema",
  $ProvenanceId: "@beep/provenance",
  $RdfId: "@beep/rdf",
  $OntologyId: "@beep/ontology",
  $TypesId: "@beep/types",
  $UtilsId: "@beep/utils",
  $UiId: "@beep/ui",
  $RepoAiMetricsId: "@beep/repo-ai-metrics",
  $RepoCliId: "@beep/repo-cli",
  $RepoConfigsId: "@beep/repo-configs",
  $RepoUtilsId: "@beep/repo-utils",
  $TestUtilsId: "@beep/test-utils",
  $SharedDomainId: "@beep/shared-domain",
  $SharedTablesId: "@beep/shared-tables",
  $SemanticWebId: "@beep/semantic-web",
  $NlpId: "@beep/nlp",
  $NlpProcessingId: "@beep/nlp-processing",
  $LangExtractId: "@beep/langextract",
  $ObservabilityId: "@beep/observability",
  $ColorsId: "@beep/colors",
  $ChalkId: "@beep/chalk",
  $RepoDocgenId: "@beep/repo-docgen",
  $InfraId: "@beep/infra",
  $WorkspaceDomainId: "@beep/workspace-domain",
  $EpistemicDomainId: "@beep/epistemic-domain",
  $EpistemicUseCasesId: "@beep/epistemic-use-cases",
  $AgentsDomainId: "@beep/agents-domain",
  $AgentsServerId: "@beep/agents-server",
  $AgentsUseCasesId: "@beep/agents-use-cases",
  $LawPracticeDomainId: "@beep/law-practice-domain",
  $LawPracticeUseCasesId: "@beep/law-practice-use-cases",
  $LawPracticeServerId: "@beep/law-practice-server",
  $ProfessionalDesktopId: "@beep/professional-desktop",
  $MdId: "@beep/md",
  $OipWebId: "@beep/oip-web",
  $DrizzleId: "@beep/drizzle",
  $DuckdbId: "@beep/duckdb",
  $FaceDetectionId: "@beep/face-detection",
  $FfmpegId: "@beep/ffmpeg",
  $PostgresId: "@beep/postgres",
  $AnthropicId: "@beep/anthropic",
  $VeniceAiId: "@beep/venice-ai",
  $XaiId: "@beep/xai",
  $AcpId: "@beep/acp",
  $OpenaiCompatId: "@beep/openai-compat",
  $WorkspaceTablesId: "@beep/workspace-tables",
  $WorkspaceUseCasesId: "@beep/workspace-use-cases",
  $WorkspaceServerId: "@beep/workspace-server",
  $ArchitectureLabDomainId: "@beep/architecture-lab-domain",
  $ArchitectureLabUseCasesId: "@beep/architecture-lab-use-cases",
  $ArchitectureLabConfigId: "@beep/architecture-lab-config",
  $ArchitectureLabServerId: "@beep/architecture-lab-server",
  $ArchitectureLabTablesId: "@beep/architecture-lab-tables",
  $ArchitectureLabClientId: "@beep/architecture-lab-client",
  $ArchitectureLabUiId: "@beep/architecture-lab-ui",
  $ArchitectureLabProofId: "@beep/architecture-lab-proof",
  $RunpodId: "@beep/runpod",
  $OnepasswordCliId: "@beep/onepassword-cli",
  $DiscordId: "@beep/discord",
  $AiProviderCliId: "@beep/ai-provider-cli",
  $SanityId: "@beep/sanity",
  $HubspotId: "@beep/hubspot",
  $PhoenixId: "@beep/phoenix",
  $AiSyncId: "@beep/ai-sync",
  $BoxId: "@beep/box",
  $NlpMcpId: "@beep/nlp-mcp",
  $RdfCanonizeId: "@beep/rdf-canonize",
  $WinkId: "@beep/wink",
  $FileProcessingId: "@beep/file-processing",
  $TikaId: "@beep/tika",
  $LibpffId: "@beep/libpff",
  $FirecrawlId: "@beep/firecrawl",
  $UsptoId: "@beep/uspto",
  $LexicalSchemaId: "@beep/lexical-schema",
  $EditorId: "@beep/editor",
  $ScratchpadId: "@beep/scratchpad",
  $HtmlId: "@beep/html",
  $PandocAstId: "@beep/pandoc-ast",
  $PgliteId: "@beep/pglite",
  $M365Id: "@beep/m365",
  $M365McpId: "@beep/m365-mcp",
  $GovinfoId: "@beep/govinfo",
  $EcfrId: "@beep/ecfr",
  $ApiTransportId: "@beep/api-transport",
  $McpKitId: "@beep/mcp-kit",
  $UsptoMcpId: "@beep/uspto-mcp",
} as const;

const composerFunctionProperties = [
  "annote",
  "annoteClass",
  "annoteHttp",
  "annoteKey",
  "annoteSchema",
  "class",
  "compose",
  "create",
  "key",
  "make",
  "string",
  "symbol",
] as const;

const isObjectLike = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const getProperty = (value: unknown, key: PropertyKey): unknown =>
  isObjectLike(value) ? Reflect.get(value, key) : undefined;

const expectFunction: (value: unknown, label: string) => asserts value is (...args: Array<unknown>) => unknown = (
  value,
  label
) => {
  expect(typeof value, label).toBe("function");
};

const callFunction = (value: unknown, label: string, ...args: Array<unknown>): unknown => {
  expectFunction(value, label);
  return value(...args);
};

const expectRecord: (value: unknown, label: string) => asserts value is Record<string, unknown> = (value, label) => {
  expect(isObjectLike(value), label).toBe(true);
};

const expectExistingAnnotationShape = (
  annotation: unknown,
  expectedIdentifier: string,
  expectedTitle: string,
  expectedExtraKeys: ReadonlyArray<string>
) => {
  expectRecord(annotation, "annotation");
  const existingKeys = ["identifier", "schemaId", "title", ...expectedExtraKeys];

  expect(Object.keys(annotation)).toEqual(expect.arrayContaining(existingKeys));
  expect(annotation.identifier).toBe(expectedIdentifier);
  expect(annotation.schemaId).toBe(Symbol.for(expectedIdentifier));
  expect(annotation.title).toBe(expectedTitle);
};

const assertComposerShape = (name: string, value: unknown, expectedIdentity: string) => {
  expectFunction(value, name);

  for (const property of composerFunctionProperties) {
    expect(typeof getProperty(value, property), `${name}.${property}`).toBe("function");
  }

  expect(getProperty(value, "identifier")).toBe(expectedIdentity);
  expect(getProperty(value, "value")).toBe(expectedIdentity);
  expect(callFunction(getProperty(value, "string"), `${name}.string`)).toBe(expectedIdentity);

  const symbol = callFunction(getProperty(value, "symbol"), `${name}.symbol`);
  expect(symbol).toBe(Symbol.for(expectedIdentity));
  expect(typeof symbol, `${name}.symbol typeof`).toBe("symbol");
  if (typeof symbol === "symbol") {
    expect(Symbol.keyFor(symbol)).toBe(expectedIdentity);
  }

  expect(callFunction(getProperty(value, "make"), `${name}.make`, "Harness")).toBe(`${expectedIdentity}/Harness`);

  const child = callFunction(getProperty(value, "create"), `${name}.create`, "Harness");
  expect(callFunction(getProperty(child, "string"), `${name}.create.string`)).toBe(`${expectedIdentity}/Harness`);

  const composed = callFunction(getProperty(value, "compose"), `${name}.compose`, "shape-stable");
  const $ShapeStableId = getProperty(composed, "$ShapeStableId");
  expect(callFunction(getProperty($ShapeStableId, "string"), `${name}.compose.$ShapeStableId.string`)).toBe(
    `${expectedIdentity}/shape-stable`
  );

  const annotation = callFunction(getProperty(value, "annote"), `${name}.annote`, "Harness", {
    description: "Shape stable harness.",
  });
  expectExistingAnnotationShape(annotation, `${expectedIdentity}/Harness`, "Harness", ["description"]);
};

const assertComposerExport = (
  moduleName: string,
  moduleExports: unknown,
  exportName: string,
  expectedIdentity: string
) => {
  const value = getProperty(moduleExports, exportName);

  expect(value, `${moduleName}.${exportName}`).not.toBeUndefined();
  assertComposerShape(`${moduleName}.${exportName}`, value, expectedIdentity);
};

describe("@beep/identity shape-stable harness", () => {
  it("keeps the current root type-only named import inventory documented", () => {
    expect(currentRootTypeOnlyNamedImports).toEqual([
      "DeclarationAnnotationExtras",
      "IdentityAnyAnnotationExtras",
      "IdentityComposer",
      "IdentityString",
      "IdentitySymbol",
      "KeyAnnotationExtras",
      "ModuleSegmentValue",
      "SegmentValue",
      "TitleFromIdentifier",
    ]);
  });

  it("keeps every current runtime named import from @beep/identity available", () => {
    for (const exportName of currentRootRuntimeNamedImports) {
      const value = getProperty(Identity, exportName);

      expect(value, `@beep/identity.${exportName}`).not.toBeUndefined();

      if (exportName === "make") {
        expectFunction(value, "@beep/identity.make");
      } else {
        const expectedIdentity = getProperty(expectedPackageComposerIdentities, exportName);

        expect(typeof expectedIdentity, `expected identity for ${exportName}`).toBe("string");
        if (typeof expectedIdentity === "string") {
          assertComposerShape(`@beep/identity.${exportName}`, value, expectedIdentity);
        }
      }
    }
  });

  it("keeps every current runtime named import from @beep/identity/packages available", () => {
    for (const exportName of currentPackagesRuntimeNamedImports) {
      const expectedIdentity = getProperty(expectedPackageComposerIdentities, exportName);

      expect(typeof expectedIdentity, `expected package identity for ${exportName}`).toBe("string");
      if (typeof expectedIdentity === "string") {
        assertComposerExport("@beep/identity/packages", IdentityPackages, exportName, expectedIdentity);
      }
    }
  });

  it("pins every generated package composer export to today's literal identity", () => {
    for (const [exportName, expectedIdentity] of Object.entries(expectedPackageComposerIdentities)) {
      assertComposerExport("@beep/identity/packages", IdentityPackages, exportName, expectedIdentity);
      assertComposerExport("@beep/identity", Identity, exportName, expectedIdentity);
    }
  });

  it("keeps RepoPkgs backed by the generated composer record", () => {
    const repoPkgs = getProperty(IdentityPackages, "RepoPkgs");

    expectRecord(repoPkgs, "@beep/identity/packages.RepoPkgs");

    for (const [exportName, expectedIdentity] of Object.entries(expectedPackageComposerIdentities)) {
      if (exportName !== "$I") {
        assertComposerShape(`RepoPkgs.${exportName}`, repoPkgs[exportName], expectedIdentity);
      }
    }
  });

  it("keeps make() one-argument call forms and generated accessor names compatible", () => {
    const cases = [
      { accessor: "$BeepId", base: "beep", identity: "@beep" },
      { accessor: "$BeepId", base: "@beep", identity: "@beep" },
      { accessor: "$SchemaId", base: "schema", identity: "@beep/schema" },
      { accessor: "$SchemaId", base: "@schema", identity: "@beep/schema" },
      { accessor: "$SchemaId", base: "@beep/schema", identity: "@beep/schema" },
      { accessor: "$RepoCliId", base: "repo-cli", identity: "@beep/repo-cli" },
    ];

    for (const current of cases) {
      const made = make(current.base);
      const composer = getProperty(made, current.accessor);

      expect(Object.keys(made)).toEqual([current.accessor]);
      assertComposerShape(`make(${current.base}).${current.accessor}`, composer, current.identity);
    }
  });

  it("keeps Symbol.for interning stable for representative identities", () => {
    const representatives = [
      IdentityPackages.$I,
      IdentityPackages.$SchemaId,
      IdentityPackages.$OntologyId.create("Ontology.models").create("OWLClass"),
      IdentityPackages.$UsptoMcpId.create("Server"),
    ];

    for (const composer of representatives) {
      const identity = composer.string();

      expect(composer.symbol()).toBe(Symbol.for(identity));
      expect(Symbol.keyFor(composer.symbol())).toBe(identity);
    }
  });

  it("keeps annote and annoteSchema existing record keys and values stable while allowing additions", () => {
    const $I = IdentityPackages.$OntologyId.create("Ontology.models");
    const annotation = $I.annote("OWLClass", {
      description: "Regression model for ontology class annotations.",
    });
    const schema = S.String.pipe(
      $I.annoteSchema("OWLClassLabel", {
        description: "Regression schema annotation.",
      })
    );
    const schemaAnnotations = S.resolveAnnotations(schema);

    expectExistingAnnotationShape(annotation, "@beep/ontology/Ontology.models/OWLClass", "OWLClass", ["description"]);
    expect(annotation.description).toBe("Regression model for ontology class annotations.");
    expectExistingAnnotationShape(schemaAnnotations, "@beep/ontology/Ontology.models/OWLClassLabel", "OWLClassLabel", [
      "description",
    ]);
    expect(schemaAnnotations?.description).toBe("Regression schema annotation.");
  });

  it("keeps annoteKey existing record keys and values stable while allowing additions", () => {
    const $I = IdentityPackages.$SchemaId.create("ShapeStable");
    const schema = S.Struct({
      field: S.String.pipe(
        $I.annoteKey<{ readonly field: string }>()("Harness.field", {
          description: "Shape-stable field.",
        })
      ),
    });
    const propertySignatures = getProperty(schema.ast, "propertySignatures");
    const firstProperty = getProperty(propertySignatures, 0);
    const propertyType = getProperty(firstProperty, "type");
    const context = getProperty(propertyType, "context");
    const annotations = getProperty(context, "annotations");

    expectExistingAnnotationShape(annotations, "@beep/schema/ShapeStable/Harness.field", "Harness.field", [
      "description",
    ]);
    expect(getProperty(annotations, "description")).toBe("Shape-stable field.");
  });

  it("keeps generated create-package accessor exports available", () => {
    for (const accessorName of ["$OntologyId", "$RepoCliId", "$UsptoMcpId"]) {
      expect(getProperty(Identity, accessorName), `generated import { ${accessorName} }`).not.toBeUndefined();
      expect(getProperty(IdentityPackages, accessorName), `generated composers.${accessorName}`).not.toBeUndefined();
    }
  });
});
