# BFO Categories — Decision Procedure

Reference for aligning domain concepts to Basic Formal Ontology (BFO, ISO
21838-2). Used during conceptualization and architecture phases.

## The Top-Level Split

Every entity falls into exactly one of two disjoint categories:

```
Entity (BFO:0000001)
├── Continuant (BFO:0000002) — persists through time, has no temporal parts
└── Occurrent (BFO:0000003) — unfolds in time, has temporal parts
```

**Decision question**: Does this entity persist through time while
maintaining its identity, or does it unfold/happen over a period of time?

- "A person **exists** at each moment" → Continuant
- "A surgery **happens** over time" → Occurrent

## Continuant Decision Tree

```
Is it a Continuant?
│
├── Does it exist independently (not dependent on a bearer)?
│   ├── YES → Independent Continuant (BFO:0000004)
│   │   ├── Is it a material thing with mass?
│   │   │   ├── YES → Material Entity (BFO:0000040)
│   │   │   │   ├── Maximally self-connected? → Object (BFO:0000030)
│   │   │   │   │   Examples: person, cell, planet, violin
│   │   │   │   ├── Collection of objects? → Object Aggregate (BFO:0000027)
│   │   │   │   │   Examples: orchestra, cell population, fleet
│   │   │   │   └── Part of an object, not self-connected? → Fiat Object Part (BFO:0000024)
│   │   │   │       Examples: upper lobe of lung, headstock of guitar
│   │   │   └── NO → Immaterial Entity (BFO:0000141)
│   │   │       ├── Bounded three-dimensional? → Site (BFO:0000029)
│   │   │       │   Examples: concert hall interior, body cavity
│   │   │       ├── Region of space? → Spatial Region (BFO:0000006)
│   │   │       │   Examples: coordinate region, boundary surface
│   │   │       └── Boundary of a material entity? → Continuant Fiat Boundary (BFO:0000140)
│   │   │           Examples: equator, state border, property line
│   │
│   └── NO → It depends on a bearer (some Independent Continuant)
│       └── Specifically/Generically Dependent Continuant
│
├── Does it depend on ONE specific bearer?
│   └── YES → Specifically Dependent Continuant (BFO:0000020)
│       ├── Is it a measurable/observable property?
│       │   └── YES → Quality (BFO:0000019)
│       │       Examples: color, mass, temperature, pitch
│       ├── Is it a capacity/tendency that may or may not be realized?
│       │   └── YES → Realizable Entity (BFO:0000017)
│       │       ├── Exists because of the bearer's physical makeup?
│       │       │   ├── Tendency toward a process? → Disposition (BFO:0000016)
│       │       │   │   Examples: fragility, solubility, disease susceptibility
│       │       │   └── Selected/designed purpose? → Function (BFO:0000034)
│       │       │       Examples: heart's pumping function, gene's coding function
│       │       └── Exists because of social/contextual factors?
│       │           └── Role (BFO:0000023)
│       │               Examples: student role, employer role, patient role
│       └── (Other SDC subcategories are rarely needed)
│
└── Does it depend on one or more bearers but can migrate between them?
    └── YES → Generically Dependent Continuant (BFO:0000031)
        Examples: PDF document, musical score, software program, recipe
        (See "GDC concretization pattern" below)
```

## Occurrent Decision Tree

```
Is it an Occurrent?
│
├── Does it have temporal extent (duration)?
│   ├── YES → Process (BFO:0000015)
│   │   Examples: surgery, concert performance, chemical reaction, running
│   │   └── Is it a proper temporal part of another process?
│   │       └── YES → Process (still — processes can have process parts)
│   │
│   └── Is it a region of time itself?
│       └── YES → Temporal Region (BFO:0000008)
│           ├── Has duration? → One-Dimensional Temporal Region (BFO:0000038)
│           │   Examples: time interval, historical period
│           └── Instantaneous? → Zero-Dimensional Temporal Region (BFO:0000148)
│               Examples: instant, time point
│
├── Is it an instantaneous boundary of a process?
│   └── YES → Process Boundary (BFO:0000035)
│       Examples: birth (as instantaneous event), moment of impact
│
├── Is it the complete lifecycle of processes involving one material entity?
│   └── YES → History (BFO history class)
│       Example: the full disease history of one patient
│
└── Is it a region of spacetime?
    └── YES → Spatiotemporal Region (BFO:0000011)
        Examples: the spacetime region occupied by a process
```

## Common Mistakes

| Mistake | Why It's Wrong | Correct Classification |
|---------|---------------|----------------------|
| "Student" as a subclass of Person | Student is a **role** played by a person | Student is a **Role** (BFO:0000023); a Person **bears** a Student role |
| "Surgery" as a Material Entity | Surgery unfolds in time | Surgery is a **Process** (BFO:0000015) |
| "Red" as a subclass of Color | Red is an instance of the color quality | Red is a **particular Quality** value, or use a value partition pattern |
| "Information" as Independent Continuant | Information depends on a physical carrier | Information content entity is a **GDC** (BFO:0000031) |
| "Location" as a Quality | Locations are regions, not dependent qualities | Use **Site** (BFO:0000029) or **Spatial Region** (BFO:0000006) |
| Using `part_of` for containment | `part_of` is mereological; containment/location is different | Use `located_in` for location and `part_of` only for genuine parthood |
| "Disease" as a Process | Disease is a disposition toward pathological processes | Disease is a **Disposition** (BFO:0000016) |
| "Gene" as information | A gene is a physical segment of DNA | Gene is a **Material Entity**; the sequence is a GDC |
| "Organization" as Object | Organizations have members that change | Organization is an **Object Aggregate** (BFO:0000027). Note: BFO 2020 treats organizations as Objects; many biomedical ontologies model them as Object Aggregates. Choose based on your domain's conventions and document the rationale. |

## Key BFO Relations (from RO)

| Relation | Domain | Range | Use When |
|----------|--------|-------|----------|
| `RO:0000052` (inheres in) | SDC | IC | Quality/disposition/role inheres in its bearer |
| `RO:0000053` (bearer of) | IC | SDC | Inverse of inheres in |
| `RO:0000056` (participates in) | Continuant | Process | A continuant takes part in a process |
| `RO:0000057` (has participant) | Process | Continuant | Inverse of participates in |
| `BFO:0000050` (part of) | — | — | Parthood (mereological) |
| `BFO:0000051` (has part) | — | — | Inverse of part of |
| `RO:0000087` (has role) | IC | Role | Entity bears a role |
| `RO:0000080` (has quality) | IC | Quality | Entity has a quality |
| `BFO:0000054` (realized in) | Realizable | Process | Disposition/function realized in a process |
| `BFO:0000055` (realizes) | Process | Realizable | Process realizes a disposition/function |

## Temporal Indexing Rules

Some relations require explicit time indexing to avoid category mistakes.

- **Continuant-continuant relations** (for example `part_of`, `located_in`)
  can change over time and should be interpreted with a time parameter.
- **Occurrent-occurrent relations** are fixed once the occurrent exists and
  usually do not need additional temporal indexing.

Verbal quantification templates:

- Universal-level relation:
  "For every instance of class A, there exists some instance of class B such
  that relation R holds at time t."
- Time-sensitive parthood:
  "A cell is part_of an organ at t1" does not entail "part_of at t2".

## GDC Concretization Pattern

For information entities and other GDCs, model concretization explicitly:

- A **GDC** is concretized in a **specifically dependent continuant**.
- That specifically dependent continuant inheres in a **material entity**.
- Use an explicit concretization relation such as `isConcretizationOf`.

Example:
"This PDF file" (material bearer) concretizes an information content entity
(the document content) via a concretization chain.

## Perspectives

The same real-world thing can be modeled from different perspectives:

- **Continuant perspective**: anatomy/structure ("what it is")
- **Occurrent perspective**: physiology/process ("what happens")

Use this to avoid false disjointness between structural and process views.

## BFO-OBO Alignment Matrix

Indicative mapping between granularity, BFO category, and common OBO sources.

| Granularity | BFO Category | Typical OBO Ontology |
|------------|--------------|----------------------|
| Molecular | Material Entity / Object | ChEBI, PRO |
| Cellular | Material Entity / Object | CL (Cell Ontology) |
| Anatomical structure | Material Entity / Fiat Object Part | UBERON |
| Biological process | Process | GO Biological Process |
| Phenotype/quality | Quality / Disposition | PATO, HPO |
| Information artifact | GDC | OBI, IAO |

## Known Ambiguities

The decision trees above present clean categories, but practitioners regularly
encounter entities where the correct BFO alignment is genuinely debated. When
you hit one of these, document your choice and rationale explicitly.

| Entity | Debate | Recommended Default | Alternative | Choose Alternative When |
|--------|--------|--------------------:|-------------|------------------------|
| Disease | Disposition vs Process | **Disposition** (per OGMS) — a tendency toward pathological processes | Process | Your domain treats disease as something that "happens" rather than something an organism "has" |
| Organization | Object vs Object Aggregate | **Object** (per BFO 2020) — identity persists through member changes | Object Aggregate | Your domain defines the organization by its members (e.g., a research consortium) |
| Information entity | GDC with concretization chain | **GDC** (per IAO pattern) — model the 3-hop chain: GDC → concretized in → SDC → inheres in → Material Entity | Skip concretization, model as GDC directly | Concretization detail is not relevant to your CQs |
| "Being toxic" | Disposition vs Role | **Disposition** — arises from physical makeup | Role | Toxicity is context-dependent (e.g., a substance toxic only to certain organisms) |
| "Being a drug" | Function vs Disposition vs Role | **Role** — exists because of social/regulatory designation | Function | Your domain defines drugs by their biochemical mechanism, not regulatory status |
| Software, algorithms | Does not fit BFO cleanly | **GDC** (information content entity pattern) | No BFO alignment | Your domain is purely computational; BFO may not add value |
| Legal entities, money, prices | Social constructs with no BFO consensus | **GDC** or **Role** depending on perspective | Consider DOLCE or no upper ontology | Social/legal domains where BFO categories cause more confusion than clarity |

**BFO version note**: The published book (Arp, Smith, Spear 2015) is based on
BFO 2.0. The ISO standard (ISO 21838-2:2021) reflects BFO 2020, which has some
differences in category names and relation definitions. Always check which
version your target community uses. OBO Foundry ontologies generally follow
BFO 2020.

## Quick Reference: "Is it a...?"

| If your concept is... | Then it's probably... |
|----------------------|----------------------|
| A physical thing you can touch | Object or Object Aggregate |
| A property you can measure | Quality |
| A capacity that may be exercised | Disposition or Function |
| A social position or status | Role |
| Something written/recorded | Generically Dependent Continuant |
| Something that happens over time | Process |
| A point in time | Temporal Region |
| A place or container | Site |
