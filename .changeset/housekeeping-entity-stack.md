---
"@beep/agents-client": patch
"@beep/agents-domain": patch
"@beep/agents-server": patch
"@beep/agents-tables": patch
"@beep/agents-use-cases": patch
"@beep/architecture-lab-domain": patch
"@beep/architecture-lab-server": patch
"@beep/architecture-lab-tables": patch
"@beep/architecture-lab-ui": patch
"@beep/architecture-lab-use-cases": patch
"@beep/db-admin": patch
"@beep/documents-domain": patch
"@beep/documents-server": patch
"@beep/documents-tables": patch
"@beep/documents-use-cases": patch
"@beep/drizzle": patch
"@beep/effect-drizzle": patch
"@beep/epistemic-client": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-server": patch
"@beep/epistemic-tables": patch
"@beep/epistemic-ui": patch
"@beep/epistemic-use-cases": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-tables": patch
"@beep/law-practice-use-cases": patch
"@beep/professional-desktop": patch
"@beep/repo-cli": patch
"@beep/repo-utils": patch
"@beep/schema": patch
"@beep/shared-domain": patch
"@beep/shared-tables": patch
"@beep/test-utils": patch
"@beep/workspace-domain": patch
"@beep/workspace-server": patch
"@beep/workspace-tables": patch
---

Entity-stack housekeeping: consolidate every EntityId into per-entity identity modules under @beep/shared-domain, migrate all 49 Domain entities to the ProductEntity kit on @beep/effect-drizzle with byte-identical baseline DDL, split model files into model/values/behavior roles, and delete the legacy BaseEntity, EntitySchema, EntityTable, Model, VariantSchema, and DomainModel stack.
