### sol-2-1
- file: scratchpad/effected/templates/internal/reconcile.ts:263
- class: bug   severity: required
- standard: D9; section 14 `upstream-bug` exception; `ManagedSection.ts` BOM-preservation contract and `SectionDocument.reconcile` byte-preservation guarantee.   evidence: Read-only `bun --eval` probes against the lab and pinned oracle parsed `"\uFEFF"` and `"\uFEFF\n"`, then reconciled one hash-style section. Both returned text beginning directly with `# --- BEGIN tool MANAGED SECTION ---`; `text.startsWith("\uFEFF")` was `false`. A `" \t\n"` document also lost its original text. `output.trim() === ""` classifies these documents as empty and replaces them. The round-1 BOM repair covers recognizing an existing block after a BOM; it does not cover this insertion path.
- failure: Creating the first managed section in a BOM-only or BOM-plus-whitespace file silently deletes the BOM and existing whitespace. `ManagedSection.sync` writes that corrupted result back to the file, despite its explicit promise to preserve the BOM.
- fix: Preserve the original text when appending to a nonempty document; reserve the empty-document branch for an actually empty string and add separators without discarding the preserved prefix. Add regressions for BOM-only and BOM-plus-whitespace input, and record this newly demonstrated upstream bug under section 14.

### sol-2-2
- file: scratchpad/effected/templates/SectionDialect.ts:330
- class: bug   severity: required
- standard: D9; section 14 `upstream-bug` exception; `SectionDialect.render` contract that successful rendering produces content the scanner can read back correctly; D10 formatter fidelity.   evidence: In both the lab and pinned oracle, rendering `id.section("a\r")` with `eol: "\n"` succeeds, but parsing that result recovers content `"a"` and checking it against the declaration returns `Drifted`. Rendering the same declaration with `eol: "\r\n"` recovers `"a\r"` and returns `UpToDate`. With LF output, the trailing content CR joins the emitted boundary LF into CRLF; `internal/scan.ts:180` strips both characters. The new fidelity property in `SectionDialect.property.test.ts` removes every CR from generated content, so it cannot detect this case.
- failure: A successful LF render silently loses a trailing bare carriage return from valid section content. Syncing that declaration produces a section that immediately reports drift and continues returning `Updated` on subsequent identical reconciliations.
- fix: Add a typed rendering refusal for LF output whose normalized content ends in a bare CR, rather than returning a successful lossy representation. Add a regression proving the LF refusal and the existing faithful CRLF behavior, and record the verified upstream-bug deviation under section 14.

### sol-2-3
- file: scratchpad/effected/templates/SectionDialect.ts:445
- class: perf   severity: required
- standard: D11 algorithmic-class criterion; section 14 `upstream-bug` exception; `SectionDialect.matchers` documented linear scanning guarantee.   evidence: For `"# --- BEGIN tool MANAGED SECTION x" + " ".repeat(n) + "!"`, the lazy attribute capture tries successive positions in the whitespace run. At each position, the following `GAP` (`[ \t]+`) consumes and backtracks through the remaining spaces while unsuccessfully looking for `---`. The total work is Θ(n²); a deterministic boundary scan can perform Θ(n) work. Read-only `bun --eval` probes, averaging three `containsMarker` calls per size, measured lab times of **2.81 / 9.86 / 39.21 ms** for **4,000 / 8,000 / 16,000** spaces; the pinned oracle measured **3.38 / 12.87 / 50.35 ms**. All calls returned `false`. This is a separate hotspot from the repaired reconciliation anchor searches.
- failure: A malformed marker-like line causes quadratic scanning before the single-pass attribute parser is reached. Both document parsing and render-time marker-injection checks incur this cost, contradicting the claimed bounded linear handling of hostile input.
- fix: Recognize the closing rule and optional comment suffix with a deterministic scan, then pass the single extracted attribute run to `parseAttributeRun`. Preserve quoted `---` values, trailing whitespace, and existing malformed-marker behavior. Add an adversarial scaling regression and record the algorithmic repair under section 14.

REQUIRED: 3
BACKLOG: 0