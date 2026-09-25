# Source binding

P2 owner refresh on 2026-09-22 at source SHA `dc852c92efdd7d259e3983ec30cd19cb9b4fd65d`. Exact inspected-file SHA-256 bindings are in the [owner audit](../data/design-refresh-2026-09-22-phoenix-prompt-read-exists.md). This proposal provides no independent P3, dry-census, GATE 2, or implementation credit.

# Instance

- id: `phoenix-prompt-read-exists`
- file:line: `packages/drivers/phoenix/src/Phoenix.models.ts:825`
- symbol: `PhoenixPromptReadResult`
- members: `exists`, `promptVersionId`
- evidence classes:
  - E3 at `packages/drivers/phoenix/src/Phoenix.service.ts:522` — `exists` is `O.isSome(prompt)` and `promptVersionId` is `O.getOrNull` of the same Option; the boolean restates payload presence.

# Current shape

Live declaration at `packages/drivers/phoenix/src/Phoenix.models.ts:825`:

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
const PhoenixPromptReadStatus = LiteralKit(["missing", "present"]);

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
  $I.annoteSchema("PhoenixPromptReadResult", {
    description: "Readback result for a Phoenix prompt selector.",
  }),
  S.toTaggedUnion("status")
);
export type PhoenixPromptReadResult = typeof PhoenixPromptReadResult.Type;
```

Construct through `PhoenixPromptReadResult.cases.missing.make({})` and `.cases.present.make({ promptVersionId })`; branch through the schema-derived `match`/guards rather than adding `isPresent` helpers.

# Migration inventory

- `packages/drivers/phoenix/src/Phoenix.models.ts:9-12` — retain `LiteralKit`, add `Tuple`, and keep the existing schema imports.
- `packages/drivers/phoenix/src/Phoenix.models.ts:810-837` — update the documentation example and replace the class bag with `PhoenixPromptReadStatus`, the two classes, and `PhoenixPromptReadResult` tagged union.
- `packages/drivers/phoenix/src/Phoenix.service.ts:42` — the import name remains stable but now refers to the tagged-union schema/value type.
- `packages/drivers/phoenix/src/Phoenix.service.ts:93` — the SDK adapter return contract keeps `Promise<PhoenixPromptReadResult>`; its structural members change.
- `packages/drivers/phoenix/src/Phoenix.service.ts:128` — the Effect service return contract keeps `Effect<PhoenixPromptReadResult, PhoenixError>`.
- `packages/drivers/phoenix/src/Phoenix.service.ts:519-529` — replace the duplicate `O.isSome`/`O.getOrNull` projection with one `O.match`: missing constructs the missing case; present constructs the present case from `value.id`.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:156` — the injected SDK writer constructs the present case.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:260-280` — the getPrompt read asserts/narrows `status: "present"` rather than reading `exists`.
- `packages/tooling/library/ai-metrics/test/agent-effectiveness.test.ts:478-483` — the cross-package fake SDK constructs the present case.

The similarly named reads at `packages/drivers/phoenix/test/Phoenix.service.test.ts:207-217` and `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:4030` are `PhoenixPromptWriteResult` values, not this instance, and must not be changed.

# Guard-deletion accounting

- `packages/drivers/phoenix/src/Phoenix.service.ts:521-529` — delete the two parallel presence interpretations (`O.isSome(prompt)` and `O.map(...).getOrNull`) and their coherence obligation. One `O.match` chooses exactly one schema case. This is removal of redundant derived state, not removal of an existing runtime rejection guard.
- `packages/drivers/phoenix/src/Phoenix.models.ts:825-837` — remove the unconstrained boolean/null payload product; the present class requires the string, and the missing class has no id. The old key descriptions do not explicitly state a coherence invariant: do not claim deletion of a comment that does not exist.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:276` — replace the boolean-only assertion with present-case and exact-id assertions. This is a test migration, not a production guard deletion.
- There is no existing production if-chain, coherence validator, or legacy normalizer for this result. Preserve the unrelated selector-value guard at `Phoenix.service.ts:623-630`: it protects the request, not the result.

# Encoded-side impact

The encoding of this internal schema deliberately changes from `{ exists, promptVersionId }` to `{ status: "missing" }` or `{ status: "present", promptVersionId }`. The old schema accepts four boolean/payload-presence combinations, while the target accepts only the two domain cases under the new names. No decoder default is introduced; preserve unrestricted `S.String` ids, including empty strings. No compatibility codec is proposed because no supported persistence or wire use was found.

Boundary proof: the installed SDK `src/prompts/getPrompt.ts:22-28` returns `Promise<PromptVersion | null>`, not the old result bag. `Phoenix.service.ts:519-529` synthesizes that bag only after the SDK returns. The service interface at line 128 and forwarding method at lines 623-630 expose it in-process. Exhaustive symbol/getPrompt searches found the production writer, the two test SDK writers, the Phoenix readback test and documentation example; the only encode/decode use of this result is schema-derived round-trip testing at `Phoenix.service.test.ts:70,175-190`. No persistence, HTTP, RPC, MCP or CLI serializer of this result was found. This is therefore an internal projection, not a D2 external wire mirror, despite living in a driver package.

The package is private, but that fact alone does not prove absence of consumers. Its root barrel (`src/index.ts:71`) and wildcard source export (`package.json` exports) expose this schema inside the workspace; the ai-metrics fixture demonstrates an actual cross-package consumer. Migrate all known consumers atomically. The decoded-TS decision rider is not a blanket authorization to change persisted/wire encoding: this particular encoded change is justified by the inspected internal-only use above and must remain explicit in P3 review. If a supported encoded boundary is discovered before apply, reopen this design and classify its compatibility needs rather than quietly adding an alias or changing wire behavior.

# Test impact

- `packages/drivers/phoenix/test/Phoenix.service.test.ts:47-70,175-190` — schema inventory continues to include `PhoenixPromptReadResult`; schema-derived arbitrary/codec coverage now generates only the two legal cases.
- `packages/drivers/phoenix/test/Phoenix.service.test.ts:155-156` and `260-280` — update the fake writer and getPrompt assertion to the present case; add the currently absent missing-result service assertion, with an SDK override returning the missing case. That fixture checks forwarding only. Also exercise the production adapter with mocked SDK nullable returns (null and undefined defensively, plus a concrete id), preserving SDK rejection mapping and the selector validation test at lines 283-293. Do not treat injected result fixtures as proof of the real adapter mapping.
- `packages/tooling/library/ai-metrics/test/agent-effectiveness.test.ts:478-483` — update the cross-package fake constructor.

# Risk & sequencing

Although classified Tier 1, this exported driver model crosses into `@beep/repo-ai-metrics` test adapters. Land the model, Phoenix service writer, package tests, and cross-package fake together. Do not change `PhoenixPromptWriteResult`, whose non-null `promptVersionId` is a separate already-coherent result.

# Qualification and review obligations

Keep E3 with 4 representable / 2 legal presence classes, `derived`, `internal`, `tagged-union`, Tier 1. This counts presence classes, not the unbounded number of possible string values. The scanner net is not itself proof; this existing E3 result/payload record is retained because the concrete writer ties both members to the same Option. Do not introduce stored state.

The status LiteralKit and member classes are implementation details unless consumed elsewhere; export the union and same-name derived type. No unused status type/export is needed. The displayed schema is a design sketch, not compiled implementation evidence; at apply time verify current local Effect APIs and use schema-derived cases/guards.

The public round-trip property test must generate both union cases and round-trip the new encoding; add explicit expected encoded values for both cases and structural rejection of malformed present values. Run full package verification for `@beep/phoenix` and `@beep/repo-ai-metrics` after implementation. No gesture-bearing UI is touched.

## Schema helper preservation correction

Use the private, unannotated LiteralKit base for `mapMembers`. Current `withLiteralKitStatics` does not copy `mapMembers`, so it cannot repair an annotated kit for this construction. Annotate the assembled union before `S.toTaggedUnion("status")`; the latter attaches `cases`, `guards`, and `match` to the resulting schema. Do not apply a rebuilding schema annotation afterward.
