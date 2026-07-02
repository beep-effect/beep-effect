# RDF, Turtle, and JSON-LD Constraints for Identity-as-IRI

This note is for the `identity-as-iri` projection layer. It assumes the model
keeps triples as tuples and treats Turtle, JSON-LD, `@context`, and Turtle
prefix forms as serializations of the same RDF terms.

All citations below are to official W3C documents fetched for this note. No
unfetched source is cited.

## RDF Abstract Syntax

RDF 1.1 Concepts and Abstract Syntax, W3C Recommendation 25 February 2014, is
the stable data model baseline for the projection work. RDF 1.2 Concepts and
Abstract Data Model was fetchable and is a Candidate Recommendation Snapshot
dated 7 April 2026. RDF 1.2 adds model features such as triple terms and
directional language-tagged strings, but the sections below cite RDF 1.1 unless
explicitly noted because the requested serialization sources are RDF 1.1 Turtle
and JSON-LD 1.1.

In RDF 1.1 Concepts section 1.1, "Graph-based Data Model", the core structure
is a set of triples; the set is an RDF graph. Section 3, "RDF Graphs", repeats
that an RDF graph is a set of RDF triples. Section 3.1, "Triples", defines a
triple as subject, predicate, object in that order.

The predicate constraint is exact and load-bearing: RDF 1.1 Concepts section
3.1, "Triples", says the predicate is an IRI. The same document section 1.2,
"Resources and Statements", states that the predicate itself is an IRI and
denotes a property. Therefore a Beep tuple predicate may be authored as a CURIE
or `^curie`, but by the time it is RDF it must expand to an IRI. Neither a
literal nor a blank node is a legal RDF predicate in RDF 1.1.

RDF 1.1 Concepts section 3.1 gives the full component domains:

- Subject: IRI or blank node.
- Predicate: IRI only.
- Object: IRI, literal, or blank node.

RDF 1.1 Concepts section 3.2, "IRIs", defines an IRI in an RDF graph as a
Unicode string conforming to RFC 3987. It also requires RDF abstract-syntax IRIs
to be absolute, with an optional fragment identifier, and defines IRI equality
by simple string comparison with no further normalization. A serializer must
therefore preserve the exact IRI string it is given; replacing a slash with
`%2F`, for example, is not semantics-preserving unless the RDF IRI already
contains those three characters.

RDF 1.1 Concepts section 3.3, "Literals", defines literals as values such as
strings, numbers, and dates. Literals have a lexical form, a datatype IRI, and,
for language-tagged strings, a non-empty language tag. Language-tagged strings
have datatype IRI `rdf:langString`. Simple literals are syntactic sugar for
`xsd:string`.

RDF 1.1 Concepts section 3.4, "Blank Nodes", defines blank nodes as disjoint
from IRIs and literals. Blank node identifiers are local implementation
artifacts and are not persistent or portable identifiers for the resource.
Identity-as-IRI should therefore prefer owned IRIs for Beep identities and use
blank nodes only for genuinely anonymous structure.

RDF 1.1 Concepts section 4, "RDF Datasets", distinguishes one RDF graph from an
RDF dataset. A dataset has one default graph and zero or more named graphs. Each
named graph is paired with a graph name, which in RDF 1.1 may be an IRI or blank
node. The immediate ontology projection can be a graph; a multi-graph export is
a dataset decision and should not be smuggled into the tuple model.

## Turtle Prefixed Names and PN_LOCAL

Turtle is a concrete syntax for RDF graphs. RDF 1.1 Turtle section 6.5,
"Grammar", defines `iri` as either `IRIREF` or `PrefixedName`, and defines
`PrefixedName` as either `PNAME_LN` or `PNAME_NS`. Therefore a prefixed name is
only conforming if the emitted token matches the relevant productions.

The fetched Turtle grammar gives the prefix/local productions as follows
(nonterminal hyperlinks removed; grammar tokens preserved):

```ebnf
[139s] PNAME_NS ::= PN_PREFIX? ':'
[140s] PNAME_LN ::= PNAME_NS PN_LOCAL
[168s] PN_LOCAL ::= (PN_CHARS_U | ':' | [0-9] | PLX) ((PN_CHARS | '.' | ':' | PLX)* (PN_CHARS | ':' | PLX))?
```

The same section defines `PLX`, `PERCENT`, `HEX`, and `PN_LOCAL_ESC`:

```ebnf
[169s] PLX ::= PERCENT | PN_LOCAL_ESC
[170s] PERCENT ::= '%' HEX HEX
[171s] HEX ::= [0-9] | [A-F] | [a-f]
[172s] PN_LOCAL_ESC ::= '\' ('_' | '~' | '.' | '-' | '!' | '$' | '&' | "'" | '(' | ')' | '*' | '+' | ',' | ';' | '=' | '/' | '?' | '#' | '@' | '%')
```

Turtle section 6.4, "Escape Sequences", separately says reserved character
escape sequences are a backslash followed by one of
`~.-!$&'()*+,;=/?#@%_`, and that this escape kind can be used in local names.
Section 7.2, "RDF Term Constructors", says `PNAME_LN` forms the IRI by
unescaping reserved characters in `PN_LOCAL` and concatenating the result to the
namespace.

The percent production is not a general serializer escape. Turtle section 6.4
notes that percent-encoded sequences are allowed in local names, but they are
not decoded during processing. The sequence `%66` in a local name contributes
the three characters `%`, `6`, `6` to the RDF IRI, not `f`.

### Slash and Dot Locals

For the handoff example local name `Ontology.models/HttpUrl`:

- The initial `O` is allowed because `PN_LOCAL` can start with `PN_CHARS_U`.
- The dot between `models` and `HttpUrl` is allowed raw because the middle part
  of `PN_LOCAL` allows `.`.
- The slash is not allowed raw by `PN_LOCAL`.
- The slash is allowed through `PLX`, because `PLX` includes `PN_LOCAL_ESC`, and
  `PN_LOCAL_ESC` includes `/`.

Therefore `beep:Ontology.models/HttpUrl` is not a valid Turtle `PNAME_LN`, but
`beep:Ontology.models\/HttpUrl` is a valid Turtle `PNAME_LN` for the same RDF
IRI local string. Escaping the dot as `\.` is also legal, but not required when
the dot is internal. A leading dot or final dot would need `\.` because a raw
dot is not allowed at the start or end of `PN_LOCAL`.

Given a fixed declared namespace and candidate local part, a conforming Turtle
writer must fall back to `IRIREF` instead of `PrefixedName` when the exact IRI
cannot be emitted as `PNAME_NS` or as `PNAME_LN` whose local matches `PN_LOCAL`
after only semantics-preserving local-name escapes. In practice:

- Use raw characters only where `PN_LOCAL` permits them.
- Use `PN_LOCAL_ESC` only for this exact set:
  `_ ~ . - ! $ & ' ( ) * + , ; = / ? # @ %`.
- Use `PERCENT` only when the source IRI literally contains `%` followed by two
  hex characters and the writer intends to preserve those three characters.
- Do not percent-encode a source slash as `%2F` if the RDF IRI contains `/`;
  that changes the IRI string under RDF 1.1 Concepts section 3.2.
- If no valid prefix/local split can satisfy the grammar without changing the
  IRI, emit `<absolute-iri>` as `IRIREF` instead.

## Turtle Literals

Turtle section 2.5, "RDF Literals", defines literal notation. Quoted literals
may have a datatype IRI with `^^`, or a language tag. Section 7.2 says an
`RDFLiteral` with neither datatype nor language tag has datatype `xsd:string`;
with a language tag it has datatype `rdf:langString`; with `^^ iri` it uses the
given datatype IRI.

Turtle section 6.5 gives these string productions:

```ebnf
[17] String ::= STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE | STRING_LITERAL_LONG_SINGLE_QUOTE | STRING_LITERAL_LONG_QUOTE
[22] STRING_LITERAL_QUOTE ::= '"' ([^#x22#x5C#xA#xD] | ECHAR | UCHAR)* '"'
[23] STRING_LITERAL_SINGLE_QUOTE ::= "'" ([^#x27#x5C#xA#xD] | ECHAR | UCHAR)* "'"
[24] STRING_LITERAL_LONG_SINGLE_QUOTE ::= "'''" (("'" | "''")? ([^'\] | ECHAR | UCHAR))* "'''"
[25] STRING_LITERAL_LONG_QUOTE ::= '"""' (('"' | '""')? ([^"\] | ECHAR | UCHAR))* '"""'
[159s] ECHAR ::= '\' [tbnrf"'\]
```

Turtle section 6.4 maps the `ECHAR` escapes to the usual characters: tab,
backspace, newline, carriage return, form feed, double quote, single quote, and
backslash. Numeric Unicode escapes are `\u` plus four hex digits and `\U` plus
eight hex digits.

Turtle section 2.5.2, "Numbers", allows integer, decimal, and double literals
as direct shorthand. Section 7.2 maps the lexical input string to `xsd:integer`,
`xsd:decimal`, or `xsd:double`. The grammar is:

```ebnf
[16] NumericLiteral ::= INTEGER | DECIMAL | DOUBLE
[19] INTEGER ::= [+-]? [0-9]+
[20] DECIMAL ::= [+-]? [0-9]* '.' [0-9]+
[21] DOUBLE ::= [+-]? ([0-9]+ '.' [0-9]* EXPONENT | '.' [0-9]+ EXPONENT | [0-9]+ EXPONENT)
[154s] EXPONENT ::= [eE] [+-]? [0-9]+
```

Turtle section 2.5.3, "Booleans", and grammar production `[133s]` define
boolean shorthand with only `true` and `false`:

```ebnf
[133s] BooleanLiteral ::= 'true' | 'false'
```

For Beep canonical Turtle emission, use `true` or `false` for booleans because
those are the only Turtle boolean shorthand forms. For numbers, the fetched
Turtle spec defines accepted shorthand grammar and datatype mapping, but does
not define a separate canonical lexical form for each XSD numeric datatype.
Beep can choose a deterministic writer policy within the accepted grammar
without claiming that Turtle itself mandates that canonical form.

## JSON-LD Contexts and Compact IRIs

JSON-LD 1.1, W3C Recommendation 16 July 2020, is the syntax source. JSON-LD 1.1
Processing Algorithms and API, also W3C Recommendation 16 July 2020, is used
only for expansion and compaction concepts.

JSON-LD syntax section 3.1, "The Context", defines a context as the mechanism
for mapping terms to IRIs. A term definition can be a simple string mapping or
an expanded term definition map. Section 9.15, "Context Definitions", gives the
normative keyword constraints for context definitions.

JSON-LD syntax section 4.1.2, "Default Vocabulary", explains `@vocab`: it sets
a vocabulary mapping for properties and types that do not match a term and are
not IRIs or compact IRIs. Section 10's keyword definition for `@vocab` says the
unaliased keyword may appear in a context definition and may also be the value
of `@type` in an expanded term definition.

JSON-LD syntax section 4.1.5, "Compact IRIs", defines compact IRIs as the
`prefix:suffix` form. The prefix must be a term in the active context, and the
IRI is generated by concatenating the prefix's IRI mapping with the suffix. The
same section says the suffix must not begin with two slashes, because values of
the form `prefix://...` are treated as IRIs. The JSON-LD API section 5.2, "IRI
Expansion", matches that model: when a value contains a colon and the prefix
maps to a term definition with a prefix flag, expansion concatenates the IRI
mapping and the suffix.

That confirms the handoff's JSON-LD claim for slash-containing local parts:
JSON-LD compact IRI syntax allows `/` in the suffix. The fetched syntax places
the special restriction on suffixes beginning with `//`; it does not impose the
Turtle `PN_LOCAL` grammar on the suffix. Thus `beep:Ontology.models/HttpUrl`
is a valid JSON-LD compact IRI when `beep` is a prefix term, while the same text
is not a valid Turtle prefixed name unless the slash is escaped as `\/`.

JSON-LD 1.1 added explicit `@prefix` control. Syntax section 10's keyword
definition says unaliased `@prefix` may appear in an expanded term definition
and must be `true` or `false`. API section 6.2, "IRI Compaction", creates a
compact IRI only from a term definition whose prefix flag is true. Beep context
generation should therefore declare owned and borrowed namespaces as explicit
prefix terms, for example:

```json
{
  "@context": {
    "@version": 1.1,
    "beep": { "@id": "https://ns.beep.sh/", "@prefix": true },
    "rdfs": { "@id": "http://www.w3.org/2000/01/rdf-schema#", "@prefix": true }
  }
}
```

JSON-LD syntax section 10 defines `@id` as usable in node objects, graph
objects, and expanded term definitions. The value of an `@id` key must be an
IRI reference or compact IRI, including blank node identifiers. Section 3.3,
"Node Identifiers", is the design-facing section: use `@id` to identify the
node whose properties are being described, and use `{"@id": "..."}` value
objects when a property value is another node by identifier.

JSON-LD syntax section 4.2.3, "Type Coercion", lets a term definition's `@type`
coerce values. When `@type` is `@id`, string values are interpreted as IRIs.
When `@type` is a datatype IRI or compact IRI, string values are interpreted as
typed values. API section 5.3.1, "Overview", describes value expansion for
`@id` or `@vocab` type mappings as returning an object with a single `@id`
entry; otherwise value expansion produces value objects with `@value` and,
where applicable, `@type`.

JSON-LD syntax section 4.8, "Reverse Properties", covers reverse arcs. A node
object may contain `@reverse` whose entries describe relationships pointing
toward the current node. Section 10's keyword definition says `@reverse` may be
used as a key in a node object and as a key in an expanded term definition. Its
value in an expanded term definition must be an IRI reference or compact IRI.
Section 9.15.1, "Expanded Term Definition", further constrains reverse term
definitions: if `@reverse` is used, the term definition must not also contain
`@id` or `@nest`, and any `@container` must be `@set`, `@index`, or null.

The Beep `^curie` convention is therefore an authoring convention, not JSON-LD
syntax. A predicate `^rdfs:subClassOf` should be expanded by stripping `^`,
expanding `rdfs:subClassOf`, and emitting the property through JSON-LD
`@reverse`, either in a node object's `@reverse` block or via a context term
definition such as:

```json
{
  "@context": {
    "children": { "@reverse": "rdfs:subClassOf", "@type": "@id" }
  }
}
```

## Datatype vs Object Property Mapping

RDF 1.1 Concepts section 3.1 permits an object to be an IRI, literal, or blank
node. JSON-LD's `@type` coercion controls which of those object shapes a JSON
string becomes.

If a JSON-LD property term has `@type: "@id"`, string values expand to node
references with `@id`; in RDF terms, the object is an IRI or blank node
identifier. That is the serialization shape Beep should use for schema handles,
absolute IRIs, CURIE-valued object references, and inverse object references.

If a JSON-LD property term has `@type` set to a datatype IRI such as
`xsd:dateTime`, or has no `@type` and receives a JSON string, expansion produces
a literal object. That is the serialization shape Beep should use for scalar
schema fields.

The fetched RDF and JSON-LD specifications do not infer OWL property classes.
They only determine whether emitted RDF objects are IRIs, blank nodes, or
literals. Therefore `owl:ObjectProperty` versus `owl:DatatypeProperty` emission
is Beep ontology projection policy:

- Emit `rdf:type owl:ObjectProperty` for a predicate whose values are schema
  handles, CURIEs, absolute IRIs, node objects, or fields coerced with
  `@type: "@id"`.
- Emit `rdf:type owl:DatatypeProperty` for a predicate whose values are RDF
  literals, including fields coerced to datatype IRIs.
- Do not infer this from the predicate string alone; infer it from the assembled
  property value shape in the fold.

## Design Implications

### Turtle Writer Escaping Table

This table is grounded in Turtle sections 6.4, 6.5, and 7.2, plus RDF 1.1
Concepts section 3.2 for IRI string equality.

| Local character or position | Turtle prefixed-name action | Why |
| --- | --- | --- |
| Letter or `_` at start | Emit raw | `PN_LOCAL` starts with `PN_CHARS_U`. |
| Digit at start | Emit raw | `PN_LOCAL` explicitly allows `[0-9]` at start. |
| `:` at start, middle, or end | Emit raw when intended | `PN_LOCAL` allows `:` in all positions. |
| `.` in the middle | Emit raw or `\.` | Middle part allows raw `.`, and `PN_LOCAL_ESC` allows `.`. |
| `.` at start or end | Emit `\.` or use `IRIREF` | Raw `.` is not in the start or final alternatives, but `PLX` is. |
| `/` anywhere in local | Emit `\/` or use `IRIREF` | `/` is not raw `PN_LOCAL`; it is in `PN_LOCAL_ESC`. |
| One of `_ ~ . - ! $ & ' ( ) * + , ; = / ? # @ %` where raw grammar disallows it | Backslash-escape with `PN_LOCAL_ESC` | Turtle section 6.5 production `[172s]`. |
| `%` followed by two hex digits already present in the source IRI | May emit as `%HH` | `PERCENT` is allowed through `PLX` but is not decoded. |
| Character outside raw `PN_LOCAL`, `PN_LOCAL_ESC`, and exact source `%HH` preservation | Use full `IRIREF` or choose another valid namespace split | A `PrefixedName` would not match `PNAME_LN` without changing the IRI. |

For `https://ns.beep.sh/ontology/Ontology.models/HttpUrl` with prefix
`beep:` mapped to `https://ns.beep.sh/ontology/`, Turtle can emit:

```turtle
beep:Ontology.models\/HttpUrl
```

It must not emit:

```turtle
beep:Ontology.models/HttpUrl
```

because the slash is not raw `PN_LOCAL`.

### JSON-LD Context Generation Rules

JSON-LD does not reuse Turtle `PN_LOCAL`. Generate JSON-LD 1.1 contexts with
explicit prefix term definitions and `@version: 1.1`:

- Define every borrowed namespace prefix with `{"@id": "...", "@prefix": true}`
  so JSON-LD API section 6.2 can compact IRIs through the prefix flag.
- Define Beep's owned namespace the same way. Slash locals such as
  `Ontology.models/HttpUrl` can be compacted as
  `beep:Ontology.models/HttpUrl` because JSON-LD syntax section 4.1.5 only
  rejects the compact-IRI interpretation when the suffix begins with `//`.
- Do not borrow Turtle escaping into JSON-LD compact IRIs. JSON syntax may
  allow `\/` as a string escape for `/`, but the compact IRI string value Beep
  wants is still `beep:Ontology.models/HttpUrl`; generate the plain slash for
  clarity.
- Use `@vocab` only for unqualified terms that are intentionally in one default
  vocabulary. Do not rely on `@vocab` for Beep identity CURIEs because compact
  IRIs are clearer and preserve the prefix registry boundary.
- Use `@id` in term definitions for direct predicates. Add `@type: "@id"` when
  string values should become node references; add a datatype IRI when string
  values should become typed literals.

### `^curie` and `@reverse` Emission Rules

The authoring predicate `^curie` should never be serialized literally in RDF,
Turtle, or JSON-LD. RDF predicates are IRIs only, and JSON-LD defines reverse
properties with `@reverse`, not `^`.

Projection rule:

1. Parse `^rdfs:subClassOf` as inverse direction plus base CURIE
   `rdfs:subClassOf`.
2. Expand the base CURIE through the prefix registry to an IRI.
3. In JSON-LD, emit either a node-object `@reverse` block or a context reverse
   term definition whose `@reverse` value is the base compact IRI.
4. If reverse values are strings naming nodes, pair the reverse term definition
   with `@type: "@id"` so JSON-LD expansion emits node references rather than
   string literals.
5. In Turtle, emit the actual RDF triples in subject-predicate-object order
   after reversing the tuple direction. Turtle has no JSON-LD-style `@reverse`
   keyword.

The cited constraints are RDF 1.1 Concepts section 3.1 for predicate IRIs,
JSON-LD syntax sections 4.8 and 9.15.1 for reverse properties, JSON-LD syntax
section 4.2.3 plus API section 5.3.1 for `@type: "@id"` coercion, and Turtle
section 6.5 for legal prefixed-name spellings.

## Sources

| title | official URL | version/date | fetched (yes/no) |
| --- | --- | --- | --- |
| RDF 1.1 Concepts and Abstract Syntax | https://www.w3.org/TR/rdf11-concepts/ | W3C Recommendation, 25 February 2014 | yes |
| RDF 1.2 Concepts and Abstract Data Model | https://www.w3.org/TR/rdf12-concepts/ | W3C Candidate Recommendation Snapshot, 7 April 2026 | yes |
| RDF 1.1 Turtle | https://www.w3.org/TR/turtle/ | W3C Recommendation, 25 February 2014 | yes |
| JSON-LD 1.1 | https://www.w3.org/TR/json-ld11/ | W3C Recommendation, 16 July 2020 | yes |
| JSON-LD 1.1 Processing Algorithms and API | https://www.w3.org/TR/json-ld11-api/ | W3C Recommendation, 16 July 2020 | yes |
