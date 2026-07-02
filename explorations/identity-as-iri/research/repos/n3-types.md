# n3-types repo mining

## 1. Overview

`.repos/n3-types` is a TypeScript definition package for the `n3` module: its package name is `@types/n3`, it is marked private, and its tests import `* as N3 from "n3"` rather than local implementation code (`.repos/n3-types/package.json:1-4`, `.repos/n3-types/n3-tests.ts:1-4`). The package metadata points at the upstream `rdfjs/n3.js` project, so its relationship to the sibling `.repos/n3` implementation is reference/typing alignment rather than an in-repo source dependency (`.repos/n3-types/package.json:5-7`). The package depends on `@rdfjs/types`, and the definitions import those RDFJS interfaces directly (`.repos/n3-types/package.json:8-10`, `.repos/n3-types/index.d.ts:1-5`).

This is effectively an `@types/n3` surface: `.npmignore` excludes everything except declaration files, while `tsconfig.json` type-checks only `index.d.ts` and `n3-tests.ts` (`.repos/n3-types/.npmignore:1-5`, `.repos/n3-types/tsconfig.json:17-20`). The tests say several examples are taken from the N3.js README, which reinforces that this package follows the external N3.js API rather than owning an implementation (`.repos/n3-types/n3-tests.ts:51-54`).

## 2. License

### License Verdict

**REFERENCE-ONLY.** I found no verifiable license grant in this vendored copy. Patterns may be described and reused conceptually, but no code should be copied from `.repos/n3-types` into the identity-as-iri implementation unless a license is later verified from an authoritative upstream source.

The package manifest has name, version, project URL, dependencies, dev dependencies, and owners, but no `license` field (`.repos/n3-types/package.json:1-41`). No README, LICENSE, COPYING, or similar license-bearing top-level file exists in the inspected file inventory; the top-level files inspected were `package.json`, `index.d.ts`, `n3-tests.ts`, `tsconfig.json`, `.eslintrc.json`, and `.npmignore`. The declaration and test file headers contain only TypeScript references/imports, not copyright, SPDX, or license text (`.repos/n3-types/index.d.ts:1-6`, `.repos/n3-types/n3-tests.ts:1-4`). The remaining metadata files likewise contain only compiler/lint/publish configuration, with no license declaration (`.repos/n3-types/tsconfig.json:1-21`, `.repos/n3-types/.eslintrc.json:1-5`, `.repos/n3-types/.npmignore:1-5`).

## 3. Type Architecture

Terms are modeled as RDFJS-compatible classes plus unions. `Term` is the union of `NamedNode`, `BlankNode`, `Literal`, `Variable`, and `DefaultGraph`; the package also defines slot-specific quad unions for subject, predicate, object, and graph (`.repos/n3-types/index.d.ts:7-12`, `.repos/n3-types/index.d.ts:75-78`). `NamedNode` is generic in its IRI string and stores that exact type in `value`, while `BlankNode`, `Variable`, `Literal`, and `DefaultGraph` are not generic over their string payloads except that `DefaultGraph.value` is the literal empty string (`.repos/n3-types/index.d.ts:14-22`, `.repos/n3-types/index.d.ts:24-67`).

Literal string preservation exists, but only for named nodes. The `NamedNode` constructor accepts an `Iri` type parameter, and `DataFactoryInterface.namedNode` returns `NamedNode<Iri>` from the input `Iri` (`.repos/n3-types/index.d.ts:14-17`, `.repos/n3-types/index.d.ts:104-109`). By contrast, `literal` accepts `string | number` and returns plain `Literal`, whose `value`, `language`, `datatypeString`, and constructor input are all widened strings (`.repos/n3-types/index.d.ts:45-57`, `.repos/n3-types/index.d.ts:107-110`).

Quads are typed through slot unions and indexed-access generics. `BaseQuad` stores broad `Term` slots, while `Quad` narrows to RDFJS quad slot aliases (`.repos/n3-types/index.d.ts:80-100`). The factory overloads let callers either use the concrete RDFJS slot aliases or pass a `Q_In` quad type and return `Q_Out`, with the arguments typed as `Q_In["subject"]`, `Q_In["predicate"]`, `Q_In["object"]`, and `Q_In["graph"]` (`.repos/n3-types/index.d.ts:104-130`).

Parser, writer, reasoner, and store APIs propagate caller-supplied quad shapes with generics. `Parser<Q>` returns or emits `Q`, `Writer<Q>` indexes into `Q` for quad arguments, and `Store<Q_RDF, Q_N3, OutQuad, InQuad>` uses separate generic channels for RDF input, N3 query return shape, output dataset shape, and input dataset shape (`.repos/n3-types/index.d.ts:216-232`, `.repos/n3-types/index.d.ts:242-262`, `.repos/n3-types/index.d.ts:283-299`). Store write methods index through `Q_RDF`, dataset methods use `OutQuad` and `InQuad`, and query helpers return arrays of `Q_N3` slot types (`.repos/n3-types/index.d.ts:300-371`).

The package uses TypeScript template literal types for format strings. `MimeSubtype` combines base format variants with RDF-star suffixes, and `MimeFormat` combines MIME top-level types with subtypes (`.repos/n3-types/index.d.ts:168-195`). The same options deliberately retain `string | MimeFormat` for backward compatibility, so the literal union is advisory rather than closed (`.repos/n3-types/index.d.ts:196-204`, `.repos/n3-types/index.d.ts:234-238`). Tests confirm arbitrary `string` formats are accepted by wrapper functions (`.repos/n3-types/n3-tests.ts:131-143`).

No branded types were found. Nominality comes from classes and RDFJS interfaces, not from opaque brands. Type guards in `Util` narrow `RDF.Term` values by term kind, while prefix helpers return a function from `string` suffix to `NamedNode`, losing suffix literal information (`.repos/n3-types/index.d.ts:381-393`, `.repos/n3-types/n3-tests.ts:431-453`).

## 4. Overload/Generic Tricks Worth Stealing For Literal-Type Preservation

The best literal-preserving trick is the simple generic constructor/factory path: make the value constructor generic over the input string and return a value parameterized by that same input type. `NamedNode<Iri>` and `DataFactoryInterface.namedNode<Iri>` do exactly this (`.repos/n3-types/index.d.ts:14-17`, `.repos/n3-types/index.d.ts:104-109`). For identity-as-iri, this maps directly to literal-preserving `curie`, `iri`, and `expand` overloads: infer the literal once at the argument boundary and carry it into the return type.

The second useful trick is indexed-access propagation over a caller-owned shape. Factory, writer, and store APIs type arguments as `Q["subject"]`, `Q["predicate"]`, and related slots instead of re-declaring unions at every method (`.repos/n3-types/index.d.ts:112-130`, `.repos/n3-types/index.d.ts:242-262`, `.repos/n3-types/index.d.ts:316-367`). For our triple fold, this suggests accepting a typed triple/quad shape and indexing into it for subject/predicate/object channels so custom schema handles, CURIEs, and absolute IRI literals stay connected.

The overload shape is worth copying conceptually: concrete ergonomic overload first, generic precision overload second. `quad` and `triple` expose a common RDFJS slot overload and then a generic overload for custom quad types (`.repos/n3-types/index.d.ts:112-130`). Parser APIs similarly separate sync array return, event callback, and object callback forms (`.repos/n3-types/index.d.ts:216-224`). For `expand`/`contract`, this points to overloads that keep the common string call ergonomic while preserving literal return types for valid registry-backed literals.

Template literal unions are used for MIME formats, but the package keeps an escape hatch with `string | MimeFormat` (`.repos/n3-types/index.d.ts:168-200`, `.repos/n3-types/index.d.ts:234-238`). The useful part for `Curie`/`Predicate` is the union construction; the part to avoid is widening the accepted input back to `string` where the handoff requires unknown prefixes to be schema errors.

## 5. DIAMONDS

1. **Literal-preserving node factory -> Phase 1 `Expand<C, V>`.** `NamedNode<Iri>` proves the small pattern we need: a string literal can survive a value-level constructor/factory boundary when the input is generic and the output stores the same generic (`.repos/n3-types/index.d.ts:14-17`, `.repos/n3-types/index.d.ts:104-109`). Our `expand("skos:prefLabel")` overload should return the expanded IRI literal, not `string`, by applying the same inference shape.

2. **Slot-indexed factory overloads -> Phase 2 triple fold.** The `quad`/`triple` generic overloads reuse `Q_In` slots for each argument and return `Q_Out` (`.repos/n3-types/index.d.ts:112-130`). Our `[Subject, Predicate, Object]` tuple machinery can use the same indexed-access style to keep schema handles, CURIE literals, inverse predicates, and absolute IRI literals in their correct channels.

3. **Long-lived generic channels -> ontology assembly surfaces.** `Store` separates RDF input shape, N3 query shape, dataset output shape, and dataset input shape across many methods (`.repos/n3-types/index.d.ts:293-371`). The identity-as-iri fold can use a similar multi-parameter design: one parameter for vocab registry, one for owned identity authority/prefix, and one for accepted external handles, rather than collapsing all ontology terms to `string`.

4. **Template literal unions -> `Curie` and `Predicate`.** `MimeSubtype` and `MimeFormat` show a compact way to derive accepted string forms from smaller unions (`.repos/n3-types/index.d.ts:168-195`). That is the same type-level family as `Curie<V>` and `Predicate<V>`, with the stricter identity-as-iri requirement that the final API should not include a broad `string` fallback.

5. **Type tests as API examples -> prototype proof style.** `n3-tests.ts` exercises parser overloads, writer prefixes, store generics, utility guards, MIME format variants, and RDFJS DataFactory compatibility as compile-time usage examples (`.repos/n3-types/n3-tests.ts:180-188`, `.repos/n3-types/n3-tests.ts:394-412`, `.repos/n3-types/n3-tests.ts:488-529`, `.repos/n3-types/n3-tests.ts:631-632`). Our scratchpad should mirror this with type-level assertions for `Curie`, `Predicate`, `Expand`, and identity-to-IRI derivation.

## 6. ROUGH

`any` escapes are present in public declarations: callback results, logger arguments, subclass hooks, and file descriptor constructor overloads all use `any` (`.repos/n3-types/index.d.ts:21-22`, `.repos/n3-types/index.d.ts:32-33`, `.repos/n3-types/index.d.ts:42-43`, `.repos/n3-types/index.d.ts:52-53`, `.repos/n3-types/index.d.ts:66-67`, `.repos/n3-types/index.d.ts:134-140`, `.repos/n3-types/index.d.ts:242-245`, `.repos/n3-types/index.d.ts:264-269`). Tests also use `{} as any` for a stream placeholder (`.repos/n3-types/n3-tests.ts:268-273`). Avoid this in the identity-as-iri prototype; if an escape is necessary, isolate it behind a typed Effect boundary.

Several stringly APIs deliberately weaken otherwise precise unions. Parser and writer formats accept `string | MimeFormat` for backward compatibility (`.repos/n3-types/index.d.ts:196-204`, `.repos/n3-types/index.d.ts:234-238`), token kinds are just `string`, and `OTerm` allows `RDF.Term | string | null` (`.repos/n3-types/index.d.ts:138-152`). That compromise is incompatible with the handoff rule that unknown prefixes are schema errors rather than silent pass-through.

Prefix utilities lose literal information. `PrefixedToIri` accepts a plain `string` suffix and returns `NamedNode` without preserving the suffix in the result type, and `Util.prefixes` takes a runtime prefix string rather than a key tied to the prefix map (`.repos/n3-types/index.d.ts:7-12`, `.repos/n3-types/index.d.ts:381-393`). The tests confirm the result is consumed as `RDF.NamedNode`/`N3.NamedNode`, not as a suffix-expanded literal type (`.repos/n3-types/n3-tests.ts:450-453`).

Literal values are not literal-preserving. `Literal.value` is `string`, `datatype` is a non-generic `NamedNode`, and the factory returns `Literal` rather than a literal-parameterized variant (`.repos/n3-types/index.d.ts:45-57`, `.repos/n3-types/index.d.ts:107-110`). For identity-as-iri, copied vocabulary terms and typed literals should not follow this widening pattern.

Generic precision is uneven. `Store.getQuads` returns concrete `Quad[]` even though adjacent methods use `OutQuad` or `Q_N3` slot types (`.repos/n3-types/index.d.ts:345-367`). This is a warning for our API: every read path must preserve the same predicate/object literal information as the write/fold path, or the literal machinery will disappear during retrieval.

## 7. Sources

- `.repos/n3-types/package.json`: cited ranges `1-41`.
- `.repos/n3-types/index.d.ts`: cited ranges `1-12`, `14-22`, `24-67`, `75-78`, `80-130`, `134-152`, `168-204`, `216-232`, `234-262`, `264-371`, `381-397`.
- `.repos/n3-types/n3-tests.ts`: cited ranges `1-4`, `51-54`, `131-143`, `180-188`, `268-273`, `394-412`, `431-453`, `488-529`, `631-632`.
- `.repos/n3-types/tsconfig.json`: cited range `1-21`.
- `.repos/n3-types/.eslintrc.json`: cited range `1-5`.
- `.repos/n3-types/.npmignore`: cited range `1-5`.

Filesystem inventory also checked for absent top-level README/LICENSE/COPYING-style files; none were present in `.repos/n3-types`.
