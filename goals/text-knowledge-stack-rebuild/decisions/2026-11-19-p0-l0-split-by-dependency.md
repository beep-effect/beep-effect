---
title: "P0 review: L0 objects are split by dependency so @beep/identity stays effect-only"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Move the digest, version and literal-kit primitives below @beep/identity into a new effect-only primitive package and reunite the registry record, by a decision file before P1 opens."
---

The reviewer of PR #3420 found that the design module typed identity-owned objects with primitives from @beep/schema (the prefixed digest, the semantic version, LiteralKit), which depends on @beep/identity, so P1 could not move them as written. Ruling: the registry is split along the dependency line. @beep/identity, which imports effect only, owns what expansion and binding need: the IRI schemas, Namespace as prefix and IRI, Term as IRI, namespace and local name, TermBinding (code id, term, since), the Deprecation record (term, since, replacement) and the term-stability snapshot. Its version field is a string with a local pattern check and its literal domains use S.Literals, the standing exception for the bottom package that @beep/schema itself depends on; the registry test cross-checks both against the @beep/schema schemas as a test dependency. The pin of an external namespace (source, license, version, digest) is a NamespacePin record keyed by prefix in @beep/rdf, beside the vendored vocabularies it describes, where the digest and SPDX schemas are importable. The optional gUFO class typing is a record keyed by term IRI in @beep/ontology, where the L3 audit reads it. ContentHash and its domain brands stay over the @beep/schema digest and the minting function stays in @beep/jsonc, as already decided. L0-1 and L0-3 are tested in identity; the license-and-digest assertion on every external namespace is tested in rdf.

The gUFO class typing record has three fields: the type of type (Kind, SubKind, Role, Phase, Category, Mixin, RoleMixin, PhaseMixin), the category of its instances (Object, Relator, Mode, Quality, Event), and for a Relator the set of role terms it mediates. The audit rules of L3-3 read those fields; an untyped term is skipped.
