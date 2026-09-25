---
"@beep/agents-server": patch
"@beep/cosmos": patch
"@beep/editor": patch
"@beep/epistemic-ui": patch
"@beep/oip-web": patch
"@beep/ontology-client": patch
"@beep/pandoc-ast": patch
"@beep/professional-desktop": patch
"@beep/rdf-canonize": patch
"@beep/test-utils": patch
---

Keep test isolation on under coverage for packages whose tests mock modules, stub globals, or
change the working directory; the shared vitest config now shares the module graph per worker
in coverage runs.
