# Instance

- id: `pretext-detect-engine-family`
- file:line: `packages/drivers/pretext/src/browser.ts:75`
- symbol: `detectEngineProfile.engineFamily`
- members: `isSafari`, `isChromium`
- evidence classes:
  - E1 at `packages/drivers/pretext/src/browser.ts:75` — `isSafari` is constructed to exclude Chrome/Chromium/CriOS/FxiOS/EdgiOS tokens, so combined-true is never written; both-false is the Gecko/other remainder.

# Current shape

Live sibling declarations at `packages/drivers/pretext/src/browser.ts:74`:

```ts
const ua = navigator.userAgent;
const isSafari =
  navigator.vendor === "Apple Computer, Inc." &&
  pipe(ua, Str.includes("Safari/")) &&
  !uaIncludesAny(ua, ["Chrome/", "Chromium/", "CriOS/", "FxiOS/", "EdgiOS/"]);
const isChromium = uaIncludesAny(ua, ["Chrome/", "Chromium/", "CriOS/", "Edg/"]);
```

# Cardinality gap

Two booleans represent four combinations. Exactly three engine families are legal:

- `safari` — Apple Safari with browser-override tokens excluded.
- `chromium` — Chrome, Chromium, CriOS, or Edge Chromium.
- `other` — Gecko, non-browser-like engines, and excluded iOS wrappers.

The combined-true state is illegal by construction. This is derived from one user-agent/vendor source, so the function must derive one literal and must not introduce stored state.

# Target schema

Add the package identity composer and `LiteralKit` imports used elsewhere in `@beep/pretext`, then define one local domain:

```ts
import { $PretextId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $PretextId.create("browser");

const BrowserEngineFamily = LiteralKit(["safari", "chromium", "other"]).pipe(
  $I.annoteSchema("BrowserEngineFamily", {
    description: "Browser engine family used to select Pretext layout-quirk fences.",
  })
);
type BrowserEngineFamily = typeof BrowserEngineFamily.Type;
```

Derive one `engineFamily` from `navigator.vendor` and `navigator.userAgent`, preserving the current token sets and precedence. Build `EngineProfile` through `BrowserEngineFamily.$match(engineFamily, ...)` (or one equivalent exhaustive literal match) so every profile arm is explicit. The non-browser early return remains unchanged.

# Migration inventory

- `packages/drivers/pretext/src/browser.ts:19-22` — add `$PretextId`, `LiteralKit`, and the file-local `$I`; retain the existing utility and Effect imports.
- `packages/drivers/pretext/src/browser.ts:42-43` — keep `uaIncludesAny`; it remains the shared user-agent token primitive, not a state predicate.
- `packages/drivers/pretext/src/browser.ts:64-73` — keep the no-`navigator` boundary return unchanged; it does not read either current member.
- `packages/drivers/pretext/src/browser.ts:74-79` — replace the two sibling boolean writes with one derived `BrowserEngineFamily` value. Preserve FxiOS/EdgiOS as `other`, not `safari` or `chromium`.
- `packages/drivers/pretext/src/browser.ts:80-86` — replace five boolean reads/negations with exhaustive `safari`, `chromium`, and `other` profile construction.

Repository-wide search finds no other source read or write of these local variables.

# Guard-deletion accounting

- `packages/drivers/pretext/src/browser.ts:75-79` — delete the cross-variable exclusivity obligation created by two independent declarations; classification produces exactly one family.
- `packages/drivers/pretext/src/browser.ts:81-85` — delete five truthiness/negation reads (`isSafari` four times and `isChromium` once) that reconstruct which mutually exclusive family was selected. Each literal match arm supplies its complete profile directly.

The underlying user-agent token checks remain because they are classification evidence, not coherence guards. What disappears is the parallel-boolean representation and every downstream interpretation of it.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/pretext/test/browser.test.ts:9-22` — retains the non-browser `other`-profile fence assertions.
- `packages/drivers/pretext/test/Pretext.models.test.ts:17-27` — the built-in Chrome fixture still asserts its captured engine-profile behavior; no encoded fixture shape changes because `BrowserEngineFamily` is not added to `EngineProfile`.
- Add focused navigator stubs for Safari, Chromium, and an excluded iOS wrapper so the three derived literal arms and existing token precedence are explicit. No test should import the local kit solely to inspect it.

# Risk & sequencing

This Tier 1 design changes only derivation, not the encoded `EngineProfile`. Its main risk is browser-token drift: preserve the exact current Safari exclusion set and Chromium recognition set, especially the deliberate difference between desktop `Edg/` and iOS `EdgiOS/`. Land classification and profile-arm construction together; do not persist or expose the family literal unless a separate design establishes that need.
