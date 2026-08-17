# Instance

- id: `phoenix-prompt-read-exists`
- file:line: `packages/drivers/phoenix/src/Phoenix.models.ts:828`
- symbol: `PhoenixPromptReadResult`
- members: `exists`, `promptVersionId`
- evidence classes:
  - E3 at `packages/drivers/phoenix/src/Phoenix.service.ts:522` — `exists` is `O.isSome(prompt)` and `promptVersionId` is `O.getOrNull` of the same Option; the boolean restates payload presence.

# Current shape

Live declaration at `packages/drivers/phoenix/src/Phoenix.models.ts:826`:

```ts
export class PhoenixPromptReadResult extends S.Class<PhoenixPromptReadResult>($I`PhoenixPromptReadResult`)(
  {
    exists: S.Boolean.annotateKey({
      description: "Whether the Phoenix prompt selector resolved to a prompt.",
    }),
    promptVersionId: S.NullOr(S.String).annotateKey({
      description: "Nullable Phoenix prompt version identifier.",
    }),
  },
  $I.annote("PhoenixPromptReadResult", {
    description: "Readback result for a Phoenix prompt selector.",
  })
) {}
```

# Cardinality gap

The boolean/payload bag represents four semantic combinations, but only two are legal:

- `missing` — no prompt and therefore no version id.
- `present(promptVersionId)` — a prompt resolved and carries its version id.

`exists: false` with an id and `exists: true` with `null` are both lies. The result is derived from one SDK `Option`, so the writer should map that source directly to one tagged member.

# Target schema

Reuse the existing `LiteralKit` import, add `Tuple` to the Effect import, and define the status plus payload-bearing members:

```ts
export const PhoenixPromptReadStatus = LiteralKit(["missing", "present"]).pipe(
  $I.annoteSchema("PhoenixPromptReadStatus", {
    description: "Outcome of resolving a Phoenix prompt selector.",
  })
);
export type PhoenixPromptReadStatus = typeof PhoenixPromptReadStatus.Type;

class PhoenixPromptReadMissing extends S.Class<PhoenixPromptReadMissing>($I`PhoenixPromptReadMissing`)(
  { status: S.tag("missing") },
  $I.annote("PhoenixPromptReadMissing", {
    description: "A Phoenix prompt selector that resolved no prompt.",
  })
) {
  static readonly thunkThis = () => PhoenixPromptReadMissing;
}

class PhoenixPromptReadPresent extends S.Class<PhoenixPromptReadPresent>($I`PhoenixPromptReadPresent`)(
  {
    status: S.tag("present"),
    promptVersionId: S.String.annotateKey({ description: "Resolved Phoenix prompt version identifier." }),
  },
  $I.annote("PhoenixPromptReadPresent", {
    description: "A resolved Phoenix prompt and its version identifier.",
  })
) {
  static readonly thunkThis = () => PhoenixPromptReadPresent;
}

export const PhoenixPromptReadResult = PhoenixPromptReadStatus.mapMembers(
  Tuple.evolve([PhoenixPromptReadMissing.thunkThis, PhoenixPromptReadPresent.thunkThis])
).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("PhoenixPromptReadResult", {
    description: "Readback result for a Phoenix prompt selector.",
  })
);
export type PhoenixPromptReadResult = typeof PhoenixPromptReadResult.Type;
```

Construct through `PhoenixPromptReadResult.cases.missing.make({})` and `.cases.present.make({ promptVersionId })`; branch through the schema-derived `match`/guards rather than adding `isPresent` helpers.

# Migration inventory

- `packages/drivers/phoenix/src/Phoenix.models.ts:9-12` — retain `LiteralKit`, add `Tuple`, and keep the existing schema imports.
- `packages/drivers/phoenix/src/Phoenix.models.ts:811-838` — update the documentation example and replace the class bag with `PhoenixPromptReadStatus`, the two classes, and `PhoenixPromptReadResult` tagged union.
- `packages/drivers/phoenix/src/Phoenix.service.ts:42` — the import name remains stable but now refers to the tagged-union schema/value type.
- `packages/drivers/phoenix/src/Phoenix.service.ts:93` — the SDK adapter return contract keeps `Promise<PhoenixPromptReadResult>`; its structural members change.
- `packages/drivers/phoenix/src/Phoenix.service.ts:128` — the Effect service return contract keeps `Effect<PhoenixPromptReadResult, PhoenixError>`.
- `packages/drivers/phoenix/src/Phoenix.service.ts:519-529` — replace the duplicate `O.isSome`/`O.getOrNull` projection with one `O.match`: missing constructs the missing case; present constructs the present case from `value.id`.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:153` — the injected SDK writer constructs the present case.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:261-268` — the getPrompt read asserts/narrows `status: "present"` rather than reading `exists`.
- `packages/tooling/library/ai-metrics/test/agent-effectiveness.test.ts:474-480` — the cross-package fake SDK constructs the present case.

The similarly named reads at `packages/drivers/phoenix/test/Phoenix.service.test.ts:209` and `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:3906` are `PhoenixPromptWriteResult` values, not this instance, and must not be changed.

# Guard-deletion accounting

- `packages/drivers/phoenix/src/Phoenix.service.ts:521-528` — delete the two parallel presence interpretations (`O.isSome(prompt)` and `O.map(...).getOrNull`) that must remain coherent at every write. One `O.match` chooses exactly one schema case.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:268` — delete the `prompt.exists` truthiness check; the `present` discriminator narrows and proves payload availability.
- `packages/drivers/phoenix/src/Phoenix.models.ts:828-833` — delete the comment-only invariant tying a true boolean to a non-null payload; the case-specific field makes it structural.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/phoenix/test/Phoenix.service.test.ts:55-70` — schema inventory continues to include `PhoenixPromptReadResult`; schema-derived arbitrary/codec coverage now generates only the two legal cases.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:152-153` and `258-269` — update the fake writer and getPrompt assertion to the present case; add a missing SDK result assertion if absent.
- `packages/tooling/library/ai-metrics/test/agent-effectiveness.test.ts:474-480` — update the cross-package fake constructor.

# Risk & sequencing

Although classified Tier 1, this exported driver model crosses into `@beep/repo-ai-metrics` test adapters. Land the model, Phoenix service writer, package tests, and cross-package fake together. Do not change `PhoenixPromptWriteResult`, whose non-null `promptVersionId` is a separate already-coherent result.
