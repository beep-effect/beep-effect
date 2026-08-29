---
{}
---

This change is version-neutral because it extends private workspace packages
that are released only with their owning application. Legacy Evidence JSONB
rows are normalized at the persistence read boundary, while the domain schema
and every newly encoded row retain strict UTF-16 span-width validation.
