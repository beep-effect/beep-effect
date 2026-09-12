---
name: Todox
description: Evergreen Ledger — deep-green ink and a mint glow on parchment, forest bands where the product runs.
colors:
  parchment: "#f4ecdc"
  parchment-deep: "#eadfc7"
  parchment-line: "rgb(16 40 31 / 0.14)"
  ink: "#10281f"
  ink-soft: "#3f5a4d"
  ink-mute: "#4f6358"
  accent: "#1e7a55"
  accent-strong: "#145c40"
  accent-wash: "rgb(30 122 85 / 0.1)"
  forest: "#0d221a"
  forest-raised: "#123126"
  forest-line: "rgb(111 240 182 / 0.2)"
  glow: "#6ff0b6"
  glow-mid: "rgb(111 240 182 / 0.78)"
  glow-ghost: "rgb(111 240 182 / 0.6)"
  glow-wash: "rgb(111 240 182 / 0.1)"
  on-forest: "#f2f7f2"
  on-accent: "#f7f3ea"
typography:
  display:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
    fontVariation: "'opsz' 144, 'wght' 500, 'SOFT' 30, 'WONK' 0"
  headline:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "clamp(1.85rem, 3.6vw, 2.75rem)"
    fontWeight: 520
    lineHeight: 1.08
    letterSpacing: "-0.015em"
    fontVariation: "'opsz' 96, 'wght' 520, 'SOFT' 30, 'WONK' 0"
  title:
    fontFamily: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "1.45rem"
    fontWeight: 580
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "'opsz' 36, 'wght' 580, 'SOFT' 30, 'WONK' 0"
  lede:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.1rem, 1.5vw, 1.3rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Martian Mono, ui-monospace, Cascadia Mono, Menlo, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.08em"
  records:
    fontFamily: "Martian Mono, ui-monospace, Cascadia Mono, Menlo, monospace"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.55
  code:
    fontFamily: "Martian Mono, ui-monospace, Cascadia Mono, Menlo, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  mark: "2px"
  field: "10px"
  detail: "12px"
  surface: "14px"
  form: "16px"
  pill: "999px"
spacing:
  row: "0.6rem"
  tier: "1rem"
  pillar: "1.75rem"
  gutter: "clamp(1.25rem, 4vw, 3rem)"
  head: "clamp(2rem, 5vw, 3.5rem)"
  section: "clamp(3.5rem, 8vw, 6.5rem)"
  hero: "clamp(4rem, 9vw, 7.5rem)"
  measure: "62ch"
  frame: "76rem"
  nav: "4.25rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-ghost-hover:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-glow:
    backgroundColor: "{colors.glow}"
    textColor: "{colors.forest}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-glow-hover:
    backgroundColor: "#8cf6c7"
    textColor: "{colors.forest}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.glow}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  button-outline-hover:
    backgroundColor: "{colors.glow-wash}"
    textColor: "{colors.glow}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.35rem"
  nav:
    backgroundColor: "rgb(244 236 220 / 0.86)"
    textColor: "{colors.ink-soft}"
    height: "{spacing.nav}"
  field:
    backgroundColor: "#fffdf8"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.75rem 0.9rem"
  console:
    backgroundColor: "rgb(18 49 38 / 0.55)"
    textColor: "{colors.glow-mid}"
    typography: "{typography.records}"
    rounded: "{rounded.surface}"
    padding: "1.25rem 1.1rem 1.5rem"
  graph-detail:
    backgroundColor: "rgb(18 49 38 / 0.55)"
    textColor: "{colors.on-forest}"
    rounded: "{rounded.detail}"
    padding: "0.9rem 1.1rem"
  code-block:
    backgroundColor: "{colors.forest}"
    textColor: "#e9f4ee"
    typography: "{typography.code}"
    rounded: "{rounded.surface}"
    padding: "1.25rem 1.4rem"
  compare-surface:
    backgroundColor: "rgb(255 252 246 / 0.55)"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "0.9rem 1.1rem"
  form-surface:
    backgroundColor: "rgb(255 252 246 / 0.8)"
    textColor: "{colors.ink}"
    rounded: "{rounded.form}"
    padding: "1.5rem"
---

# Design System: Todox

<!-- Recorded 2026-09-11 from the shipped build (apps/todox/src/app/globals.css, the components under src/components, and the round-11 real-browser captures under .beep/qa/round-11). Direction contract key: evergreen-ledger. The world was pinned by Benjamin (deep green + parchment), not rolled, and replaced the withdrawn Terminal of Record direction. -->

## Overview

**Creative North Star: "The Evergreen Ledger"**

Todox is a standard product site for an advisor runtime, set in the firm's own palette rather than the category's. The ground is parchment with deep-green ink; where the product runs (the hero and the "how it works" band) the page turns forest-dark and a single mint glow lights the records. The site reads like a well-kept ledger: hairline rules separate rows, a serif display face carries the argument, a sans carries the reading, and a monospace carries every record, label, and receipt. Nothing is a card unless it needs a physical boundary.

Density is editorial, not dashboard. Sections are generous (clamped block padding of 3.5–6.5rem), text sits in a 62ch measure, and the only illustration is one evidence graph, bound to the same synthetic session the console below it replays. Confirmed rejections carried from the direction contract and PRODUCT.md: no neon-AI gradients, no chat mockups, no hero metrics, no particle fields or orbiting brains, no wealth-lifestyle photography, no third-party logos. Every demonstration on the page is labeled synthetic in the interface itself.

**Key Characteristics:**
- Parchment ground with green ink; forest bands carry the mint glow and the product.
- Three self-hosted OFL faces with distinct jobs: Fraunces (display), Geist (body), Martian Mono (records, labels, code).
- Hairline rules instead of cards; two bordered surfaces only (the demo form and the comparison table), each for a functional boundary.
- Pill buttons in four variants, two per ground.
- One evidence graph, one authored motion moment, one call to action.

## Colors

A two-ground palette: parchment with green ink for reading, forest with a mint glow for the product, and one saturated accent that means "action" on both.

### Primary
- **Ledger Green** (`accent`): the action color on parchment. Primary pill buttons, focus outlines (2px, 3px offset), the selection highlight, the trust-list checks, the FAQ chevron, hover underlines in the nav, and the scrollbar thumb. Measured ≈5.3:1 on parchment.
- **Ledger Green, Pressed** (`accent-strong`): the primary button's hover fill only.
- **Green Wash** (`accent-wash`): a 10% tint. Ghost-button hover, the "Todox" column of the comparison table, the wordmark dot's ring, the field focus ring, and the held-form status.

### Secondary
- **Mint Glow** (`glow`): the product's light. On forest it is the graph's edges and core node, the record identifiers, the step numbers, code paths, the glow button, and lit source spans (glow fill, forest text). Measured ≈12:1 on forest. Never used on parchment.
- **Mint, Mid** (`glow-mid`) and **Mint, Ghost** (`glow-ghost`): the console body color and record states (78%), and the gate's left rule and inspector top rule (60%).
- **Mint Wash** (`glow-wash`): the expanded record row's background and the outline button's hover fill.
- **Mint Line** (`forest-line`): every hairline on the forest ground (20% mint).

### Neutral
- **Parchment** (`parchment`): the page ground and the primary-button text on forest-adjacent surfaces. **Parchment, Deep** (`parchment-deep`): the contact band and the scrollbar track.
- **Ink** (`ink`): headings, body on parchment, the wordmark. Measured ≈15:1 on parchment.
- **Ink, Soft** (`ink-soft`): ledes, prose, pillar and FAQ paragraphs, nav links at rest, comparison "typical" column.
- **Ink, Mute** (`ink-mute`): footer, notes, placeholders, uppercase table headers. Set at #4f6358 after the reviewer measured the earlier #6b7f75 below AA; it is ≈5.5:1 on parchment and ≈4.9:1 on parchment-deep.
- **Ink Line** (`parchment-line`): every hairline on parchment (14% ink).
- **Forest** (`forest`) and **Forest, Raised** (`forest-raised`): the hero, demo band, and code block ground; raised is the graph's node fill and (at 55% alpha) the console and detail-panel surface.
- **On Forest** (`on-forest`): the base text color on forest. Its secondary tones are alpha steps of the same value: .82 (ledes, source spans, ≈11:1), .72 (step paragraphs, ≈9:1), .6 (proof lines, meta, ≈7:1), .5 (pane titles, timestamps, superseded and rejected rows, ≈5.5:1).
- **On Accent** (`on-accent`): text on the primary button and the light wordmark.

### Named Rules
**The Two Grounds Rule.** Parchment carries reading and `accent` carries action on it; forest carries the product and `glow` carries action on it. `glow` never appears on parchment, `accent` never appears on forest; the only crossings are the 35% `accent` radial in the hero's upper-left and the 10% wash.

**The Alpha Ladder Rule.** Secondary text on forest is `on-forest` at .82 / .72 / .6 / .5, never a second gray. The lowest step (.5) is reserved for labels, timestamps, and records the ledger has retired (SUPERSEDED, REJECTED).

**The One Glow Rule.** The mint glow is emitted, never painted: two radial washes behind the hero, one behind the demo band's foot, the core node's SVG filter, and the glow button's shadow. No mint gradients on text, no glowing borders.

## Typography

**Display Font:** Fraunces (variable: opsz, wght, SOFT, WONK; with Iowan Old Style, Palatino Linotype, Georgia)
**Body Font:** Geist (variable wght; with Inter, ui-sans-serif, system-ui)
**Label/Mono Font:** Martian Mono (variable wght and wdth 75–112.5%; with ui-monospace, Cascadia Mono, Menlo)

**Character:** A soft-serif voice for the argument (Fraunces at SOFT 30, WONK 0, optical size climbing with the size), a quiet grotesk for reading, and a wide-tracked mono that makes every record look like a record. All three are OFL and self-hosted from `/public/fonts` with their license texts; the detector's "overused font" warning on Fraunces and Geist is a recorded, user-confirmed choice.

### Hierarchy
- **Display** (wght 500, clamp(2.5rem, 6vw, 4.5rem), 1.08, opsz 144, tracking -0.02em): the hero headline only, balanced (`text-wrap: balance`).
- **Headline** (wght 520, clamp(1.85rem, 3.6vw, 2.75rem), 1.08, opsz 96, tracking -0.015em): section heads, inside a 44rem head block with the lede beneath.
- **Title** (wght 580, 1.45rem, 1.2, opsz 36): pillar headings. The wordmark is the same face at 1.45rem, wght 600, SOFT 40.
- **Lede** (Geist 400, clamp(1.1rem, 1.5vw, 1.3rem), 1.55): under the hero and section heads, in `ink-soft` on parchment and `on-forest` .82/.78 on forest.
- **Body** (Geist 400, 17px, 1.6): all reading, max 62ch. Pillar paragraphs are capped at 40ch.
- **Step title** (Geist 600, 1.05rem, 1.3): the four "how it works" headings; the leading-zero step number sits inline in the heading's first 2.4rem column in mono 0.8rem, `glow`.
- **Label** (Martian Mono 400, 0.72rem, 0.08em, uppercase content): pane titles, record-table headers, packet headings, comparison headers, the code path, and the cursor hint. Labels are always inside a mono surface (console, table, code block), never above a section heading.
- **Records** (Martian Mono, 0.85rem, 1.55): the session console body. Identifiers are wdth 112.5 / wght 700; reviewer-authored rows are wdth 112.5 / wght 600; source spans are wdth 100 / wght 400.
- **Code** (Martian Mono, 0.82rem, 1.65): the skills code block.
- **Graph labels** (Martian Mono, 10.5px, 0.02em): the evidence graph's node labels; 16px under 48rem.

### Named Rules
**The Number in the Heading Rule.** Ordinals live inline in the heading's first grid column (the step counter), never as an eyebrow above it. Pillar indices were removed for the same reason; there are no kickers or eyebrows anywhere in the system.

**The Weight-Is-Width Rule.** Emphasis in the mono ledger is carried by Martian Mono's `wdth` and `wght` axes (112.5 / 700 for identifiers and producers), not by color or a second face.

## Layout

One centered frame of 76rem with a fluid gutter of clamp(1.25rem, 4vw, 3rem). Sections stack with block padding of clamp(3.5rem, 8vw, 6.5rem); the hero is taller (clamp(4rem, 9vw, 7.5rem) above, clamp(3.5rem, 8vw, 6rem) below). Each section opens with a head block (max 44rem, 1rem gap, clamp(2rem, 5vw, 3.5rem) below) holding a headline and a lede.

Two-column bands split on asymmetric fractions at 64rem: hero 7/5 (copy left, graph right, `align-items: center`), skills 5/6, trust 5/7, contact 5/6. Pillars go to two columns with a 3rem column gap at 56rem; the four steps go to four columns at 56rem and are a subgrid (`grid-row: span 2; grid-template-rows: subgrid`) so every step's paragraph shares a baseline regardless of heading length. The form's name/firm row splits at 40rem. The nav's section links appear at 56rem; below that only the wordmark and the primary pill remain.

The record table inside the console is container-queried on the record pane's own width, not the viewport: below `62ch` a row is two lines (identifier | text, then meta), at or above it a row is four columns (`10ch | 1fr | 18ch | 12ch`: record, text, state, time). The comparison table keeps a 42rem minimum width and scrolls inside its bordered surface; under 48rem a mono hint appears and the right edge fades with a mask.

Vertical rhythm on parchment lists is the hairline: pillars 1.75rem, tiers 1rem, trust rows 0.9rem, FAQ summaries 1.1rem, each closed by a `parchment-line` rule and the list opened by one. On forest the same rhythm uses `forest-line`, and record rows are 0.6rem.

Scroll is cuts, never smooth (`scroll-behavior: auto`); `scroll-padding-top` equals the sticky nav's height (4.25rem + 1px) so anchor landings clear it. The nav is a 4.25rem sticky bar at z-index 10.

## Elevation & Depth

Depth is tonal and hairlined, not stacked. Parchment surfaces are flat; the two bordered surfaces on parchment (form, comparison) lift on a warm tint (`rgb(255 252 246 / .8)` and `.55`) with a hairline and one very long, very soft drop. Forest surfaces (console, graph detail) sit on `forest-raised` at 55% alpha with a mint hairline; the console adds a 1px inset mint highlight. The nav is translucent parchment at 86% with `backdrop-filter: blur(14px) saturate(1.2)`.

### Shadow Vocabulary
- **Button rest** (`box-shadow: 0 1px 0 rgb(16 40 31 / 0.2), 0 8px 20px -12px rgb(16 40 31 / 0.5)`): the primary pill on parchment; hover deepens to `0 1px 0 rgb(16 40 31 / 0.25), 0 14px 28px -14px rgb(16 40 31 / 0.55)` with a 1px lift.
- **Glow button** (`box-shadow: 0 10px 30px -12px rgb(111 240 182 / 0.7)`): the mint pill on forest.
- **Surface drop** (`box-shadow: 0 30px 60px -40px rgb(16 40 31 / 0.6)` on the code block; `-45px … / 0.5` on the form; `0 30px 60px -40px rgb(0 0 0 / 0.8)` plus the inset line on the console): a long, negative-spread shadow that reads as weight, not float.
- **Wordmark dot** (`0 0 0 3px accent-wash` on parchment; `0 0 12px 2px rgb(111 240 182 / 0.45)` when light): the only ring shadow.

### Named Rules
**The Long Soft Drop Rule.** Every surface shadow is a single long, negative-spread drop (30/60/-40 family) in ink or black. No hard offsets, no layered elevation tiers, no shadows on hairlined lists.

**The Hairline Is the Edge Rule.** Depth between rows and sections is a 1px line at 14% ink or 20% mint. If a boundary can be a rule, it is a rule.

## Shapes

Two silhouettes: the pill and the softly rounded surface. Buttons are full pills (999px). Surfaces step by role: fields 10px, the graph detail panel 12px, the console, code block, and comparison surface 14px, the form 16px. Lit source spans and the focused record identifier square off at 2px with a 0.5ch / 0.25ch box-shadow bleed so the highlight reads as a marker, not a chip. Record rows are unrounded buttons with no inline borders. The wordmark dot is a 0.55rem circle. The FAQ marker is a 0.7rem rotated square outline in `accent` (chevron), not a glyph.

Borders are 1px throughout: `parchment-line` on parchment, `forest-line` on forest, `accent` or `glow` on hover and focus. Ghost and outline pills are the only bordered buttons; primary and glow pills carry a transparent border so their box does not shift.

**The Card Exception Rule.** Hairline rules instead of cards, with exactly two exceptions on parchment: the demo-request form (a form needs a field boundary) and the comparison table (a scroll container needs a visible edge). Do not add a third without a functional boundary to justify it.

## Components

### Buttons
Pill, weighted 560, tracking -0.005em, 0.8rem × 1.35rem padding, 0.6rem gap for an inline 1em arrow. Transitions: color and background 160ms, transform and shadow 200ms, all on `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Shape:** full pill (999px).
- **Primary** (parchment ground): `accent` fill, `on-accent` text, the rest shadow; hover to `accent-strong`, -1px lift. Used for the nav CTA and the form submit.
- **Ghost** (parchment ground): transparent, `ink` text, `parchment-line` border; hover to `accent-wash` fill and `accent` border.
- **Glow** (forest ground): `glow` fill, `forest` text, the mint shadow; hover to #8cf6c7 with a -1px lift. The hero's primary action.
- **Outline** (forest ground): transparent, `glow` text, `forest-line` border; hover to `glow` border and `glow-wash` fill. The hero's secondary action.
- **Focus:** the global 2px `accent` outline with 3px offset.

### Navigation
Sticky, translucent parchment (86%) with backdrop blur and a `parchment-line` bottom rule; 4.25rem tall, 2rem gaps. Wordmark left (Fraunces 1.45rem with the green dot); section links in Geist 0.95rem / 500 / `ink-soft`, 1.75rem apart, with a transparent 1px underline that turns `accent` and the text `ink` on hover; the primary pill right. Under 56rem the links are removed, not collapsed into a menu; the wordmark and pill remain. A visually hidden skip link precedes the page.

### Inputs / Fields
- **Style:** 1px `parchment-line` stroke, #fffdf8 fill, 10px radius, 0.75rem × 0.9rem padding, `ink` text, `ink-mute` placeholders; labels in Geist 0.9rem / 600 above with a 0.35rem gap.
- **Focus:** border to `accent` plus a 3px `accent-wash` ring; the global outline is suppressed here in favor of the ring.
- **Textarea:** 6rem minimum, vertical resize only.
- **Submit state:** the form holds the submit on the page and shows a status line (`form__status`: `accent-wash` fill, 10px radius, `role="status"`); the no-JS path posts to a stub route that redirects (303) back to the section. Nothing is sent or stored.

### Bordered Surfaces
- **Form:** 16px radius, `rgb(255 252 246 / .8)`, `parchment-line` border, the long soft drop, 1.5rem padding, 1rem gaps. Sits on the `parchment-deep` contact band.
- **Comparison:** 14px radius, `rgb(255 252 246 / .55)`, `parchment-line` border, horizontal scroll; cells 0.9rem × 1.1rem with hairline row rules, mono uppercase headers in `ink-mute`, the Todox column on `accent-wash` in weight 500.
- **Console** (forest): 14px radius, `forest-raised` at 55%, `forest-line` border, inset mint line plus the deep drop. A mono bar (0.75rem, 0.04em, on-forest .6) carries the session label in `glow` and the qualification literal "NO CLIENT DATA · NO LIVE MODEL"; the body is `records` typography in `glow-mid`.
- **Graph detail** (forest): 12px radius, same fill and border, 0.9rem × 1.1rem padding, minimum height 7.5rem, `aria-live`. Identifier line in mono 0.75rem with the record id in `glow` at wdth 112.5 / wght 700.
- **Code block** (forest on parchment): 14px radius, `forest` fill, #e9f4ee text, path line in `glow` mono 0.72rem over a `forest-line` rule.

### Lists on Rules
Pillars, tiers (8rem term column), trust rows (1.5rem icon column, `accent` check), and FAQ details all open with a top `parchment-line` and close each item with a bottom one; no fills, no radius. FAQ summaries are Geist 1.05rem / 600 with the rotated-square chevron that flips on `[open]` over 200ms.

### Evidence Graph (signature)
The one illustration. An SVG at min(100%, 34rem) with seven authored nodes bound to real session records from the fixture: nodes are `forest-raised` disks with a 1.25px `glow` stroke at 55%, the core node is a solid `glow` disk under an SVG glow filter, edges are 1.25px `glow` at 35% (live edges 1.75px at 90%). Labels are mono 10.5px (16px under 48rem) in on-forest .86, dimmed to .55 for superseded records. Each node is a keyboard-reachable hit target holding atom state: hover and `aria-pressed` raise the stroke to 2px and brighten the label, focus-visible raises it to 3px, a selected node shows an 8% mint halo, connected edges go to 100% while the rest drop to 16%. Selection fills the detail panel beneath, which links into the full session.

### Session Console and Record Rows (signature)
The forest "how it works" band replays a synthetic session: a gate block (1px `glow-ghost` left rule), a source pane where the cited span is lit (`glow` fill, `forest` text, 2px marker), and record rows. Rows are unstyled buttons on `forest-line` rules; the identifier is wdth 112.5 / wght 700 in `on-forest`; the state column is `glow-mid` (`glow` when ACCEPTED (SCOPED)); SUPERSEDED rows strike through in `forest-line` and drop to .5, REJECTED rows drop to .5. The resting cursor is a `▮` after the identifier in `glow-mid`; while any row holds focus the resting mark yields, and the focused identifier inverts to `glow` on `forest` with its own blinking mark (1.1s steps). An expanded row fills with `glow-wash`; the inspector beneath opens the receipt (a two-column `dl`, 0.82rem, producer in `glow` wdth 112.5 / wght 700) with the literal "FIXTURE RUNTIME (DETERMINISTIC · NO LIVE MODEL)".

### Motion
One authored moment: on load with no reduced-motion preference, the live graph edges draw in over 1400ms (dash 600, 300ms delay) and the core node pulses (brightness 1 → 1.25, 3.2s, from 1600ms) on the same `cubic-bezier(0.16, 1, 0.3, 1)`. `prefers-reduced-motion: reduce` collapses both to their final state and stops the cursor blink. State transitions elsewhere are 160–200ms on that easing; the FAQ chevron and pill lifts are the only other movement.

## Do's and Don'ts

### Do:
- **Do** keep the two grounds distinct: `accent` acts on parchment, `glow` acts on forest, and secondary text on forest is `on-forest` at .82 / .72 / .6 / .5.
- **Do** separate list items with 1px hairlines (`parchment-line` on parchment, `forest-line` on forest) and reserve bordered, rounded surfaces for the form, the comparison scroller, and the forest console.
- **Do** set every record, label, receipt, and code path in Martian Mono, carrying emphasis through `wdth` 112.5 / `wght` 700 rather than color.
- **Do** put ordinals inline in the heading's first column (the step counter pattern) and share baselines with a subgrid.
- **Do** use the pill (999px) for every button, with a transparent border on filled variants so hover does not shift the box.
- **Do** switch record-row layout on the pane's own width (`@container rows (min-width: 62ch)`), not the viewport.
- **Do** keep scroll as cuts with `scroll-padding-top: calc(4.25rem + 1px)` so anchors clear the sticky nav.
- **Do** label every demonstration synthetic in the surface itself (console bar, producer literal, hero proof line, footer qualification).

### Don't:
- **Don't** add kickers, eyebrows, or uppercase section labels above headings; mono uppercase labels belong only inside console, table, and code surfaces.
- **Don't** paint the mint glow onto parchment, put `accent` text on forest, or introduce a second gray or a gradient on text.
- **Don't** add a third bordered card on parchment without a functional boundary (field or scroll edge) to justify it.
- **Don't** use hard-offset shadows, stacked elevation tiers, or shadows on hairlined lists; the only drops are the long soft 30/60/-40 family and the button rest shadow.
- **Don't** add a second illustration, chart, or metric to the hero; the evidence graph is the one figure and it binds to real session records.
- **Don't** add a second authored motion moment or smooth scrolling; the graph draw-in and core pulse are the motion budget, and reduced motion collapses them.
- **Don't** use system display faces, glyph icons, or icon fonts; the arrow, the check, and the chevron are inline strokes.
- **Don't** lower `ink-mute` below #4f6358 or use on-forest below .5 for running text.
