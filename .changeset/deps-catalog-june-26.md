---
{}
---

Dependency catalog refresh: effect 4.0.0-beta.90 (and all `@effect/*` packages),
@effect/tsgo 0.14.6, @typescript/native-preview 20260624, biome 2.5.1, next
16.3.0-canary.68, turbo 2.10.0, vite 8.1.0, knip 6.20.0, fallow 2.102.0, oxlint
1.71.0, recharts 3.9.0, and assorted minor bumps, plus adaptation fixes:

- effect Schema: the lightweight constraint types `Decoder`/`Encoder` were renamed to
  `ConstraintDecoder`/`ConstraintEncoder`. Decode-only parameter constraints follow the
  rename; constructed-schema annotations that need schema methods (`@beep/firecrawl`
  `typedUnknown`, `@beep/test-utils` arbitrary helper) use `Codec`/`Schema`.
- recharts 3.9: the `Pie` `shape` render callback `index` is now `string | number |
  undefined`; the chart story callback was widened to match.
- biome 2.5.1: config migrated ($schema bump; `useSortedKeys` given an explicit
  `level: "off"`, preserving its prior dormant behavior — biome 2.5.1 made `level`
  required on assist actions).

No package releases required.
