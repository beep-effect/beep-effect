# Instance

- id: `link-preview-fetch-machine`
- file:line: `packages/foundation/ui-system/ui/src/components/link-preview.tsx:46`
- symbol: `LinkPreviewState`
- members: `isLoading`, `error`, `fetchedMetadata`
- evidence classes:
  - E3 at `packages/foundation/ui-system/ui/src/components/link-preview.tsx:46` — isLoading plus nullable error/fetchedMetadata: the boolean duplicates payload presence — one fetch machine split across three fields.
  - E1 at `packages/foundation/ui-system/ui/src/components/link-preview.tsx:146` — write sites set isLoading true with payloads cleared, then flip it false while setting exactly one payload (lines 146/158/182).

# Current shape

Live declaration at `packages/foundation/ui-system/ui/src/components/link-preview.tsx:46`:

```ts
type LinkPreviewState = {
  readonly error: null | string;
  readonly fetchedMetadata: null | UrlMetadata;
  readonly isLoading: boolean;
  readonly validFavicon: boolean;
  readonly validImage: boolean;
};
```

# Cardinality gap

Ignoring the independent image-validity flags, loading plus two nullable payloads represent eight presence combinations. Four fetch states are legal:

- `idle`: no request is active and neither result payload exists.
- `loading`: a request is active and neither result payload exists.
- `failed(message)`: the request settled with one error message and no metadata.
- `loaded(metadata)`: the request settled with metadata and no error.

The other combinations allow contradictory loading/result or error/metadata states.

# Target schema

Keep `validFavicon` and `validImage` as independent booleans. Add `LiteralKit` to the imports and make the fetch machine a payload-bearing tagged union. The new literal kit is `LinkPreviewFetchStatus`; the new union/type is `LinkPreviewFetchState`.

```ts
import { LiteralKit } from "@beep/schema";

const LinkPreviewFetchStatus = LiteralKit(["idle", "loading", "failed", "loaded"]).pipe(
  $I.annoteSchema("LinkPreviewFetchStatus", {
    description: "Discriminants for the per-URL metadata fetch machine.",
  })
);
type LinkPreviewFetchStatus = typeof LinkPreviewFetchStatus.Type;

const LinkPreviewFetchState = LinkPreviewFetchStatus.toTaggedUnion("status")({
  idle: {},
  loading: {},
  failed: { message: S.String },
  loaded: { metadata: UrlMetadata },
}).pipe(
  $I.annoteSchema("LinkPreviewFetchState", {
    description: "State of the per-URL metadata fetch, with payloads present only in their owning cases.",
  })
);
type LinkPreviewFetchState = typeof LinkPreviewFetchState.Type;

class LinkPreviewState extends S.Class<LinkPreviewState>($I`LinkPreviewState`)(
  {
    fetch: LinkPreviewFetchState,
    validFavicon: S.Boolean,
    validImage: S.Boolean,
  },
  $I.annote("LinkPreviewState", {
    description: "Per-URL link-preview fetch state plus independent image validity observations.",
  })
) {}

const emptyLinkPreviewState = LinkPreviewState.make({
  fetch: LinkPreviewFetchState.cases.idle.make(),
  validFavicon: true,
  validImage: true,
});
```

The local Effect v4 `S.toTaggedUnion` utilities provide `.cases`, `.guards`, and `.match`; `LiteralKit.toTaggedUnion` builds that same utility-bearing union. Constructors omit `status` because each `S.tag(...)` supplies its constructor default.

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:46-52` — replace the nullable payload bag with the schema-backed `LinkPreviewState` and nested `fetch` union.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:59-65` — construct the empty state with the `idle` case and retain both independent validity flags.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:73` — keep the atom family type as `LinkPreviewState`; its initial value is now the class value above.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:138` — replace `fetchedMetadata !== null || isLoading` with fetch-case guards. To preserve the existing retry eligibility, block `loading` and `loaded`; `idle` and `failed` remain eligible when `maybeFetch` is triggered.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:143-147` — replace the partial boolean/null write with `fetch: LinkPreviewFetchState.cases.loading.make()` while spreading the independent validity fields.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:154-160` — write `failed.make({ message: "Preview unavailable" })`.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:167-183` — write `loaded.make({ metadata: UrlMetadata.make(...) })`.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:303` — obtain fetched metadata only from the `loaded` case, falling back to `getFallbackMetadata(href)` for all other cases.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:307` — derive the error message from the `failed.message` payload (with the existing invalid-URL override and fallback text).
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:362-375` — replace the `isLoading` / `error !== null` if/else-if chain with `LinkPreviewFetchState.match`; invalid URL remains an orthogonal rendering override.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:328` and `:342` — keep the independent `validImage` and `validFavicon` writes unchanged; class reconstruction/spread must preserve `fetch`.

# Guard-deletion accounting

- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:138` — delete the coherence guard that separately checks nullable metadata and `isLoading` to infer whether a fetch may start.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:143-147`, `:154-160`, and `:167-183` — delete write-side clearing/coordination of `error`, `fetchedMetadata`, and `isLoading`; each case constructor makes contradictory payloads unrepresentable.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:303` — delete nullable `fetchedMetadata` fallback logic and read only the `loaded` payload.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:307` — delete the nullable-error fallback check.
- `packages/foundation/ui-system/ui/src/components/link-preview.tsx:362-368` — delete the `isLoading` then `error !== null` exclusivity chain and exhaustively match the fetch case.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/ui/test/` reads `LinkPreviewState`, `isLoading`, or `fetchedMetadata`; the `error` matches in `schema-parity.test.ts` belong to unrelated schemas. Add focused component/atom coverage for all four fetch cases, especially failure payload rendering, loaded metadata selection, and preservation of `validImage`/`validFavicon` while the fetch case changes. Existing `packages/foundation/ui-system/ui/stories/components/link-preview.stories.tsx` exercises the public component but does not access these members.

# Risk & sequencing

This is a single-file internal migration, but the asynchronous atom subscription makes retry behavior the main risk. Preserve the current eligibility of `failed` when `maybeFetch` is triggered unless a separate retry-policy change is explicitly approved. Land the union, initial state, all promise continuations, and rendering match together so no partial nullable-bag state remains.
