# Instance

- id: `r2-apps-hero-clip-playback`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus: `origin/main@9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `apps/oip-web/src/components/HeroVideo.tsx:216`
- symbol: `HeroClipLayer.playback`
- members: `active`, `playing`, `posterHidden`
- evidence: E4 at `HeroVideo.tsx:229` — `posterHidden` is exactly
  `active && playing`, so a hidden poster implies both an active layer and a
  playing video. Four of the eight triples are impossible.

# Current shape

`HeroClipLayer` receives `active` from the rotation projection and reads
`playing` from the clip-keyed media atom. Those are independent facts. In
particular, a rotation render can make a formerly active layer inactive while
its atom still says playing until the video ref cleanup writes false
(`HeroVideo.tsx:73-97, 314-328`). The component then creates a third boolean,
`posterHidden`, from their conjunction and separately branches on all three
facts for the poster, video, and layered wrapper (`HeroVideo.tsx:229-272`).

The existing stable record considered only `active` and `playing` and correctly
classified that pair D1. The current qualified owner is the expanded cluster:
the independent source pair plus its redundant derived alias. `layered` is an
independent layout choice and is outside this owner.

# Cardinality gap

Three booleans represent eight tuples. Exactly four playback presentations are
legal:

| Playback presentation | `active` | `playing` | `posterHidden` |
| --- | --- | --- | --- |
| `inactive-idle` | false | false | false |
| `inactive-playing` | false | true | false |
| `active-loading` | true | false | false |
| `active-playing` | true | true | true |

The inactive-playing case is legitimate current behavior, not an invalid state:
rotation owns `active`, while media callbacks and ref cleanup own `playing`.
The only invariant is `posterHidden === (active && playing)`.

# Target schema

Define a private annotated `HeroClipPlayback` LiteralKit with
`inactive-idle`, `inactive-playing`, `active-loading`, and `active-playing`.
Add one pure classifier from the two source facts and derive the poster and
video opacity decisions with the LiteralKit helpers. Keep `active` as the
rotation prop and `playing` in `HeroVideoState`; the literal is a render-time
projection and must not become another atom or encoded model.

This four-value literal preserves the independent inputs while making the
poster visibility decision exhaustive. It must not collapse
`inactive-playing` into `inactive-idle`, assert that playing implies active, or
add a boolean compatibility getter for `posterHidden`.

# Migration inventory

- `apps/oip-web/src/components/HeroVideo.tsx:7-14` — add the narrow
  `@beep/schema/LiteralKit` import and define the private annotated playback
  literal/classifier near the component helpers, reusing the existing `$I`
  identity composer.
- `HeroVideo.tsx:56-97` — retain `HeroVideoState`, its false default, the
  element-null reset, and the independent playing writer. These are source
  facts, not the redundant representation.
- `HeroVideo.tsx:208-263` — classify `active` and `playing` once, remove
  `posterHidden`, and select the exact existing poster/video opacity classes
  from the playback literal. Continue mounting the video only when `active`.
- `HeroVideo.tsx:269-272` — preserve the independent `layered` wrapper and its
  active-layer opacity behavior.
- `HeroVideo.tsx:305-331` — preserve rotation indexing and the
  `index === activeIndex` writer.
- `apps/oip-web/test/oip-web.test.tsx:418-523` — retain autoplay and rotation
  coverage and extend it to the four playback presentations, including the
  inactive-playing transition before ref cleanup.

# Guard-deletion accounting

Delete the `posterHidden` boolean, its `active && playing` initializer, and the
poster opacity ternary that reads the alias. Replace the separate poster/video
boolean decisions with one exhaustive playback-literal projection. Do not
delete or alias the independent `active` prop or `playing` atom field.

# Encoded-side impact

None. `HeroClipPlayback` is private derived render state. `HeroClipMedia`,
`HeroVideoState`, atom keys and defaults, public `HeroVideo` props, DOM
attributes, asset URLs, media events, CSS class strings, and timer behavior
remain unchanged. No literal is serialized, persisted, or exposed through a
wire boundary.

# Test impact

Add a pure four-row classifier table and component assertions for the exact
poster/video opacity and mount behavior of each presentation. Retain the
existing proof that idle autoplay calls `load` then `play`, that `onPlaying`
hides the active poster, and that rotation switches wrapper opacity. Include
the render where the old clip is inactive while its stored playing bit has not
yet been cleared. Preserve reduced-motion, save-data, 2g, timer cleanup, and
play-rejection coverage.

This changes gesture-bearing media presentation. The implementation must run
the `browser-qa-loop` record, extract, and judge flow with `requiredCount: 0`,
plus focused OIP component tests and full `@beep/oip-web` package verification.

# Risk and sequencing

Land in the Tier 1 app UI batch. The principal risk is accidentally treating
inactive-playing as impossible and changing crossfade timing during rotation.
Preserve current React/Atom update order, video mounting, media callbacks, and
all four source combinations; this refactor only removes the derived boolean
alias and centralizes presentation selection.
