---
title: "P1: IdentityAuthority moves to @beep/identity/Authority, a module with no imports (design D11)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Move IdentityAuthority back into Id.ts by a decision file and inline the authority string in the generated registry data."
---

D11 of the registry-first design, not replaced by a ruling. IdentityAuthority moves from Id.ts:77 to a new @beep/identity/Authority module with no imports, because the generated registry data (identity/src/internal/generated/Registry.data.ts) and Id.ts both need it and Id.ts keeping it would close the cycle Id.ts to Registry.data.ts to Id.ts. Id.ts and packages.ts never import Iri.ts, Term.ts or Registry.ts; an ImportGraph test in identity guards that. The importer outside identity, public-site/test/PublicSite.test.ts, is re-pointed in the same commit. IdentityRegistry stays as the runtime view of the same table, and @beep/semantic-web IdentityEntry is built by IdentityEntry.fromBinding with iri typed TermIri (breaking; no changeset is written).
