# Callable-predicate eligibility audit — 2026-09-09

## Scope and rule

This bounded audit covers only the twelve requested canonical D1 records. Live
source was inspected at checkout
`7440cb8c4302ce64b87860069a464bafbf65f576`, corresponding to the packages/apps
main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

The campaign inventories Boolean value carriers: sibling fields, locals,
parameters, or other simultaneously materialized Boolean observations whose
legal combinations can be counted. A predicate declaration is a callable API,
not a Boolean member. Calls may return Boolean values, but an inline condition,
short-circuit expression, nested helper call, or calls at separate sites do not
create a sibling bit-vector carrier unless the results are actually bound,
stored, returned together, or jointly consumed as such.

All twelve records should be **withdrawn out of net** and retained only as
historical exclusions. None should remain a D1 candidate. This is an eligibility
correction rather than a claim that all mathematical combinations of predicate
results are possible.

## Record decisions

### `r3-tooling-media-kind-from-extension`

**Recommendation: withdraw out of net.**

- `Files.media.ts:447` declares `isImageFileExtension` as the schema guard
  returned by `S.is(ImageFileExtension)`.
- `Files.media.ts:463` separately declares `isVideoFileExtension` as
  `S.is(VideoFileExtension)`.
- `Files.media.ts:562-574` calls the guards sequentially and immediately returns
  `Option<MediaKind>` as image, video, or None. It does not bind or carry a pair
  of Boolean values.

The existing `Option<MediaKind>` is already the honest classification owner.
The two exported callable guards remain useful independently; replacing them
with another state domain would duplicate that owner without deleting Boolean
state.

### `r24-architecture-ecosystem-internal-variant-is-guards`

**Recommendation: withdraw out of net.**

- `packages/ecosystem/effect-drizzle/src/core/variant.ts:16` declares the six
  canonical literal values.
- `variant.ts:38` derives the existing `Variant` type from that tuple.
- `variant.ts:45-54` exposes six property values under `Variant.is`, but each
  property is a function `(unknown) => value is Literal`, not a Boolean.
- Repository search at the frozen source found no consumer that materializes
  their six results as a value vector; consumers use the existing literal
  domain and `VariantSchema` factory at `variant.ts:63-66`.

Mutual exclusivity for one argument is a property of the already-owned literal
domain. A guard toolkit is outside the Boolean-carrier census.

### `r25-foundation-schema-n-z-percentage-zero-full`

**Recommendation: withdraw out of net.**

- `packages/foundation/modeling/schema/src/Percentage.ts:180` declares
  `isZero(percentage): boolean`.
- `Percentage.ts:197` separately declares `isFull(percentage): boolean`.
- `packages/foundation/modeling/schema/test/Percentage.test.ts:30-33` calls the
  functions as independent scalar checks; no production or test consumer binds
  both outputs into sibling state.

The `Percentage` scalar remains the domain owner. Although one percentage
cannot be both zero and one hundred, that numeric fact does not turn its two
callable predicates into a Boolean carrier.

### `r25-foundation-ui-mermaid-inline-style-safety`

**Recommendation: withdraw out of net.**

- `packages/foundation/ui-system/editor/src/mermaid-view.tsx:176-189` declares
  `hasUnsafeLayoutStyle(style)` as a callable CSS predicate.
- `mermaid-view.tsx:191-198` declares `isSafeMermaidRootStyle(style)` as a
  separate callable predicate.
- `mermaid-view.tsx:352-365` invokes the predicates in separate short-circuit
  paths while validating a stylesheet rule.
- `mermaid-view.tsx:609-612` invokes both inline while validating one element's
  style, returning one aggregate Boolean without materializing their results as
  sibling values.

The calls can reject for different reasons and both failures may describe one
style, but no pair is declared, returned, or stored. The sanitizer's one
aggregate result is not a two-bit state carrier.

### `r25-foundation-ui-mermaid-fragment-url-safety`

**Recommendation: withdraw out of net.**

- `mermaid-view.tsx:402-410` declares
  `hasUniqueInternalFragmentTarget(root,id)` as a per-ID callable predicate.
- `mermaid-view.tsx:412-428` declares the multi-token aggregator
  `hasSafeLocalFragmentUrls(root,value)`. It calls the per-ID predicate zero or
  more times at line 423, folds those results into its private
  `targetsAreSafe`, and returns one final Boolean with the leftover-URL check.
- `mermaid-view.tsx:621,624,629` invokes these APIs for different attribute
  policies; no object or tuple carries both named function results.

The aggregator/callee relationship is control flow. The aggregator's internal
fold is one accumulated Boolean, not a sibling pair with the callable helper.

### `r25-foundation-ui-composer-enter-modifiers`

**Recommendation: withdraw out of net.**

- `packages/foundation/ui-system/editor/src/chat/atoms.ts:710` declares
  `hasCommandModifier(event)` as a callable event predicate.
- `chat/atoms.ts:712-717` separately declares `isImeComposing(event)`.
- `chat/atoms.ts:719-720` calls only the modifier predicate in the configured
  enter-send policy.
- `chat/atoms.ts:776` handles IME composition first; lines 784, 797, and 802
  call modifier/send predicates in later keyboard-command branches.

The same `KeyboardEvent` can carry both observations, and their behavior must
remain unchanged, but the handler never binds them as sibling Boolean values.
Separate policy calls in ordered branches do not create a state carrier.

### `r25-foundation-ui-link-preview-url-predicates`

**Recommendation: withdraw out of net.**

- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:195`
  declares `isEmail(value)` as a callable string predicate.
- `link-preview.tsx:197-204` declares `isValidHttpUrl(value)` separately.
- `link-preview.tsx:297` invokes both inline with length and `mailto:` checks to
  produce the single local `isValidUrl`.
- `link-preview.tsx:307,368` consume only that aggregate eligibility value for
  error and rendering branches.

The two named members are functions, and their outputs are never materialized
as a pair. The one actual Boolean local is a single URL-eligibility result, not
a multi-member carrier.

### `r25-shared-documents-transient-box-retryable`

**Recommendation: withdraw out of net.**

- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:219` declares
  `transientBoxStatus(status)` as a status classifier.
- `DmsMirrorBox.ts:226-230` declares `isRetryableBoxFailure(error)` as an error
  classifier. Its Option match invokes `transientBoxStatus` only in the Some
  status arm and uses the transport-reason guard in the None arm.
- `DmsMirrorBox.ts:258` separately reuses the status predicate when deriving a
  disconnect reason; `DmsMirrorBox.ts:276` calls the error-level predicate for
  the encoded retryable field.

These are nested and separately reused callable classifiers over different
input types. No status/result Boolean pair exists in the adapter state or
error payload.

### `r25-cli-commands-d-k-knowledge-home-convention-gates`

**Recommendation: withdraw out of net.**

- `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1774-1775`
  declares `hasConventionPrefix(conventions,token)` with a caller-supplied set.
- `Knowledge.refs.ts:1777-1778` declares `isExactHomeConvention(token)` against
  a separate fixed exact-match set.
- `Knowledge.refs.ts:1851` calls both inline in one home-anchor acceptance OR;
  line 1855 calls only the prefix function with the temporary convention set.

Different argument domains and reuse sites make these predicate APIs especially
unsuitable as purported sibling members. The OR returns one policy decision and
does not carry the two call results.

### `r25-cli-commands-d-k-adaface-runtime-warning-gates`

**Recommendation: withdraw out of net.**

- `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.ts:1174-1176`
  declares `hasSingleRocmFallbackWarning(runtime)` as a callable predicate.
- `MatchPerson.ts:1178-1190` declares
  `hasCoherentAdaFaceRuntimeWarnings(runtime,compute)` and invokes the narrower
  predicate only for the auto-requested/CPU-actual arm at line 1186.
- `MatchPerson.ts:1192-1200` consumes only the aggregate coherence call in the
  validator; line 1209 composes that validator with the other runtime checks.

The nested call is part of a decidable validation policy. Neither function
returns both results, and the validator stores neither, so there is no Boolean
carrier to redesign.

### `r25-cli-yeet-proof-ledger-identity-gates`

**Recommendation: withdraw out of net.**

- `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofLedger.ts:106-109`
  declares `sameActionInputs(left,right)`.
- `ProofLedger.ts:111-114` declares `sameReuseIdentity(left,right)`, which calls
  the first predicate and adds environment/epoch equality.
- `ProofLedger.ts:225` calls full reuse identity while locating an exact fact;
  line 233 separately calls action-input identity while locating a related fact.

The logical implication between callable comparison policies is real, but
their results are not simultaneous state. They are invoked at different lookup
sites for different decisions and never become a sibling value pair.

### `docgen-rubric-void-observable-predicates`

**Recommendation: withdraw out of net.**

- `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.rubric.ts:50-53`
  declares `exampleOnlyVoidsResult(example)`.
- `Quality.rubric.ts:64-65` separately declares
  `exampleHasObservableResult(example)`.
- `Quality.rubric.ts:82-86` wraps the functions in distinct subject-aware
  predicates.
- `Quality.rubric.ts:150-158` installs the void-only wrapper as one finding
  rule; the observable wrapper contributes to subject-evidence policy rather
  than forming a two-result record.

Regex relationships between two callable analyses of an example do not create
a runtime bit vector. The rubric evaluates predicate policies as needed and
emits findings; it does not persist these two named results together.

## Canonical disposition recommendation

Withdraw all twelve IDs from the active D1 census and preserve their current
source explanations as historical exclusion evidence:

1. `r3-tooling-media-kind-from-extension`
2. `r24-architecture-ecosystem-internal-variant-is-guards`
3. `r25-foundation-schema-n-z-percentage-zero-full`
4. `r25-foundation-ui-mermaid-inline-style-safety`
5. `r25-foundation-ui-mermaid-fragment-url-safety`
6. `r25-foundation-ui-composer-enter-modifiers`
7. `r25-foundation-ui-link-preview-url-predicates`
8. `r25-shared-documents-transient-box-retryable`
9. `r25-cli-commands-d-k-knowledge-home-convention-gates`
10. `r25-cli-commands-d-k-adaface-runtime-warning-gates`
11. `r25-cli-yeet-proof-ledger-identity-gates`
12. `docgen-rubric-void-observable-predicates`

No retain-D1 cases remain in this bounded set. This recommendation does not
alter or remove the predicate functions themselves, change their validation
semantics, or preclude a future candidate based on actual Boolean fields or
locals. It only corrects the eligibility category of these recorded IDs.

## Change boundary and validation

Only this handoff file was added. Product source, tests, designs, canonical
inventory, lifecycle status, dependencies, generated files, and git refs were
not changed. Parent owns canonical withdrawal/archive updates. A scoped
no-index whitespace check is required because this file is new and untracked.
