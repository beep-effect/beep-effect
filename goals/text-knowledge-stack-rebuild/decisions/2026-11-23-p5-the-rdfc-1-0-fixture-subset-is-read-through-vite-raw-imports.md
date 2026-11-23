---
title: "P5: the RDFC-1.0 fixture subset is read through Vite raw imports and leaves out two W3C cases"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Add @effect/platform-bun as an rdf devDependency, read the fixtures through FileSystem, and vendor test060 once the IRI schema admits a no-break space"
---

Row 3 vendors 24 W3C RDFC-1.0 cases (revision 5ffaaa13c0e19a2a2f9e60d0ecd9efaf3edab633, recorded in packages/foundation/modeling/rdf/test/fixtures/rdfc10/SOURCE.json with the W3C test licence in LICENSE beside it). Two cases stay out. test060 has an IRI ending in a no-break space, which the IRI schema refuses as trailing whitespace, so the dataset cannot be built. test075 is a SHA-384 case, and the port hashes with SHA-256 only. The code point ordering that test060 would have exercised is a planted case in Rdfc10.fixtures.test.ts instead, beside two planted branch cases: a blank graph name related to a non-unique blank node, and K4. The fixtures load through Vite's eager raw import.meta.glob (test/support/vite-env.d.ts, after the law-practice-server precedent), so @beep/rdf gains no FileSystem devDependency. The code point order compares UTF-8 bytes, which order the same way as code points.
