# P2 audit: html-link-imagesizes-disposition

Exact source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Private proposals only; no source or canonical packet edits. Saved inventory/design inputs matched the live canonical files when audited.

## Inputs (SHA-256)

- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/foundation/modeling/html/src/Html.conformance.ts`: `7a9ca39b11ca3f85d426f826392150d4874d2a34c63c1b0f689906f676e3eac2`
- `packages/foundation/modeling/html/src/index.ts`: `95dedf64877863567cd2ded17968a5e55b644c85e230d5eb4a7c2ceec4d2eace`
- `packages/foundation/modeling/html/package.json`: `d4162bc5309948a0d6debcecd9c297a3b538d5612ea6e482eba00ce24e4cfc48`
- `packages/foundation/modeling/html/test/Html.responsive-image-conformance.test.ts`: `ecbf81892f1fa0b5dfa8cb775fdf138ce1ac98dbf881b6940674ab8dccbb90cc`
- Private `inventory.start.jsonl`: `9c4eaaf326b781e0b6239b197098e82e25aa394c70da15225f5a2e4d8704c8d3`
- Private `design.start.md`: `7743dfae911f4ea3899c7e0ee413a54569bc28c91a919908bfc24e1aa900f556`

## Results

8 representable / 6 legal remains correct. Primary E4 proof lines1035-1038: incompatible requires successful source-size parsing, hence raw sizes presence. Six constructive witnesses are in the design. Classify source presence before parsed success; failed parsing is not absence. Preserve invalid-present srcset with valid sizes as no pairing error. Shared kit coordinated with img_refresh; source imports SchemaUtils but requires adding LiteralKit. Keep iconSizesMisplaced independent and append its issue last. No encoded/public impact; diagnostic arrays unchanged. No independent P3, implementation or package verification claimed.

## Probe

`bun <private>/probe.ts` exited0; 32 Link.make fixtures asserted pairing/icon messages in order and invalid sizes syntax preservation. First invocation used an incorrect Bun tsconfig flag; retry needed no flag. An initial overly broad message filter accidentally included syntax errors; corrected to exact three relationship messages, separately asserting syntax diagnostics. Syntax and pairing both use attributeRelationship, now documented as a test pitfall. This was probe correction, not a product failure.

## Deliverables (SHA-256)

- `proposed-design.md`: `cb58e03337163903f6b537916ebc2ab409bad309de055f176b08b6dede17e85f`
- `proposed-row.json`: `3c26c9103d057a166a697251042b4d4ce029b7b69c23c5a498daff9844969eed`
- `probe.ts`: `d1f49370a1d9100f035255ea807db37e16d1d36cf916333aa05435623e09df6f`
- `probe.json`: `f04925b2376c6836a5068f9bfc6dc63f7d5d620acd0fe763848a958eab5e60a3`

Graft tally: 39,711 tokens saved across 4 calls (initial obsolete scope and absent symbol returned no savings).
