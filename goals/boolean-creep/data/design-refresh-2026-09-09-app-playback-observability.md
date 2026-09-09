# App playback and observability design refresh

## Source

- Checkout: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Corpus: `origin/main@9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Scope: Round 26 app candidates and all live writers, readers, tests, and
  capability boundaries for the two qualified owners below.

## Qualified designs

### `r2-apps-hero-clip-playback`

The stable ID survives, but its old two-member D1 judgment was incomplete.
`active` is written by rotation (`HeroVideo.tsx:314-328`) and `playing` is
written by media/ref callbacks (`HeroVideo.tsx:73-97, 253`), so all four source
pairs are legitimate. `HeroClipLayer` adds `posterHidden = active && playing`
at line 229. The complete owner is therefore `active`, `playing`, and
`posterHidden`: 8 representable tuples, 4 legal presentations, E4 at line 229,
derived/internal, LiteralKit, Tier 1.

The repaired design preserves the inactive-playing transition, both atom
writers and defaults, video mount behavior, exact opacity classes, rotation,
and public props. It introduces a private four-value render projection and
deletes only the redundant poster boolean and its repeated conditional. There
is no encoded boundary. Implementation requires focused component coverage and
recorded browser QA because media crossfade behavior is gesture bearing.

### `r3-apps-sidecar-devtools-gates`

The stable owner remains the local `devtoolsRequested`/`devtoolsAllowed` pair.
Source lines 63-65 establish exactly three pairs: `(false,true)`,
`(true,true)`, and `(true,false)`. The full metadata is 4/3, E4,
derived/internal, LiteralKit, Tier 1. The inline `devtoolsEnabled` property at
line 85 belongs to the separate `ServerObservabilityConfig` construction and
is downstream projection evidence, not a third sibling in this carrier.

The repaired design classifies `disabled`, `enabled`, or
`blocked-non-local` privately, preserves false-request short-circuiting and
every environment default, and projects only the existing boolean into
`ServerObservabilityConfig` (`packages/foundation/capability/observability/src/server/Config.ts:48-65`).
The downstream layer still branches on that adapter field at
`server/Layer.ts:76-82`. No encoded shape changes. Non-local and invalid URLs
remain blocked and warned only when requested.

## Callable scope adjudication

The following findings do not describe sibling boolean values in a type,
schema, props object, or state carrier. They are separately invoked zero-arg
predicates and are outside the campaign net. Their truth relations can be
reasoned about per call, but there is no multi-boolean value to replace.

- `App.spikeFlags`: `isDevMode`, `hasCosmosSpikeFlag`, and
  `hasGraph3dSpikeFlag` are function declarations at
  `apps/professional-desktop/src/App.tsx:105-110,258-266`. The two spike
  predicates invoke `isDevMode` independently, and `App` calls them in
  separate branches at lines 962 and 970. Recommend withdrawing the raw
  confirmed `r26-apps-spike-dev-mode-implication` and the existing live D1
  record `r2-apps-app-spike-surface-flags` from the current projection;
  historical copies remain in the archive.
- `App.ipcCosmosSpikeFlags`: `hasIpcSpikeFlag` and `hasCosmosSpikeFlag` are
  separate functions at `App.tsx:255-261`, called in different render paths at
  lines 852 and 962. The raw D1 ID is
  `r26-apps-ipc-cosmos-spike-gates`; no separate old live canonical ID exists.
  Do not admit it.
- `shouldSkipHeroVideo`: the reduced-motion, save-data, and connection-speed
  observations are branch-local expressions inside one predicate at
  `apps/oip-web/src/components/HeroVideo.tsx:99-114`. Consumers call the one
  returned skip decision at lines 139 and 181; no sibling state or result
  carrier exposes the underlying booleans. The raw D1 ID is
  `r26-apps-hero-skip-connection-gates`; no old live canonical ID exists. Do
  not admit it.

This ruling is specific to callable predicates. It does not exclude actual
CLI configuration objects, schemas, props, or stored state that are later
passed to functions.

## Verification

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` —
  passed: `design coverage OK: 159 qualified ids`.
- `git diff --check` over the three owned files — passed.
- Scope: only the two design files and this handoff are owned by this lane;
  product source, tests, inventory, statuses, dependencies, generated files,
  and git refs were not changed.

## Remaining decisions

- Parent must update the live inventory metadata for both qualified owners and
  decide the archive/removal receipts for the callable records. This lane does
  not mutate canonical inventory or campaign status.
- Formal P3 review remains pending.
- Upstream advanced to
  `origin/main@52fcc8d1353db9481ef9edb6cc9619500f95568d` after this bounded source
  audit began. Per the source freeze, these conclusions and citations remain
  tied to checkout `7440cb8c` / corpus `9b7553f`; refresh their line/source
  metadata after the parent merges the new main delta.
