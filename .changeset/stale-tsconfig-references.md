---
"@beep/epistemic-ui": patch
"@beep/firecrawl": patch
"@beep/ontology-ui": patch
"@beep/shared-use-cases": patch
---

Drop tsconfig project references that point outside each package's declared dependency closure; an undeclared reference lets tsc -b span packages Turbo cannot order, which is the torn-read TS2306 race class.
