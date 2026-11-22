# BFO Categories — Decision Procedure

Reference for aligning domain concepts to Basic Formal Ontology (BFO, ISO
21838-2). Used during conceptualization and architecture phases.

**Applies only when the project's upper ontology is BFO.** The upper
ontology is a project input recorded in the scope document; BFO is one
option. When the scope names another upper ontology (DOLCE, gist, UFO via
gUFO, schema.org) or none, use that ontology's own categories instead of
this file.

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
│   │   │   │   └── Part of an object marked off by fiat boundaries, not physical
│   │   │   │       discontinuities (it may be self-connected)? → Fiat Object Part (BFO:0000024)
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
│       │       │   └── Disposition (BFO:0000016)
│       │       │       Examples: fragility, solubility, disease susceptibility
│       │       │       └── Exists because the bearer was selected or designed for it?
│       │       │           → Function (BFO:0000034), a subclass of Disposition
│       │       │           Examples: heart's pumping function, gene's coding function
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
| "Student" as a rigid subclass of Person, or disjoint with Teacher | Being a student is a **role** a person can gain and lose | StudentRole is a **Role** (BFO:0000023); define `Student EquivalentTo Person and ('has role' some StudentRole)` (RO:0000087) |
| "Surgery" as a Material Entity | Surgery unfolds in time | Surgery is a **Process** (BFO:0000015) |
| "RedCar" as a subclass of Car | Mixes the bearer with one value of its quality | Red is a **determinate Quality class** under Color (as in PATO); relate the car to it: `Car SubClassOf 'has quality' some Color` (RO:0000086) |
| "Information" as Independent Continuant | Information depends on a physical carrier | Information content entity is a **GDC** (BFO:0000031) |
| "Location" as a Quality | Locations are regions, not dependent qualities | Use **Site** (BFO:0000029) or **Spatial Region** (BFO:0000006) |
| Using `part_of` for containment | `part_of` is mereological; containment/location is different | Use `located_in` for location and `part_of` only for genuine parthood |
| "Disease" as a Process | Disease is a disposition toward pathological processes | Disease is a **Disposition** (BFO:0000016) |
| "Gene" as information | A gene is a physical segment of DNA | Gene is a **Material Entity**; the sequence is a GDC |
| "Organization" as a single Object | An organization is made of members that can change | Organization is an **Object Aggregate** (BFO:0000027); BFO's own usage examples for object aggregate include "an organization is an aggregate whose member parts have roles of specific types". See Known Ambiguities for the alternative. |

## Key BFO Relations (from RO)

| Relation | Domain | Range | Use When |
|----------|--------|-------|----------|
| `RO:0000052` (characteristic of; formerly "inheres in") | SDC | IC | Quality/disposition/role inheres in its bearer |
| `RO:0000053` (has characteristic; formerly "bearer of") | IC | SDC | Inverse of RO:0000052 |
| `RO:0000056` (participates in) | Continuant | Process | A continuant takes part in a process |
| `RO:0000057` (has participant) | Process | Continuant | Inverse of participates in |
| `BFO:0000050` (part of) | — | — | Parthood (mereological) |
| `BFO:0000051` (has part) | — | — | Inverse of part of |
| `RO:0000087` (has role) | IC | Role | Entity bears a role |
| `RO:0000086` (has quality) | IC | Quality | Entity has a quality (RO:0000080 is the inverse, "quality of") |
| `RO:0000059` (concretizes) | SDC | GDC | A pattern on a carrier concretizes information content |
| `RO:0000058` (is concretized as) | GDC | SDC | Inverse of concretizes |
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

- A **GDC** is concretized in a **specifically dependent continuant**
  (RO:0000058 is concretized as; inverse RO:0000059 concretizes).
- That specifically dependent continuant inheres in a **material entity**
  (RO:0000052).
- The material entity never concretizes the GDC directly: the SDC does.

Example:
A file's content (GDC) is concretized as a pattern of magnetic or electric
states (SDC) that inheres in a disk or other storage device (material
entity). Printing the file makes a second pattern, in ink on paper, that
concretizes the same content.

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
| Organization | Object Aggregate vs Object | **Object Aggregate** (BFO's own object-aggregate examples include organizations; CCO follows this) — member parts can change over time | Object | Your domain treats the organization as one unified thing whose identity does not rest on its members, and you record why |
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
