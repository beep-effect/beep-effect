---
title: Conformance imports whatwg-url through its pure subpaths, never the package root
date: 2026-11-23
reversal: Import parseURL and isValidURLString from the whatwg-url package root and delete the subpath declarations in src/whatwg-url.d.ts.
governs:
  - src/Html.conformance.ts#HTML_URL_VALIDATION_BASE
  - src/Html.conformance.ts#isValidHtmlUrlString
enforcedBy: []
---

`Html.conformance.ts` imports `parseURL` from `whatwg-url/lib/url-state-machine.js`
and `isValidURLString` from `whatwg-url/lib/url-string-validator.js`, typed by
`src/whatwg-url.d.ts`. The package root initializes the Node WebIDL wrappers,
which read `SharedArrayBuffer` at load, so importing it pulls that layer into
browser bundles. The two subpaths keep the author-validity URL algorithm exact
without it.

Rejected: the package root import, which is the documented entry point and
which a competent agent would choose; under Bun with `SharedArrayBuffer`
deleted, `import("whatwg-url")` throws at `whatwg-url/index.js` while the
subpath import loads, the case `test/Html.browser-import.test.ts` runs.
