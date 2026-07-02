# rdfjs-types type-design review

## 1. Overview

- Package identity: `@rdfjs/types` version `2.0.1`, with `index.d.ts` as the package types entrypoint (.repos/rdfjs-types/package.json:2, .repos/rdfjs-types/package.json:3, .repos/rdfjs-types/package.json:5).
- The README describes the package as authoritative TypeScript typings for RDF/JS specifications (.repos/rdfjs-types/README.md:3).
- The README says the types should match the RDF/JS Data Model, Dataset, and Stream specifications, while allowing TypeScript-specific differences (.repos/rdfjs-types/README.md:5).
- The root barrel exports type declarations from `data-model`, `stream`, `dataset`, and `query` modules (.repos/rdfjs-types/index.d.ts:3, .repos/rdfjs-types/index.d.ts:4, .repos/rdfjs-types/index.d.ts:5, .repos/rdfjs-types/index.d.ts:6).
- The package is declarations-only for RDF/JS interfaces rather than a runtime implementation (.repos/rdfjs-types/README.md:15).

## 2. License

- License verified as MIT: `package.json` sets `"license": "MIT"` (.repos/rdfjs-types/package.json:4).
- License file quote: `.repos/rdfjs-types/LICENSE` line 1 says `MIT License` (.repos/rdfjs-types/LICENSE:1).

## 3. Term type design

- `Term` is a union of `NamedNode`, `BlankNode`, `Literal`, `Variable`, `DefaultGraph`, and `BaseQuad` (.repos/rdfjs-types/data-model.d.ts:13).
- `NamedNode<Iri extends string = string>` is the one term interface with a string generic for its IRI value (.repos/rdfjs-types/data-model.d.ts:18).
- `NamedNode` uses the `"NamedNode"` `termType` discriminant and stores the IRI in `value: Iri` (.repos/rdfjs-types/data-model.d.ts:22, .repos/rdfjs-types/data-model.d.ts:26).
- `NamedNode.equals` is specified to return true only when the other term has `termType` `"NamedNode"` and the same `value` (.repos/rdfjs-types/data-model.d.ts:30, .repos/rdfjs-types/data-model.d.ts:32).
- `BlankNode` uses the `"BlankNode"` `termType`, has `value: string`, and its equality contract is same `termType` plus same `value` (.repos/rdfjs-types/data-model.d.ts:38, .repos/rdfjs-types/data-model.d.ts:42, .repos/rdfjs-types/data-model.d.ts:49, .repos/rdfjs-types/data-model.d.ts:53, .repos/rdfjs-types/data-model.d.ts:55).
- `Literal` uses the `"Literal"` `termType`, has `value: string`, `language: string`, optional `direction`, and `datatype: NamedNode` (.repos/rdfjs-types/data-model.d.ts:61, .repos/rdfjs-types/data-model.d.ts:65, .repos/rdfjs-types/data-model.d.ts:69, .repos/rdfjs-types/data-model.d.ts:75, .repos/rdfjs-types/data-model.d.ts:79, .repos/rdfjs-types/data-model.d.ts:83).
- `Literal.equals` includes `termType`, `value`, `language`, `direction`, and `datatype` in the equality contract (.repos/rdfjs-types/data-model.d.ts:87, .repos/rdfjs-types/data-model.d.ts:88, .repos/rdfjs-types/data-model.d.ts:90).
- `BaseQuad` uses the `"Quad"` `termType`, has empty-string `value`, stores all four positions as `Term`, and defines equality as same type with all components equal (.repos/rdfjs-types/data-model.d.ts:170, .repos/rdfjs-types/data-model.d.ts:174, .repos/rdfjs-types/data-model.d.ts:178, .repos/rdfjs-types/data-model.d.ts:184, .repos/rdfjs-types/data-model.d.ts:189, .repos/rdfjs-types/data-model.d.ts:194, .repos/rdfjs-types/data-model.d.ts:199, .repos/rdfjs-types/data-model.d.ts:203, .repos/rdfjs-types/data-model.d.ts:205).
- `Quad` refines `BaseQuad` positions to `Quad_Subject`, `Quad_Predicate`, `Quad_Object`, and `Quad_Graph` (.repos/rdfjs-types/data-model.d.ts:211, .repos/rdfjs-types/data-model.d.ts:216, .repos/rdfjs-types/data-model.d.ts:221, .repos/rdfjs-types/data-model.d.ts:226, .repos/rdfjs-types/data-model.d.ts:231).
- `Quad_Predicate` is `NamedNode | Variable`, so RDF/JS predicates are term objects rather than CURIE string literals in the quad interface (.repos/rdfjs-types/data-model.d.ts:147).
- Literal-preserving string typing appears at the `NamedNode<Iri extends string = string>` boundary and the matching `DataFactory.namedNode<Iri extends string = string>(value: Iri): NamedNode<Iri>` factory method (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:249).
- `Literal` does not preserve the literal type of its lexical value because `Literal.value` is `string` and `DataFactory.literal` takes `value: string` and returns `Literal` (.repos/rdfjs-types/data-model.d.ts:69, .repos/rdfjs-types/data-model.d.ts:273).

## 4. DataFactory contract

- `DataFactory<OutQuad extends BaseQuad = Quad, InQuad extends BaseQuad = OutQuad>` is the factory interface for RDF terms and quads (.repos/rdfjs-types/data-model.d.ts:241, .repos/rdfjs-types/data-model.d.ts:243).
- `namedNode<Iri extends string = string>(value: Iri): NamedNode<Iri>` preserves a string-literal IRI through the factory result (.repos/rdfjs-types/data-model.d.ts:249).
- `blankNode(value?: string): BlankNode`, `literal(value: string, languageOrDatatype?: string | NamedNode | DirectionalLanguage): Literal`, optional `variable?(value: string): Variable`, and `defaultGraph(): DefaultGraph` cover the scalar term factories without preserving literal-value generics beyond `namedNode` (.repos/rdfjs-types/data-model.d.ts:258, .repos/rdfjs-types/data-model.d.ts:273, .repos/rdfjs-types/data-model.d.ts:281, .repos/rdfjs-types/data-model.d.ts:286).
- `quad(subject: InQuad['subject'], predicate: InQuad['predicate'], object: InQuad['object'], graph?: InQuad['graph']): OutQuad` delegates quad position types to the selected `InQuad`/`OutQuad` generics (.repos/rdfjs-types/data-model.d.ts:296).
- `fromTerm` overloads return bare `NamedNode`, `BlankNode`, `Literal`, `Variable`, `DefaultGraph`, or `OutQuad`, so a copied `NamedNode<I>` is not typed as preserving `I` through `fromTerm` (.repos/rdfjs-types/data-model.d.ts:303, .repos/rdfjs-types/data-model.d.ts:304, .repos/rdfjs-types/data-model.d.ts:305, .repos/rdfjs-types/data-model.d.ts:306, .repos/rdfjs-types/data-model.d.ts:307, .repos/rdfjs-types/data-model.d.ts:308).
- `fromQuad(original: InQuad): OutQuad` preserves the selected quad generic pair at the quad boundary (.repos/rdfjs-types/data-model.d.ts:315).
- A Beep identity/composer IRI value can interoperate by passing its literal string value to `namedNode`, because that method returns `NamedNode<Iri>` for the same `Iri` type parameter (.repos/rdfjs-types/data-model.d.ts:249).
- A Beep object projection structurally satisfies `NamedNode<I>` only if it has `termType: "NamedNode"`, `value: I`, and `equals(other: Term | null | undefined): boolean` (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:22, .repos/rdfjs-types/data-model.d.ts:26, .repos/rdfjs-types/data-model.d.ts:32).
- A string-like Beep IRI alone does not structurally satisfy `NamedNode<I>` because the declared interface requires the object members `termType`, `value`, and `equals` (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:22, .repos/rdfjs-types/data-model.d.ts:26, .repos/rdfjs-types/data-model.d.ts:32).

## 5. Dataset/Stream interfaces

- `DatasetCore` is a quad set interface with `size`, `add`, `delete`, `has`, `match`, and iterator members (.repos/rdfjs-types/dataset.d.ts:7, .repos/rdfjs-types/dataset.d.ts:11, .repos/rdfjs-types/dataset.d.ts:18, .repos/rdfjs-types/dataset.d.ts:23, .repos/rdfjs-types/dataset.d.ts:28, .repos/rdfjs-types/dataset.d.ts:45, .repos/rdfjs-types/dataset.d.ts:47).
- `Dataset` extends `DatasetCore` and adds collection-style and RDF dataset operations such as `addAll`, `contains`, `equals`, `filter`, `map`, `toArray`, `toCanonical`, `toStream`, and `toString` (.repos/rdfjs-types/dataset.d.ts:57, .repos/rdfjs-types/dataset.d.ts:64, .repos/rdfjs-types/dataset.d.ts:72, .repos/rdfjs-types/dataset.d.ts:97, .repos/rdfjs-types/dataset.d.ts:116, .repos/rdfjs-types/dataset.d.ts:140, .repos/rdfjs-types/dataset.d.ts:169, .repos/rdfjs-types/dataset.d.ts:175, .repos/rdfjs-types/dataset.d.ts:180, .repos/rdfjs-types/dataset.d.ts:188).
- `Stream<Q extends BaseQuad = Quad>` is a readable quad stream with `read(): Q | null` (.repos/rdfjs-types/stream.d.ts:23, .repos/rdfjs-types/stream.d.ts:30).
- `Source.match` returns a `Stream<Q>` for optional term pattern arguments, so projection code only needs this interface when it targets RDF/JS source/store streaming interop (.repos/rdfjs-types/stream.d.ts:40, .repos/rdfjs-types/stream.d.ts:50).

## 6. DIAMONDS

- D3/D4 interop diamond: keep a Beep literal IRI path that can feed `DataFactory.namedNode<Iri>(value): NamedNode<Iri>`, because that is the declared RDF/JS literal-preserving handle boundary (.repos/rdfjs-types/data-model.d.ts:249).
- D4 handle diamond: expose an optional RDF/JS object projection with `termType: "NamedNode"`, literal-typed `value`, and `equals`, because those are the declared members of `NamedNode<Iri>` (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:22, .repos/rdfjs-types/data-model.d.ts:26, .repos/rdfjs-types/data-model.d.ts:32).
- D6 triples-as-tuples diamond: compile tuple predicates to RDF/JS `NamedNode` terms before producing quads, because `Quad_Predicate` is `NamedNode | Variable` and `Quad` positions are term-typed fields (.repos/rdfjs-types/data-model.d.ts:147, .repos/rdfjs-types/data-model.d.ts:216, .repos/rdfjs-types/data-model.d.ts:221, .repos/rdfjs-types/data-model.d.ts:226, .repos/rdfjs-types/data-model.d.ts:231).
- Projection diamond: use RDF/JS `Quad` as the ecosystem emission target, because `DataFactory.quad` creates `OutQuad` from selected `InQuad` position types and `DatasetCore` consumes `InQuad` values through `add` (.repos/rdfjs-types/data-model.d.ts:296, .repos/rdfjs-types/dataset.d.ts:18).
- Equality diamond: preserve RDF/JS equality behavior on interop objects, because `NamedNode.equals` is based on `termType` plus `value` and quad equality is based on same type plus all components equal (.repos/rdfjs-types/data-model.d.ts:30, .repos/rdfjs-types/data-model.d.ts:32, .repos/rdfjs-types/data-model.d.ts:203, .repos/rdfjs-types/data-model.d.ts:205).
- Scratchpad assessment: if the prototype IRI type is represented only as a string literal, it does not structurally satisfy `NamedNode<Iri>` because `NamedNode<Iri>` is an object interface requiring `termType`, `value`, and `equals` members (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:22, .repos/rdfjs-types/data-model.d.ts:26, .repos/rdfjs-types/data-model.d.ts:32).
- Scratchpad assessment: an RDF/JS projection wrapper around the prototype IRI can structurally satisfy `NamedNode<Iri>` when the wrapper's `.value` retains the IRI literal type and the wrapper implements the declared equality method (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:26, .repos/rdfjs-types/data-model.d.ts:32).

## 7. ROUGH

- String-widening risk: bare `NamedNode` defaults its generic to `string`, and core aliases such as `Term` and `Quad_Predicate` use bare `NamedNode` rather than carrying a specific `Iri` parameter (.repos/rdfjs-types/data-model.d.ts:18, .repos/rdfjs-types/data-model.d.ts:13, .repos/rdfjs-types/data-model.d.ts:147).
- Copy risk: `fromTerm(original: NamedNode): NamedNode` returns a bare `NamedNode`, so a literal `NamedNode<I>` can be widened by factory copying through this overload (.repos/rdfjs-types/data-model.d.ts:303).
- Literal-value risk: `DataFactory.literal` accepts `value: string` and returns `Literal`, while `Literal.value` is `string`, so literal lexical values do not receive the same literal-preserving treatment as named-node IRIs (.repos/rdfjs-types/data-model.d.ts:273, .repos/rdfjs-types/data-model.d.ts:69).
- Predicate conversion risk: CURIE predicates from the Beep baseline must be expanded or wrapped before RDF/JS quad emission, because `Quad_Predicate` is `NamedNode | Variable` rather than a string predicate type (.repos/rdfjs-types/data-model.d.ts:147).
- Baseline type-machinery gap: the closest predicate-facing RDF/JS declaration is `Quad_Predicate = NamedNode | Variable`, so the Beep `Curie`/`Predicate`/`Expand` machinery has no direct RDF/JS type-level counterpart in this repo and must stay on the Beep side before `NamedNode` emission (.repos/rdfjs-types/data-model.d.ts:147).
- Base-quad precision risk: `BaseQuad` stores `subject`, `predicate`, `object`, and `graph` as `Term`, while `Quad` is the interface that refines those positions to role-specific aliases (.repos/rdfjs-types/data-model.d.ts:184, .repos/rdfjs-types/data-model.d.ts:189, .repos/rdfjs-types/data-model.d.ts:194, .repos/rdfjs-types/data-model.d.ts:199, .repos/rdfjs-types/data-model.d.ts:216, .repos/rdfjs-types/data-model.d.ts:221, .repos/rdfjs-types/data-model.d.ts:226, .repos/rdfjs-types/data-model.d.ts:231).
- Dataset/stream widening risk: `DatasetCore.match` and `Source.match` accept optional `Term | null` pattern arguments, so literal IRI types are not preserved at those query boundaries (.repos/rdfjs-types/dataset.d.ts:45, .repos/rdfjs-types/stream.d.ts:50, .repos/rdfjs-types/data-model.d.ts:13).

## 8. Sources

- `.repos/rdfjs-types/LICENSE`
- `.repos/rdfjs-types/README.md`
- `.repos/rdfjs-types/data-model.d.ts`
- `.repos/rdfjs-types/dataset.d.ts`
- `.repos/rdfjs-types/index.d.ts`
- `.repos/rdfjs-types/package.json`
- `.repos/rdfjs-types/query.d.ts`
- `.repos/rdfjs-types/query/common.d.ts`
- `.repos/rdfjs-types/query/queryable.d.ts`
- `.repos/rdfjs-types/stream.d.ts`
