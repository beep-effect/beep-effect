---
title: "Vercel provider surface: env credentials, constant layers, narrowed constructors"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-vercel"
reversal: "Expose providers()/XProvider() functions and the full ResourceClass type once the repo's lazyEffect and missingPipeableSignature diagnostics allow them, or when the package goes upstream."
---

Credentials are distilled's `CredentialsFromEnv` (`VERCEL_TOKEN`, optional `VERCEL_API_URL`) and the team is a per-resource `teamId` prop; there is no Alchemy AuthProvider, profile or `Contributions` module. Two repo diagnostics (errors here, off upstream) shape the exported surface: `lazyEffect` rejects zero-argument functions returning a Layer, so `Vercel.providers`, `Vercel.resources` and the three `XProvider` layers are constants rather than Alchemy's `providers()` calls; `missingPipeableSignature` rejects the `(id, Effect<props>)` overload of Alchemy's resource constructor, so each resource is exported as `DeclaredResource<R>` (the `ResourceClass` without that overload; declarations yield props first). The upstream PR (D14) restores both mechanically. `resources` is exported so tests and other hosts can supply their own `Credentials` and `HttpClient`.
