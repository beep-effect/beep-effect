# Pretext engine-family qualification audit — 2026-09-08

## Scope and source

- Inventory id: `pretext-detect-engine-family`.
- Reviewed source: `05405bf322da0ca7eb88b8bb402145081e8fded6`.
- Packages/apps corpus baseline: `origin/main` at
  `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`.
- Audited source: `packages/drivers/pretext/src/browser.ts:42-43,64-86`.
- Audited consumers/tests:
  `packages/drivers/pretext/src/browser.ts:126-164`,
  `packages/drivers/pretext/src/Pretext.models.ts:27-64`,
  `packages/drivers/pretext/test/browser.test.ts:1-22`, and
  `packages/drivers/pretext/test/Pretext.models.test.ts:17-27`.
- This is a qualification/source-evidence audit, separate from formal P3
  design review. No product source, design, or canonical inventory was changed.

The reviewed source files are identical at the named source SHA and the named
`origin/main` corpus baseline.

## Source finding

`detectEngineProfile` accepts the ambient `globalThis.navigator` without a
schema or value-level metadata constraint. At `browser.ts:75-78`, `isSafari`
requires Apple vendor plus `Safari/` and excludes `Chrome/`, `Chromium/`,
`CriOS/`, `FxiOS/`, and `EdgiOS/`. At `browser.ts:79`, `isChromium` recognizes
`Chrome/`, `Chromium/`, `CriOS/`, and desktop `Edg/`.

The Safari exclusion set does not contain `Edg/`. Therefore this accepted
metadata tuple makes both booleans true:

```json
{
  "vendor": "Apple Computer, Inc.",
  "userAgent": "Mozilla/5.0 Safari/605.1.15 Edg/140.0.0.0",
  "platform": "audit"
}
```

A bounded runtime call through the public `@beep/pretext/browser` export
returned:

```json
{
  "lineFitEpsilon": 0.015625,
  "carryCJKAfterClosingQuote": true,
  "breakKeepAllAfterPunctuation": false,
  "preferPrefixWidthsForBreakableRuns": true,
  "preferEarlySoftHyphenBreak": true
}
```

`0.015625`, `breakKeepAllAfterPunctuation: false`, and both prefix/soft-hyphen
preferences are the current Safari-derived values at `browser.ts:81,83-85`;
`carryCJKAfterClosingQuote: true` is the simultaneous Chromium-derived value at
line 82. The reader does not reject or mask the combined-true case. It preserves
both facts in one `EngineProfile`.

The command temporarily replaced the configurable global navigator property,
called the existing public export, printed only the resulting non-secret
profile, and restored the original property descriptor. It exited 0. No file
or durable runtime state was changed.

## Evidence-class audit

The inventory's current E1 citation is defective. Under
`goals/boolean-creep/DECISIONS.md:107-108`, E1 requires one write operation that
sets one flag true and its siblings false. `browser.ts:75-79` instead performs
two independent predicate assignments with mismatched token sets. It neither
writes sibling false nor prevents combined true.

No replacement E1-E4 evidence exists in the inspected graph:

- E1 exclusive-write: absent; both predicates can write true for the tuple
  above.
- E2 exclusive-read: absent; `EngineProfile.make` reads each boolean
  independently and preserves the combined case.
- E3 flag/payload: absent; neither boolean duplicates payload presence.
- E4 phase implication: absent; these are metadata observations rather than an
  ordered state machine, and neither predicate implies the other.

All four boolean combinations are accepted by the current source contract:
Safari metadata yields true/false, Chrome metadata yields false/true, other or
Gecko-like metadata yields false/false, and the bounded tuple above yields
true/true. There is no cardinality gap in the source-defined input space.

The installed `@chenglou/pretext` v0.0.8 source at
`node_modules/@chenglou/pretext/src/measurement.ts:88-110` contains the same
token sets and independent profile projections. That confirms the driver is an
accurate mirror; it does not impose a navigator invariant or make the E1 claim
true.

## Design impact

The current `designs/pretext-detect-engine-family.md` three-state target
(`safari | chromium | other`) cannot preserve the demonstrated profile:

- Safari-first precedence drops `carryCJKAfterClosingQuote: true`.
- Chromium-first precedence drops all four Safari-derived fence values.
- Classifying the tuple as `other` drops both sets.

Adding a fourth `safari-chromium` literal could preserve the current truth
table, but then all four original boolean combinations remain legal and the
campaign's required cardinality gap disappears. Changing Safari's exclusions
to include `Edg/` would alter existing accepted behavior and would be a separate
product/browser-normalization decision, not a boolean-creep refactor.

## Recommended disposition

Reclassify `pretext-detect-engine-family` from qualified/reviewed to
`disqualified` with D1 evidence: the predicates are independently derived,
overlapping metadata facts, and the current runtime supports all four
combinations. Remove its live implementation design according to the packet's
normal superseded-design/history procedure. Do not implement the current
three-state design.

This recommendation corrects the instance-specific evidence and does not
change the campaign's evidence taxonomy or other ratified decisions.

## Remaining uncertainty

Whether a mainstream browser currently emits this exact vendor/UA combination
is not established here and is not required by the source-level qualification
gate. The public function accepts unvalidated ambient metadata, the source and
upstream mirror compute the mixed profile, and no repository test or runtime
guard narrows that accepted space. Product owners may separately decide to
normalize browser-identification metadata, but that decision must define the
supported input contract and desired mixed-profile behavior explicitly.
