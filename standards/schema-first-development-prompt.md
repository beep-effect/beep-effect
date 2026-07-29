# Schema-First Development Session Prompt

Use this template to start a new schema-heavy Codex session in this repository.
Replace every `<...>` field before pasting it. Use `none` when a field is
deliberately empty rather than leaving the decision implicit.

This is an operational prompt, not a new source of repository law. The live
repository standards, applicable `AGENTS.md` files, and verified source APIs
take precedence if this template drifts.

````text
You are working in the beep-effect repository on a schema-first, Effect-first
task. Skill activation alone does not satisfy this prompt: the concrete
modeling, proof, and closeout obligations below remain binding.

## Task Input

- TASK_MODE: <new | refactor | port>
- MISSION: <one concrete outcome>
- TARGET_PATHS: <files or directories in scope>
- SOURCE_PROVENANCE: <upstream path, repository, revision, or "not applicable">
- ALLOWED_FILES: <hard file fence>
- FORBIDDEN_ACTIONS: <commands or mutations that are not authorized>
- COMPATIBILITY_OR_WIRE_CONTRACT: <public API, encoded shape, persistence, or "none">
- VERIFICATION_SCOPE: <focused package/test/law commands plus required final gate>
- KNOWN_CONSTRAINTS: <dirty files, concurrent work, environmental limits, or "none">

## Mission

Deliver the requested capability so the schema is the source of truth for data
shape, invariants, construction, decoding, encoding, and reusable derived
behavior. Keep business logic focused on domain intent.

Use the current `schema-first-development` and `effect-first-development`
guidance. Use `crispen` as a refactoring lens when existing logic can be
absorbed into an existing schema; it is not the law source and it does not
justify inventing new abstractions. When any skill conflicts with current
repository law, repository law wins.

The governing creed is:

> The schema is truth. Behavior precipitates from the data.

This does not mean "put every function on a class." It means the model owns the
facts that define valid data, and downstream behavior derives from those facts
instead of recreating them.

## Authority and Live-Source Rule

Read and apply authority in this order:

1. Every applicable `AGENTS.md`, including package-local instructions.
2. Named initiative packets, specifications, plans, decisions, and file fences.
3. `standards/effect-first-development.md`,
   `standards/architecture/04-rich-domain-model.md`, and the relevant portions
   of `standards/ARCHITECTURE.md`.
4. The current `schema-first-development` references:
   `repo-laws.md`, `pattern-catalog.md`, `local-primitives.md`, and
   `examples.md`.
5. Live target source, public barrels, package manifests, consumers, and tests.
6. The currently installed or vendored Effect source.

Never write a nontrivial Effect or Schema API from memory. Locate the current
vendored checkout instead of assuming that it is named `.repos/effect-v4`.
Search for `SCHEMA.md`, `Schema.ts`, or the relevant specialized module under
the live `.repos/effect*` tree. Trust current symbols and signatures, not stale
line anchors.

Before introducing a helper, schema, model, utility, or public export, search
live package source and barrels. Prefer an existing `@beep/*` primitive over a
local duplicate.

## Hard Boundaries

- Inspect `git status` before editing. Preserve unrelated modified, staged,
  and untracked files.
- Treat `ALLOWED_FILES`, "ONLY", "nothing else", and explicit verification
  commands as hard fences.
- Do not stage, commit, push, publish, open a pull request, switch branches, or
  regenerate whole-repository snapshots without a separate explicit request.
- Do not weaken trust boundaries, error channels, refinements, tests, or wire
  contracts merely to simplify implementation.
- Do not claim a gate passed unless the exact command completed successfully.
- Attribute failures as introduced, inherited, unrelated, or
  environment-only before deciding whether they are in scope to fix.

## Session Protocol

### 1. Audit before proposing

Resolve discoverable facts through repository inspection rather than asking
the user:

- establish the repository root, branch, dirty state, and applicable laws;
- inventory the target's exports, schemas, consumers, tests, codecs, errors,
  and service boundaries;
- inspect canonical local primitives and analogous implementations;
- for a refactor, record current behavior and encoded forms before changing
  them;
- for a port, inspect the complete source tree and freeze source provenance;
- verify every advanced Effect/Schema API against current source.

Report material contradictions between current code, the stated task, and
repository doctrine. Classify them instead of silently choosing a side.

### 2. Plan and grill

After the audit, state the goal, success criteria, scope, compatibility
contract, and proposed proof.

Ask one material question at a time. Do not ask questions the repository can
answer. Continue until ownership, data shapes, invariants, public interfaces,
wire behavior, failure modes, tests, and scope are decision-complete.

Produce a decision-complete implementation plan and wait for explicit user
authorization before editing. A request to plan is not authorization to
implement.

### 3. Implement after explicit authorization

Keep one writer responsible for each file. For broad work, parallelize
read-only discovery and review where useful, but avoid overlapping writers.

Work in focused loops:

1. model or repair the schema;
2. derive or colocate the lawful helper surface;
3. update consumers without assertions or compatibility drift;
4. add focused examples and tests;
5. run the narrowest meaningful checks;
6. widen verification only after focused proof is green.

Run the target package's `@effect/tsgo`/TypeScript diagnostics frequently
enough that errors do not accumulate.

### 4. Close with evidence

For material changes, obtain a fresh read-only adversarial review. For a tiny,
obvious edit, a structured self-review is sufficient. Resolve every finding or
record a concrete justification.

Run the required final verification only after focused checks and review are
complete. Report the exact commands and outcomes.

## Task-Mode Overlay

### `new`

- Model the domain vocabulary, valid states, invariants, and boundaries before
  operations.
- Do not invent wire compatibility, migration policy, adapters, services, or
  extension points that the mission does not require.
- Start from the smallest precise schema graph that supports the requested
  behavior.

### `refactor`

- Treat observed behavior, public types, encoded forms, consumers, and tests as
  the baseline unless the mission explicitly changes them.
- Move existing invariants and normalization into schemas before deleting the
  helper wall that previously enforced them.
- Preserve encoded and persistence shapes with explicit parity tests.
- If `.Type`, `.Encoded`, construction input, or a public export changes,
  update all in-scope consumers in the same change or stop and report the
  ripple.

### `port`

- Treat the named source revision as behavioral evidence, not as a shape to
  copy mechanically.
- Preserve semantic capability while redesigning weak source models into
  lawful local schemas.
- Maintain a disposition ledger for every source file, public export, and
  source test. Each item must be `ported`, `subsumed`, `redesigned`, or
  `rejected`, with a target, reason, and proof.
- Add ingress compatibility adapters only when the conversion is total,
  unambiguous, required by a real consumer, and covered by tests.
- Account for every source test even when the local proof is a stronger
  property law rather than a line-for-line test translation.

## Core Modeling Contract

### Schema owns pure data

- Use Schema for domain objects, wire payloads, persisted rows, configuration
  payloads, events, and other pure data.
- Prefer `S.Class` for reusable object models.
- Use `S.Struct` when a boundary shape is itself the desired value and
  class-style construction adds no value.
- Keep plain interfaces and type literals for service contracts, ports,
  overload surfaces, and genuinely type-level machinery.
- Do not suffix schema values with `Schema`.
- For a non-class schema, export its runtime type from the same identifier:
  `export type Name = typeof Name.Type`.

### Precision carries invariants

- Replace broad primitives with the real domain where the domain is narrower:
  non-empty strings, patterns, brands, finite or integral numbers, ranges, and
  bounded or non-empty collections.
- Prefer built-in schemas and checks before custom filters.
- Reusable custom checks must have `identifier`, `title`, `description`, and a
  user-facing `message`.
- Do not weaken the production schema to make tests or arbitrary generation
  easier.

### Defaults, normalization, and absence live at the boundary

- Distinguish constructor defaults, decoding defaults, and encoded/wire
  optionality. They are different contracts.
- Apply a schema default only when one value is semantically canonical.
- Normalize external nullish or optional values into `Option` with the
  `S.OptionFrom*` helper matching the actual boundary representation.
- Preserve `null` on encoded persistence boundaries where the storage contract
  requires it.
- Use schema transformations for deterministic type-shaping conversions.
- Do not scatter `??`, null checks, trim/case conversion, default-object
  spreads, or native JSON parsing through business logic.

### Derive behavior instead of duplicating truth

- Derive guards with `S.is`, comparisons with `S.toEquivalence`, generators
  with `S.toArbitrary`, and codecs with Schema APIs.
- Prefer tagged-union `.cases`, `.guards`, `.isAnyOf`, and `.match` over
  handwritten constructors, guards, and branch chains.
- Prefer `LiteralKit.Options`, `.Enum`, `.is`, `.pickOptions`,
  `.omitOptions`, `.$match`, `.thunk`, and `.toTaggedUnion` over duplicate
  literal arrays, enum-like objects, and literal predicates.
- Attach frequently reused schema-specific helpers to a schema or class when
  doing so improves locality and does not create cycles.
- Do not create a universal wall of `decodeX`, `encodeX`, and `isX` helpers.
  Keep one-off composition local.
- Use Effect-returning decoders by default at fallible external boundaries.
  Synchronous throwing decoders are limited to trusted programmer-error
  boundaries.

### Behavior placement is intentional

- Put invariants, construction semantics, schema-derived helpers, and small
  value-local pure behavior with the model.
- Put large algorithms, collection operations, multi-model policies, and
  orchestration in `.behavior.ts`, `.policy.ts`, services, or exported
  functions.
- Keep functions immutable and total where the domain permits.
- Prefer folds and exhaustive matching over mutable `let` / `for` / `push`
  accumulation and conditional chains.
- Schema verbosity is acceptable when it buys precision. The goal is crisp
  business logic, not the shortest schema declaration.

### Finite variants are discriminated

- Model lifecycle states, result/status cases, commands, events, and
  case-specific payloads as discriminated unions, not one object with optional
  fields for every case.
- Use `LiteralKit` for a reusable discriminator domain.
- Prefer `S.Class` for member schemas.
- Use `S.toTaggedUnion("<field>")` for custom fields such as `kind`, `type`,
  `status`, `family`, or `profile`.
- Use `S.TaggedUnion(...)` only for canonical `_tag` unions.
- Nest discriminated values only when the domain actually contains a nested
  decision. Do not create nesting solely to demonstrate an API.
- Branch exhaustively with the schema-derived matcher or Effect `Match`.

### Effect owns fallibility and runtime boundaries

- Decode unknown input with Schema at the edge.
- Translate Schema issues into the boundary's typed error when the error
  leaves the local helper or module.
- Model expected failure in the Effect error channel; reserve defects for
  invariant violations that cannot be recovered from locally.
- Keep services and Layers explicit. Do not run Effects inside domain models.
- Use Effect JSON codecs, collections, `Option`, `Result`, `Match`, time,
  randomness, and resource APIs in their intended domains.

### Documentation explains semantics

- Give exported APIs meaningful JSDoc with a useful fenced `@example`, a
  canonical `@category`, and `@since`.
- Use `@param`, `@returns`, `@throws`, `@remarks`, and singular `@invariant`
  only when they add information not already present in the signature.
- `@throws` documents synchronous throws or defects, not typed Effect errors.
- Describe invariants, units, normalization, ordering, lossy behavior,
  ownership, and wire semantics where applicable.
- Add canonical `$I.annote(...)` / `$I.annoteSchema(...)` metadata to schemas.
  Descriptions must explain domain intent rather than repeat the symbol name.
- Keep examples compilable and imports routed through public package aliases.

## Pattern Playbook

The following examples show the intended direction. Verify every imported
symbol and combinator against the live checkout before adapting them.

### Pattern 1: Replace a parallel type and validator with one schema

**Rationale:** A TypeScript interface disappears at runtime. A schema can
construct, validate, decode, encode, document, compare, and generate the same
model.

**Smell:**

```ts
export interface TaskInput {
  readonly id: string;
  readonly title: string;
}

export const isTaskInput = (input: unknown): input is TaskInput => {
  // parallel validation logic
};
```

**Target:**

```ts
import { $PackageNameId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PackageNameId.create("relative/path/from/package/src");

/**
 * Validated input for creating one task.
 *
 * @example
 * ```ts
 * const input = TaskInput.make({ id: "task-1", title: "Review evidence" })
 * console.log(TaskInput.is(input)) // true
 * ```
 *
 * @invariant `id` and `title` are non-empty.
 * @category models
 * @since 0.0.0
 */
export class TaskInput extends S.Class<TaskInput>($I`TaskInput`)(
  {
    id: S.NonEmptyString,
    title: S.NonEmptyString,
  },
  $I.annote("TaskInput", {
    description: "Validated input for creating a task.",
  })
) {
  static readonly is = S.is(TaskInput);
}
```

**Carve-out:** Keep a service or port interface when its purpose is dependency
inversion rather than data modeling.

**Proof:** Decode representative unknown input, reject invalid empty fields,
and confirm consumers use the schema-derived type.

### Pattern 2: Make a refinement precise and generatable

**Rationale:** A named invariant should be executable, documented, and usable
by property tests.

**Smell:** A branded string whose actual pattern exists only in a constructor,
regular-expression helper, assertion, or comment.

**Target:**

```ts
import { SchemaUtils } from "@beep/schema";
import { $PackageNameId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PackageNameId.create("relative/path/from/package/src");
const SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const Slug = S.String.check(
  S.isPattern(SLUG_PATTERN, {
    identifier: $I`SlugPatternCheck`,
    title: "Slug",
    description: "A lowercase hyphen-delimited identifier.",
    message: "Expected a lowercase slug beginning with a letter",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(SLUG_PATTERN),
  })
  .pipe(
    S.brand("Slug"),
    $I.annoteSchema("Slug", {
      description: "Lowercase identifier used in stable URL and storage keys.",
    }),
    SchemaUtils.withCodecStatics
  );

export type Slug = typeof Slug.Type;
```

**Carve-out:** Omit a custom `toArbitrary` annotation when the source schema
already derives realistic, warning-free values. Do not add redundant custom
generators merely for uniformity.

**Proof:** `S.toArbitrary(Slug, { report: true })` has no warnings, generated
values satisfy `Slug.is`, and invalid edge cases fail with the intended
message.

### Pattern 3: Separate constructor defaults from wire semantics

**Rationale:** A canonical construction default can remove boilerplate without
silently widening an encoded contract.

**Smell:**

```ts
const makeImportOptions = (input: {
  readonly strict?: boolean;
  readonly note?: string | null;
}) => ({
  strict: input.strict ?? true,
  note: input.note == null ? O.none() : O.some(input.note),
});
```

**Target:**

```ts
import { SchemaUtils } from "@beep/schema";
import { $PackageNameId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PackageNameId.create("relative/path/from/package/src");

export class ImportOptions extends S.Class<ImportOptions>($I`ImportOptions`)(
  {
    strict: S.Boolean.pipe(SchemaUtils.withConstantDefault(true)),
    note: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("ImportOptions", {
    description: "Import behavior with canonical construction defaults.",
  })
) {}
```

**Carve-out:** Use decoding defaults only when omitted encoded input is
actually valid. Constructor-only defaults do not make a required wire key
optional. Do not default values such as identity, authorization, provenance,
money, or timestamps unless the domain defines one canonical value.

**Proof:** Assert constructor behavior, decoded boundary behavior, and encoded
output separately.

### Pattern 4: Turn finite case bags into an exhaustive tagged union

**Rationale:** A discriminator makes invalid combinations unrepresentable and
gives construction, guards, and exhaustive matching one source of truth.

**Smell:**

```ts
interface Job {
  readonly kind: "queued" | "completed";
  readonly queuedAt?: string;
  readonly completedAt?: string;
  readonly result?: string;
}
```

**Target:**

```ts
import { LiteralKit } from "@beep/schema";
import { $PackageNameId } from "@beep/identity/packages";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $PackageNameId.create("relative/path/from/package/src");
const JobKind = LiteralKit(["queued", "completed"]);

class JobQueued extends S.Class<JobQueued>($I`JobQueued`)(
  {
    kind: S.tag("queued"),
    queuedAt: S.String,
  },
  $I.annote("JobQueued", {
    description: "Job waiting to be processed.",
  })
) {
  static readonly thunkThis = () => JobQueued;
}

class JobCompleted extends S.Class<JobCompleted>($I`JobCompleted`)(
  {
    kind: S.tag("completed"),
    completedAt: S.String,
    result: S.String,
  },
  $I.annote("JobCompleted", {
    description: "Successfully completed job.",
  })
) {
  static readonly thunkThis = () => JobCompleted;
}

export const Job = JobKind.mapMembers(
  Tuple.evolve([JobQueued.thunkThis, JobCompleted.thunkThis])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Job", {
    description: "Job lifecycle state discriminated by `kind`.",
  })
);

export type Job = typeof Job.Type;

export const summarizeJob = Job.match({
  queued: ({ queuedAt }) => `queued at ${queuedAt}`,
  completed: ({ result }) => `completed: ${result}`,
});
```

**Carve-out:** Preserve a required external bag shape at the transport edge,
then decode it into the internal tagged model. Use nested tagged values only
for a real nested domain choice.

**Proof:** Construct every case through `Job.cases`, test every guard, and
exercise the exhaustive matcher. Adding a case must create a compile-time
obligation at every exhaustive match.

### Pattern 5: Colocate a repeated helper surface without building a helper wall

**Rationale:** Call sites should express `EntityId.is(value)` or
`EntityId.equivalence(left, right)` rather than re-deriving the same behavior
throughout the codebase.

**Smell:**

```ts
const isEntityId = S.is(EntityId);
const decodeEntityId = S.decodeUnknownOption(EntityId);
const entityIdEquivalence = S.toEquivalence(EntityId);
```

**Target:**

```ts
export const EntityId = EntityIdBase.pipe(
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    equivalence: S.toEquivalence(schema),
  }))
);

export type EntityId = typeof EntityId.Type;
```

For an `S.Class`, keep class identity and attach only repeatedly useful
statics in the class body:

```ts
export class Entity extends S.Class<Entity>($I`Entity`)(
  {
    id: EntityId,
    label: S.NonEmptyString,
  },
  $I.annote("Entity", {
    description: "Named domain entity.",
  })
) {
  static readonly is = S.is(Entity);
  static readonly equivalence = S.toEquivalence(Entity);
}
```

**Carve-out:** A one-use decoder is usually clearer at its boundary. Avoid
attaching unrelated algorithms, runtime services, or functions that create an
import cycle. Treat synchronous throwing statics as trusted-boundary tools,
not general external decoders.

**Proof:** Search consumers for duplicate guards/decoders, replace repeated
ones, and verify the schema remains constructible and decodable.

### Pattern 6: Keep decoding and JSON in Effect/Schema

**Rationale:** External data is fallible. The boundary should expose that
fallibility rather than conceal it behind assertions, native JSON calls, or
untyped throws.

**Smell:**

```ts
const payload = JSON.parse(text) as TaskInput;
```

**Target:**

```ts
const TaskInputFromJson = S.fromJsonString(TaskInput);
const decodeTaskInput = S.decodeUnknownEffect(TaskInput);
const decodeTaskInputJson = S.decodeUnknownEffect(TaskInputFromJson);
```

Map the resulting Schema issue into the existing typed error belonging to the
service, CLI, HTTP, or protocol boundary when it leaves the local module.

**Carve-out:** `S.decodeUnknownOption` or `S.decodeUnknownResult` is suitable
when dropping or inspecting malformed input is deliberately synchronous and
non-throwing. Do not default to synchronous throwing codecs.

**Proof:** Test valid input, malformed JSON, structurally invalid input, and
typed error translation at the owning boundary.

### Pattern 7: Prove schemas with generated data and laws

**Rationale:** Examples prove anecdotes. Schema-derived properties test claims
across the modeled domain and expose over-broad or impossible schemas.

For every changed named schema:

```ts
import { expect } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const arbitrary = S.toArbitrary(MySchema, { report: true });

expect(arbitrary.report.warnings).toEqual([]);
fc.assert(
  fc.property(arbitrary.value, (value) => {
    expect(S.is(MySchema)(value)).toBe(true);
  })
);
```

For meaningful codecs, transforms, refinements, defaults, or equivalence:

```ts
const encode = S.encodeUnknownResult(MySchema);
const decode = S.decodeUnknownResult(MySchema);
const equivalent = S.toEquivalence(MySchema);

fc.assert(
  fc.property(S.toArbitrary(MySchema), (value) => {
    const encoded = Result.getOrThrow(encode(value));
    const decoded = Result.getOrThrow(decode(encoded));
    expect(equivalent(decoded, value)).toBe(true);
  })
);
```

Also assert exact encoded examples whenever compatibility, persistence, or a
wire contract matters.

**Carve-out:** Not every schema needs every possible law. Choose laws that
match real semantics. A deliberately lossy normalization may require
idempotence or canonical-form laws instead of equality after round trip.

**Proof:** All changed named schemas derive and sample without warnings;
generated values satisfy their source schema; all claimed round-trip,
invariant, default, transform, codec, and equivalence laws pass.

### Pattern 8: Port semantics with a disposition ledger

**Rationale:** A file-copy checklist misses behavior, while an unbounded
"redesign" silently drops features. A semantic ledger permits local
improvement while proving source completeness.

Use this record:

| Source item | Source evidence | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- |
| `Model/User.ts#User` | exports + tests | redesigned | `User.model.ts#User` | schema-owned invariant | property + parity tests |

Allowed dispositions:

- `ported`: recognizable local equivalent;
- `subsumed`: behavior is provided by a broader local primitive;
- `redesigned`: capability is preserved through a stronger local model;
- `rejected`: intentionally omitted with a documented incompatibility or
  non-goal.

**Carve-out:** A source directory layout may be mirrored for traceability when
that improves auditability, but local architecture and public package
boundaries still govern.

**Proof:** Every source file, export, and test appears exactly once in the
ledger, and every accepted capability has an executable local proof.

## Documentation and Annotation Review

Review every touched export after implementation:

- the summary says what the symbol is for;
- `@example` demonstrates meaningful input and an observable result;
- `@category` uses a canonical repository category;
- `@since` is present;
- conditional tags add semantics rather than restating types;
- `@invariant` describes an enforced property, not an aspiration;
- `@throws` is spelled correctly and documents only real synchronous
  throw/defect behavior;
- schema identity, title, description, examples, and check messages are useful
  to both humans and tooling;
- documentation examples compile through the repository's docgen surface.

## Verification Contract

Build the verification matrix from the task rather than pasting unrelated
repo-wide commands.

At minimum:

1. inspect the final diff and run `git diff --check`;
2. run focused formatting/lint checks for touched files;
3. run focused TypeScript diagnostics;
4. run focused unit and property tests;
5. run schema-first and relevant Effect law checks;
6. run docgen for changed public exports or examples;
7. perform the scaled adversarial review and close its findings;
8. run `bun run beep yeet verify` as the final local gate unless an explicit
   task fence forbids that command.

Do not run formatters in write mode outside the authorized file fence. Do not
regenerate whole-repository standards snapshots on a feature change.

If the final gate fails:

- preserve its exact command and first actionable error;
- determine whether the failure is introduced, inherited, unrelated, or
  environmental;
- fix only introduced, in-scope failures;
- rerun the narrow failing lane before rerunning the full gate;
- report unresolved external blockers without claiming success.

## Final Response Contract

Lead with the outcome. Include:

- what schemas, invariants, and behavior changed;
- what was deliberately left outside the schema and why;
- compatibility or port-ledger disposition;
- exact verification commands and results;
- attributable unresolved failures, if any;
- confirmation that no unauthorized git publication action occurred.
````
