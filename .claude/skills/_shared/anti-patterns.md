# Anti-Patterns

16 common ontology modeling anti-patterns with descriptions, examples, why
they are wrong, how to fix them, and SPARQL detection queries. Reference
for the conceptualizer and validator skills.

## 1. Singleton Hierarchy (Lazy Taxonomy)

**Description**: A class has exactly one subclass. The intermediate class
adds no meaningful distinction.

**Example**:
```
MusicalInstrument → StringInstrument → Guitar
```
(Where `StringInstrument` has only `Guitar` as a subclass.)

**Why it's wrong**: Adds unnecessary depth without information. Violates
the principle that classification should reflect real distinctions.

**Fix**: Either add sibling classes to `StringInstrument` (Violin, Cello)
or collapse the hierarchy: `Guitar SubClassOf MusicalInstrument`.

**Detection (SPARQL)**:
```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?parent (COUNT(?child) AS ?childCount) WHERE {
  ?child rdfs:subClassOf ?parent .
  FILTER(?parent != owl:Thing)
  FILTER(!isBlank(?child))
  FILTER(!isBlank(?parent))
}
GROUP BY ?parent
HAVING (COUNT(?child) = 1)
```

---

## 2. Role-Type Confusion

**Description**: Modeling a role as a subclass instead of using the role
pattern. The entity changes "type" depending on context.

**Example** (wrong):
```
Person → Student
Person → Teacher
```

**Why it's wrong**: A person can be both a student and a teacher, and can
stop being either without changing identity. If Student and Teacher are
disjoint subclasses of Person, a Person cannot be both simultaneously.

**Fix**: Use BFO's Role pattern:
```
Person bearerOf some StudentRole
StudentRole SubClassOf Role
```

**Detection**: Look for classes whose names suggest roles (ending in -er,
-or, -ist, -ant) that are modeled as subclasses of their bearer.

---

## 3. Process-Object Confusion

**Description**: Modeling a process (something that unfolds in time) as a
material entity, or vice versa.

**Example** (wrong):
```
Surgery SubClassOf MaterialEntity
```

**Why it's wrong**: Surgery has temporal parts (incision, closure) and
participants — it's a Process, not an Object.

**Fix**: `Surgery SubClassOf Process`, with `hasParticipant some Surgeon`.

**Detection**: Check class names against BFO categories. Terms ending in
-tion, -ment, -sis, -ing typically denote processes.

---

## 4. Missing Disjointness

**Description**: Sibling classes under the same parent are not declared
disjoint, even though they clearly cannot overlap.

**Example** (incomplete):
```
Animal → Mammal
Animal → Reptile
# No disjoint axiom between Mammal and Reptile
```

**Why it's wrong**: Without disjointness, the reasoner cannot detect
classification errors. An individual could be asserted as both Mammal
and Reptile without triggering inconsistency.

**Fix**: `DisjointClasses: Mammal, Reptile, Amphibian, ...`

**Detection (SPARQL)**:
```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

# Finds sibling classes missing pairwise disjointness.
# Note: also check owl:AllDisjointClasses declarations,
# which cover multi-way disjointness more concisely.
SELECT ?parent ?child1 ?child2 WHERE {
  ?child1 rdfs:subClassOf ?parent .
  ?child2 rdfs:subClassOf ?parent .
  FILTER(STR(?child1) < STR(?child2))
  FILTER NOT EXISTS { ?child1 owl:disjointWith ?child2 }
  FILTER NOT EXISTS { ?child2 owl:disjointWith ?child1 }
  FILTER NOT EXISTS {
    ?disj a owl:AllDisjointClasses ;
          owl:members ?list .
    ?list rdf:rest*/rdf:first ?child1 .
    ?list rdf:rest*/rdf:first ?child2 .
  }
  FILTER(!isBlank(?child1))
  FILTER(!isBlank(?child2))
  FILTER(?parent != owl:Thing)
}
```

---

## 5. Circular Definition

**Description**: A class is defined in terms of itself, directly or
through a chain of definitions.

**Example** (wrong):
```
Parent EquivalentTo Person and hasChild some Person
Child EquivalentTo Person and hasParent some Parent
Parent EquivalentTo Person and hasChild some Child
```

**Why it's wrong**: Circular definitions are logically uninformative —
they don't constrain the extension of the class.

**Fix**: Ground at least one class in the chain as a primitive (SubClassOf
only, not EquivalentTo).

**Detection**: Trace EquivalentTo chains — if a class appears in its own
expansion, it's circular.

---

## 6. Quality-as-Class (Reified Attribute)

**Description**: Modeling a quality value as a standalone class in the
hierarchy instead of using the value partition or quality pattern.

**Example** (wrong):
```
Color → Red
Color → Blue
Thing → RedThing  (EquivalentTo Thing and hasColor value Red)
```

**Why it's wrong**: Conflates the quality (color) with the quality value
(red). Leads to proliferation of classes like RedCar, BlueCar.

**Fix**: Use value partition pattern (see axiom-patterns.md #8):
```
Color DisjointUnionOf Red, Blue, Green
Car SubClassOf hasColor some Color
```

---

## 7. Information-Physical Conflation

**Description**: Treating information content and its physical carrier as
the same entity.

**Example** (wrong):
```
Book SubClassOf InformationContentEntity
# But Book also has physical properties like weight, location
```

**Why it's wrong**: A book (physical) and the text it contains
(information) are distinct entities. The text can exist in multiple
physical copies.

**Fix** (BFO pattern):
```
BookCopy SubClassOf MaterialEntity (Object)
TextualWork SubClassOf GenericallyDependentContinuant
BookCopy isConcretizationOf some TextualWork
```

---

## 8. Orphan Class

**Description**: A class has no named superclass (other than `owl:Thing`).

**Example** (wrong):
```
Class: SpecialWidget
  # No SubClassOf assertion
```

**Why it's wrong**: Disconnected from the taxonomy. Cannot benefit from
inherited axioms or be found through hierarchical navigation.

**Fix**: Place the class under an appropriate parent. If no parent
exists, it may indicate a gap in the upper-level alignment.

**Detection (SPARQL)**:
```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?orphan WHERE {
  ?orphan a owl:Class .
  FILTER NOT EXISTS {
    ?orphan rdfs:subClassOf ?parent .
    FILTER(?parent != owl:Thing)
    FILTER(!isBlank(?parent))
  }
  FILTER(?orphan != owl:Thing)
  FILTER(?orphan != owl:Nothing)
  FILTER(!isBlank(?orphan))
}
```

---

## 9. Polysemy / Overloaded Term

**Description**: A single class is used to represent multiple distinct
concepts, causing logical confusion.

**Example** (wrong):
```
Class: Bank
  # Sometimes means financial institution, sometimes river bank
```

**Why it's wrong**: Creates ambiguous reasoning results. Axioms appropriate
for one sense are incorrectly applied to the other.

**Fix**: Mint separate classes with disambiguated labels:
```
Class: FinancialInstitution  (label: "bank (financial)")
Class: RiverBank             (label: "bank (geographic)")
```

**Detection**: Look for classes with multiple, semantically divergent
definitions or synonyms. Check for classes with disjoint parent candidates.

---

## 10. Property Domain/Range Overcommitment

**Description**: Setting overly broad or overly narrow domain/range on
a property, causing unintended classification.

**Example** (wrong):
```
ObjectProperty: prescribes
  Domain: Physician
  Range: Drug
```

If you assert `NurseJane prescribes Aspirin`, the reasoner will infer
`NurseJane rdf:type Physician` — probably not intended.

**Why it's wrong**: OWL domain/range axioms are NOT constraints — they
are inference rules. Any use of the property triggers classification
of subject/object into the declared domain/range.

**The key misconception**: Most newcomers (and many experienced practitioners)
treat domain/range like SQL foreign keys. They are not — they are inference
rules. This is the single most common OWL "gotcha" in practice.

**The "too narrow domain" cascade**: Setting domain to a leaf class causes
everything that uses the property to be classified as that leaf class. This
is a major source of unexpected unsatisfiable classes in real-world ontologies.

**Fix** — use this decision procedure:

1. **Want to constrain?** Use SHACL `sh:class` on a property shape.
2. **Want to infer?** Use OWL domain/range, but keep it BROAD (parent
   classes, not leaves).
3. **Want per-class restrictions?** Use local OWL restrictions:
   `Physician SubClassOf prescribes only Drug`

**Detection (SPARQL)**:
```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

# Find properties with domain or range set to leaf classes (high risk)
SELECT ?prop ?narrowClass ?position WHERE {
  {
    ?prop rdfs:domain ?narrowClass .
    BIND("domain" AS ?position)
  } UNION {
    ?prop rdfs:range ?narrowClass .
    FILTER(isIRI(?narrowClass))
    BIND("range" AS ?position)
  }
  FILTER NOT EXISTS {
    ?child rdfs:subClassOf ?narrowClass .
    FILTER(?child != ?narrowClass)
    FILTER(!isBlank(?child))
  }
  FILTER(?narrowClass != owl:Thing)
}
```

---

## 11. Individuals in the T-box

**Description**: Placing many instance assertions directly in the ontology's
schema module and treating A-box data as if it were T-box structure.

**Example** (wrong):
```
# In core ontology file
Class: Country
Individual: USA
Individual: Canada
... (hundreds of instances)
```

**Why it's wrong**: Blurs schema/data boundaries, increases maintenance burden,
and makes modular reuse harder.

**Fix**: Keep schema in the T-box module. Move reference and test individuals
to dedicated A-box modules (for example `reference-individuals.ttl`,
`test-individuals.ttl`).

**Detection (SPARQL)**:
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT (COUNT(?i) AS ?individualCount) WHERE {
  ?i a owl:NamedIndividual .
}
```

---

## 12. Negative Universals / Class Complements Overuse

**Description**: Modeling classes primarily by negation (for example, broad
use of `owl:complementOf`) instead of positive domain semantics.

**Example** (risky):
```
Class: NonMammal
  EquivalentTo: not Mammal
```

**Why it's wrong**: Under OWA, negative definitions are often too weak or too
broad, and can hide modeling gaps.

**Fix**: Prefer positive classes and explicit disjointness/partitions. Use
complements only when there is a clear closed conceptual boundary.

**Detection**: Review classes using `owl:complementOf` and confirm each has
clear, documented justification.

---

## 13. False is-a from OO Inheritance

**Description**: Translating software inheritance directly into ontology
subclassing without checking ontological subsumption.

**Example** (wrong):
```
Class: PersistenceManager
  SubClassOf: Manager
```

**Why it's wrong**: Programming abstractions encode implementation reuse, not
necessarily real-world category structure.

**Fix**: Assert `is-a` only when every instance of child is necessarily an
instance of parent in the domain, independent of software architecture.

**Detection**: Flag classes that look implementation-specific (`*Manager`,
`*Service`, `*Controller`) and verify domain grounding.

---

## 14. System Blueprint Instead of Domain Model

**Description**: Modeling database tables, APIs, or screens rather than the
domain reality the ontology should represent.

**Example** (wrong):
```
Class: UserTableRow
Class: ApiResponsePayload
```

**Why it's wrong**: Produces brittle ontologies coupled to one system and
invalidates reuse across projects.

**Fix**: Model domain entities and relations first; map technical artifacts in
separate integration layers if needed.

**Detection**: Search for class names tied to implementation artifacts
(`Table`, `Row`, `DTO`, `API`, `Payload`).

---

## 15. Technical Perspective Over Domain Perspective

**Description**: Prioritizing storage/query convenience over correct domain
semantics.

**Example** (risky):
```
Class: FlattenedEventRecord
```

**Why it's wrong**: Convenience-first modeling can introduce semantic drift and
break CQ traceability.

**Fix**: Start from stakeholder questions and domain consensus; optimize
storage/querying after semantic design is stable.

**Detection**: Review terms and axioms justified only by performance or schema
constraints, not by domain meaning.

---

## 16. Mixing Individuals with Classes

**Description**: Confusing class-level and instance-level entities.

**Example** (wrong):
```
Class: Beethoven
Individual: Composer
```

**Why it's wrong**: Breaks reasoning semantics and causes erroneous
inferences.

**Fix**: Keep universals as classes and particulars as individuals. If a term
must be both, use explicit metamodeling only when required and documented.

**Detection (SPARQL)**:
```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?x WHERE {
  ?x a owl:Class .
  ?x a owl:NamedIndividual .
}
```

---

## Summary Checklist

Before finalizing any ontology design, verify:

- [ ] No singleton hierarchies (every parent has ≥2 children, or is a leaf)
- [ ] Roles modeled as roles, not subtypes
- [ ] Processes separated from objects (BFO alignment)
- [ ] Sibling classes are disjoint where appropriate
- [ ] No circular definitions in equivalence chains
- [ ] Quality values use value partition, not standalone class hierarchies
- [ ] Information content distinguished from physical carriers
- [ ] No orphan classes (every class has a named parent)
- [ ] No polysemous terms (one class = one concept)
- [ ] Domain/range used intentionally, not as constraints
- [ ] A-box individuals separated from T-box schema where feasible
- [ ] Complement/negation classes used only with explicit justification
- [ ] Class hierarchy reflects domain subsumption, not OO inheritance
- [ ] Domain model is not replaced by system blueprint artifacts
- [ ] Technical constraints do not drive primary semantic modeling
- [ ] No unintended class/individual mixing
