# JSDoc Tag Database — Fibration Refactor & Agent Pipeline Architecture

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

## Status

ARCHITECTURAL DECISION RECORD — Captures design decisions from collaborative sessions (2026-03-01 through 2026-03-02). The Grothendieck fibration is **already implemented** via `JSDocTagDefinition.make()` + `mapFields` + `.annotate()`. Remaining work: pipeline metadata annotations, `toAgentOutputSchema`, agent pipeline, MCP server. Integrates with `repo-codegraph-canonical` spec (P1–P4 phases).

---

## 1. The Core Insight: Grothendieck Fibration

### Problem (Solved)

The `JSDocTagDefinition` schema defines **constant metadata** for each tag kind — fields like `overview`, `astDerivableNote`, `specifications`, `applicableTo`, `relatedTags`, `parameters` (syntax metadata), `example`, and `isDeprecated` are **fixed per tag kind** and do not vary between occurrences. A `@param` tag means the same thing whether extracted from `foo.ts` or `bar.ts`.

Without the fibration, this is a **dependent sum (Σ-type)** where every instance is a pair of `(tag discriminant, metadata + payload)`, but the metadata component is a **definitional function** of the discriminant — it adds no information beyond what the discriminant already determines.

**The `JSDocTagDefinition.make()` factory already solves this** via `mapFields` + `.annotate()`. This section documents the theory behind the implementation for architectural continuity.

### Solution: Factor the Fibration

Transform the Σ-type into an **indexed family over a singleton base**:

- **Base category**: The schema with annotations (metadata lives here)
- **Fibers**: Decoded instances carry only `_tag` discriminant + `value` (the tag-specific occurrence shape)
- **Projection functor**: `S.resolveAnnotations(schema)?.jsDocTagMetadata` recovers metadata from the base

In Haskell terms:

```haskell
-- BEFORE: Fat product (metadata repeated per instance)
data JSDocTag = MkTag { _tag :: Tag, metadata :: Metadata, payload :: Payload }

-- AFTER: Metadata promoted to type level, instances carry only payload
type family MetadataOf (t :: Tag) :: Metadata where
  MetadataOf 'Param = '(Full, [Function, Method, Constructor], ...)
  MetadataOf 'Returns = '(Partial, [Function, Method], ...)

data JSDocTag (t :: Tag) = MkTag { payload :: PayloadOf t }
```

**TL;DR**: Factored constant fibers out of a Σ-type into a section of the base, turning a fat product into a Grothendieck fibration where metadata is recoverable via the display map.

### Effect/Schema Implementation (Already Done)

**The fibration is already implemented.** The `JSDocTagDefinition.make()` factory performs the factoring in a single call:

```typescript
// JSDocTagDefinition.model.ts
export const make = <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
  _tag: Tag,
  meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
) => {
  const def = S.decodeSync(JSDocTagDefinition)({ _tag, ...meta });
  return JSDocTagDefinition.mapFields((_) => ({
    _tag: S.tag(_tag),           // singleton literal discriminant
    value: TagValue.cases[_tag], // the tag-specific occurrence shape (fiber)
  })).annotate({ jsDocTagMetadata: def }); // full metadata on the schema (base)
};
```

This is exactly the factoring operation:

1. `S.decodeSync(JSDocTagDefinition)({ _tag, ...meta })` — validates the full metadata payload
2. `.mapFields(...)` — **strips the instance** down to just `{ _tag, value }` (the fiber)
3. `.annotate({ jsDocTagMetadata: def })` — **moves the metadata to the schema** (the base)

The `value` field references `TagValue.cases[_tag]`, which resolves to the tag-specific `S.TaggedClass` occurrence shape from the `tag-values/` module. These are the actual fiber payload types:

```typescript
// tag-values/StructuralTagValues.ts — fiber for @param
export class ParamValue extends S.TaggedClass<ParamValue>($I`ParamValue`)(
  "param",
  { ...optionalType, ...nameField, ...optionalDesc },  // only varying data
  $I.annote("ParamValue", { description: "..." })
) {}

// tag-values/DocumentationTagValues.ts — fiber for @example
export class ExampleValue extends S.TaggedClass<ExampleValue>($I`ExampleValue`)(
  "example",
  { ...optionalDesc },  // only the description text
  $I.annote("ExampleValue", { description: "..." })
) {}
```

The reusable field building blocks in `tag-values/_fields.ts` define the minimal varying shapes:

```typescript
export const typeField     = { type: S.String } as const;
export const optionalType  = { type: S.optionalKey(S.String) } as const;
export const nameField     = { name: S.String } as const;
export const optionalName  = { name: S.optionalKey(S.String) } as const;
export const optionalDesc  = { description: S.optionalKey(S.String) } as const;
export const empty         = {} as const;
```

The `TagValue` tagged union in `tag-values/index.ts` composes all 113 occurrence shapes into a single discriminated union via `S.toTaggedUnion("_tag")`, with sub-unions by category (StructuralEnc, AccessModifierEnc, etc.) to keep TypeScript's recursion depth in bounds.

#### What lives on the annotation (via `.annotate({ jsDocTagMetadata: def })`):

The full `JSDocTagDefinition` payload is already stored as a single `jsDocTagMetadata` annotation. This includes:

- `overview` — static description of what the tag does
- `astDerivableNote` — explanation of derivability
- `specifications` — which specs define this tag (jsdoc3, tsdoc-core, etc.)
- `applicableTo` — which AST node types this tag can attach to
- `relatedTags` — semantically related tags
- `parameters` (syntax metadata) — `TagParameters` describing syntax template
- `example` — canonical usage example
- `isDeprecated` — whether the tag itself is deprecated
- `synonyms` — alternative names
- `tagKind` — block, inline, or modifier
- `astDerivable` — full, partial, or none

#### What stays on the instance (the fiber via `mapFields`):

- `_tag` — singleton literal discriminant (e.g., `"param"` as const)
- `value` — the tag-specific `TagValue.cases[_tag]` occurrence shape, containing only varying fields:
  - `ParamValue`: `{ name: string, type?: string, description?: string }`
  - `ReturnsValue`: `{ type?: string, description?: string }`
  - `ThrowsValue`: `{ type?: string, description?: string }`
  - `ExampleValue`: `{ description?: string }`
  - `AsyncValue`: `{}` (empty — presence alone is the signal)
  - etc.

#### Annotation access pattern (Effect/Schema v4):

```typescript
import * as S from "effect/Schema";

/**
 * Projection functor: recovers the full JSDocTagDefinition metadata
 * from any tag schema produced by make().
 */
export const getJSDocTagMetadata = (schema: S.Top): JSDocTagAnnotationPayload | undefined =>
  S.resolveAnnotations(schema)?.jsDocTagMetadata;

// Usage: metadata recovered from schema, not from instance
const paramTagSchema = make("param", { /* ... full definition ... */ });
const meta = getJSDocTagMetadata(paramTagSchema);
// meta.overview → "Documents a function parameter."
// meta.applicableTo → ["function", "method", "constructor"]
// meta.astDerivable → "full"
// meta.specifications → ["jsdoc3", "tsdoc-core"]

// Instance (fiber) carries only varying data:
// { _tag: "param", value: { name: "userId", type?: "string", description?: "..." } }
```

### Annotation Composition Through Unions

Annotations survive schema composition. The `TagValue` union in `tag-values/index.ts` composes sub-unions (StructuralEnc, AccessModifierEnc, etc.) via `S.toTaggedUnion("_tag")`. Per-member annotations from individual `ParamValue`, `ReturnsValue`, etc. remain reachable through the union AST. Group-level annotations via `$I.annote()` on each value class carry occurrence-shape documentation that layers on top.

When `make()` produces a tag schema with `.annotate({ jsDocTagMetadata: def })`, that annotation is recoverable regardless of whether the schema is accessed directly or through a union composition. The pipeline can introspect any tag schema at runtime via `S.resolveAnnotations(schema)?.jsDocTagMetadata` without a separate lookup table — **the schema IS the lookup table**.

### Extending the Annotation Surface

The current `.annotate({ jsDocTagMetadata: def })` stores the full `JSDocTagDefinition` as a single annotation payload. Additional pipeline metadata can be added as **sibling annotation keys** on the same schema:

```typescript
return JSDocTagDefinition.mapFields((_) => ({
  _tag: S.tag(_tag),
  value: TagValue.cases[_tag],
})).annotate({
  jsDocTagMetadata: def,
  // Pipeline metadata — candidates for future annotation keys:
  tsCategoryClassification: { _tag: "SideEffect" },
  certaintyTier: { tier: 1, provenance: "ast" },
  extractionRouting: { visitors: ["FunctionDeclaration", "MethodDeclaration"] },
  multiplicity: { kind: "per-parameter" },
  astSignals: { modifierFlags: ["Async"], nodeKinds: [...] },
});
```

| Annotation Key | Purpose | Example |
|---|---|---|
| `tsCategoryClassification` | 8-category taxonomy classification | `{ _tag: "SideEffect" }` |
| `certaintyTier` | Layer 1/2/3 confidence | `{ tier: 1, provenance: "ast" }` |
| `extractionRouting` | Which AST visitors to invoke | `{ visitors: ["FunctionDeclaration", "MethodDeclaration"] }` |
| `multiplicity` | Output schema shape for structured outputs | `{ kind: "per-parameter" \| "single" \| "per-error" \| "unbounded" }` |
| `astSignals` | Deterministic heuristics for auto-classification | `{ modifierFlags: ["Async"], nodeKinds: [...] }` |

All recoverable at runtime via `S.resolveAnnotations(schema)?.tsCategoryClassification`, etc.

### Staticness Spectrum

Not all "constant-looking" fields are equally static. Be deliberate about placement:

| Field | Staticness | Recommendation |
|---|---|---|
| `_tag`, `tagKind`, `specifications` | Fully static | Immutable schema annotation |
| `applicableTo` | Fully static | Immutable schema annotation |
| `overview`, `astDerivableNote` | Fully static | Immutable schema annotation |
| `relatedTags` | Mostly static (could evolve with taxonomy) | Schema annotation with versioning |
| `astDerivable` | Could be context-dependent (Effect-TS `@throws` derivability differs from vanilla TS) | Consider a two-tier annotation: base derivability + context-specific override layer |

### Tag-Values Module: The Fiber Catalog

The `tag-values/` module contains all 113 fiber payload types organized by category:

| File | Category | Count | Example Tags |
|---|---|---|---|
| `StructuralTagValues.ts` | AST-derivable structure | 15 | `ParamValue`, `ReturnsValue`, `ThrowsValue`, `TemplateValue`, `AsyncValue` |
| `AccessModifierTagValues.ts` | Access/visibility modifiers | 18 | `AccessValue`, `PublicValue`, `ReadonlyValue`, `StaticValue`, `ExportValue` |
| `DocumentationTagValues.ts` | Documentation content | 10 | `DescriptionValue`, `ExampleValue`, `DeprecatedValue`, `SeeValue` |
| `TSDocTagValues.ts` | TSDoc-specific | 11 | `AlphaValue`, `BetaValue`, `InternalValue`, `LabelValue` |
| `InlineTagValues.ts` | Inline references | 2 | `LinkValue`, `InheritDocValue` |
| `OrganizationalTagValues.ts` | Organizational | 7 | `ModuleValue`, `NamespaceValue`, `PropertyValue` |
| `EventDependencyTagValues.ts` | Events & dependencies | 4 | `FiresValue`, `ListensValue`, `RequiresValue` |
| `RemainingTagValues.ts` | Remaining JSDoc | 20 | `AliasValue`, `CopyrightValue`, `KindValue`, `MixinValue` |
| `ClosureTagValues.ts` | Google Closure | 15 | `DefineValue`, `SuppressValue`, `NosideeffectsValue` |
| `TypeDocTagValues.ts` | TypeDoc-specific | 10 | `CategoryValue`, `GroupValue`, `HiddenValue` |
| `TypeScriptTagValues.ts` | TypeScript-specific | 1 | `OverloadValue` |

Each value class extends `S.TaggedClass` with its `_tag` as the discriminant and only the varying fields for that tag kind. The `_fields.ts` module provides reusable field compositions (`typeField`, `optionalType`, `nameField`, `optionalName`, `optionalDesc`, `empty`).

The `TagValue` union composes all 113 shapes via `S.toTaggedUnion("_tag")`, with intermediate sub-unions per category to manage TypeScript recursion limits. `TagName` is a `LiteralKit` over all 113 canonical names.

---

## 2. The Schema Serves Three Roles

The fibration refactor enables a single schema to project into three distinct roles simultaneously:

### Role 1: Agent Context (Base Annotations → Markdown Descriptions)

Schema annotations get projected into markdown-formatted `description` fields in the JSON Schema used for structured outputs. The agent sees rich context about what each tag means, its applicability, and derivability — all generated from a single `S.resolveAnnotations(schema)?.jsDocTagMetadata` traversal.

### Role 2: Agent Output Validation (Fiber Payload → JSON Schema)

The fiber (varying payload) defines the validation schema for what agents return. Decoded agent responses are validated against the schema, and only valid outputs proceed to the ts-morph write step.

### Role 3: ts-morph Write Source (Validated Output → Code Mutation)

A validated agent output is directly consumable by ts-morph's JSDoc manipulation API. The schema ensures type-safe construction of `JSDocStructure` objects.

**One schema, three projections, zero drift between them.**

---

## 3. Structured Output Narrowing

### The Union Problem

Both Anthropic and OpenAI structured output APIs accept JSON Schema but **neither handles discriminated unions cleanly**. OpenAI supports `anyOf` with constraints, Anthropic's tool use accepts JSON Schema, but the discriminant-determines-valid-fields pattern doesn't have a reliable primitive. `oneOf` with `const` discriminants works in theory but models don't reliably respect it for complex unions.

### Solution: Product of Optionals, Not Array of Coproducts

The narrowing step already eliminates the need for unions. By the time you've computed "this function node needs `param`, `returns`, `throws`, `example`, `description`," the **index set is known at schema construction time**. You're not asking the agent to "pick from N tag kinds" — you're asking it to "fill in these specific tag kinds."

Transform `Array<A | B | C>` → `{ a?: Array<A>, b?: B, c?: C }`:

```typescript
// ❌ Array of coproducts (requires runtime discriminant)
{
  "tags": [
    { "_tag": "param", "name": "userId", "description": "..." },
    { "_tag": "returns", "description": "..." }
  ]
}

// ✅ Product of optionals (key IS the discriminant)
{
  "param": [
    { "name": "userId", "description": "...", "optional": false }
  ],
  "returns": {
    "description": "..."
  },
  "throws": [
    { "errorType": "HttpError", "description": "..." }
  ],
  "example": [
    { "code": "...", "description": "..." }
  ],
  "description": {
    "summary": "...",
    "remarks": "..."
  }
}
```

Every key in the output object is a known tag kind with its own typed schema. **No discriminant needed — the key IS the discriminant.** Arrays where multiplicity makes sense (`param`, `throws`), objects where it's singular (`returns`, `description`).

### The `toAgentOutputSchema` Function

```
toAgentOutputSchema(astNodeKind: NodeKind) → JSON Schema
```

1. For each tag schema produced by `make()`, call `S.resolveAnnotations(schema)?.jsDocTagMetadata` to get the full definition
2. Filter to tags where `meta.applicableTo` includes the target `astNodeKind`
3. For each applicable tag, project the fiber payload (`TagValue.cases[tagName]`) into a property on an `S.Struct`
4. Serialize `meta.overview`, `meta.astDerivableNote`, `meta.parameters.syntax` into the `description` field of each JSON Schema property
5. Use the `multiplicity` annotation (or derive from tag semantics) to determine `array` vs `object` per tag

The agent sees:

```json
{
  "param": {
    "type": "array",
    "description": "Function parameters. Names and types are pre-filled from AST. Provide natural language descriptions explaining purpose and constraints.",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "Parameter name (pre-filled, do not modify)" },
        "description": { "type": "string", "description": "Natural language description of purpose" }
      }
    }
  }
}
```

### Schema Size Budget

Full `TagValue` with all 113 tag occurrence shapes would blow past provider limits. The narrowing step solves this: **only include `TagValue.cases[tagName]` for tags whose `jsDocTagMetadata.applicableTo` includes the target AST node kind**.

- A function gets: `param`, `returns`, `throws`, `example`, `description`, `pure`, `side-effect`, `business-rule`
- A class gets: `extends`, `implements`, `template`, `description`, `category`
- An interface gets: `extends`, `template`, `description`, `see`

The `jsDocTagMetadata.applicableTo` field on each tag's annotation is the dispatch table for this narrowing.

### Pre-filling Deterministic Values

The agent should NOT guess parameter names or types — those are Layer 1, certainty 1.0. The structured output schema should only contain fields the agent is **actually authoring**:

- Parameter names, types, optionality → pre-filled from Layer 1/2 pipeline, passed as **context**
- Parameter descriptions, examples, business rules → **agent output fields**

The agent's output schema for `param` is just `{ name: string, description: string }` where `name` is a pre-filled anchor (agent echoes it back for matching) and `description` is the only generated field.

### Staleness-Driven Narrowing

Before constructing the structured output schema, compute the **minimal set of tags that need staleness updates or creation**:

1. Compare current JSDoc state against AST (hash comparison)
2. Identify which tags are missing, stale, or need creation
3. Build the structured output schema from only that subset
4. Agent receives a focused task with minimal output surface

---

## 4. Agent Pipeline Architecture

### Pipeline Overview (GitHub Action / Pre-Commit Hook)

```
1. Compute or update codebase knowledge graph AST
   - If no pre-existing KG: full cold index
   - If KG exists: Turborepo --affected + git diff → compute which nodes/edges need updates

2. Compute staleness for partial/manual KG nodes
   - Hash comparison on DOCUMENTED_BY edges
   - LLM confidence score thresholds for Layer 3 content

3. Run deterministic updates (Layer 1/2)
   - ts-morph writes for AST-derivable tags
   - No agent calls needed — these are computed

4. Run agent enrichment (Layer 3) in batches
   - Agent receives: 2-hop context window + pre-computed Layer 1/2 tags
   - Agent returns: structured output validated against narrowed schema
   - Validation loop: generate → validate JSDoc → filter successes → re-run failures
   - Circuit breaker: max 3 retries with progressive constraint tightening
   - Fallback: mark as needsReview with degraded confidence score

5. Reactive embedding update
   - Successful ts-morph write → JSDocWritten event
   - Re-hash node → MERGE upsert to FalkorDB
   - Embedding queue: changed node + immediate neighbors
```

### Agent Context Window: Rooted Sub-AST (2-Hop Ego Network)

The "slice" of the AST provided to each agent is a **rooted sub-AST** — the ego-network of the target node. The same 2-hop boundary used for MCP query responses also defines the enrichment agent's context:

- The target function/class/interface
- Its callers, callees, types, imports
- The containing module
- Pre-computed Layer 1/2 tags already on the node
- Layer 1/2 tags on immediate neighbors (for cross-reference context)

### Agent Task Granularity

One agent call per **symbol** (function, class, interface, type alias). The unit of work is not a file or a tag, but a symbol with its 2-hop neighborhood.

### ts-morph Project Scoping

Rather than a singleton ts-morph `Project` holding the entire monorepo (expensive for type-checking), instantiate **scoped projects** from TypeScript project references:

1. Resolve the reference chain for the changed file via `tsconfig.json` composite projects
2. Create a project with just those referenced configs
3. Get precise type resolution without paying for the whole repo
4. Maps to Turborepo `--affected` — package-level via Turbo, file-level via scoped ts-morph

### Validation Loop Convergence

The agent → validate → filter → re-run cycle is a **fixpoint computation**. Termination strategy:

| Attempt | Strategy | Context Augmentation |
|---|---|---|
| 1 | Standard prompt with 2-hop context | Full annotation metadata in description |
| 2 | + specific validation error message | "Your @example failed to compile because X" |
| 3 | + correct symbol list from AST | "Available symbols in scope: [...]" |
| 4 (fallback) | Drop to simpler template | Mark as `certaintyTier: 3, provenance: "llm", needsReview: true` |

After 3 retries, the human review queue receives the item sorted by confidence score (lowest first).

### ts-morph Write Atomicity

When running agents in batches, file mutations create a race condition. If batch A writes to `foo.ts` and batch B's context included the pre-write version, batch B's output is stale.

**Solution: Two-phase commit.**

1. **Phase 1 (Compute)**: All agents compute outputs against a **frozen snapshot** of the codebase. No writes during this phase.
2. **Phase 2 (Apply)**: All writes happen in a single pass with conflict detection. If two outputs target the same JSDoc location, the higher-confidence one wins and the other re-enters the queue.

This maps to how git works — compute everything, then apply.

### Reactive Embedding Pipeline

```
ts-morph write succeeds
  → emits JSDocWritten event
  → re-hash node against .graph-hashes.json
  → hash mismatch detected
  → MERGE upsert to FalkorDB
  → embedding queue picks up:
    - changed node
    - immediate neighbors (because @see, @requires cross-references affect their semantic context)
  → Voyage Code 3 re-embedding via debounced batch
```

**Staleness window**: During the write → hash → upsert → embed pipeline, vector queries return stale embeddings. For the CI/pre-commit use case this is acceptable (batch, sequential). For a future watch-mode dev server, version the embeddings and query against the last-complete snapshot.

---

## 5. GitHub Action vs Pre-Commit Hook

### Recommended Split

| Trigger | Scope | Runs Where | Blocking? |
|---|---|---|---|
| **Pre-commit hook** | Fast path only: tree-sitter change detection → deterministic Layer 1/2 tag generation → lint check | Developer machine | Yes (but fast, <10s) |
| **GitHub Action (PR)** | Full enrichment pipeline: compute KG delta → batch agents → validate → write → re-embed | CI | Non-blocking (posts review comments) |
| **GitHub Action (cron)** | Weekly health audit: coverage/freshness/completeness scoring | CI | No (creates issues) |

**Rationale**: Pre-commit hooks need the full type-checker locally and API access for agents. The heavy Layer 3 enrichment belongs in CI where you control the environment, can parallelize, and don't block the developer's commit flow.

### Dry-Run Mode

```bash
turbo run enrich-jsdoc --dry-run
```

Outputs a diff preview: "I would add these 47 JSDoc tags across 12 files, here's a sample of 5" with confidence scores. Builds trust during early adoption. Once confidence is high, flip to auto-write in CI.

---

## 6. MCP Server / Claude Code Plugin Design

### Interface Surface

The MCP server serves as the portable interface for both Claude Code (today) and Codex (later).

| MCP Primitive | Usage |
|---|---|
| **Resources** | Tag database schema (with annotations), example prompts, current KG stats |
| **Tools** | Validate JSDoc insertion, write via ts-morph, search symbols, traverse dependencies, check drift |
| **Prompts** | Annotation-derived context baked into prompt templates per AST node kind |

### Resource: Tag Database Schema

Expose the full tag database schema (with annotations projected to descriptions) as an MCP resource. Agents can query "what tags are applicable to a function?" and receive the narrowed schema with full metadata context.

### Tool: Validate JSDoc

```typescript
{
  name: "validate-jsdoc",
  input: { symbolId: string, jsdocTags: NarrowedTagOutput },
  output: { valid: boolean, errors: ValidationError[], suggestions: string[] }
}
```

Decodes the agent's output against the fiber payload schema, runs De-Hallucinator checks (symbol reference validation against AST), and returns structured errors.

### Tool: Write JSDoc

```typescript
{
  name: "write-jsdoc",
  input: { symbolId: string, validatedTags: ValidatedTagOutput },
  output: { success: boolean, filePath: string, diff: string }
}
```

Takes validated output and performs the ts-morph write. Emits `JSDocWritten` event for the reactive embedding pipeline.

---

## 7. Integration with repo-codegraph-canonical Phases

| Phase | Fibration Impact |
|---|---|
| **P1 (Schema)** | Refactored `JSDocTagDefinition` with annotations. Define custom annotation keys. Lean instance types for graph node properties. |
| **P2 (AST Extraction)** | Layer 1/2 extraction produces fiber payloads only. Metadata accessed via schema annotations during extraction routing. |
| **P3 (Storage)** | Graph nodes carry only varying data. Annotation metadata queryable at schema level, not stored per-node. Reduces FalkorDB storage and MERGE payload. |
| **P4 (LLM Enrichment)** | `toAgentOutputSchema` generates narrowed structured outputs from annotations. De-Hallucinator validates against fiber schema. Staleness-driven narrowing reduces agent token cost. |
| **P5 (MCP Server)** | Tag database exposed as MCP resource. Schema annotations power prompt templates. Validation tool uses fiber schema. |
| **P6 (Freshness)** | Drift detection operates on fiber payloads. Annotation metadata (applicableTo, astDerivable) drives which tags to check per symbol kind. |

---

## 8. Key Type Theory Concepts Reference

For implementation clarity, here's a mapping of the category theory concepts to their Effect/Schema equivalents:

| Concept | Formal Name | Effect/Schema Equivalent |
|---|---|---|
| The full current type | Dependent sum (Σ-type) | `JSDocTagDefinition` S.Class with all fields |
| Constant metadata | Section of the base | `.annotate({ jsDocTagMetadata: def })` |
| Varying payload | Fiber | `TagValue.cases[_tag]` (e.g., `ParamValue`, `ReturnsValue`) |
| Recovering metadata from discriminant | Display map / Projection functor | `S.resolveAnnotations(schema)?.jsDocTagMetadata` |
| The factoring operation | Promotion / Fibration construction | `JSDocTagDefinition.mapFields(() => ({ _tag: S.tag(tag), value: TagValue.cases[tag] })).annotate(...)` |
| Tag kind → valid fields | Indexed inductive family | `S.tag()` narrowing + `TagValue.cases` lookup |
| Schema-as-lookup-table | The schema IS the base category | Introspect schema annotations at runtime via `S.resolveAnnotations()` |
| Union grouping | Coproduct with group annotations | `S.toTaggedUnion("_tag")` with `$I.annote()` |
| Narrowing for structured output | Distributing coproduct into product | `toAgentOutputSchema(nodeKind)` |
| Pre-filled + agent-authored fields | Known index set → product | Key-per-tag-kind in output schema |

---

## 9. Open Questions & Future Work

1. **Annotation versioning**: If `relatedTags` or `astDerivable` context-overrides evolve, how are annotation versions tracked?
2. **Multi-provider normalization**: Should `toAgentOutputSchema` emit provider-specific JSON Schema (Anthropic tool_use vs OpenAI function_calling) or a single canonical form?
3. **Confidence score propagation**: When an agent-authored `@description` on function A references function B, should B's certainty tier influence A's?
4. **Watch-mode embedding consistency**: If the system moves beyond CI batch mode, how are in-flight embeddings handled during concurrent queries?
5. **Custom tag extensibility**: The `definedTags` pattern in eslint-plugin-jsdoc allows arbitrary custom tags. How does the annotation schema accommodate user-defined tags not in the database?
