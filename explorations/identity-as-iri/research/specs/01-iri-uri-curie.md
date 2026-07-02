# IRI, URI, and CURIE Constraints for Identity-as-IRI

This note is for the `identity-as-iri` identifier layer: `IdentityComposer`
should derive a literal IRI and literal CURIE from one canonical identity path,
with slash IRIs as the normal projection and hash IRIs available through an
explicit projection/rebase policy (RDF 1.1 Concepts §3.2, CURIE Syntax 1.0
§3, RFC 3986 §3.3, RFC 3986 §3.5). The sections below cite only fetched
official specifications and W3C notes.

## 1. IRI grammar

An IRI has the same top-level component shape as a URI: `scheme`, hierarchical
part, optional query, and optional fragment; the IRI grammar expands URI
character ranges rather than changing the component model (RFC 3987 §2.1,
RFC 3987 §2.2, RFC 3986 §3).

The scheme is still the URI scheme production: it starts with a letter and is
then letters, digits, `+`, `-`, or `.`; scheme names are case-insensitive, but
producers should emit lowercase for consistency (RFC 3986 §3.1, RFC 3987
§2.2). For `https://ns.beep.sh/...`, `IriFromIdentity` should therefore emit
lowercase `https` and should not allow an identity-local transform to alter the
scheme spelling (RFC 3986 §3.1, RFC 3986 §6.2.2.1).

The IRI authority is `[ iuserinfo "@" ] ihost [ ":" port ]`, and an
internationalized registered name may contain `iunreserved`, percent-encoded
octets, or sub-delimiters (RFC 3987 §2.2). For the default Beep namespace,
keeping the authority ASCII and lowercase avoids IDN/Punycode choices during
IRI-to-URI conversion and keeps comparison cheap (RFC 3987 §3.1, RFC 3987
§5.3.2.1).

The IRI path is a sequence of path segments, with `/` separating segments; an
individual IRI segment is `*ipchar`, where `ipchar` is `iunreserved`,
`pct-encoded`, sub-delimiters, `:`, or `@` (RFC 3987 §2.2, RFC 3986 §3.3).
That means a mechanical mapping from `@beep/a/b` to
`https://ns.beep.sh/a/b` is structurally a path mapping: the identity separator
`/` becomes the IRI path separator, not data inside a segment (RFC 3986 §3.3,
RFC 3987 §2.2).

`iunreserved` is the URI unreserved set plus `ucschar`: ASCII letters, digits,
`-`, `.`, `_`, `~`, and the allowed UCS scalar ranges named by `ucschar`
(RFC 3987 §2.2). A literal path segment may therefore contain `.` as data, but
complete `.` and `..` path segments are special dot-segments in URI reference
resolution and path normalization, so identity path validation should reject
segments exactly `.` or `..` (RFC 3986 §3.3, RFC 3986 §5.2.4, RFC 3986
§6.2.2.3).

The raw characters `?` and `#` are not `ipchar`; in a path, `?` starts query
and `#` starts fragment (RFC 3986 §3, RFC 3986 §3.3, RFC 3987 §2.2).
Therefore an identity path segment cannot preserve raw `?` or raw `#` as path
data unless the identifier layer defines an explicit encoding policy before
constructing the IRI (RFC 3986 §2.1, RFC 3986 §3.3).

The fragment grammar allows `ipchar`, `/`, and `?`; fragment semantics are
defined by the retrieved representation's media type and are independent of
the URI scheme (RFC 3986 §3.5, RFC 3987 §2.2). A hash rebase therefore moves
the local term from path semantics to fragment semantics, and implementers
should treat that as an explicit projection choice rather than a spelling-only
change (RFC 3986 §3.5).

Percent-encoding represents a data octet as `%` plus two hex digits, and URI
producers should use uppercase hex digits (RFC 3986 §2.1). Reserved characters
are delimiters or potential delimiters; replacing a reserved character by its
percent-encoded octet can change interpretation and does not produce an
equivalent URI (RFC 3986 §2.2). For `IriFromIdentity`, percent-encoding is
therefore not a generic "make it safe" string pass: it must be applied only
where the component grammar requires it, and it must not encode structural
slashes that are meant to divide Beep path segments (RFC 3986 §2.1, RFC 3986
§2.2, RFC 3986 §3.3).

Normalization should be a minting discipline, not a comparison repair step.
For minted Beep IRIs, emit lowercase scheme and ASCII host, uppercase percent
hex, avoid percent-encoding unreserved characters, and reject dot-segments in
the identity path (RFC 3986 §6.2.2.1, RFC 3986 §6.2.2.2, RFC 3986 §6.2.2.3,
RDF 1.1 Concepts §3.2). For Unicode input, require normalized identity literals
up front; IRI comparison assumes appropriate pre-normalization and does not
normalize characters while comparing (RFC 3987 §5.3.2.2).

## 2. IRI to URI mapping

An IRI can be mapped to a URI for protocol use; the RFC 3987 mapping applies to
IRIs, IRI references, URI references, and their components, including
fragments (RFC 3987 §3.1). The mapping first obtains a UCS character sequence,
then UTF-8 encodes each `ucschar` or `iprivate` character and replaces those
octets with percent triplets, preferably uppercase (RFC 3987 §3.1).

The IRI-to-URI mapping produces RFC 3986-conforming URIs, is an identity
transformation for URIs, is idempotent, and does not encode already-allowed URI
characters or existing percent-encoded sequences again (RFC 3987 §3.1). For
Beep, `toUri(iri)` should be a projection used for dereference or transport,
not a different canonical identity type (RFC 3987 §3.1, RDF 1.1 Concepts
§3.2).

The registered-name branch can require IDN handling for schemes that use domain
names, and RFC 3987 permits ToASCII conversion for interoperability with legacy
URI resolvers (RFC 3987 §3.1). The simplest default for Beep is to keep the
authority ASCII in the root binding and reserve Unicode for path data where
the generic IRI mapping is deterministic (RFC 3987 §3.1).

URI-to-IRI conversion is not the inverse that a literal-preserving identity
system wants as its source of truth. RFC 3987 says a URI converted to an IRI
will map back to the URI used as input, except for percent-encoding case and
percent-encoded unreserved characters, but the resulting IRI may not be the
same as any original IRI (RFC 3987 §3.2). URI-to-IRI conversion cannot remove
all percent-encodings because some preserve reserved-character distinctions,
some are not legal UTF-8, and some would produce characters inappropriate for
IRIs (RFC 3987 §3.2).

URI-to-IRI conversion must use UTF-8 in the relevant decoding steps and must
not guess another character encoding from context (RFC 3987 §3.2). Therefore
`IriFromIdentity` should derive the IRI directly from the canonical identity
literal, while any URI projection should be treated as a derived wire form
(RFC 3987 §3.1, RFC 3987 §3.2).

## 3. Slash vs hash namespace IRIs

At the URI/IRI syntax level, a slash term such as
`https://ns.beep.sh/ontology/Ontology.models/HttpUrl` is path data under the
`https` naming authority, while a hash term such as
`https://opip.law/ns/patent#Claim` uses the fragment component (RFC 3986 §3.3,
RFC 3986 §3.5). The fragment identifies a secondary resource by reference to a
primary resource and representation-specific fragment semantics; those
semantics are not redefined by the URI scheme (RFC 3986 §3.5).

W3C's vocabulary publishing note treats "hash namespace" and "slash namespace"
as informal construction patterns for RDF vocabulary terms, not as separate
URI schemes (Best Practice Recipes Appendix B). In a hash namespace, class and
property IRIs are constructed by appending `#` and a local name to the
vocabulary URI; in a slash namespace, term IRIs are constructed by appending
the local name directly to a vocabulary URI ending in `/` (Best Practice
Recipes Appendix B).

The same W3C note says both hash and slash namespaces are supported by Web
architecture, but they imply different server behavior (Best Practice Recipes
Appendix B). It recommends hash namespaces for small vocabularies that are
conveniently served in one access, and slash namespaces for large or frequently
extended vocabularies where clients may want progressively more detail about
individual terms (Best Practice Recipes Appendix B).

W3C's "Cool URIs" note gives the same operational distinction: hash URIs cause
clients to request the pre-fragment URI, while 303/slash-style identifiers can
redirect to per-resource or shared description documents (Cool URIs §4.1,
Cool URIs §4.2, Cool URIs §4.4). For the Beep handoff default, slash IRIs fit
per-term dereference and documentation; hash rebases fit small, stable
published vocabularies whose terms are intended to be retrieved together
(Best Practice Recipes Appendix B, Cool URIs §4.4).

## 4. CURIE syntax

CURIE Syntax 1.0 defines a CURIE as a compact expression that maps to an IRI,
but a CURIE or SafeCURIE is not itself a URI, IRI, URI-reference, or
IRI-reference (CURIE Syntax 1.0 §2, CURIE Syntax 1.0 §3). RDF 1.1 makes the
same modeling distinction for RDF prefixes: namespace prefixes are syntactic
convenience, are not part of the RDF data model, and must not be used where
IRIs are expected (RDF 1.1 Concepts §1.4).

The normative CURIE grammar is:

```ebnf
safe_curie := '[' curie ']'
curie      := [ [ prefix ] ':' ] reference
prefix     := NCName
reference  := irelative-ref
```

The empty string matches the grammar shape but is not a valid CURIE, and a
host language must provide a prefix-to-IRI binding mechanism (CURIE Syntax 1.0
§3). The intended IRI is constructed by concatenating the prefix binding with
the reference, and that concatenation must be an IRI (CURIE Syntax 1.0 §3).

For Beep, `CurieFromIdentity<"beep", "@beep/a/b">` should therefore be
`beep:a/b`, and `Expand<"beep:a/b">` must be exactly the registered `beep`
binding concatenated with `a/b` (CURIE Syntax 1.0 §3). Unknown prefixes should
be schema errors, because a CURIE requires an in-scope binding for its prefix
or default prefix (CURIE Syntax 1.0 §3, RDFa Core 1.1 §7.4).

The prefix is an `NCName`, so prefix literals should stay in the XML-name-like
space used by CURIE/RDFa processors (CURIE Syntax 1.0 §3, RDFa Core 1.1 §6).
The `_` prefix is reserved for RDF-supporting languages and should be avoided
by authors; RDFa processors ignore explicit mappings for `_` (CURIE Syntax 1.0
§3, RDFa Core 1.1 §6).

The CURIE `reference` is an `irelative-ref`, and RDFa summarizes its reference
space as an IRI path form with optional query and fragment (CURIE Syntax 1.0
§3, RDFa Core 1.1 §6). Because IRI path syntax permits `.` through
`iunreserved` and permits `/` as the path separator, `beep:Ontology.models/HttpUrl`
is valid as a CURIE reference shape when the expanded concatenation is a valid
IRI (RFC 3987 §2.2, CURIE Syntax 1.0 §3, RDFa Core 1.1 §6).

CURIEs differ from QNames in the direction Beep needs: CURIEs were designed for
attribute values, expand to any IRI, and have a looser post-colon string than
QNames (CURIE Syntax 1.0 §1, CURIE Syntax 1.0 §2). The resulting Beep CURIE
literal type should therefore not inherit QName local-name restrictions that
would reject `/` or internal `.` in the reference (CURIE Syntax 1.0 §1,
CURIE Syntax 1.0 §3, RFC 3987 §2.2).

`safe_curie` exists for contexts where a CURIE must be disambiguated from a
URI or IRI by brackets, and host languages are not required to use SafeCURIEs
outside such contexts (CURIE Syntax 1.0 §3). The in-memory Beep predicate type
should be the unbracketed CURIE literal; an RDFa projection can add brackets
only when the target RDFa attribute datatype requires that disambiguation
(CURIE Syntax 1.0 §3, RDFa Core 1.1 §7.4).

RDFa's `@prefix` attribute is a whitespace-separated list of `NCName ':'`
followed by an IRI value, and RDFa prefix mappings are scoped to the current
element and descendants, with the inner-most mapping winning (RDFa Core 1.1
§5, RDFa Core 1.1 §7.4.1). For Beep's static registry, the useful constraint
is stronger than RDFa's dynamic scoping: one prefix should map to one namespace
throughout a generated artifact, because RDFa warns that redefining prefixes
inside a document is bad practice and recommends stable vocabulary prefixes
(RDFa Core 1.1 §7.4.1).

## 5. Equality and comparison

In RDF, an IRI in an RDF graph is a Unicode string conforming to RFC 3987, must
be absolute, and may contain a fragment identifier (RDF 1.1 Concepts §3.2).
RDF IRI equality is simple string comparison and no further normalization is
performed for equality (RDF 1.1 Concepts §3.2, RFC 3987 §5.3.1).

This equality rule is stricter than many URI/IRI equivalence strategies.
RFC 3986 and RFC 3987 describe syntax-based normalization as a way to reduce
false negatives, including case normalization, percent-encoding normalization,
and dot-segment removal (RFC 3986 §6.2.2, RFC 3987 §5.3.2). Those techniques
are useful for minting stable identifiers, but they must not be applied when
checking RDF IRI equality (RDF 1.1 Concepts §3.2).

CURIE equality is not RDF IRI equality until after expansion. Since CURIEs are
abbreviations and not IRIs, Beep should compare predicates at the expanded IRI
layer for graph identity, while preserving the original literal CURIE for
authoring ergonomics and projection round-trips (CURIE Syntax 1.0 §2,
CURIE Syntax 1.0 §3, RDF 1.1 Concepts §1.4, RDF 1.1 Concepts §3.2).

## 6. Design implications

`IriFromIdentity` must produce an absolute RFC 3987 IRI, because RDF abstract
syntax permits only absolute IRIs, with an optional fragment (RDF 1.1 Concepts
§3.2). The root `authority` binding should therefore be validated as an
absolute IRI prefix, and the path append should reject any identity path that
would produce a relative reference, query, or accidental fragment (RFC 3986 §3,
RFC 3986 §3.3, RFC 3986 §3.5, RFC 3987 §2.2).

`IriFromIdentity` should treat `/` in the Beep identity path as hierarchy, not
as literal segment data, because path syntax uses `/` to separate segments
(RFC 3986 §3.3, RFC 3987 §2.2). If a future identity segment needs literal
slash data, it should be modeled through an explicit reversible segment
encoding rather than by overloading the current path separator (RFC 3986 §2.1,
RFC 3986 §3.3).

`IriFromIdentity` should reject identity segments exactly `.` or `..`, because
dot-segments are special in hierarchical path resolution and normalization
(RFC 3986 §3.3, RFC 3986 §5.2.4, RFC 3986 §6.2.2.3). It should also avoid
minting aliases that differ only by percent-encoding unreserved characters or
percent-hex case, because RDF equality will not repair those aliases during
comparison (RFC 3986 §6.2.2.1, RFC 3986 §6.2.2.2, RDF 1.1 Concepts §3.2).

`CurieFromIdentity` may preserve `/` and internal `.` in the CURIE reference,
because CURIE references are IRI relative references and RDFa's CURIE reference
space is an IRI path form with optional query and fragment (CURIE Syntax 1.0
§3, RDFa Core 1.1 §6, RFC 3987 §2.2). This is separate from Turtle prefixed
name syntax and should be handled as a serialization-specific projection issue,
because RDF concrete syntaxes may encode the same graph with different syntax
conveniences (RDF 1.1 Concepts §1.8).

`Expand<C, V>` must require a known prefix and must concatenate the registered
namespace IRI with the CURIE reference exactly, because CURIE conformance
requires an in-scope binding and defines the intended IRI by concatenation
(CURIE Syntax 1.0 §3). A prefix registry should reject `_` and should avoid
dynamic remapping inside generated artifacts, because `_` is reserved in RDF
contexts and RDFa warns against redefining prefixes within a document
(CURIE Syntax 1.0 §3, RDFa Core 1.1 §7.4.1).

The expand/contract codec should be total only over the registered vocabulary
section, not over arbitrary colon strings, because CURIE Syntax permits host
languages to add constraints but not relax the base constraints (CURIE Syntax
1.0 §3). Contracting an absolute IRI should choose a CURIE only when the
namespace binding and reference reconstruction are exact, because RDF equality
is simple string comparison and prefixes are only syntactic convenience
(RDF 1.1 Concepts §1.4, RDF 1.1 Concepts §3.2).

`rebase` to a hash namespace should be an explicit projection that changes only
the IRI/CURIE namespace binding and local reference layout, because fragment
semantics are representation-dependent and hash vocabulary terms are retrieved
through the pre-fragment document (RFC 3986 §3.5, Best Practice Recipes
Appendix B, Cool URIs §4.1). A slash default remains appropriate for the
mechanical Beep namespace when the intended operational behavior is per-term
documentation or bounded term descriptions (Best Practice Recipes Appendix B,
Cool URIs §4.4).

The identifier layer should store and compare the literal IRI form as minted,
not a normalized repair of it, because RDF forbids further normalization for
IRI equality (RDF 1.1 Concepts §3.2). Normalization belongs in constructors and
tests: lowercase scheme/ASCII host, uppercase percent hex, no unreserved
percent-encoding, no dot-segments, and NFC-normalized Unicode literals
(RFC 3986 §6.2.2.1, RFC 3986 §6.2.2.2, RFC 3986 §6.2.2.3, RFC 3987 §5.3.2.2).

The URI projection should be one-way from canonical IRI to wire URI for
retrieval and protocol APIs; it should not be used to recover `IdentityComposer`
literal types (RFC 3987 §3.1, RFC 3987 §3.2). The reason is that URI-to-IRI
conversion can preserve or remove different percent-encodings and may not
recover the same IRI surface that originally produced the URI (RFC 3987 §3.2).

## Sources

| title | official URL | version/date | fetched yes/no |
|---|---|---|---|
| RFC 3986: Uniform Resource Identifier (URI): Generic Syntax | https://www.rfc-editor.org/rfc/rfc3986 | Internet Standard, January 2005 | yes |
| RFC 3987: Internationalized Resource Identifiers (IRIs) | https://www.rfc-editor.org/rfc/rfc3987 | Standards Track, January 2005 | yes |
| CURIE Syntax 1.0 | https://www.w3.org/TR/curie/ | W3C Working Group Note, 16 December 2010 | yes |
| RDFa Core 1.1 - Third Edition | https://www.w3.org/TR/rdfa-core/ | W3C Recommendation, 17 March 2015 | yes |
| RDF 1.1 Concepts and Abstract Syntax | https://www.w3.org/TR/rdf11-concepts/ | W3C Recommendation, 25 February 2014 | yes |
| Best Practice Recipes for Publishing RDF Vocabularies | https://www.w3.org/TR/swbp-vocab-pub/ | W3C Working Group Note, 28 August 2008 | yes |
| Cool URIs for the Semantic Web | https://www.w3.org/TR/cooluris/ | W3C Interest Group Note, 03 December 2008 | yes |
