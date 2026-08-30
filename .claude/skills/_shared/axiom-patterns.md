# Axiom Patterns

16 core OWL 2 axiom patterns with when-to-use guidance, ROBOT template
syntax, and Manchester Syntax examples. Reference for the conceptualizer
and architect skills.

## 1. Simple SubClassOf (Primitive Class)

**When**: Asserting that one class is a subtype of another.

**Manchester Syntax**:
```
Class: Piano
  SubClassOf: KeyboardInstrument
```

**ROBOT Template**:
```tsv
ID	LABEL	SC %
ID	A rdfs:label	SC %
EX:0001	piano	EX:0010
```

**Notes**: The foundation of taxonomy. Every class should have at least one
named superclass (no orphans except owl:Thing).

---

## 2. Existential Restriction (SomeValuesFrom)

**When**: "Every X has at least one Y" — expressing necessary conditions.

**Pattern**: `X SubClassOf R some Y`

**Manchester Syntax**:
```
Class: Guitar
  SubClassOf: hasComponent some String
```

**ROBOT Template**:
```tsv
ID	LABEL	SC %	REL
ID	A rdfs:label	SC %	'hasComponent' some %
EX:0002	guitar	EX:0010	EX:0030
```

**Notes**: The most common restriction pattern. Use for necessary conditions
that define what members of the class must have.

---

## 3. Universal Restriction (AllValuesFrom / Closure Axiom)

**When**: "The only Y that X can have are Z" — constraining the range of a
relation for a specific class.

**Pattern**: `X SubClassOf R only Y`

**Manchester Syntax**:
```
Class: VegetarianPizza
  SubClassOf: hasTopping only VegetableTopping
```

**Notes**: Often combined with an existential restriction to form a
**closure axiom**: "has at least one, and only these." Without a
corresponding `some`, the universal restriction alone is satisfied by
having no values at all (vacuous truth).

**Worked closure example**:
```
Class: VegetarianPizza
  SubClassOf: hasTopping some VegetableTopping
  SubClassOf: hasTopping only VegetableTopping
```

---

## 4. Equivalent Class (Defined Class)

**When**: Providing necessary AND sufficient conditions — enabling automatic
classification by the reasoner.

**Pattern**: `X EquivalentTo Y and R some Z`

**Manchester Syntax**:
```
Class: StringInstrument
  EquivalentTo: MusicalInstrument and hasComponent some String
```

**ROBOT Template**:
```tsv
ID	LABEL	EC %
ID	A rdfs:label	EC %
EX:0020	string instrument	EX:0010 and ('hasComponent' some EX:0030)
```

**Notes**: Defined classes are the heart of reasoning. Any individual (or
class) that satisfies the conditions will be automatically classified.
Use sparingly — not every class needs to be defined.

**Design decision: `SubClassOf` vs `EquivalentClass`**
- Use `SubClassOf` when you are asserting only necessary conditions.
- Use `EquivalentClass` when you are confident the condition set is both
  necessary and sufficient.
- Default to `SubClassOf` if domain consensus is incomplete; premature
  equivalence often causes misclassification cascades.

---

## 5. Disjoint Classes

**When**: Two sibling classes under the same parent share no instances.

**Pattern**: `DisjointClasses: A, B, C`

**Manchester Syntax**:
```
DisjointClasses: WindInstrument, StringInstrument, PercussionInstrument
```

**ROBOT Template**:
```tsv
ID	LABEL	SC %	DISJOINT_WITH
ID	A rdfs:label	SC %	DC %
EX:0020	string instrument	EX:0010	EX:0021
EX:0021	wind instrument	EX:0010	EX:0020
```

**Notes**: Disjointness is critical for reasoning — without it, the
reasoner cannot detect classification errors. Siblings under the same
parent SHOULD be declared disjoint unless there is a specific reason
not to. For >2 classes, use `DisjointClasses` (pairwise disjointness)
or `DisjointUnion`.

---

## 6. Covering Axiom (Disjoint Union / Exhaustive Partition)

**When**: A parent class is fully partitioned into its children — "X is
exactly A, B, or C, and nothing else."

**Pattern**: `X DisjointUnionOf A, B, C`

**Manchester Syntax**:
```
Class: InstrumentFamily
  DisjointUnionOf: StringFamily, WindFamily, PercussionFamily, KeyboardFamily
```

**Notes**: Combines SubClassOf + DisjointClasses + Covering in one axiom.
Use when the enumeration is exhaustive and stable. Be cautious — adding
a new sibling later requires updating the union.

---

## 7. Qualified Cardinality Restriction

**When**: "X has exactly/at least/at most N values of type Y for relation R."

**Pattern**: `X SubClassOf R exactly N Y`

**Manchester Syntax**:
```
Class: StringQuartet
  SubClassOf: hasMember exactly 4 Musician
```

**ROBOT Template** (requires `EC %` or `SC %` with full expression):
```tsv
ID	LABEL	SC %
ID	A rdfs:label	SC %
EX:0050	string quartet	'hasMember' exactly 4 EX:0060
```

**Notes**: Requires OWL 2 DL. Unqualified cardinality (`R exactly 3`) is
simpler but less expressive. ELK does not support cardinality — use
HermiT or Pellet.

---

## 8. Value Partition Pattern

**When**: Modeling quality values as a controlled vocabulary (e.g., sizes,
grades, severity levels).

**Pattern**: Quality class with exhaustive partition of value classes.

**Manchester Syntax**:
```
Class: PitchRange
  DisjointUnionOf: HighPitch, MediumPitch, LowPitch

Class: HighPitch
  SubClassOf: PitchRange

Class: Cello
  SubClassOf: hasPitchRange some LowPitch
```

**Notes**: Preferred over data properties with string values. Enables
reasoning over quality values. Each value is a class, not an individual.

---

## 9. N-ary Relation Pattern

**When**: A relation involves more than two participants (e.g., "Person X
prescribed Drug Y for Condition Z at Time T").

**Pattern**: Reify the relation as a class.

**Manchester Syntax**:
```
Class: MusicalPerformance
  SubClassOf: Process
  SubClassOf: hasPerformer some Musician
  SubClassOf: hasPiece some MusicalWork
  SubClassOf: hasVenue some Site
  SubClassOf: hasDate some xsd:date
```

**Notes**: OWL only supports binary relations. For n-ary, create a
"connector" class representing the event/situation. The connector class
holds all the participants via binary relations.

---

## 10. Self-Restriction Pattern

**When**: "Every X is related to itself via R" (reflexive for a specific class).

**Pattern**: `X SubClassOf R Self`

**Manchester Syntax**:
```
Class: NarcissisticEntity
  SubClassOf: admires Self
```

**Notes**: Rarely needed. More common is to declare the property reflexive
globally (`ReflexiveObjectProperty: partOf`).

---

## 11. HasKey Axiom

**When**: Defining a unique identifier for individuals of a class — analogous
to a database primary key.

**Pattern**: `HasKey(C, P1, P2, ...)`

**Manchester Syntax**:
```
Class: Person
  HasKey: hasSSN
```

**Notes**: OWL 2 feature. Individuals of class C are considered identical
if they share values for all key properties. Useful for instance matching
and data integration.

---

## 12. Property Chain (SubPropertyChain)

**When**: Inferring a relation from a sequence of relations — "if A R1 B
and B R2 C, then A R3 C."

**Pattern**: `R3 SubPropertyChainOf R1 o R2`

**Manchester Syntax**:
```
ObjectProperty: hasGrandparent
  SubPropertyChain: hasParent o hasParent
```

**Notes**: Powerful for transitive-like inference paths. OWL 2 allows
chains of arbitrary length but regularity restrictions apply (R can
appear at most once and only at the end of its own chain). ELK supports
simple chains.

---

## 13. Negation (Negative Property Assertion)

**When**: You must explicitly state that a specific relation does not hold
between two named individuals.

**Pattern**: `NegativeObjectPropertyAssertion( R a b )`

**Manchester Syntax**:
```
Individual: Alice
  Facts: not hasParent Bob
```

**Notes**: Assertion-level construct. Use sparingly; in OWA, absence of a
triple is not equivalent to negation.

---

## 14. Identity Links (`owl:sameAs` / `owl:differentFrom`)

**When**: Asserting strict identity (or non-identity) between individuals.

**Pattern**:
- `a owl:sameAs b`
- `a owl:differentFrom b`

**Manchester Syntax**:
```
Individual: ex:PatientRecord123
  SameAs: ex:NationalRegistryPerson987
```

**Notes**: `owl:sameAs` is very strong and transitive. One incorrect link can
merge large identity clusters and propagate unintended inferences.

---

## 15. Enumeration (`owl:oneOf`)

**When**: Representing a genuinely closed, finite set of named individuals.

**Pattern**: `Class: C EquivalentTo {a, b, c}`

**Manchester Syntax**:
```
Class: TrafficLightState
  EquivalentTo: {RedState, YellowState, GreenState}
```

**Notes**: Use only for stable closed sets. If the set changes frequently,
prefer a normal class hierarchy or controlled vocabulary approach.

---

## 16. Complement (`owl:complementOf`)

**When**: Defining a class as the complement of another class.

**Pattern**: `A EquivalentTo not B`

**Manchester Syntax**:
```
Class: NonSmoker
  EquivalentTo: not Smoker
```

**Notes**: Use cautiously. Complement-heavy modeling can indicate missing
positive class definitions or insufficient partition design.

---

## Pattern Selection Guide

| CQ Pattern | Axiom Pattern | # |
|-----------|--------------|---|
| "Every X has a Y" | Existential restriction | 2 |
| "X can only have Y" | Universal restriction / closure | 3 |
| "X is defined as Y with Z" | Equivalent class | 4 |
| "X and Y never overlap" | Disjoint classes | 5 |
| "X is exactly A, B, or C" | Covering axiom | 6 |
| "X has exactly N of Y" | Qualified cardinality | 7 |
| "X has high/medium/low Z" | Value partition | 8 |
| "X did Y to Z at time T" | N-ary relation | 9 |
| "X is identified by P" | HasKey | 11 |
| "if R1 then R2" (chained) | Property chain | 12 |
| "These two identifiers are the same individual" | Identity links | 14 |
| "Class is exactly this finite set" | Enumeration | 15 |
