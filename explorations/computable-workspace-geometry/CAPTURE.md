# Capture — raw dump

Append-only. Never interrogated. Newest entries at the bottom.

## 2026-07-12 — the story so far

Arc of the day: scratch_30 (a late-night reply to the beep-effect6 layout-bug
session) got grilled and crystallized into `docs/product/workspace-substrate.md`
(commit `44ec290e7a`) — workspace-as-data, agents as first-class workspace
operators, four binding guardrails, dock kernel named. Hours later, scratch_31
arrived and cracked the thing open one level deeper.

### scratch_31, verbatim (Ben, 2026-07-12)

> So I want us to dig into these divergences and their "costs". Setting aside
> the time it would take to implement things are there truly any "costs"
> besides this? If there are "costs" outside of development effort,
> maintenance, etc how do we eliminate them. Can we be smarter than the
> conventional knowledge. I look for example at Cheng Lou a former React core
> team member and engineer at Midjourney who crawled through the depths of
> hell to bring us [Pretext](https://github.com/chenglou/pretext). Rendering
> dynamic text has for decades been a performance tradeoff. Before pretext
> whenever the browser had to figure out how tall a paragraph is or where to
> break a line, it had to trigger a layout reflow which often calculates the
> position and geometry of every element on the page...a very expensive
> "cost" like calculation simply to provide you with the height of any text
> element.
>
> For fun I want you to use claude in chrome and visit
> https://pretextwall.xyz/playground/dragon-reflow and just take a few
> screenshots for yourself
>
> Curious isn't it? Almost suspiciously relevant.
>
> The year is 2026, pretext...agents...beep block dock?
>
> I've cloned this repository for our amusement.
> [here](/home/elpresidank/YeeBois/dev/pretext)
>
> I highly suggest you scour that codebase and tell me if you see what I'm
> seeing. (I might be seeing things because I've been up for too long though.
> But I'm catching glimpses of the golden snitch so to speak).

### The dragon demo (witnessed live, Claude-in-Chrome)

https://pretextwall.xyz/playground/dragon-reflow — a serpentine chain of
translucent circles slithering across a paragraph; text rewraps around its
body every frame; per-line exclusion zones merged from overlapping segments;
on-screen layout counter read **700µs**. The demo's own copy: *"The entire
layout runs with zero DOM measurements... no reflows, no forced layouts, no
jank. Just math."* Provenance note: pretextwall.xyz is a **third-party** site
built on pretext's public `layoutNextLine` API — no "dragon" anywhere in the
official clone (grepped). Official demos: chenglou.me/pretext.

### The verdict, same session

Not sleep deprivation. The snitch is real. Full articulation in
[`RESEARCH.md`](./RESEARCH.md): text measurement was the last fact forcing
the DOM to stay a layout oracle; pretext deletes it; docks + blocks + pretext
closes the composition — the workspace's *rendered geometry* becomes data,
and agents gain sight. The divergence "costs" audit came out almost empty of
true costs.

### Loose phrases worth keeping (they carried the day)

- "The DOM demoted from oracle to projection target."
- "The impurity isn't eliminated, it's quarantined as a value."
- "Per-engine sight is the honest kind — 'what does the user see' was always
  a per-engine question."
- "Cheng Lou independently arrived at your architecture, for text."
- "Same snitch, spotted from two brooms."
- Cheng Lou, thoughts.md: "The cost of verifiable software will trend toward
  zero." / "80% of the CSS spec could be avoided if user code had better
  control over text."
- The beep-effect6 layout bugs were, every one, "the browser was the only
  oracle and we asked it wrong."

## 2026-07-12 (last drops of the genesis context)

Per-group minimums landed in the kernel via `requiredExtent` (sum along
axis + gap, max across axes — the v1 scalar provably understated nested
requirements: 35/30/30 vs the 49/23/23 squeeze). Then the full-circle test:
fixture metrics → naturalWidth → GroupMinimumLookup → project() → one-line
render guaranteed by kernel geometry, starvation counter-case included.
The sentence "blocks feed docks" is now a passing test, not a slogan.
