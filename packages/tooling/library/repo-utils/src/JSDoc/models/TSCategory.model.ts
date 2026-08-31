/**
 * TypeScript category taxonomy schemas, fibration metadata, and classifier utilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { ArrayOfStrings, LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { flow, Order, pipe, Result, SchemaAST } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ArchitecturalLayer } from "./ArchitecturalLayer.model.ts";
import { ASTSignal } from "./ASTSignal.model.ts";
import { DependencyProfile } from "./DependencyProfile.model.ts";
import type { ApplicableTo } from "./ApplicableTo.model.ts";
import type { ArchitecturalLayer as ArchitecturalLayerValue } from "./ArchitecturalLayer.model.ts";

const $I = $RepoUtilsId.create("JSDoc/models/TSCategory.model");

const TS_CATEGORY_TAG_VALUES = [
  "DomainModel",
  "DomainLogic",
  "PortContract",
  "Validation",
  "Utility",
  "UseCase",
  "Presentation",
  "DataAccess",
  "Integration",
  "Configuration",
  "CrossCutting",
  "Uncategorized",
] as const;

const DocumentationPriority = S.Int.check(S.isBetween({ minimum: 1, maximum: 99 })).pipe(
  $I.annoteSchema("DocumentationPriority", {
    description: "Integer documentation ordering priority from 1 through 99; lower values sort first.",
  })
);

/**
 * Internal base literal schema for all supported TypeDoc `@category` values.
 *
 * @category models
 * @since 0.0.0
 */
const TSCategoryTagBase = LiteralKit(TS_CATEGORY_TAG_VALUES).pipe(
  $I.annoteSchema("TSCategoryTag", {
    description: "Strict literal union for all supported TypeDoc @category values.",
  })
);

/**
 * Inferred type for {@link TSCategoryTagBase}.
 *
 * @category models
 * @since 0.0.0
 */
type TSCategoryTagBase = typeof TSCategoryTagBase.Type;

/**
 * Purity classification for a TSCategory taxonomy member.
 *
 * **Example** (Checking pure purity value)
 *
 * ```ts
 * import { CategoryPurity } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * const purity = CategoryPurity.Enum.pure
 * console.log(CategoryPurity.is.pure(purity))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CategoryPurity = LiteralKit(["pure", "effectful", "mixed"]).pipe(
  $I.annoteSchema("CategoryPurity", {
    description: "Purity classification",
    documentation:
      "- pure: no observable side effects\\n- effectful: performs IO, mutation, or external effects\\n- mixed: both pure and effectful patterns",
  })
);

/**
 * Inferred type for {@link CategoryPurity}.
 *
 * **Example** (Accepting CategoryPurity type)
 *
 * ```ts
 * import type { CategoryPurity } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * type Example = CategoryPurity
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CategoryPurity = typeof CategoryPurity.Type;

/**
 * A single member of the closed taxonomy used to classify
 * TypeScript code elements in the knowledge graph.
 *
 * **Example** (Looking up Utility category)
 *
 * ```ts
 * import { getCategory } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 * import * as O from "effect/Option"
 *
 * const category = getCategory("Utility")
 * console.log(O.getOrUndefined(category)?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TSCategoryDefinition extends S.Class<TSCategoryDefinition>($I`TSCategoryDefinition`)(
  {
    /**
     * Discriminant. PascalCase with no spaces.
     * This is the value used in `@category PascalCaseName`.
     */
    _tag: TSCategoryTagBase.annotateKey({
      description: "Discriminant. PascalCase with no spaces.\\nThis is the value used in `@category PascalCaseName`.",
    }),
    /** One-sentence definition precise enough to resolve ambiguity. */
    definition: S.NonEmptyString.annotateKey({
      description: "One-sentence definition precise enough to resolve ambiguity.",
    }),
    /**
     * Extended guidance written for LLM-based fallback classification.
     * Should cover membership, non-membership, and edge-case boundaries.
     */
    classificationGuidance: S.NonEmptyString.annotateKey({
      description:
        "Extended guidance written for LLM-based fallback classification.\\nShould cover membership, non-membership, and edge-case boundaries.",
    }),
    /** Concrete production-like TypeScript patterns for this category. */
    examples: S.NonEmptyArray(S.String).annotateKey({
      description: "Concrete production-like TypeScript patterns for this category.",
    }),
    /** Disambiguation patterns that belong in other categories. */
    counterExamples: ArrayOfStrings.annotateKey({
      description: "Disambiguation patterns that belong in other categories.",
    }),
    /**
     * Common SyntaxKind names for this category.
     * This is indicative, not exclusive.
     */
    typicalSyntaxKinds: ArrayOfStrings.annotateKey({
      description: "Common SyntaxKind names for this category.\\nThis is indicative, not exclusive.",
    }),
    /**
     * Deterministic AST signals. Every category includes at least one signal
     * with confidence at least 0.7.
     */
    astSignals: S.Array(ASTSignal).annotateKey({
      description:
        "Deterministic AST signals. Every category includes at least one signal\\nwith confidence at least 0.7.",
    }),
    /**
     * Effect or monad analog for the computational nature of this category.
     * Null when no clean mapping exists.
     */
    effectAnalog: S.OptionFromNullOr(S.String).annotateKey({
      description:
        "Effect or monad analog for the computational nature of this category.\\nNull when no clean mapping exists.",
    }),
    /** Architectural layers this category maps to. */
    architecturalLayers: S.Array(ArchitecturalLayer).annotateKey({
      description: "Architectural layers this category maps to.",
    }),
    /**
     * Purity classification.
     * - pure: no observable side effects
     * - effectful: performs IO, mutation, or external effects
     * - mixed: both pure and effectful patterns
     */
    purity: CategoryPurity.annotateKey({
      description:
        "Purity classification.\\n- pure: no observable side effects\\n- effectful: performs IO, mutation, or external effects\\n- mixed: both pure and effectful patterns",
    }),
    /**
     * Semantically adjacent categories for query expansion and ambiguity handling.
     * Reference by `_tag` value.
     */
    adjacentCategories: ArrayOfStrings.annotateKey({
      description:
        "Semantically adjacent categories for query expansion and ambiguity handling.\\nReference by `_tag` value.",
    }),
    /** Import path glob patterns that are strong classification hints. */
    typicalImportPatterns: ArrayOfStrings.annotateKey({
      description: "Import path glob patterns that are strong classification hints.",
    }),
    /** Typical dependency direction profile. */
    dependencyProfile: DependencyProfile.annotateKey({
      description: "Typical dependency direction profile.",
    }),
    /** Lower means document first in topological ordering. */
    documentationPriority: DocumentationPriority.annotateKey({
      description: "Lower means document first in topological ordering.",
    }),
  },
  $I.annote("TSCategoryDefinition", {
    description:
      "A single member of the closed taxonomy used to classify TypeScript code elements in the knowledge graph.",
  })
) {}

/**
 * Runtime encoded shape for TS category metadata.
 *
 * **Example** (Accepting TSCategory type)
 *
 * ```ts
 * import type { TSCategory } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * type Example = TSCategory
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSCategory = typeof TSCategoryDefinition.Encoded;

const EncodedTSCategoryDefinition = S.toEncoded(TSCategoryDefinition).pipe(
  $I.annoteSchema("EncodedTSCategoryDefinition", {
    description: "Encoded category metadata shape used in public taxonomy arrays and candidate payloads.",
  })
);

/**
 * The payload type stored in the `tsCategoryMetadata` annotation key.
 *
 * **Example** (Accepting annotation payload type)
 *
 * ```ts
 * import type { TSCategoryAnnotationPayload } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * type Example = TSCategoryAnnotationPayload
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSCategoryAnnotationPayload = TSCategoryDefinition;

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly tsCategoryMetadata?: TSCategoryAnnotationPayload | undefined;
    }
  }
}

/**
 * Retrieve TS category metadata annotation from a schema, if present.
 *
 * **Example** (Reading schema category metadata)
 *
 * ```ts
 * import { getCategory, getTSCategoryMetadata, make } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 * import * as O from "effect/Option"
 *
 * const utility = getCategory("Utility")
 * if (O.isSome(utility)) {
 *   const tagSchema = make("Utility", utility.value)
 *   console.log(O.getOrUndefined(getTSCategoryMetadata(tagSchema))?._tag)
 * }
 * ```
 *
 * @param schema - Any Effect schema.
 * @returns The TSCategoryDefinition metadata when present.
 * @category models
 * @since 0.0.0
 */
export const getTSCategoryMetadata = (schema: S.Top): O.Option<TSCategoryAnnotationPayload> =>
  O.fromUndefinedOr(SchemaAST.resolve(schema.ast)?.tsCategoryMetadata);

/**
 * Build a TS category fibration schema for a concrete category tag.
 *
 * **Details**
 *
 * Validates full taxonomy metadata with {@link TSCategoryDefinition} and
 * projects to a lean literal schema suitable for category value usage.
 *
 * **Example** (Building category fibration schema)
 *
 * ```ts
 * import { getCategory, getTSCategoryMetadata, make } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 * import * as O from "effect/Option"
 *
 * const utility = getCategory("Utility")
 * if (O.isSome(utility)) {
 *   const tagSchema = make("Utility", utility.value)
 *   console.log(O.getOrUndefined(getTSCategoryMetadata(tagSchema))?._tag)
 * }
 * ```
 *
 * @param _tag - Canonical TS category discriminator.
 * @param meta - Category metadata payload without the discriminator.
 * @returns Literal category schema annotated with validated metadata.
 * @category models
 * @since 0.0.0
 */
export const make: {
  <const Tag extends TSCategoryTagBase>(meta: Omit<TSCategory, "_tag">): (tag: Tag) => ReturnType<typeof S.Literal>;
  <const Tag extends TSCategoryTagBase>(_tag: Tag, meta: Omit<TSCategory, "_tag">): ReturnType<typeof S.Literal>;
} = dual(2, <const Tag extends TSCategoryTagBase>(_tag: Tag, meta: Omit<TSCategory, "_tag">) => {
  const definition = Result.getOrThrow(S.decodeResult(TSCategoryDefinition)({ _tag, ...meta }));
  return S.Literal(_tag).annotate({ tsCategoryMetadata: definition });
});

/**
 * Confidence threshold where deterministic classification can skip LLM inference.
 *
 * **Example** (Comparing threshold to 0.8)
 *
 * ```ts
 * import { DETERMINISTIC_CLASSIFICATION_THRESHOLD } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(DETERMINISTIC_CLASSIFICATION_THRESHOLD > 0.8)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DETERMINISTIC_CLASSIFICATION_THRESHOLD = 0.85;

/**
 * Guardrail threshold used to route low-confidence matches to `Uncategorized`.
 *
 * **Example** (Comparing guardrail thresholds)
 *
 * ```ts
 * import {
 *   DETERMINISTIC_CLASSIFICATION_THRESHOLD,
 *   UNCATEGORIZED_GUARDRAIL_THRESHOLD
 * } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(UNCATEGORIZED_GUARDRAIL_THRESHOLD < DETERMINISTIC_CLASSIFICATION_THRESHOLD)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const UNCATEGORIZED_GUARDRAIL_THRESHOLD = 0.45;

/**
 * File-path patterns that identify test infrastructure.
 * The classifier should exclude these files from category scoring
 * or route them to a dedicated test-handling path before applying
 * the main taxonomy.
 *
 * **Example** (Matching test file patterns)
 *
 * ```ts
 * import { TESTING_FILE_PATTERNS } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * const matchesTests = TESTING_FILE_PATTERNS.some((pattern) => pattern.includes("test"))
 * console.log(matchesTests)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TESTING_FILE_PATTERNS = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/test/**",
  "**/tests/**",
  "**/*.stories.ts",
  "**/*.stories.tsx",
  "**/fixtures/**",
  "**/__fixtures__/**",
] as const satisfies ReadonlyArray<string>;

/**
 * Import patterns that strongly signal test infrastructure.
 * Used as a secondary signal when file paths are ambiguous
 * (e.g., test utilities not in a conventional test directory).
 *
 * **Example** (Check testing import pattern)
 *
 * ```ts
 * import { TESTING_IMPORT_PATTERNS } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(TESTING_IMPORT_PATTERNS.includes("vitest*"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TESTING_IMPORT_PATTERNS = [
  "vitest*",
  "jest*",
  "@jest/*",
  "@testing-library/*",
  "msw*",
  "playwright*",
  "@playwright/*",
  "cypress*",
  "supertest*",
  "nock*",
  "sinon*",
] as const satisfies ReadonlyArray<string>;

/**
 * Per-category literal schema members built through the TS category fibration `make` helper.
 *
 * @category models
 * @since 0.0.0
 */
const DomainModel = make("DomainModel", {
  definition: "Core business concepts and stable type-level contracts that represent domain state and invariants.",
  classificationGuidance:
    "Classify as DomainModel when the element defines domain nouns and canonical shapes (types, interfaces, enums, immutable classes) without orchestration concerns. Put parsers/validators in Validation, workflow coordinators in UseCase, and storage schema bindings in DataAccess. If a symbol is primarily a typed data contract used across layers, prefer DomainModel.",
  examples: [
    "export interface Invoice { readonly id: InvoiceId; readonly lines: ReadonlyArray<LineItem>; readonly currency: Currency }",
    "export type UserId = string & { readonly UserId: unique symbol }",
  ],
  counterExamples: [
    "export const InvoiceSchema = S.Struct({ ... }) belongs to Validation",
    "export const invoice = pgTable('invoice', { ... }) belongs to DataAccess",
  ],
  typicalSyntaxKinds: [
    "InterfaceDeclaration",
    "TypeAliasDeclaration",
    "EnumDeclaration",
    "ClassDeclaration",
    "PropertySignature",
  ],
  astSignals: [
    {
      signal: "File imports avoid framework and IO adapters",
      confidence: 0.7,
      detection:
        "node.getSourceFile().getImportDeclarations().every((decl) => !/react|next|express|hono|drizzle-orm|prisma|@effect\\/schema|zod/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Branded or opaque type pattern indicating domain identity",
      confidence: 0.8,
      detection:
        "Node.isTypeAliasDeclaration(node) && /\\{ readonly \\w+: unique symbol \\}|Brand|Opaque/.test(node.getText())",
    },
  ],
  effectAnalog: "Identity",
  architecturalLayers: ["DomainEntity", "Core"],
  purity: "pure",
  adjacentCategories: [
    "DomainLogic",
    "Validation",
    "Utility",
    "TransportContract", // Forward-declaration: see design decision #6
  ],
  typicalImportPatterns: ["**/domain/**/*.ts", "**/model/**/*.ts", "**/entities/**/*.ts"],
  dependencyProfile: { typicalFanIn: "high", typicalFanOut: "low" },
  documentationPriority: 1,
}).pipe(
  $I.annoteSchema("DomainModel", {
    description: "Literal schema for DomainModel category.",
  })
);
type DomainModel = typeof DomainModel.Type;

const DomainLogic = make("DomainLogic", {
  definition:
    "Pure domain rules and transformations that operate on domain models without infrastructure side effects.",
  classificationGuidance:
    "Use DomainLogic for deterministic computations such as policies, pricing rules, normalization logic, and invariant checks that do not perform IO. If code orchestrates multiple dependencies, classify as UseCase. If code validates external payloads, classify as Validation. If code is framework-neutral but generic across many domains, classify as Utility. Tiebreaker: when a pure function takes domain-typed parameters (branded types, types from **/domain/** paths, or types appearing in DomainModel categories) AND returns a domain-typed result, prefer DomainLogic over Utility.",
  examples: [
    "export const computeInvoiceTotal = (invoice: Invoice): Money => ...",
    "export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => ...",
  ],
  counterExamples: [
    "export const createOrderUseCase = Effect.fn(...) belongs to UseCase",
    "export const trimAndCompact = (input: string) => ... belongs to Utility",
  ],
  typicalSyntaxKinds: [
    "FunctionDeclaration",
    "ArrowFunction",
    "MethodDeclaration",
    "BinaryExpression",
    "ReturnStatement",
  ],
  astSignals: [
    {
      signal: "Pure callable with no await and no Promise or Effect return",
      confidence: 0.8,
      detection:
        "Node.isFunctionDeclaration(node) && !node.getDescendantsOfKind(SyntaxKind.AwaitExpression).length && !/^(Promise|Effect)</.test(node.getReturnType().getText())",
    },
    {
      signal: "Business-rule naming and domain-type parameters",
      confidence: 0.72,
      detection:
        "/(calculate|compute|derive|normalize|isValid|can)/.test(node.getSymbol()?.getName() ?? '') && node.getParameters().some((param) => /Id|Status|Amount|Domain/.test(param.getType().getText()))",
    },
    {
      signal: "Parameters reference domain-typed symbols (branded, enum, or domain-path types)",
      confidence: 0.65,
      detection:
        "Node.isFunctionDeclaration(node) && node.getParameters().some(p => /Id|Status|Amount|Price|Currency|Score/.test(p.getType().getText()) || p.getType().getSymbol()?.getDeclarations()?.some(d => /domain|model|entities/.test(d.getSourceFile().getFilePath())))",
    },
    {
      signal: "Return type references domain-typed symbols (branded, enum, or domain-path types)",
      confidence: 0.65,
      detection:
        "Node.isFunctionDeclaration(node) && (/Id|Status|Amount|Price|Currency|Score/.test(node.getReturnType().getText()) || node.getReturnType().getSymbol()?.getDeclarations()?.some(d => /domain|model|entities/.test(d.getSourceFile().getFilePath())))",
    },
  ],
  effectAnalog: "Either",
  architecturalLayers: ["Core"],
  purity: "pure",
  adjacentCategories: ["DomainModel", "UseCase", "Validation", "Utility"],
  typicalImportPatterns: ["**/domain/**/*.ts", "**/policies/**/*.ts", "**/rules/**/*.ts"],
  dependencyProfile: { typicalFanIn: "high", typicalFanOut: "low" },
  documentationPriority: 2,
}).pipe(
  $I.annoteSchema("DomainLogic", {
    description: "Literal schema for DomainLogic category.",
  })
);
type DomainLogic = typeof DomainLogic.Type;

const PortContract = make("PortContract", {
  definition: "Abstract capability contracts that define how core and UseCase logic talks to external dependencies.",
  classificationGuidance:
    "Assign PortContract to interfaces and type contracts describing repositories, gateways, or service boundaries with no concrete implementation details. If the symbol includes concrete persistence or API client logic, use DataAccess or Integration instead. If it orchestrates work using ports, use UseCase.",
  examples: [
    "export interface UserRepositoryPort { findById(id: UserId): Effect.Effect<Option<User>, RepoError> }",
    "export type MailGateway = { readonly send: (input: MailMessage) => Promise<void> }",
  ],
  counterExamples: [
    "export class PrismaUserRepository implements UserRepositoryPort belongs to DataAccess",
    "export const sendWelcomeEmailUseCase = ... belongs to UseCase",
  ],
  typicalSyntaxKinds: [
    "InterfaceDeclaration",
    "TypeAliasDeclaration",
    "MethodSignature",
    "CallSignature",
    "ConstructSignature",
  ],
  astSignals: [
    {
      signal: "Interface names ending in Port, Repository, or Gateway",
      confidence: 0.75,
      detection: "Node.isInterfaceDeclaration(node) && /(Port|Repository|Gateway)$/.test(node.getName() ?? '')",
    },
    {
      signal: "Interface with port-style naming AND effectful method signatures",
      confidence: 0.9,
      detection:
        "Node.isInterfaceDeclaration(node) && /(Port|Repository|Gateway|Store|Client)$/.test(node.getName() ?? '') && node.getMembers().some(m => Node.isMethodSignature(m) && /Effect<|Promise<|Observable<|Task</.test(m.getReturnType().getText()))",
    },
    {
      signal: "Interface with async or effectful method signatures",
      confidence: 0.8,
      detection:
        "Node.isInterfaceDeclaration(node) && node.getMembers().some(m => Node.isMethodSignature(m) && /Effect<|Promise<|Observable<|Task</.test(m.getReturnType().getText()))",
    },
    {
      signal: "Type alias describing a service record with effectful methods",
      confidence: 0.75,
      detection:
        "Node.isTypeAliasDeclaration(node) && /\\{[^}]*:\\s*(\\([^)]*\\)\\s*=>\\s*(Effect|Promise|Observable))/.test(node.getText())",
    },
  ],
  effectAnalog: "Reader",
  architecturalLayers: ["Port", "InterfaceAdapter"],
  purity: "pure",
  adjacentCategories: ["UseCase", "DataAccess", "Integration"],
  typicalImportPatterns: ["**/*Port.ts", "**/*Repository.ts", "**/*Gateway.ts"],
  dependencyProfile: { typicalFanIn: "high", typicalFanOut: "low" },
  documentationPriority: 4,
}).pipe(
  $I.annoteSchema("PortContract", {
    description: "Literal schema for PortContract category.",
  })
);
type PortContract = typeof PortContract.Type;

const Validation = make("Validation", {
  definition:
    "Boundary parsing, schema validation, and normalization that converts unknown input into trusted typed values.",
  classificationGuidance:
    "Choose Validation for schema definitions, decoders, parser functions, and boundary guards that verify shape, type, and constraints. Do not use Validation for domain entities alone (DomainModel), workflow orchestration (UseCase), or UI request/response handling (Presentation). Validation can be pure or effectful depending on parser runtime.",
  examples: [
    "export const AgentTaskSpecSchema = S.Struct({ ... })",
    "export const parseCreateUser = (input: unknown) => CreateUserSchema.safeParse(input)",
  ],
  counterExamples: [
    "export type AgentTaskSpec = { ... } belongs to DomainModel",
    "export async function post(request: Request) { ... } belongs to Presentation",
  ],
  typicalSyntaxKinds: [
    "VariableDeclaration",
    "FunctionDeclaration",
    "TypeAliasDeclaration",
    "CallExpression",
    "PropertyAssignment",
  ],
  astSignals: [
    {
      signal: "Imports schema-validation libraries",
      confidence: 0.9,
      detection:
        "node.getSourceFile().getImportDeclarations().some((decl) => /@effect\\/schema|effect\\/Schema|zod|valibot|arktype/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Decoder or parser call patterns on unknown input",
      confidence: 0.75,
      detection:
        "node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpr) => /(decode|parse|safeParse|validate)/.test(callExpr.getExpression().getText()))",
    },
  ],
  effectAnalog: "Either",
  architecturalLayers: ["InterfaceAdapter", "CrossCutting"],
  purity: "mixed",
  adjacentCategories: ["DomainModel", "UseCase", "Presentation"],
  typicalImportPatterns: ["@effect/schema*", "effect/Schema*", "zod*", "valibot*", "arktype*", "**/schemas/**/*.ts"],
  dependencyProfile: { typicalFanIn: "medium", typicalFanOut: "low" },
  documentationPriority: 5,
}).pipe(
  $I.annoteSchema("Validation", {
    description: "Literal schema for Validation category.",
  })
);
type Validation = typeof Validation.Type;

const Utility = make("Utility", {
  definition: "Reusable generic helpers that are not specific to one domain workflow or infrastructure boundary.",
  classificationGuidance:
    "Classify as Utility when code provides cross-context helper behavior such as formatting, collection transforms, class name merging, and simple adapters. If helper logic encodes business policy, use DomainLogic. If helper configures runtime environment or framework behavior, use Configuration or CrossCutting. Tiebreaker: when parameters and return types are generic primitives or standard library types with no domain-specific branding, prefer Utility over DomainLogic.",
  examples: [
    "export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }",
    "export const chunk = <T>(items: ReadonlyArray<T>, size: number) => ...",
  ],
  counterExamples: [
    "export const calculateRiskScore = (...) => ... belongs to DomainLogic",
    "export const GraphitiConfig = S.Struct({ ...process.env }) belongs to Configuration",
  ],
  typicalSyntaxKinds: ["FunctionDeclaration", "ArrowFunction", "VariableDeclaration", "TypeAliasDeclaration"],
  astSignals: [
    {
      signal: "Utility file naming with no framework or data access imports",
      confidence: 0.75,
      detection:
        "/(utils|helpers)/.test(node.getSourceFile().getFilePath()) && node.getSourceFile().getImportDeclarations().every((decl) => !/react|next|express|hono|drizzle-orm|prisma|@effect\\/platform/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Helper callable declarations in utility modules stay synchronous",
      confidence: 0.72,
      detection:
        "/(utils|helpers)/.test(node.getSourceFile().getFilePath()) && (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node) || Node.isArrowFunction(node)) && !node.getDescendantsOfKind(SyntaxKind.AwaitExpression).length",
    },
  ],
  effectAnalog: "Identity",
  architecturalLayers: ["Core", "CrossCutting"],
  purity: "pure",
  adjacentCategories: ["DomainLogic", "DomainModel", "CrossCutting"],
  typicalImportPatterns: ["**/utils.ts", "**/helpers.ts", "**/lib/**/*.ts"],
  dependencyProfile: { typicalFanIn: "medium", typicalFanOut: "low" },
  documentationPriority: 6,
}).pipe(
  $I.annoteSchema("Utility", {
    description: "Literal schema for Utility category.",
  })
);
type Utility = typeof Utility.Type;

const UseCase = make("UseCase", {
  definition:
    "Application-level orchestration that coordinates domain logic, validation, and port interactions to fulfill business intents.",
  classificationGuidance:
    "Use UseCase for command or query handlers and workflow services that coordinate multiple operations and dependencies. If a symbol is mostly transport mapping (HTTP/UI), classify as Presentation. If it is a pure policy function, classify as DomainLogic. If it is a concrete adapter implementation, classify as DataAccess or Integration.",
  examples: [
    "export const createOrderUseCase = Effect.fn('CreateOrderUseCase')(function* (...) { ... })",
    "export async function inviteUserHandler(input: InviteUserInput): Promise<InviteUserResult> { ... }",
  ],
  counterExamples: [
    "export async function GET(request: NextRequest) { ... } belongs to Presentation",
    "export class HttpPaymentGateway { ... } belongs to Integration",
  ],
  typicalSyntaxKinds: ["FunctionDeclaration", "ArrowFunction", "CallExpression", "AwaitExpression", "ReturnStatement"],
  astSignals: [
    {
      signal: "Exported callable with UseCase, Handler, or Service suffix and async or Effect return",
      confidence: 0.8,
      detection:
        "node.getModifiers().some((modifier) => modifier.getText() === 'export') && /(UseCase|Handler|Service)$/.test(node.getSymbol()?.getName() ?? '') && /Effect<|Promise</.test(node.getReturnType().getText())",
    },
    {
      signal: "Workflow code invoking multiple dependent services or ports",
      confidence: 0.78,
      detection:
        "node.getDescendantsOfKind(SyntaxKind.CallExpression).length >= 2 && (node.getSourceFile().getImportDeclarations().some((decl) => /(Port|Repository|Gateway)/.test(decl.getModuleSpecifierValue())) || node.getText().includes('Effect.fn') || node.getText().includes('Effect.runPromise'))",
    },
  ],
  effectAnalog: "ReaderTaskEither",
  architecturalLayers: ["UseCase"],
  purity: "mixed",
  adjacentCategories: ["PortContract", "DomainLogic", "Presentation", "Integration", "DataAccess"],
  typicalImportPatterns: ["**/*UseCase.ts", "**/*Handler.ts", "**/application/**/*.ts"],
  dependencyProfile: { typicalFanIn: "medium", typicalFanOut: "high" },
  documentationPriority: 7,
}).pipe(
  $I.annoteSchema("UseCase", {
    description: "Literal schema for UseCase category.",
  })
);
type UseCase = typeof UseCase.Type;

const Presentation = make("Presentation", {
  definition: "Transport and UI surface code that handles requests, responses, rendering, and interaction flow.",
  classificationGuidance:
    "Classify as Presentation for React components, route handlers, controllers, page modules, and HTTP adapters that convert external requests to internal UseCase calls and map outputs back to transport formats. If the symbol is mostly schema parsing use Validation. If it is external service client wiring use Integration.",
  examples: [
    "export async function GET(request: NextRequest) { ... }",
    "export default function SignInPage() { return <Suspense fallback={null}>...</Suspense> }",
  ],
  counterExamples: [
    "export const GraphSearchRouteResponseSchema = S.Struct({ ... }) belongs to Validation",
    "export const searchGraph = Effect.fn(...)(...) belongs to UseCase",
  ],
  typicalSyntaxKinds: [
    "FunctionDeclaration",
    "ArrowFunction",
    "ClassDeclaration",
    "JsxElement",
    "VariableDeclaration",
    "ExportAssignment",
  ],
  astSignals: [
    {
      signal: "Framework imports from web and UI stacks",
      confidence: 0.75,
      detection:
        "node.getSourceFile().getImportDeclarations().some((decl) => /react|next|remix|astro|hono|express|fastify/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Framework imports AND component or route handler exports",
      confidence: 0.88,
      detection:
        "node.getSourceFile().getImportDeclarations().some((decl) => /react|next|remix|astro|hono|express|fastify/.test(decl.getModuleSpecifierValue())) && (() => { const sf = node.getSourceFile(); const hasJsx = sf.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 || sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0; const exportNames = Array.from(sf.getExportedDeclarations().keys()); const hasRouteExport = exportNames.some(name => /^(GET|POST|PUT|DELETE|PATCH|default|Page|Layout)$/.test(name)); return hasJsx || hasRouteExport; })()",
    },
    {
      signal: "Request or response handling signatures",
      confidence: 0.72,
      detection:
        "Node.isFunctionDeclaration(node) && /(request|response|NextRequest|NextResponse|Request|Response)/.test(node.getText())",
    },
  ],
  effectAnalog: "IO",
  architecturalLayers: ["InterfaceAdapter", "FrameworkDriver"],
  purity: "effectful",
  adjacentCategories: ["UseCase", "Validation", "Integration", "Configuration"],
  typicalImportPatterns: ["next/*", "react*", "**/app/**/page.tsx", "**/api/**/route.ts"],
  dependencyProfile: { typicalFanIn: "medium", typicalFanOut: "high" },
  documentationPriority: 8,
}).pipe(
  $I.annoteSchema("Presentation", {
    description: "Literal schema for Presentation category.",
  })
);
type Presentation = typeof Presentation.Type;

const DataAccess = make("DataAccess", {
  definition: "Persistence adapters and data-mapping logic that interact with databases and storage engines.",
  classificationGuidance:
    "Use DataAccess for table schemas, repository implementations, query builders, and persistence mappers. If code talks to third-party APIs rather than persistence stores, use Integration. If it only defines data contracts, use DomainModel. DataAccess is usually effectful and adapter-layer oriented.",
  examples: [
    "export const user = pgTable('user', { ... })",
    "export class UserRepositoryDrizzle implements UserRepositoryPort { ... }",
  ],
  counterExamples: [
    "export interface UserRepositoryPort { ... } belongs to PortContract",
    "export const OpenAIClient = new OpenAI(...) belongs to Integration",
  ],
  typicalSyntaxKinds: [
    "VariableDeclaration",
    "FunctionDeclaration",
    "ClassDeclaration",
    "MethodDeclaration",
    "PropertyAssignment",
  ],
  astSignals: [
    {
      signal: "Database or ORM imports",
      confidence: 0.9,
      detection:
        "node.getSourceFile().getImportDeclarations().some((decl) => /drizzle-orm|prisma|typeorm|kysely|@effect\\/sql|pg|mongodb/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Query, transaction, or table-definition API usage",
      confidence: 0.75,
      detection:
        "node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpr) => /(pgTable|select|insert|update|delete|transaction|query)/.test(callExpr.getExpression().getText()))",
    },
  ],
  effectAnalog: "State",
  architecturalLayers: ["Adapter", "FrameworkDriver"],
  purity: "effectful",
  adjacentCategories: ["PortContract", "UseCase", "Integration", "Configuration"],
  typicalImportPatterns: ["drizzle-orm*", "prisma*", "**/db/**/*.ts", "**/repository/**/*.ts"],
  dependencyProfile: { typicalFanIn: "low", typicalFanOut: "medium" },
  documentationPriority: 9,
}).pipe(
  $I.annoteSchema("DataAccess", {
    description: "Literal schema for DataAccess category.",
  })
);
type DataAccess = typeof DataAccess.Type;

const Integration = make("Integration", {
  definition:
    "Adapters for external systems and third-party services such as APIs, queues, payment providers, and AI backends.",
  classificationGuidance:
    "Assign Integration when code encapsulates outbound communication with systems outside the local runtime and persistence boundary. Use DataAccess for databases and storage. Use Presentation for inbound HTTP or UI boundary handlers. Use UseCase for orchestration that consumes integrations.",
  examples: [
    "export const openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })",
    "export class StripeBillingGateway { async charge(...) { ... } }",
  ],
  counterExamples: [
    "export const account = pgTable('account', { ... }) belongs to DataAccess",
    "export async function POST(request: Request) { ... } belongs to Presentation",
  ],
  typicalSyntaxKinds: ["ClassDeclaration", "MethodDeclaration", "NewExpression", "AwaitExpression", "CallExpression"],
  astSignals: [
    {
      signal: "External SDK or HTTP client imports",
      confidence: 0.8,
      detection:
        "node.getSourceFile().getImportDeclarations().some((decl) => /openai|anthropic|resend|stripe|@aws-sdk|axios|fetch|undici/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Explicit outbound fetch or request construction",
      confidence: 0.72,
      detection:
        "node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpr) => /fetch|request|post|get|put/.test(callExpr.getExpression().getText()))",
    },
  ],
  effectAnalog: "IO",
  architecturalLayers: ["Adapter", "FrameworkDriver"],
  purity: "effectful",
  adjacentCategories: ["UseCase", "Presentation", "DataAccess", "Configuration"],
  typicalImportPatterns: ["openai*", "stripe*", "@aws-sdk/*", "**/client.ts", "**/gateway/**/*.ts"],
  dependencyProfile: { typicalFanIn: "low", typicalFanOut: "medium" },
  documentationPriority: 10,
}).pipe(
  $I.annoteSchema("Integration", {
    description: "Literal schema for Integration category.",
  })
);
type Integration = typeof Integration.Type;

const Configuration = make("Configuration", {
  definition: "Environment, wiring, and runtime setup that determines how services are instantiated and composed.",
  classificationGuidance:
    "Use Configuration for environment decoding, settings modules, dependency-layer assembly, and runtime bootstrap wiring. Avoid using Configuration for domain contracts (DomainModel), business workflows (UseCase), or generic logging wrappers (CrossCutting) unless the symbol's primary role is setup and composition.",
  examples: [
    "export const AppConfig = S.Struct({ DATABASE_URL: S.NonEmptyString })",
    "export const LiveLayer = Layer.mergeAll(DatabaseLive, LoggerLive, GraphitiLive)",
  ],
  counterExamples: [
    "export const logger = Logger.withSpan(...) belongs to CrossCutting",
    "export const createOrderUseCase = ... belongs to UseCase",
  ],
  typicalSyntaxKinds: [
    "VariableDeclaration",
    "FunctionDeclaration",
    "PropertyAssignment",
    "CallExpression",
    "PropertyAccessExpression",
  ],
  astSignals: [
    {
      signal: "Environment variable reads or config naming",
      confidence: 0.85,
      detection:
        "node.getText().includes('process.env') || node.getText().includes('Bun.env') || /(Config|Configuration|Settings|Env)/.test(node.getSymbol()?.getName() ?? '')",
    },
    {
      signal: "Dependency wiring and layer composition patterns",
      confidence: 0.72,
      detection:
        "node.getSourceFile().getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => /(Layer|provide|make)/.test(identifier.getText()))",
    },
  ],
  effectAnalog: "Reader",
  architecturalLayers: ["FrameworkDriver", "CrossCutting"],
  purity: "mixed",
  adjacentCategories: ["Integration", "DataAccess", "Presentation", "CrossCutting"],
  typicalImportPatterns: ["**/config/**/*.ts", "**/*Config.ts", "**/*Settings.ts", "**/env/**/*.ts"],
  dependencyProfile: { typicalFanIn: "high", typicalFanOut: "medium" },
  documentationPriority: 3,
}).pipe(
  $I.annoteSchema("Configuration", {
    description: "Literal schema for Configuration category.",
  })
);
type Configuration = typeof Configuration.Type;

const CrossCutting = make("CrossCutting", {
  definition:
    "Shared operational concerns that span multiple layers, such as auth, logging, tracing, metrics, and caching.",
  classificationGuidance:
    "Use CrossCutting for behavior that is orthogonal to one business use case and is intentionally reused across layers. If logic is specific to one workflow, use UseCase. If code primarily configures runtime settings, use Configuration. If code only formats data with no operational concern, use Utility.",
  examples: [
    "export const withRequestLogging = <A>(effect: Effect.Effect<A, E, R>) => ...",
    "export const authMiddleware = (request: Request) => ...",
  ],
  counterExamples: [
    "export const cn = (...inputs) => ... belongs to Utility",
    "export const graphSearchRoute = async (...) => ... belongs to Presentation",
  ],
  typicalSyntaxKinds: [
    "FunctionDeclaration",
    "ArrowFunction",
    "MethodDeclaration",
    "CallExpression",
    "VariableDeclaration",
  ],
  astSignals: [
    {
      signal: "Imports for auth, logging, metrics, tracing, or cache modules",
      confidence: 0.75,
      detection:
        "node.getSourceFile().getImportDeclarations().some((decl) => /auth|logger|pino|winston|otel|opentelemetry|metrics|cache|redis/.test(decl.getModuleSpecifierValue()))",
    },
    {
      signal: "Operational concern naming in exported symbol",
      confidence: 0.7,
      detection: "/(Auth|Logger|Log|Trace|Metric|Cache|Audit|Telemetry)/.test(node.getSymbol()?.getName() ?? '')",
    },
  ],
  effectAnalog: "Writer",
  architecturalLayers: ["CrossCutting"],
  purity: "mixed",
  adjacentCategories: ["Configuration", "Utility", "Presentation", "UseCase"],
  typicalImportPatterns: ["**/middleware/**/*.ts", "**/logger/**/*.ts", "**/auth/**/*.ts", "**/metrics/**/*.ts"],
  dependencyProfile: { typicalFanIn: "medium", typicalFanOut: "medium" },
  documentationPriority: 11,
}).pipe(
  $I.annoteSchema("CrossCutting", {
    description: "Literal schema for CrossCutting category.",
  })
);
type CrossCutting = typeof CrossCutting.Type;

const Uncategorized = make("Uncategorized", {
  definition:
    "Fallback category for elements that remain ambiguous after deterministic signals and boundary-context rules.",
  classificationGuidance:
    "Use Uncategorized only as a last resort. First classify by nearest exportable ancestor for statement/expression/signature nodes. If no ancestor applies, use source-file dominant category. Only assign Uncategorized when combined confidence for known categories remains below 0.45 or signals are contradictory without a clear winner.",
  examples: [
    "Generated shim modules with mixed declarations and no stable semantic role",
    "Ad hoc migration scratch files that blend setup, data transformation, and one-off scripts",
  ],
  counterExamples: [
    "Any symbol with a stable dominant concern (validation, data access, presentation, use case, etc.) should use that concrete category",
    "A file path ending in /utils.ts with pure helpers belongs to Utility, not Uncategorized",
  ],
  typicalSyntaxKinds: ["SourceFile", "VariableDeclaration", "ExpressionStatement"],
  astSignals: [
    {
      signal: "No known category exceeds fallback confidence threshold",
      confidence: 1,
      detection: "Node.isSourceFile(node) && scoredCandidates.every((entry) => entry.combinedConfidence < 0.45)",
    },
  ],
  effectAnalog: null,
  architecturalLayers: ["CrossCutting"],
  purity: "mixed",
  adjacentCategories: [
    "DomainModel",
    "DomainLogic",
    "PortContract",
    "Validation",
    "Utility",
    "UseCase",
    "Presentation",
    "DataAccess",
    "Integration",
    "Configuration",
    "CrossCutting",
  ],
  typicalImportPatterns: [],
  dependencyProfile: { typicalFanIn: "low", typicalFanOut: "low" },
  documentationPriority: 99,
}).pipe(
  $I.annoteSchema("Uncategorized", {
    description: "Literal schema for Uncategorized category.",
  })
);
type Uncategorized = typeof Uncategorized.Type;

/**
 * Strict literal union for all supported TypeDoc `@category` values.
 *
 * **Example** (Use category tag enum)
 *
 * ```ts
 * import { TSCategoryTag } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * const tag = TSCategoryTag.Enum.Utility
 * console.log(TSCategoryTag.is.Utility(tag))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TSCategoryTag = LiteralKit([
  DomainModel.literal,
  DomainLogic.literal,
  PortContract.literal,
  Validation.literal,
  Utility.literal,
  UseCase.literal,
  Presentation.literal,
  DataAccess.literal,
  Integration.literal,
  Configuration.literal,
  CrossCutting.literal,
  Uncategorized.literal,
]).pipe(
  $I.annoteSchema("TSCategoryTag", {
    description: "Strict literal union for all supported TypeDoc @category values.",
  })
);

/**
 * Inferred type for {@link TSCategoryTag}.
 *
 * **Example** (Constrain with category type)
 *
 * ```ts
 * import type { TSCategoryTag } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * type Example = TSCategoryTag
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSCategoryTag =
  | "DomainModel"
  | "DomainLogic"
  | "PortContract"
  | "Validation"
  | "Utility"
  | "UseCase"
  | "Presentation"
  | "DataAccess"
  | "Integration"
  | "Configuration"
  | "CrossCutting"
  | "Uncategorized";

const CATEGORY_TAG_OPTIONS: ReadonlyArray<TSCategoryTag> = [
  "DomainModel",
  "DomainLogic",
  "PortContract",
  "Validation",
  "Utility",
  "UseCase",
  "Presentation",
  "DataAccess",
  "Integration",
  "Configuration",
  "CrossCutting",
  "Uncategorized",
];

const CATEGORY_TAG_SCHEMAS = [
  DomainModel,
  DomainLogic,
  PortContract,
  Validation,
  Utility,
  UseCase,
  Presentation,
  DataAccess,
  Integration,
  Configuration,
  CrossCutting,
  Uncategorized,
] as const;

/**
 * Closed category taxonomy used by `@category` tags.
 *
 * **Example** (Logging taxonomy length)
 *
 * ```ts
 * import { CATEGORY_TAXONOMY } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(CATEGORY_TAXONOMY.length)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CATEGORY_TAXONOMY: ReadonlyArray<TSCategory> = pipe(
  CATEGORY_TAG_SCHEMAS,
  A.map((schema) =>
    pipe(
      getTSCategoryMetadata(schema),
      O.map((metadata) => Result.getOrThrow(S.encodeResult(TSCategoryDefinition)(metadata)))
    )
  ),
  A.getSomes
);

/**
 * All valid category tag values.
 *
 * **Example** (Accepting CategoryTag type)
 *
 * ```ts
 * import type { CategoryTag } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * type Example = CategoryTag
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CategoryTag = TSCategoryTag;

const UNCATEGORIZED_CATEGORY_TAG: CategoryTag = "Uncategorized";

/**
 * Deterministic precedence for external classifier conflict resolution.
 *
 * **Details**
 *
 * Ordering rationale - most-specific signals win:
 *   1. Library-specific imports (Validation, DataAccess, Integration) -
 *      schema/ORM/SDK imports are near-unambiguous signals.
 *   2. Structural patterns (Presentation, UseCase) -
 *      framework imports + structural shape are strong but broader.
 *   3. Naming and convention patterns (PortContract, Configuration, CrossCutting) -
 *      rely on naming heuristics which are project-dependent.
 *   4. Residual categories (DomainModel, DomainLogic, Utility) -
 *      identified by absence of other signals rather than presence.
 *   5. Uncategorized - last resort.
 *
 * This policy is intentionally separate from `getCandidateCategories`,
 * which preserves canonical sorting by confidence and `_tag`.
 *
 * **Example** (Checking Validation precedence)
 *
 * ```ts
 * import { CATEGORY_PRECEDENCE } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(CATEGORY_PRECEDENCE.includes("Validation"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CATEGORY_PRECEDENCE: ReadonlyArray<CategoryTag> = [
  "Validation",
  "DataAccess",
  "Integration",
  "Presentation",
  "UseCase",
  "PortContract",
  "Configuration",
  "CrossCutting",
  "DomainModel",
  "DomainLogic",
  "Utility",
  "Uncategorized",
];

/**
 * Explicit fallback policy for non-declaration nodes where direct classification
 * is ambiguous without structural context.
 *
 * **Example** (Reading fallback category)
 *
 * ```ts
 * import { CONTEXT_FALLBACK_POLICY } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(CONTEXT_FALLBACK_POLICY.fallbackCategory)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CONTEXT_FALLBACK_POLICY = {
  appliesTo: ["statement", "expression", "signature"],
  resolutionSteps: [
    "Classify by nearest exportable ancestor symbol first.",
    "If no ancestor applies, classify by source-file dominant category.",
    "If ambiguity remains or score is below guardrail, classify as Uncategorized.",
  ],
  fallbackCategory: "Uncategorized",
  threshold: UNCATEGORIZED_GUARDRAIL_THRESHOLD,
} as const;

/**
 * Complete routing table from `ApplicableTo` node intent to candidate categories.
 * This makes taxonomy completeness auditable against HasJSDoc surfaces.
 *
 * **Example** (Reading function routing entry)
 *
 * ```ts
 * import { APPLICABLE_TO_CATEGORY_ROUTING } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(APPLICABLE_TO_CATEGORY_ROUTING.function[0])
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const APPLICABLE_TO_CATEGORY_ROUTING: Readonly<Record<ApplicableTo, ReadonlyArray<CategoryTag>>> = {
  function: ["UseCase", "DomainLogic", "Validation", "Presentation", "Utility"],
  method: ["UseCase", "DomainLogic", "DataAccess", "Integration", "CrossCutting"],
  class: ["DomainModel", "UseCase", "DataAccess", "Integration", "Presentation", "CrossCutting"],
  classStaticBlock: ["Configuration", "CrossCutting"],
  interface: ["DomainModel", "PortContract"],
  typeAlias: ["DomainModel", "PortContract", "Validation", "Utility"],
  enum: ["DomainModel"],
  enumMember: ["DomainModel"],
  variable: ["Utility", "Validation", "Configuration", "DataAccess", "CrossCutting"],
  constant: ["Utility", "DomainModel", "Configuration", "CrossCutting"],
  property: ["DomainModel", "DataAccess", "Validation", "Configuration"],
  accessor: ["DomainModel", "DataAccess", "CrossCutting", "Presentation"],
  constructor: ["UseCase", "DataAccess", "Integration", "DomainModel"],
  parameter: ["UseCase", "Validation", "Presentation", "DomainLogic"],
  signature: ["PortContract", "DomainLogic", "UseCase", "Validation"],
  indexSignature: ["DomainModel", "PortContract"],
  typeParameter: ["DomainModel", "Utility", "Validation"],
  tupleMember: ["DomainModel"],
  exportSpecifier: ["Presentation", "UseCase", "Utility", "Configuration"],
  identifier: ["Uncategorized", "Utility", "DomainModel", "CrossCutting"],
  statement: ["Presentation", "UseCase", "CrossCutting", "Uncategorized"],
  expression: ["DomainLogic", "Validation", "Presentation", "Integration", "Uncategorized"],
  module: ["Configuration", "Presentation", "UseCase", "Integration"],
  namespace: ["Configuration", "DomainModel"],
  file: ["Configuration", "Presentation", "DataAccess", "Uncategorized"],
  event: ["CrossCutting", "Presentation"],
  mixin: ["CrossCutting", "Presentation", "Integration"],
  any: ["Uncategorized"],
};

const CATEGORY_TAXONOMY_RUNTIME: ReadonlyArray<TSCategory> = CATEGORY_TAXONOMY;

const clampConfidence = (confidence: number): number =>
  globalThis.Number.isFinite(confidence) ? globalThis.Math.max(0, globalThis.Math.min(1, confidence)) : 0;

/**
 * Combine multiple signal confidences using the noisy-OR formula:
 *   1 - Π(1 - c_i)
 *
 * Assumes signal independence. Correlated signals (e.g., two signals
 * both triggered by the same import declaration) will produce inflated
 * combined confidence. Callers should prefer structurally independent
 * detection criteria when designing AST signals.
 *
 * @param confidences - Individual signal confidence scores to combine.
 * @returns Combined confidence score clamped to the inclusive range [0, 1].
 * @category utilities
 * @since 0.0.0
 */
const combineSignalConfidences: (confidences: ReadonlyArray<number>) => number = flow(
  A.reduce(0, (combined, confidence) => {
    const clamped = clampConfidence(confidence);
    return 1 - (1 - combined) * (1 - clamped);
  })
);

/**
 * Get deterministic conflict precedence rank for a category tag.
 *
 * **Example** (Ranking Validation precedence)
 *
 * ```ts
 * import { getCategoryPrecedence } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(getCategoryPrecedence("Validation"))
 * ```
 *
 * @param tag - Category tag to rank by conflict precedence.
 * @returns Zero-based precedence index, or the list length when absent.
 * @category utilities
 * @since 0.0.0
 */
export function getCategoryPrecedence(tag: CategoryTag): number {
  return pipe(
    CATEGORY_PRECEDENCE,
    A.findFirstIndex((candidate) => candidate === tag),
    O.getOrElse(() => CATEGORY_PRECEDENCE.length)
  );
}

/**
 * Lookup a category by `_tag`.
 *
 * **Example** (Resolving Utility category tag)
 *
 * ```ts
 * import { getCategory } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(getCategory("Utility"))?._tag)
 * ```
 *
 * @param tag - Category tag identifier to resolve.
 * @returns Matching category definition, when present.
 * @category utilities
 * @since 0.0.0
 */
export function getCategory(tag: TSCategoryTag): O.Option<TSCategory> {
  return pipe(
    CATEGORY_TAXONOMY_RUNTIME,
    A.findFirst((category) => category._tag === tag)
  );
}

/**
 * Get categories by purity classification.
 *
 * **Example** (Counting pure categories)
 *
 * ```ts
 * import { getCategoriesByPurity } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(getCategoriesByPurity("pure").length)
 * ```
 *
 * @param purity - Purity value used to filter the taxonomy.
 * @returns Categories whose `purity` matches the requested value.
 * @category utilities
 * @since 0.0.0
 */
export function getCategoriesByPurity(purity: TSCategory["purity"]): ReadonlyArray<TSCategory> {
  return pipe(
    CATEGORY_TAXONOMY_RUNTIME,
    A.filter((category) => category.purity === purity)
  );
}

/**
 * Get categories by architectural layer.
 *
 * **Example** (Counting Core layer categories)
 *
 * ```ts
 * import { getCategoriesByArchLayer } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(getCategoriesByArchLayer("Core").length)
 * ```
 *
 * @param layer - Architectural layer used to filter taxonomy members.
 * @returns Categories mapped to the provided architectural layer.
 * @category utilities
 * @since 0.0.0
 */
export function getCategoriesByArchLayer(layer: ArchitecturalLayerValue): ReadonlyArray<TSCategory> {
  return pipe(
    CATEGORY_TAXONOMY_RUNTIME,
    A.filter((category) =>
      pipe(
        category.architecturalLayers,
        A.some((archLayer) => archLayer === layer)
      )
    )
  );
}

/**
 * Get categories by Effect or monad analog.
 *
 * **Example** (Counting Reader analog categories)
 *
 * ```ts
 * import { getCategoriesByEffectAnalog } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(getCategoriesByEffectAnalog("Reader").length)
 * ```
 *
 * @param analog - Effect or monad analog label to match.
 * @returns Categories whose `effectAnalog` equals the provided label.
 * @category utilities
 * @since 0.0.0
 */
export function getCategoriesByEffectAnalog(analog: string): ReadonlyArray<TSCategory> {
  return pipe(
    CATEGORY_TAXONOMY_RUNTIME,
    A.filter((category) => category.effectAnalog === analog)
  );
}

/**
 * Get ordered candidate categories for an `ApplicableTo` node intent.
 *
 * **Example** (Counting function candidates)
 *
 * ```ts
 * import { getCategoriesForApplicableTo } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * console.log(getCategoriesForApplicableTo("function").length)
 * ```
 *
 * @param applicableTo - Node intent routed to taxonomy candidates.
 * @returns Categories in routing-table order, excluding unknown tags.
 * @category utilities
 * @since 0.0.0
 */
export function getCategoriesForApplicableTo(applicableTo: ApplicableTo): ReadonlyArray<TSCategory> {
  return pipe(APPLICABLE_TO_CATEGORY_ROUTING[applicableTo], A.map(getCategory), A.getSomes);
}

/**
 * Category signal tuple consumed by candidate resolution.
 *
 * **Example** (Creating validation signal)
 *
 * ```ts
 * import { CategorySignal } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 * const signal = CategorySignal.make({ category: "Validation", confidence: 0.9 })
 * console.log(signal.category)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CategorySignal extends S.Class<CategorySignal>($I`CategorySignal`)(
  {
    category: TSCategoryTag.annotateKey({
      description: "Category tag suggested by an AST signal.",
    }),
    confidence: ASTSignal.fields.confidence.annotateKey({
      description: "Confidence for this category signal.",
    }),
  },
  $I.annote("CategorySignal", {
    description: "Category signal tuple consumed by candidate resolution.",
  })
) {}

/**
 * Scored category candidate shape produced by candidate resolution.
 *
 * **Example** (Building scored candidate)
 *
 * ```ts
 * import { ScoredCategoryCandidate, getCategory } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 * import * as O from "effect/Option"
 * const candidate = ScoredCategoryCandidate.make({
 *   category: O.getOrThrow(getCategory("Validation")),
 *   combinedConfidence: 0.9
 * })
 * console.log(candidate.combinedConfidence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScoredCategoryCandidate extends S.Class<ScoredCategoryCandidate>($I`ScoredCategoryCandidate`)(
  {
    category: EncodedTSCategoryDefinition.annotateKey({
      description: "Encoded category metadata selected as a candidate.",
    }),
    combinedConfidence: ASTSignal.fields.confidence.annotateKey({
      description: "Combined confidence after merging all signals for the category.",
    }),
  },
  $I.annote("ScoredCategoryCandidate", {
    description: "Scored category candidate shape produced by candidate resolution.",
  })
) {}

const scoredCategoryCandidateOrder = Order.make<ScoredCategoryCandidate>((left, right) => {
  if (left.combinedConfidence > right.combinedConfidence) {
    return -1;
  }

  if (left.combinedConfidence < right.combinedConfidence) {
    return 1;
  }

  return Order.String(left.category._tag, right.category._tag);
});

/**
 * Get categories whose AST signals could match a code element.
 * Unknown categories are ignored.
 *
 * **Details**
 *
 * Sorting policy:
 * 1) `combinedConfidence` descending
 * 2) `_tag` ascending
 *
 * `CATEGORY_PRECEDENCE` is intentionally NOT used here.
 * It is an external conflict policy for classifier flows.
 *
 * Combined confidence formula:
 *   1 - Π(1 - c_i)
 *
 * **Example** (Scoring Validation candidates)
 *
 * ```ts
 * import { getCandidateCategories } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * const candidates = getCandidateCategories([{ category: "Validation", confidence: 0.9 }])
 * console.log(candidates[0]?.category._tag)
 * ```
 *
 * @param signals - Category signal tuples with confidence values.
 * @returns Candidate categories sorted by confidence and tag.
 * @category utilities
 * @since 0.0.0
 */
export function getCandidateCategories(signals: ReadonlyArray<CategorySignal>): ReadonlyArray<ScoredCategoryCandidate> {
  const grouped = pipe(
    signals,
    A.groupBy((signal) => String(signal.category))
  );

  return pipe(
    CATEGORY_TAG_OPTIONS,
    A.map((tag) =>
      pipe(
        R.get(grouped, tag),
        O.flatMap((categorySignals) =>
          pipe(
            getCategory(tag),
            O.map((category) =>
              ScoredCategoryCandidate.make({
                category,
                combinedConfidence: combineSignalConfidences(
                  pipe(
                    categorySignals,
                    A.map((signal) => signal.confidence)
                  )
                ),
              })
            )
          )
        )
      )
    ),
    A.getSomes,
    A.sort(scoredCategoryCandidateOrder)
  );
}

/**
 * Resolve category for non-declaration AST nodes using context fallback policy.
 *
 * **Details**
 *
 * Resolution order:
 * 1. Classify by nearest exportable ancestor symbol
 * 2. Fall back to source-file dominant category
 * 3. Return Uncategorized if below guardrail threshold
 *
 * This is a stub - the actual implementation will need ts-morph node
 * traversal that depends on the extraction pipeline architecture.
 * The stub documents the contract and makes the fallback policy executable.
 *
 * **Example** (Resolving Utility fallback)
 *
 * ```ts
 * import { resolveContextFallback } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * const category = resolveContextFallback([], undefined, "Utility")
 * console.log(category)
 * ```
 *
 * @param scoredCandidates - Ranked category candidates derived from AST signals.
 * @param ancestorCategory - Nearest ancestor category, if available.
 * @param sourceFileDominantCategory - Dominant category inferred from the source file.
 * @returns Resolved category tag using fallback precedence and guardrail policy.
 * @category utilities
 * @since 0.0.0
 */
export const resolveContextFallback: {
  (
    ancestorCategory?: CategoryTag,
    sourceFileDominantCategory?: CategoryTag
  ): (scoredCandidates: ReadonlyArray<ScoredCategoryCandidate>) => CategoryTag;
  (
    scoredCandidates: ReadonlyArray<ScoredCategoryCandidate>,
    ancestorCategory?: CategoryTag,
    sourceFileDominantCategory?: CategoryTag
  ): CategoryTag;
} = dual(
  (args) => A.isArray(args[0]),
  (
    scoredCandidates: ReadonlyArray<ScoredCategoryCandidate>,
    ancestorCategory?: CategoryTag,
    sourceFileDominantCategory?: CategoryTag
  ): CategoryTag => {
    const resolvedAncestor = pipe(
      ancestorCategory,
      O.fromUndefinedOr,
      O.filter((category) => category !== UNCATEGORIZED_CATEGORY_TAG)
    );

    if (O.isSome(resolvedAncestor)) {
      return resolvedAncestor.value;
    }

    const resolvedSourceFileDominant = pipe(
      sourceFileDominantCategory,
      O.fromUndefinedOr,
      O.filter((category) => category !== UNCATEGORIZED_CATEGORY_TAG)
    );

    if (O.isSome(resolvedSourceFileDominant)) {
      return resolvedSourceFileDominant.value;
    }

    return pipe(
      scoredCandidates,
      A.head,
      O.filter((candidate) => candidate.combinedConfidence >= UNCATEGORIZED_GUARDRAIL_THRESHOLD),
      O.map((candidate) => candidate.category._tag),
      O.getOrElse(() => UNCATEGORIZED_CATEGORY_TAG)
    );
  }
);

/**
 * The TypeScript Category Tag
 *
 * **Example** (Decoding Utility category tag)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Category } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * const category = S.decodeUnknownSync(Category)("Utility")
 * console.log(category)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Category = S.Union(CATEGORY_TAG_SCHEMAS).pipe(
  SchemaUtils.withStatics((self) => ({
    decodeUnknown: S.decodeUnknownEffect(self),
  })),
  $I.annoteSchema("Category", {
    description: "A TypeScript category tag, representing a categorization of TypeScript constructs.",
  })
);

/**
 * Type for {@link Category}.
 *
 * **Example** (Accepting Category type)
 *
 * ```ts
 * import type { Category } from "@beep/repo-utils/JSDoc/models/TSCategory.model"
 *
 * type Example = Category
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Category = typeof Category.Type;
