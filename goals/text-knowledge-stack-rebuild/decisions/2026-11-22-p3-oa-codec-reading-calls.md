---
title: "P3: the OA codec reads one default graph, refuses in the listed order, and needs IRI attribution and typed times"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Widen what the reading rule admits by a decision file edited with the L2-6 row; decodeOa and normalize change together"
---

Calls taken while writing commit 6 that section 8 of the P3 design does not settle. Each keeps `L2-6` a law over every input: `decodeOa` and `normalize` share one reading rule, so a call changes both sides alike.

- Only the default graph is read. Quads in a named graph go to the residual untouched, and the input is deduplicated as a quad set before it is read.
- An annotation's kind is its one `rdf:type` besides `oa:Annotation`, and it must be an OA kind IRI. No other type, two, or a non-OA kind (such as `annotation:Section`) is `unknown-kind`.
- A `Mention` reads exactly one `oa:hasBody`, an IRI that decodes as a `TermIri`; the four empty-bodied kinds read none. Anything else is `body-refused`.
- A target needs an `oa:hasSource`, and one or more selectors typed `oa:TextPositionSelector` or `oa:TextQuoteSelector`. A selector typed both, a position without exactly one natural `oa:start` and `oa:end`, a quote without exactly one non-empty `oa:exact`, or a second `oa:prefix` or `oa:suffix` is `target-refused`, as is an annotation with no target. A selector of any other class is not read and stays in the residual. Offsets are read from the literal's lexical form whatever its datatype, and written as `xsd:integer`; quotes are written as `xsd:string`.
- The checks run in the order of the refusal list (`other-source`, `unknown-kind`, `body-refused`, `target-refused`, `time-conflict`), and the first that fails names the rejection. Rejections are ordered by the serialized subject term.
- An attribution statement needs an IRI object. A blank-node or literal activity, creator or generator is no statement: its triple stays in the residual, and an annotation with no other statement takes the import activity.
- A stated time is a literal typed `xsd:dateTime` with that lexical form. Another time literal is no time and stays in the residual. A subject's `prov:generatedAtTime` values win over its `dcterms:created` values, and two different values of the winning kind on one subject are `time-conflict`.
- An annotation's own time triples are carried only when its time is used: it makes statements itself, or it is unattributed and its time goes to the import generation. A run with no statement is not read: its triples, `prov:specializationOf` included, stay in the residual.
- The encoder writes only the anchors rows some annotation targets, so `decode(encode(d)) = d` holds for documents in which every row is a target, as `restrictToOa` and `decodeOa` leave them.
- The adapter's `selector-conflict`, an anchor whose quote is not the text it ranges over, is reported as `capture-mismatch`: the receipt is not over the given text. The other conversion refusals keep their own reasons. Neither happens for a verified receipt.
- `normalize` builds no document. It writes the run entities, selectors and NIF triples from what the shared rule read, by its own writer, and calls neither `decodeOa` nor `encodeOa`.
