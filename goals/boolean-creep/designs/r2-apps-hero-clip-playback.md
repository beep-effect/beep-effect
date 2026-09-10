# Design: r2-apps-hero-clip-playback

Current P2 design at source `93217d998f851e2e93d9864e2b5315552eaa58a7`,
main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Actual owner `HeroClipLayer`;
16 representable / 6 legal, Tier 1.
Native source and inferred-type corrections are integrated in
`data/r28-agent-app-integration.json`. This is not an independent P3 receipt;
review and the merged packet-only ratification remain required before implementation.

## Current shape

`HeroClipLayer` receives actual Boolean `active` and `layered` props at
216 and 218, reads actual local Boolean `playing` at 224 from the clip-keyed
atom, and binds actual Boolean `posterHidden = active && playing` at 229.
The poster, video and layer wrapper then branch separately at 240, 244,
255, 265 and 272. Required strings, the index, optional webm source and
the parent required clips array retain their complete payload roles.

The private writer at 319-328 derives selection from the public full clips
array. Empty clips return no layer at 310-312. A one-clip render is always
active and nonlayered. More than one clip gives layered active/inactive
instances, with selection computed at 314-315 and passed at 322/324.
The rotation atom starts at zero and advances modulo its count at 172-192.
There is no public direct constructor or second writer for `HeroClipLayer`.

`playing` has an independent writer at 86-97; the element ref setter at
73-82 resets it on null, and the media callback at 253 sets it true.
An old active layer may render inactive while playing remains true before
ref cleanup. Preserve this intermediate presentation and the current
key-sharing behavior when clip payloads produce identical keys.

## Cardinality gap

The connected four-Boolean owner admits 16 raw tuples and six legal tuples:

| Case | active | layered | playing | posterHidden |
| --- | --- | --- | --- | --- |
| single-loading | true | false | false | false |
| single-playing | true | false | true | true |
| layered-active-loading | true | true | false | false |
| layered-active-playing | true | true | true | true |
| layered-inactive-idle | false | true | false | false |
| layered-inactive-playing | false | true | true | false |

The laws are `posterHidden === (active && playing)` at 229 and
`!layered => active` from the complete private props writer at 310-328.
The earlier 8/4 projection remains correct for its three members but leaves
out the connected `layered` member. The existing `hero-clip-layer-flags`
D1 projection is wholly contained and is archived as superseded in the integration receipt. Its prior reasoning remains historical.

This does not admit array emptiness, array length or payload existence as
new Boolean axes. The actual bound `layered` prop is the fourth member.
The separate `HeroVideoState` schema is unchanged: playing with a null
element remains supported by its independent writer, as its separate D1
record already documents.

## Target schema

Reuse the public `@beep/schema/LiteralKit` implementation and existing `$I`
identity composer. The live implementation is
`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`,
exported through its `index.ts` and the schema package barrel. Targeted source
search found no existing Hero placement/presentation domain to reuse.

Introduce two private annotated literal domains with distinct data roles:

```ts
const HeroClipPlacement = LiteralKit([
  "single",
  "layered-active",
  "layered-inactive",
]);

const HeroClipPresentation = LiteralKit([
  "single-loading",
  "single-playing",
  "layered-active-loading",
  "layered-active-playing",
  "layered-inactive-idle",
  "layered-inactive-playing",
]);
```

This sketch specifies vocabulary; implementation adds the existing `$I`
schema annotations and uses the literal helpers rather than hand-written
literal unions. Neither domain needs payload-bearing tagged variants.

Change only the private layer props: replace `active` and `layered` with
`placement: typeof HeroClipPlacement.Type`. Keep `index`, `mp4`, `poster`
and optional `webm` exactly as they are. The sole writer derives placement
from the nonempty collection and current index: one clip selects `single`;
otherwise index equality selects one of the two layered cases. It no longer
forwards two independently representable Boolean selection props.

Inside `HeroClipLayer`, keep the same keyed atom read and callbacks. Derive
one render-time `HeroClipPresentation` by exhaustively matching placement
and selecting the corresponding idle/loading or playing literal. This is a
three-case placement domain times an independent playing Boolean: all six
source combinations are legal. The six-case presentation is a derived view,
not another stored atom, effect transition or public prop. The two domains
describe producer selection and the final render respectively; they are not
two newly admitted overlapping census clusters.

Project the existing JSX decisions directly from the presentation helpers
or exhaustive matches. Do not introduce a replacement object of
`isActive`, `isLayered`, `isPlaying`, `posterHidden` booleans. Keep the
media tree stable across cases; avoid duplicating whole JSX trees in a way
that changes element identity, ref callbacks or mount/unmount order.

## Migration inventory

| Source / boundary | Required migration or preserved behavior |
| --- | --- |
| `HeroVideo.tsx:9-18` | Add the narrow LiteralKit import; use existing `$I` for private schema annotations. |
| `HeroVideo.tsx:41-71` | Preserve `HeroClipMedia`, all asset fields, `HeroVideoState`, default `element=null`, default `playing=false`, shared empty instance and exact clip keys. |
| `HeroVideo.tsx:73-97` | Preserve element-null playing reset and independent playing setter; no new restriction relating playing to active, placement or element presence. |
| `HeroVideo.tsx:99-150` | Preserve reduced-motion/save-data/2g skipping, idle callback or timer scheduling, load-before-play, rejected-play handling and cancellation. |
| `HeroVideo.tsx:164-199` | Preserve public `HERO_ROTATE_MS`, rotation-set key, modulo update, zero initialization, count guards and interval finalizer. |
| `HeroVideo.tsx:208-229` | Replace only private active/layered props with placement; keep key/playing/setters/autoplay hook; derive one presentation and delete posterHidden. |
| `HeroVideo.tsx:231-263` | Preserve Image payload/options/classes, video mount, ref, attributes, playing callback, optional webm-before-mp4 ordering and source URLs. Select visual states from presentation. |
| `HeroVideo.tsx:265-275` | Preserve absence of a wrapper for single clips; preserve indexed wrapper and exact transition/opacity classes for layered cases. |
| `HeroVideo.tsx:305-331` | Preserve the public clips contract, empty collection behavior, rotation key and active-index math, map order and React key. Construct the private placement at the sole writer and pass the full media payload. |
| `OipHomePage.tsx:157-163` | Public caller continues passing all clip asset fields. No API migration or asset transformation changes. |
| `oip-web.test.tsx:422-480,482-525,529-553` | Preserve public single/multiple clip fixtures, autoplay/playing assertions, interval rotation and reduced-motion suppression; extend focused proof for the six cases. |

Targeted source and fixture searches found one private layer writer and one
production public `HeroVideo` consumer, plus the three public test fixtures.
The exported `HeroVideo` and `HERO_ROTATE_MS` remain exported; the schemas,
private layer, media-state atoms and new literal domains remain unexported.
No barrel, external decoder, serializer, command, persistence reader or
legacy compatibility adapter consumes the private Boolean pair.

## Guard-deletion accounting

Delete the private `active` and `layered` Boolean prop declarations and
their separate JSX assignments at 216/218 and 322/324. Replace the
comment-only private selection law with the three-case placement prop.
The required collection-length and index comparisons still select cases
at the producer; they are real business decisions and are not claimed as
deleted input validation.

Delete the `posterHidden` local and `active && playing` initializer at
229. Replace its opacity ternary at 240, the active mount test at 244,
the playing opacity ternary at 255, the nonlayered branch at 265 and the
active wrapper-opacity ternary at 272 with direct literal projections.
The same visual choices remain, now exhaustively owned by the six cases.
Do not claim all conditional rendering disappears or remove the independent
playing field/setter. Delete no autoplay, environment, optional-source or
rotation-count guard: those enforce separate behavior.

## Encoded-side impact

None. Public `HeroVideo({ clips })`, `HeroClipMedia` field types, source
ordering, assets, atom storage, keys, defaults and exported interval remain
unchanged. Both new domains are private in-memory derived values. No wire,
JSON, storage, Rust or external SDK encoding changes, and no legacy codec is
introduced. Unknown direct private props are not a supported external
compatibility boundary; the sole actual writer migrates in the same change.

Preserve these observable DOM choices exactly:

| Presentation | Wrapper | Poster opacity | Video |
| --- | --- | --- | --- |
| single-loading | absent | 70 | mounted, opacity 0 |
| single-playing | absent | 0 | mounted, opacity 70 |
| layered-active-loading | indexed, opacity 100 | 70 | mounted, opacity 0 |
| layered-active-playing | indexed, opacity 100 | 0 | mounted, opacity 70 |
| layered-inactive-idle | indexed, opacity 0 | 70 | absent |
| layered-inactive-playing | indexed, opacity 0 | 70 | absent |

The two inactive cases have equal DOM projections but different legitimate
source observations; keep both in the literal domain and preserve callback
timing. Image `aria-hidden`, video `aria-hidden`, muted/loop/playsInline,
preload, tabIndex, size/quality, transition durations and all CSS strings
remain as today. Do not promote the DOM constants into new state members.

## Test impact

Implementation should verify the three valid placements and all six
presentations against the DOM contract table, with no representable
nonlayered-inactive private prop state. Preserve the public single-clip
autoplay scenario, first playing event, two-clip rotation, reduced motion,
save-data/2g checks, play rejection, cancellation and unmount cleanup.
Exercise the inactive-playing render before ref cleanup instead of asserting
playing implies active. Preserve full webm/mp4 ordering and test the legal
omitted-webm payload. Retain zero clips and current duplicate-key behavior;
introduce no validation or uniqueness requirement.

Existing source fixtures supply single and multiple clips; no complete
six-state suite has been executed for this audit. The eventual UI change
requires recorded browser QA: portless record -> extract -> judge with
`requiredCount: 0`, relevant focused component checks, and full
`@beep/oip-web` package verification. This design-only
task executes none of those product commands and claims no acceptance result.

## Risk

Tier 1 app UI work after independent P3 review and packet ratification.
Principal risks are dropping inactive-playing, altering ref identity or
React tree shape while replacing conditions, changing atom keys/defaults,
or discarding clip/source payloads. The placement domain is private; preserve
the public clips API and all existing side-effect ordering. Keep the atom's
playing value as source state and derive presentation during render.

The integration supersedes `hero-clip-layer-flags` as a contained projection
and archives the original three-member design bytes under the receipt. The separate HeroVideoState D1
owner remains unchanged. If independent review finds an additional supported
private writer, reopen placement legality before applying; generic structural
type permissiveness alone is not such evidence.
