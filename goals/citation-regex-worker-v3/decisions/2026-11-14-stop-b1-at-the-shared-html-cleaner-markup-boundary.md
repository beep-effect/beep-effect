---
title: "Pass native starters explicitly across closed cleaner boundaries"
date: 2026-11-14
reversal: "Replace the explicit starter route only through a new owner ruling with equivalent capacity proofs."
---

Owner ruling: a native starter crosses a closed boundary as an explicit argument,
never a Context lookup or an optional fallback. Markup and Diff take the lane's
start shape explicitly at call time or per-request construction. Invocation-owned
regex, Diff, Xml and HTML cleaning all use that invocation's lane. A named
standalone starter claims one native unit per process only for genuinely external
calls, retaining confirmed retirement and quarantine. The public cleaner port
keeps its shape. This supersedes the earlier proposal to exempt engine HTML
cleaning from lane accounting.

## Required call-path facts (source inspection, no runtime claim)

Paths below are relative to `packages/law-practice/`.

There is exactly one production call expression to `CitationBuiltinCleaners.invoke`:
`server/src/internal/Citation/CleanerRegistry.ts:357`. Registry construction captures
that object at line 99. Its callers reach it through `CitationCleaner.invoke`:

| Entry / route | Invocation status |
| --- | --- |
| Engine clean: `server/src/CitationEngine/CitationEngine.layer.ts:152` -> `server/src/internal/Citation/SourceCleaning.ts:74` -> `CleanerPipeline.ts:236` -> `CleanerRegistry.ts:357` | Inside `openCitationInvocation`, engine layer lines 138-149. |
| Engine extract: engine layer line 157 -> source/document extraction -> `InputDocument.ts:169` -> `CleanerPipeline.ts:236` -> `CleanerRegistry.ts:357` | Inside the same engine invocation. Plain input with cleaning steps uses `InputDocument.ts:176`; markup uses line 193. |
| Six-form extractor: `server/src/CitationExtractor/CitationExtractor.layer.ts:90-100,132` | Has an invocation but uses Recognizer, not this cleaner; no route into builtin invoke. |
| Direct returned registry runtime / pipeline / builtin invocation | No invocation is required by the closed port; an external caller can invoke it directly. If a caller already has an invocation, the current port still has the identical signature and object. |
| Nested cleaner plan: `CleanerPipeline.ts:252` calls `execute`, whose line 236 dispatches through the same runtime | Inherits the caller's invocation status; it creates no invocation. |

Other source-level host dispatch is `CleanerRegistry.ts:361`, calling captured
`protocols.invoke`. `DocumentCleanerProtocols.ts:196` spreads the supplied host
protocols, retaining that invoke implementation. Those callbacks are opaque to
the engine. This inspection does not establish that an arbitrary host callback
actually starts a process; its implementation is not available here.

Direct test adapters also reach builtins: `CitationBuiltinCleaners.test.ts:197`
(the pipeline is invocation-bound at lines 163-164), and
`CitationCleanerRegistry.fixtures.ts:121` (wrapper around the real builtin).
`CitationUnicodePipeline.fixtures.ts:134` wraps the registry runtime; its pipeline
is invocation-bound at lines 145-149. These do not add production entry paths.

### Object identity

Yes, in the default assembly the engine uses the same closed registry runtime
that is exposed to the host. `DocumentServices.ts:61-71` creates one registry,
provides its runtime to the pipeline, and puts that exact runtime into the output
Context. Line 74 also returns the registry and builtin objects. The default engine
passes these services into install (`CitationEngine.layer.ts:276-280`).
`SourceCleaning.ts:45` captures `CitationCleaner` and provides that same object
at line 78. General `CitationEngineLive` instead accepts whatever public cleaner
the host supplied; it does not require the internal registry or builtin service.

### Does one invocation use both cleaning and other native work?

Yes: markup extraction cleans at `InputDocument.ts:193`, then computes geometry
at line 196 (regex and Diff), then tokenizes in `DocumentExtraction.ts:173` after
initialization at lines 185-187. Those stages share one invocation. In the normal
built-in source order, HTML cleaning precedes regex/Diff; inspection found no
normal built-in path holding a regex/Diff/Xml occupant before entering that HTML
cleaner. Today no lane exists, so no current execution can literally hold a lane
occupant. Host callback reentry and process use are opaque, not proved absent.
Engine annotate does not call this cleaner pipeline; it has its own geometry/Xml
path. Engine resolve does not call it either.

## Second stop: exported cleaner port

The internal default assembly can be given an explicit-starter entry. That alone
cannot satisfy the ruling for the general live engine: `SourceCleaning.ts:45`
and `InputDocument.ts:143` capture the public `CitationCleaner`, and
`CleanerPipeline.ts:73,236` has only that port's closed invoke method.
`use-cases/src/CitationEngine/CitationEngine.cleaner.ts:238-260` defines it;
`use-cases/src/server.ts:23` exports it. Neither invoke nor the public
`CitationCleanerWork` argument (cleaner.ts:203-217, exported at server.ts:373)
carries native starter authority.

Passing the starter through an arbitrary existing implementation requires a public
contract amendment or an additional required installation capability specifying
how host cleaners bind invocation authority. Substituting a new internal runtime
would bypass the host's cleaner semantics and owned-value/registry identity.
A Context lookup, optional fallback, identity cache, or silently using standalone
inside the engine is forbidden. Per owner ruling item 5, stop here before lane
implementation. No claim is made that an unseen host callback was observed
spawning; the demonstrated blocker is the exported port on the explicit argument
route, independently of that second possible stop condition.

Proposed next ruling: define the required host installation capability for an
invocation-bound cleaner view, including preservation of registry/value identity
and host invoke semantics, or explicitly authorize a public cleaner contract
amendment carrying starter authority. No such change is implemented here.
