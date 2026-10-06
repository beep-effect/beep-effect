---
"@beep/architecture-lab-proof": patch
"@beep/architecture-lab-tables": patch
"@beep/box": patch
"@beep/db-admin": patch
"@beep/epistemic-tables": patch
"@beep/epistemic-ui": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-tables": patch
"@beep/law-practice-use-cases": patch
"@beep/ontology-client": patch
"@beep/ontology-server": patch
"@beep/professional-desktop": patch
"@beep/rdf-canonize": patch
"@beep/semantic-web": patch
"@beep/storybook": patch
"@beep/ui": patch
"@beep/xstate": patch
---

Declare direct workspace dependencies used by runtime code and tests so isolated
installs do not rely on root hoisting. Keep RDF adapter integration tests in the
driver package to preserve the contract-to-driver dependency direction.
