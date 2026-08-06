# Position, relator, and transition — the legal frame

> **Provenance.** This is research Lane B for
> `explorations/legal-position-relator-runtime`, dated 2026-08-05, executing the
> 2026-08-05 “research depth” decision in [`../DECISIONS.md`](../DECISIONS.md).
> It is a bounded synthesis of **public primary sources only**, every one of
> which was opened and read during this lane. It is **not legal advice**, and no
> client or pre-publication material of any kind was consulted or transmitted.
>
> Citation discipline: every bracketed citation below resolves to an entry in
> [§9 Sources](#9-sources) — a URL this lane actually fetched, or a command this
> lane actually ran in this checkout. Genuine gaps are marked **NOT FOUND**;
> claims that could not be checked are marked **NOT VERIFIED**. Nothing is cited
> from memory.

## 2026-08-05

### 0. What this lane did and did not do

Did: read both Hohfeld articles from the Yale Law School repository; read the
FLINT/CALCULEMUS and eFLINT papers; read the `flint-ontology` repository files
directly from GitLab, including both LICENSE files; read four UFO-L papers;
cross-checked the correlativity and multital material against two independent
public transcriptions of Hohfeld 1913.

Did not: inventory repo surfaces (that is Lane A → `01-repo-surfaces.md`); the
only repo commands run here are the two cheap net-new confirmations in §7.
Did not read anything behind a paywall, login, or aggregator annotation layer.

A note on scope for the reader: the sources below use “FLINT” for at least three
distinct artifacts — a 2016 DSL prototype, a 2022–2025 RDF/OWL ontology from
TNO, and `eFLINT`, an executable language from UvA. They do **not** agree with
each other on Hohfeldian coverage. §2 and §3 keep them separate on purpose,
because `P100` and `R25` were written as if they were one thing.

---

## 1. Hohfeld — eight positions, four correlative pairs, two axes

### 1.1 The two schemes, verbatim

Hohfeld declines to define the fundamental relations at all, and offers the two
schemes instead:

> The strictly fundamental legal relations are, after all, sui generis; and thus
> it is that attempts at formal definition are always unsatisfactory, if not
> altogether useless. Accordingly, the most promising line of procedure seems to
> consist in exhibiting all of the various relations in a scheme of “opposites”
> and “correlatives,” and then proceeding to exemplify their individual scope and
> application in concrete cases.

[hohfeld-1913-yale.pdf, the scheme page — the printed page number is not legible
in the OCR layer, so no page locator is asserted]

The schemes as printed:

| Jural **Opposites** | rights | privilege | power | immunity |
| --- | --- | --- | --- | --- |
| | no-rights | duty | disability | liability |

| Jural **Correlatives** | right | privilege | power | immunity |
| --- | --- | --- | --- | --- |
| | duty | no-right | liability | disability |

[hohfeld-1913-yale.pdf, scheme page; independently confirmed against
hohfeld-1913-wikisource, “Jural Opposites” / “Jural Correlatives”]

Both transcriptions agree character-for-character on the sixteen cells, so the
tables are safe to encode. (The Yale scan OCRs the word “Opposites” as
“Upposites”; the Wikisource proofread text renders it correctly. That is an OCR
artifact of the scan, not a variant reading.)

### 1.2 The two axes are **not** the same axis

This is the single most load-bearing distinction in this section, and the
campaign nugget blurs it (see §1.6).

**Correlative** = *same relation, other party's view.*

> In other words, if X has a right against Y that he shall stay off the former's
> land, the correlative (and equivalent) is that Y is under a duty toward X to
> stay off the place.

[hohfeld-1913-wikisource, “Rights and Duties”]

Hohfeld's parenthetical “(and equivalent)” is the schema licence: the correlative
is not an additional fact, it is the same fact read from the other end.

**Opposite** = *same party, contradictory position, with the content negated.*

> As indicated in the above scheme of jural relations, a privilege is the
> opposite of a duty, and the correlative of a “no-right.” … The privilege of
> entering is the negation of a duty to stay off.

[hohfeld-1913-wikisource, “Privileges and ‘No-Rights.’”]

And immediately the trap:

> As indicated by this case, some caution is necessary at this point, for,
> always, when it is said that a given privilege is the mere negation of a duty,
> what is meant, of course, is a duty having a content or tenor precisely
> opposite to that of the privilege in question. Thus, if, for some special
> reason, X has contracted with Y to go on the former's own land, it is obvious
> that X has, as regards Y, both the privilege of entering and the duty of
> entering. The privilege is perfectly consistent with this sort of duty …

[hohfeld-1913-wikisource, “Privileges and ‘No-Rights.’”]

**Consequence for the schema, stated bluntly:** a design that stores
`(holder, counterparty, positionKind)` and derives the opposite view by flipping
`positionKind` alone is *wrong on Hohfeld's own example*. X can simultaneously
hold `privilege(enter)` and `duty(enter)` toward Y. The opposite mapping is only
sound when the **content is negated in the same step**. Content is therefore not
an annotation on a position — it is part of the identity of the position, and
the opposite bimap must be defined over `(kind, content)`, never over `kind`.

The power/immunity definitions complete the set:

> a legal power (as distinguished, of course, from a mental or physical power) is
> the opposite of legal disability, and the correlative of legal liability.

> Immunities and Disabilities. As already brought out, immunity is the
> correlative of disability (“no-power”), and the opposite, or negation, of
> liability. … a power bears the same general contrast to an immunity that a
> right does to a privilege. A right is one's affirmative claim against another,
> and a privilege is one's freedom from the right or claim of another. Similarly,
> a power is one's affirmative “control” over a given legal relation as against
> another; whereas an immunity is one's freedom from the legal power or “control”
> of another as regards some legal relation.

[hohfeld-1913-wikisource, “Powers and ‘Liabilities’”; “Immunities and
Disabilities”]

And the definition of power itself, which is the transition primitive:

> A change in a given legal relation may result (1) from some superadded fact or
> group of facts not under the volitional control of a human being (or human
> beings); or (2) from some superadded fact or group of facts which are under the
> volitional control of one or more human beings. As regards the second class of
> cases, the person (or persons) whose volitional control is paramount may be
> said to have the (legal) power to effect the particular change of legal
> relations that is involved in the problem.

[hohfeld-1913-wikisource, “Powers and ‘Liabilities’”]

Note branch (1): *changes not under anyone's volitional control*. Hohfeld's own
scheme admits non-agentive legal change. Keep this in view for §2.5 — the FLINT
ontology explicitly puts that branch out of scope.

### 1.3 The correlativity invariant, stated for a schema (T1-F1)

Reading the two tables as functions over the eight-element position domain gives
two involutions:

```
correlative : Position -> Position          -- swaps holder and counterparty
  claim <-> duty          privilege <-> noRight
  power <-> liability     immunity  <-> disability

opposite    : Position -> Position          -- same holder, content negated
  claim <-> noRight       privilege <-> duty
  power <-> disability    immunity  <-> liability
```

Both are involutive and they commute, so `{id, correlative, opposite,
correlative∘opposite}` is a Klein four-group acting on the eight positions. Its
orbits are exactly two, of size four:

- `{claim, duty, privilege, noRight}` — Hohfeld's first-order/conduct positions
- `{power, liability, immunity, disability}` — the second-order/potestative ones

That two-orbit split is not this lane's invention; Griffo et al. state the same
division from the legal side, attributing it to Alexy: positions “arise from
norms of conduct, namely: right, duty, permission, and no-right … and … from
norms of power, namely: power, liability, disability, and immunity. While norms
of conduct have mainly a coordinative nature, norms of power presuppose a
subordinate nature … and concern the creation and change of other legal
positions through institutional action.” [ufol-cmlr-2018.pdf, §2]

**The invariant, in the form a SPEC can inherit:**

> **T1-F1-INV.** Exactly one directed legal position is stored per legal
> relation instance: `(holder, counterparty, kind, content, …)` where `kind` is
> drawn from a canonical *advantage-side* subdomain
> `{claim, privilege, power, immunity}`. The **correlative** view is a derived
> total function that maps `kind` through the correlative bimap and swaps
> `holder`/`counterparty`; it is never persisted. The **opposite** view is a
> derived total function over `(kind, content)` that maps `kind` through the
> opposite bimap **and negates `content`**; it is never persisted and is never
> asserted as a second position of the same relation. Persisting both ends of a
> correlative pair as independent rows is a schema defect, because the two rows
> can drift and Hohfeld's own text makes them the same fact.

Two riders that fall straight out of the source text:

1. **The advantage-side canonicalisation is a modelling choice, not Hohfeld's.**
   Hohfeld's tables are symmetric; nothing in them privileges `claim` over
   `duty`. Picking a canonical side is what makes the stored form unique. Record
   it as a decision, not as a finding.
2. **Content negation must be defined before the bimap is usable.** For an act
   `φ`, the negation is the omission `¬φ`, in Alexy's sense as reported by Griffo:
   “for each legal concept right, duty, privilege, and no-right to an action,
   there exists a concept of right, duty, privilege, and no-right to an
   omission.” [ufol-cmlr-2018.pdf, §2] If the schema has no first-class
   act/omission polarity, the opposite bimap cannot be built correctly.

### 1.4 Where correlativity is contested in later scholarship

Four distinct lines of contest, each with an opened source:

**(a) Directedness / duties without correlative rights.** The Stanford
Encyclopedia entry records that “What explains the ‘direction’ of directed duties
has been the subject of controversy”, and for the sharper claim: “For the related
claim that some directed duties — those central to personal relationships — do
not correlate with rights, see A. Martin 2021.” [sep-rights, §2.1.2 and §2.2.3]
If some duties genuinely lack correlative claims, then correlativity is not a
*total* function on stored duties, only on stored claims — which is another
argument for canonicalising storage to the advantage side and treating the
duty-side view as derived.

**(b) The “loss of direction” problem in formalisation.** Surveying prior
Hohfeldian logics, Goossens reports that “Markovich mentions that previous
formalizations of Hohfelds relation have to deal with a ‘loss of direction’
problem, where these logics fail to specify the counterpart in the Hohfeldian
relation … in her formalization all Hohfeldian relations will include an explicit
one-to-one directed relation by virtue of a directed arrow, x →y.”
[flint-ontology-formalizing.pdf, §3.2.2] This is direct external support for
T1-F1's *directed* framing: the recorded failure mode of prior formalisations is
exactly dropping the counterparty.

**(c) Whether liberty and immunity are positions at all, or mere absences.**
FLINT reduces the four pairs to two by treating the other two as absences.
Goossens: “for FLINT the four Hohfeldian relations are reduced to two, the
Duty-Claim-right and Power-Liability relations. van Doesburg and van Engers
(2019a) claims this can be done because, in line with Kocourek (1930), the
authors view the Liberty-No-claim and Immunity-Disability relations as absent
Duty-Claim-right and Power-Liability relations. This perspective is not
completely in line with other formalizations of Hohfeld's framework …”
[flint-ontology-formalizing.pdf, §2.3] So the eight-position domain is itself
contested; a closed `HohfeldPosition` LiteralKit takes a side (Hohfeld's) against
a live and documented alternative.

**(d) In-rem aggregation — see §1.5.**

### 1.5 Multital / paucital and the in-rem aggregation problem

The 1917 article defines the division:

> A paucital right, or claim, (right in personam) is either a unique right
> residing in a person (or group of persons) and availing against a single person
> (or single group of persons); or else it is one of a few fundamentally similar,
> yet separate, rights availing respectively against a few definite persons. A
> multital right, or claim, (right in rem) is always one of a large class of
> fundamentally similar yet separate rights, actual and potential, residing in a
> single person (or single group of persons) but availing respectively against
> persons constituting a very large and indefinite class of people.

[hohfeld-1917-yale.pdf, §on the classification]

And the aggregation claim, in Hohfeld's own words:

> … it is submitted that instead of there being a single right with a single
> correlative duty resting on all the persons against whom the right avails,
> there are many separate and distinct rights, actual and potential, each one of
> which has a correlative duty resting upon some one person.

[hohfeld-1917-yale.pdf, §on rights in rem]

> Suppose, for example, that A is fee-simple owner of Blackacre. His “legal
> interest” or “property” relating to the tangible object that we call land
> consists of a complex aggregate of rights (or claims), privileges, powers, and
> immunities.

[hohfeld-1917-yale.pdf, §on complex aggregates]

Cook's editorial introduction to the 1920 collected volume states the resulting
schema rule most cleanly: “A single right is always a legal relation between a
person who has the right and some one other person who is under the correlative
duty.” [hohfeld-book-1920, Cook, Introduction]

**Why this is a schema hazard, not just theory.** Taken literally, an in-rem
right is an *indefinite, unbounded* set of pairwise binary relations — one per
person in the world, “actual and potential”. A system that materialises multital
relations pairwise does not terminate. Two consequences:

- The stored unit must be the **relation type with a scoped counterparty class**
  (“all persons other than A”, “any taxpayer owning urban property in Vitória”),
  with pairwise instances materialised only when a specific counterparty is
  identified by a grounding event. Griffo et al. model exactly this with
  role*mixins*: “The legal Power-Subjection relator mediates disjoint legal
  agents, who play legal roles (represented here Legal RoleMixins, given that
  they may be played by agents of different kinds).”
  [ufol-power-subjection-2022.pdf, §3]
- The aggregate (“ownership”, “the AWS customer's position”) is a **derived
  molecular view over atomic positions**, never a stored ninth position kind.
  SEP names this layer directly: the privilege, claim, power and immunity are
  “atomic” incidents that “bond together in characteristic ways to form complex
  rights”, illustrated with the molecular structure of a property right.
  [sep-rights, §2.1.6]

**The contest.** Hohfeld's dissolution of ownership into a bundle of pairwise
relations is not settled. “In recent literature, the ‘bundle of rights’
conception has encountered resistance (Penner 1996; Smith 2012; Klein & Robinson
2011). Some theorists want to insist that property is better conceived, as it is
in colloquial usage, as a substantial relation between a person and a thing
(Smith 2012).” [sep-property, §on the bundle conception] The practical reading
for this wedge: the pairwise decomposition is a *defensible modelling stance with
named opponents*, so the SPEC should say it is a stance, and should not claim
that an aggregate view is “merely” a rendering of the truth.

### 1.6 A precision defect in T1-F1 as written

T1-F1 says: “Hohfeld's eight legal positions form four correlative pairs. Store
one directed relation and derive its **opposite view** as a schema invariant …”
[CAPTURE.md, T1-F1]

The first sentence is about **correlatives**; the second says **opposite**. Those
are different axes (§1.2), applied to different parties, and the opposite axis
additionally requires content negation. The invariant the nugget is reaching for
is the correlative one. Recommend the SPEC state both derivations explicitly, as
in T1-F1-INV, rather than inherit the conflation. This is a wording fix, not a
finding reversal — the underlying claim survives.

### 1.7 Bonus: operative vs evidential facts (grounding events)

Hohfeld's own distinction, which maps onto the “grounding event” field better
than anything in the later literature:

> Operative, constitutive, causal, or “dispositive” facts are those which, under
> the general legal rules that are applicable, suffice to change legal relations,
> that is, either to create a new relation, or to extinguish an old one, or to
> perform both of these functions simultaneously. … It is sometimes necessary to
> consider, also, what may, from the particular point of view, be regarded as
> negative operative facts.

> An evidential fact is one which, on being ascertained, affords some logical
> basis — not conclusive — for inferring some other fact.

[hohfeld-1913-wikisource, §on operative and evidential facts]

Two things worth carrying into the schema: (i) create / extinguish / both is
Hohfeld's own trichotomy, and it is the same trichotomy FLINT and UFO-L land on
independently (§2.3, §4.3); (ii) **negative operative facts** are load-bearing —
“the fact that A had not ‘revoked’ his offer” is part of the operative set. A
precondition model that can only express positive facts cannot represent
Hohfeld's own contract example.

---

## 2. FLINT — frames, transition semantics, and the P100 verdict

### 2.1 What FLINT is, and a name that drifted

The 2016 source paper expands the acronym as **“Formal Language for the
Interpretation of Normative Theories”** [calculemus.pdf, §1]. The 2025/2026
eFLINT paper expands it as **“Formal Language for the Interpretation of Normative
Texts (FLINT) of Van Doesburg”** [eflint-reflections.pdf, §2.6]. The 2024 thesis
title also uses “normative texts” [flint-ontology-formalizing.pdf, title page].

Both expansions are real and attested; the wedge brief's “Normative Texts” form
matches current usage. Flagging it because a SPEC that cites the acronym with one
expansion and the 2016 paper as its source is citing a mismatch.

Provenance chain worth recording: FLINT came out of a collaboration between the
Dutch Immigration and Naturalisation Service (IND), the Dutch Tax and Customs
Administration, and the Leibniz Center for Law [calculemus.pdf, §1]. The RDF/OWL
`flint-ontology` is a **TNO** artifact (§3). `eFLINT` is a **UvA** artifact
[eflint-reflections.pdf, author affiliations]. Three organisations, one acronym.

### 2.2 Act frames, fact frames, duty frames

The 2016 paper builds “Institutional Reality” out of *normative relations*, split
by Hohfeld's two orbits (§1.3) under different names:

> The Hohfeldian legal conceptions can only exist in pairs and describe relations
> between two people, each holding one of the rights in a pair. ‘Power-Liability
> relations’ and ‘Immunity-Disability relations’ are generative: they can generate
> new ‘Legal Relations’. The ‘Duty-Claimright relations’ and ‘Privilege-Noright
> relations’ are situational: they can only be created and terminated by a
> generative ‘Legal Relation’.

[calculemus.pdf, §2]

The element lists are the T1-F9 field set in embryo:

> Situational Normative Relations (‘situational NRs’) exist in two types:
> ‘Claimright-Duty relations’ and ‘Liberty-Noright relations’. They exist of the
> following elements: the ‘holder’ of a ‘Claimright’ or ‘Liberty’; the holder of a
> ‘Duty’ or ‘Noright’; the ‘Object of the normative relation’; and the ‘Duty’ or
> ‘Noright’ itself. For every element of the ‘situational NR’ references to
> normative sources are registered.

> Generative Normative Relations (‘generative NR’) also exist in two types:
> ‘Power-Liability relations’ and ‘Immunity-disability relations’. They exist of
> the following elements: an ‘Actor’ (a person); a ‘Recipient’ (another person);
> an ‘institutional act (iACT); the ‘Object of the normative relation’; a
> ‘precondition’ and a ‘postcondition’. The references to normative sources of the
> elements of a ‘generative NR’ are also registered.

[calculemus.pdf, §3.1]

The **duty frame** as a named third frame type is clearest in the later
artifacts. The FLINT ontology's own summary: “Flint **Act frames** describe valid
transitions between states. Acts are performed by **actors** against
**recipients**. Flint **Fact frames** describe the information that characterizes
states. … **Duty frames** describe the obligations that can hold in states.”
[flint-ontology/competency-questions/README.md, Introduction]

In `eFLINT` the duty frame is a typed declaration with mandatory correlative
slots:

> A duty-type declaration defines a fact-type with mandatory fields for a
> duty-holder and a duty-claimant to establish a duty-claim relation in the
> Hohfeldian legal framework. A duty-type declaration has zero or more additional
> fields … and zero or more violation conditions. A duty raises a violation when
> it is enabled and when one or more of its violation conditions hold.

[eflint-reflections.pdf, §3]

### 2.3 Precondition → create / terminate semantics

The 2016 statement is the cleanest:

> The ‘precondition’ of a ‘generative NR’ is a iFACT or a set of iFACTs and
> ‘situational NRs’ combined using Boolean connections.
>
> The ‘postcondition’ is a set of iFACTs and ‘situational NRs’ that are created
> and/or terminated by a ‘generative NR’. The ‘postcondition’ can only be reached
> when the ‘precondition’ is met and an act in ‘Social Reality’ is qualified as
> the iACT belonging to the ‘generative NR’ that the ‘postcondition’ is a part of.
> The ‘postcondition’ describes the transition of the initial state that fulfills
> the ‘precondition’ to an end state.

[calculemus.pdf, §3.1]

In the ontology this is reified: `flint:Postcondition` “assign[s] values to an
instance of a Frame as characterized through `flint:hasPostconditionFrame`, with
the value being determined through `flint:hasPostconditionValue`”, and
`flint:creates` / `flint:terminates` are shorthands that a SHACL SPARQL rule
expands into postcondition assignments of `true` / `false`.
[flint-ontology/flint.ttl, `flint:Postcondition`; `flint:Act` sh:rule “Derive
postconditions from shorthands”]

Two semantic details that matter more than the shape:

**(a) eFLINT does not gate effects on authority.** “A performed action that does
not hold true raises a violation, but still has its effects.”
[eflint-reflections.pdf, §3] So in eFLINT an unauthorised act still rewrites the
state, and the unauthorisedness is recorded as a *violation*.

**(b) The theory says that is the deontic case, not the potestative one.**

> The claim-right group are deontic modalities, whereas the power group are
> ‘potestative’ rather than ‘deontic’ modalities. The implication of this
> distinction is that when we do something without permission we can expect a
> penalty, whereas if we do something without power, we regard the act as having
> never been constituted.

[flint-ontology-formalizing.pdf, §2.3]

These two are in tension, and the tension is exactly T1-F7's subject matter. An
act without *permission* is effective-and-penalised; an act without *power* is
**void — never constituted**. eFLINT's uniform “violation but effects apply” rule
collapses that distinction. A beep schema that copies eFLINT's rule inherits the
collapse. This is the sharpest single design finding in this lane.

### 2.4 Exactly what P100 claims

> **P100** (unverified-addendum): “FLINT models normative change through n-ary
> Act and Fact frames whose preconditioned acts create or terminate state facts.
> It may supply transition semantics over Hohfeldian relators, but it has not
> passed campaign verification.” [CAPTURE.md, P100]

Three separable assertions: (i) n-ary Act and Fact frames; (ii)
precondition→create/terminate over state facts; (iii) *transition semantics over
Hohfeldian relators*.

### 2.5 P100 verification verdict

**Source fidelity — PASS with a material correction.**

(i) and (ii) are verified verbatim (§2.2, §2.3). Frames are n-ary: the ontology
gives Act frames four default slots and Duty frames two, plus arbitrary
additional slots, and asks arity explicitly as a competency question
(`cq-atom-degree`, “How many atoms might be involved in this frame? (What is the
arity/degree/valency?)”). [flint-ontology/flint.ttl, `flint:Act` / `flint:Duty`
sh:rule “default slots”; flint-ontology/competency-questions/README.md]

(iii) is **false as written** for the FLINT ontology, and the maintainers say so
themselves. Three independent confirmations:

1. The ontology's TTL contains **no Hohfeldian position vocabulary at all**. A
   full-text scan of `flint.ttl` for `hohfeld|power|liabilit|immunit|disabilit|
   liberty|no-right|privilege|claim` returns only the word “claimant” inside
   `flint:Duty` and `flint:Agent` comments. There is no `Power`, `Liability`,
   `Immunity`, `Disability`, `Liberty` or `NoRight` class.
   [flint-ontology/flint.ttl, full term listing]
2. The maintainers' own issue: “In our recent Semantics paper, we identify our
   design choice of defining **Act frames instead of directly modeling the
   underlying power-liability relation** (the latter being, interestingly, what
   Griffo et al. do).” [flint-ontology issue #14, “Act vs. power-liability
   relation”, closed 2025-11-06]
3. Their competency-question list flags the gap: “`cq-power-liability` … **NOTE**
   The Flint ontology currently offers limited support for this CQ”, and the
   *Out of scope* section lists “**Hohfeldian relations** —
   `cq-immunity-disability` … `cq-liberty-noclaim`”, alongside out-of-scope
   **Events**, **Omissions** (`cq-act-omission`, `cq-duty-omission`) and **Duty
   violations**. [flint-ontology/competency-questions/README.md, “Act frames &
   Hohfeldian powers”; “Out of scope”]

So the corrected claim is: *FLINT supplies act-centric transition semantics over
**duty-claim** relations, with power-liability represented only implicitly by the
Act frame, and with liberty-noclaim and immunity-disability out of scope by
design.* Two of the four Hohfeldian pairs are absent; a third is admitted as
“limited support”.

Note also that FLINT's out-of-scope **Omissions** collides directly with T1-F9's
required `act or omission` field, and with §1.3's requirement that content
negation exist for the opposite bimap. Goossens states the consequence: “Since
the FLINT ontology is modeled for positive actions … it is unclear how a duty to
refrain from performing an action fits within the action-oriented approach. …
Without the inclusion of the notion of refrainment, we are not able to model the
Privilege-No-claim relation in L_FLINT.” [flint-ontology-formalizing.pdf, §2.3]

One conflicting datum, reported rather than reconciled: the TNO team's own 2023
demo paper says “Similar to FLINT, UFO-L has a rich representation for classes of
power—liability relations” [flint-toolset-ceur.pdf, §2], implying FLINT has one
too. That statement (2023) is contradicted by their own issue #14 (2025) and by
the current CQ README. This lane treats the later, more specific artifacts as
authoritative and flags the 2023 sentence as superseded.

**Beep-fit — PARTIAL PASS.**

What transfers cleanly: the frame/slot shape; precondition as a boolean
expression over facts; postcondition as an explicit set of frame-instance value
assignments with `creates`/`terminates` shorthands; per-element source
references. All of that is schema-shaped and maps onto a
`LegalPositionRelator` + `PowerExercise` design without importing a reasoner.

What does not transfer: eFLINT's execution semantics. Adopting “effects apply
even on violation” would erase the void-vs-penalised distinction (§2.3) that
T1-F7 exists to preserve, and would put the system in the business of *applying*
legal effects — the never-compute line (§6). FLINT's own authors are candid that
the assessment layer presupposes a completed human interpretation and a completed
human qualification (§6.1).

**Novelty vs what the repo already has — PASS.**

`rg` over `packages/**/src/**/*.{ts,tsx}` on 2026-08-05 returns **zero** files
for `ActFrame`, `PowerExercise`, `SlotCorrespondence`, `Hohfeld`,
`LegalPositionRelator`, `LegalScopeContext`, `PriorityBasis`, `CorrectionDelta`.
[rg-net-new-2026-08-05] The frame/precondition/postcondition vocabulary is
genuinely absent from live source; nothing here is a rebuild.

**License handling — N/A for the papers, see §3 for the artifacts.** The
CALCULEMUS PDF and the ILLC thesis carry no reuse licence this lane could find;
the eFLINT arXiv paper is the author version of an Elsevier article; the CEUR
demo paper is CC BY 4.0 [flint-toolset-ceur.pdf, footer]. Ideas and cited
statements are fine; **do not copy figures or extended passages** from the
non-CC sources into repo docs.

> ### P100 VERDICT
>
> **Promote from `unverified-addendum` to `verified-with-correction`, in the
> corrected form only.** FLINT genuinely supplies act-centric,
> precondition→create/terminate transition semantics with source traceability,
> and that is directly useful. It does **not** supply transition semantics over
> *Hohfeldian relators* in the plural sense P100 asserts — the ontology has no
> Hohfeldian position vocabulary, models power-liability only implicitly via Act
> frames, and puts liberty-noclaim, immunity-disability, omissions, events and
> duty violations out of scope. **Adopt the frame/transition shape; do not adopt
> FLINT as the source of the position domain.** For the position domain, §4's
> UFO-L is the better donor, and the maintainers of FLINT say so in issue #14.

### 2.6 One more FLINT datum for §6

Van Gessel's working notes state FLINT's purpose in a sentence that belongs in
the never-compute section: “The main purpose of Flint is to help multiple parties
gain confidence that they are in agreement about the interpretation of a set of
normative sources (e.g. law texts).” [flint-formalization-2023.pdf, §1] The
artifact's stated job is **agreement about interpretation**, not decision of law.

---

## 3. `flint-ontology` — locating the real repo and verifying R25

### 3.1 The repo is on GitLab, not GitHub

`R25` and the packet's SOURCES ledger both refer to “`flint-ontology`” without a
host. It is **not on GitHub**: a GitHub repository search for `flint ontology`
returns no matching project. The real repository is on **GitLab**, under the
Dutch “Normative Systems” group:

`https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology`
(project id 41344868, public, default branch `main`, created 2022-11-24, last
activity 2025-12-03) [gitlab-project-41344868]

Copyright holder is **TNO** — “Nederlandse Organisatie voor Toegepast
Natuurwetenschappelijk Onderzoek TNO / TNO, Netherlands Organisation for applied
scientific research”, © 2022 [flint-ontology/LICENSE, appendix; also the header
comment of flint-ontology/flint.ttl]. TNO is a Dutch statutory applied-research
organisation, which matches the packet's “Dutch government or research org”
expectation, though via GitLab.

Current release is **1.0.0, dated 2025-12-03** [flint-ontology/CHANGELOG.md].

### 3.2 R25's license claim — VERIFIED on the real files

R25: “Apache-2.0 portions may be ported with attribution, while MPL-2.0 SHACL
behavior requires clean-room re-expression if adopted.” [CAPTURE.md, R25]

The repository's own README states the split verbatim:

> All relevant source code in this repository is licensed under the Apache
> License Version 2.0, included here as [LICENSE](./LICENSE), except for the
> SHACL profiles in [/shacl](./shacl), which are licensed under the Mozilla
> Public License Version 2.0.

[flint-ontology/README.md, “Licensing”]

Confirmed on the license files themselves, not just the README:

| File | First line(s) read | License |
| --- | --- | --- |
| `LICENSE` | “Apache License / Version 2.0, January 2004” | Apache-2.0, © 2022 TNO |
| `shacl/LICENSE` | “Mozilla Public License Version 2.0” | MPL-2.0 |

[flint-ontology/LICENSE; flint-ontology/shacl/LICENSE]

The `shacl/README.md` repeats it: “All SHACL profiles are licensed under the
Mozilla Public License Version 2.0, included here as [LICENSE](./LICENSE).”

**Portion-by-portion inventory** (full recursive tree read from the GitLab API):

| Portion | Files | License | Discipline |
| --- | --- | --- | --- |
| Ontology | `flint.ttl`, `functions.ttl` | Apache-2.0 | **Port with attribution.** Reproduce the TNO copyright notice and the Apache-2.0 notice in any derived file. |
| Competency questions | `competency-questions/*.rq`, `README.md` | Apache-2.0 | **Port with attribution.** These are the T1-F9 raw material (§5). |
| Examples | `examples/library/*`, `examples/tic-tac-toe/*` | Apache-2.0 | Port with attribution; useful as fixture inspiration. |
| Docs / meta | `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `flint.drawio(.png)` | Apache-2.0 | Port with attribution. Diagrams are images — prefer re-drawing. |
| Utility | `util/shacl_inference.py` | Apache-2.0 | Port with attribution (Python; not a beep target anyway). |
| **SHACL profiles** | `shacl/full-flint.ttl`, `shacl/flint-warnings.ttl` | **MPL-2.0** | **Clean-room re-expression only.** Do not copy shape text, SPARQL constraint bodies, or file structure. Re-derive constraints from the Apache-2.0 ontology and from the CQ list, and record that the derivation was clean-room. |

The MPL-2.0 boundary is file-level (MPL §1.4 “Covered Software … Source Code Form
to which the initial Contributor has attached the notice”), so a TypeScript
validator whose *rules* were re-derived independently is not a Modification of
those `.ttl` files. But copying a `sh:sparql` body across is a copy, and MPL-2.0
would then reach the file it lands in. The clean-room framing in R25 is the right
one; keep it.

### 3.3 R25's structural claims — verified item by item

R25: “Executable FLINT artifacts add SlotCorrespondence, hard and advisory
shapes, source ranges, and competency queries.” [CAPTURE.md, R25]

**SlotCorrespondence — VERIFIED, and more precise than R25 says.** `flint.ttl`
defines the class, with semantics worth quoting because they are the T1-F2
role-binding constraint in RDF form:

> A correspondence between a set of slots, which are identified by
> `flint:SlotReference`. The meaning of a correspondence between slots is that
> whenever the relation between frames is relevant through the execution of an
> act, the instances of the relevant frames should hold the same atom in these
> slots. For example, a fact slot correspondence to the actor slot of an act
> expresses that the atom instantiating the fact slot should also be the atom
> instantiating the actor of the act when the fact instance is used for a
> precondition or postcondition of a given act instance.

[flint-ontology/flint.ttl, `flint:SlotCorrespondence`]

Introduced in 0.8.0 (2024-12-17), together with the default-slot rule — Acts:
`"action", "actor", "object", "recipient"`; Duty: `"duty_holder", "claimant"`;
Facts: no default slots. [flint-ontology/CHANGELOG.md, 0.8.0]

**Hard and advisory shapes — VERIFIED.** The split is stated in the shape files'
own header comments:

- `shacl/full-flint.ttl` (80 lines): “If a FLINT knowledge graph fails on any of
  the constraints included here, it is not a well-formed FLINT graph.” — 8 lines
  mention `sh:Violation`; none mention `sh:Warning`.
- `shacl/flint-warnings.ttl` (43 lines): “If a knowledge graph fails on any of
  the constraints included here, it could still be a well-formed FLINT graph, but
  it is advisable to check the accuracy of the graph.” — 2 lines mention
  `sh:Warning`; none mention `sh:Violation`.

[flint-ontology/shacl/full-flint.ttl; flint-ontology/shacl/flint-warnings.ttl]

Minor documentation defect worth knowing before anyone follows the README: the
`shacl/README.md` describes a profile named `partial-flint.ttl`, which **does not
exist** in the tree; the two real files are `full-flint.ttl` and
`flint-warnings.ttl`. [flint-ontology/shacl/README.md vs the recursive tree
listing]

**Source ranges — VERIFIED, though “ranges” is loose.** The ontology carries
`flint:hasSource` (`rdfs:range src:Element`, “Connects an act or fact to a
structural element of a legal source”) and `flint:hasTextFragment`
(`rdfs:range src:TextFragment`, “Connects an act or fact to a text fragment in a
legal source”), plus a SHACL rule on `flint:Frame` that infers `hasSource` from
`hasTextFragment` / `src:isFragmentOf`. [flint-ontology/flint.ttl,
`flint:hasSource`, `flint:hasTextFragment`, `flint:Frame` sh:rule] The offset
mechanics live in a separate `source` ontology module (`src:` namespace,
`http://ontology.tno.nl/normengineering/source#`) which is **NOT FOUND** in this
repository — the CEUR paper says “we developed a source ontology module that
describes the structure and content of a source of norms”
[flint-toolset-ceur.pdf, §3], but this lane did not locate that module's
repository. Whether spans are character offsets or structural pointers is
therefore **NOT VERIFIED**.

**Competency queries — VERIFIED.** 22 `.rq` files plus a README that classifies
every CQ as in-scope or out-of-scope. [flint-ontology/competency-questions/,
recursive tree listing + README.md]

Freshness caveat, from the maintainers: issue #53 is **open**, titled “Update CQs
and/or add a note that they are outdated”, and says “We cannot do a full revamp
pending #14.” [flint-ontology issue #53, opened 2024-12-03] The specific note the
CQ README links for the power-liability discussion (`#53#note_2478325492`)
requires authentication to read and is **NOT VERIFIED** by this lane; only the
README's own NOTE text and the issue title/description were read.

> ### R25 VERDICT
>
> **Source fidelity — PASS.** Every structural claim checks out on the real
> files, and the license claim checks out on both LICENSE files, not just the
> README. R25 is the more accurate of the two addenda.
>
> **Beep-fit — PASS for the structural half, with a hard boundary.**
> `SlotCorrespondence` is the right primitive for binding a relator's role slots
> to an exercise event's actor/recipient slots, and the hard/advisory severity
> split is exactly the shape a `@beep/schema` validator wants (decode failure vs
> advisory finding). The MPL-2.0 line means the *shapes* must be re-derived, not
> transliterated.
>
> **Novelty — PASS.** Zero `SlotCorrespondence` symbols in live source
> [rg-net-new-2026-08-05].
>
> **License handling — PASS, with the per-portion discipline in §3.2 made
> binding.** Apache-2.0 portions: port with the TNO attribution preserved.
> `shacl/`: clean-room only, and the clean-room fact should be recorded in the
> goal packet, not just asserted.
>
> **Promote `R25` from `unverified-addendum` to `verified`.**

---

## 4. UFO-L — legal relations as identity-bearing relators (T1-F2)

### 4.1 The relator pattern

UFO-L is a legal core ontology grounded in the Unified Foundational Ontology,
built on Hohfeld plus Alexy's Theory of Constitutional Rights. “UFO-L accounts
for legal notions that include: rights and duties, no-rights and permissions,
powers and liabilities, disabilities and immunities, as well as liberties.”
[ufol-cmlr-2018.pdf, §1] — i.e. **all four Hohfeldian pairs**, which is precisely
where it differs from FLINT (§2.5).

The ontological move is to reify the relation:

> relators are the real truthmakers of relations. At least for the so-called
> material relations … it is true that “John is married to Mary” because there is
> a relator (a particular marriage) binding them …
>
> Moreover, as also elaborated there, relators are full-fledged endurants, i.e.,
> proper object-like entities as opposed to just n-uples of relata. They are
> entities that can bear their own individualized properties and can have their
> own complex mereological structures, i.e., they can have their own parts, some
> of which are essential … and, conversely, they can be part of other complex
> relators.

[ufol-cmlr-2018.pdf, §3]

That paragraph *is* T1-F2's justification, stated better than the nugget states
it. “Object-like entities as opposed to just n-uples of relata” is the exact
reason a binary epistemic edge is substrate and not the legal aggregate: an edge
has no identity of its own to hang properties, lifecycle, or parthood on.

Positions are **externally dependent modes** — relational tropes:

> Within the category of modes, we have relational modes (or externally dependent
> modes). These are entities that, while inhering in an individual A, are still
> existentially dependent on another individuals B disjoint from A.

[ufol-cmlr-2018.pdf, §3]

Which is the ontological restatement of §1.2's correlativity: a position is not a
property of a party, it is a property *of a party toward a counterparty*, and it
cannot exist without both.

### 4.2 The taxonomy: simple and complex legal relators

> A key notion in UFO-L is that of a legal relator, which is a relator that is
> composed of externally dependent legal moments, each of which represents a
> legal position following Alexy. A Legal Relator specializes Social Relator
> (UFO-C) which in turn specializes the basic notion of Relator (UFO-A).
>
> Legal relators can be simple or complex. A Simple Legal Relator is composed
> simply by a pair of legal positions (categorized in UFO-L as legal moments),
> such as: Right/Duty, NoRight/Permission, Power/Subjection, and
> Disability/Immunity. In contrast, a Complex Legal Relator is composed of other
> legal relators (thus more than one pair of legal moments). For instance, a
> Liberty Relator is composed of NoRight to an Action–Permission to Omit Relator
> and NoRight to an Omission–Permission to Act Relator. **Legal moments are
> related to each other by a correlation association and are essential and
> inseparable parts of the legal relator which they form.**

[ufol-cmlr-2018.pdf, §4; emphasis added]

Three schema consequences, in descending order of load:

1. **The relator, not the position, is the aggregate root.** A simple legal
   relator *is* one correlative pair. This is the strongest available support for
   T1-F1-INV: since the two moments are “essential and inseparable parts” of one
   relator, storing them as two independent rows contradicts the ontology.
2. **Complex relators compose from simple relators**, not from loose positions.
   Liberty is not a ninth position kind — it is a relator made of two relators.
   Same shape as SEP's atomic/molecular layering (§1.5) and the same shape a
   `LegalPositionRelator` aggregate wants: atoms are pairs, molecules are
   compositions of pairs.
3. **Roles are contingent and mediate the relator.** Roles “classify, in a
   contingent and relationally dependent way, instances of the same kind”
   [ufol-cmlr-2018.pdf, §3], and legal roles specialise UFO-C social roles and
   “are prescribed by a legal norm before their assignment to an agent or group
   of agents and are played within the scope of legal relations.”
   [ufol-pattern-2016.pdf, §2] Party identity and Role are therefore *separate*
   things (see §7.3): the Party persists, the Role is prescribed by a norm and
   held only within a relator's scope.

### 4.3 Powers/liabilities vs rights/duties

UFO-L's power-subjection pattern is the T1-F7 donor. Its axioms (verbatim):

> **A1.** A Legal Power-Subjection Relator is a relator composed of legal
> positions called Legal Power and Legal Subjection, which are essential and
> inseparable parts of the legal relator.
>
> **A2.** Every exercise of legal power changes the legal reality but not every
> act that alters the legal reality is an exercise of legal power.
>
> **A3.** Every action performed by Power Holder in the context of legal
> power-subjection relation is an institutional act prescribed by an institutional
> agent in a Legal Object (Legal Normative Description or Legal Norm).
>
> **A4.** Every act of legal power exercised by a Power Holder towards a
> Subjection Holder is a permissible action (There is no prohibition on the
> action) but not every permissible action is an action of legal power.
>
> **A5.** A material relation “has a legal power as against” holds between agents
> A and B iff there is a conversing relation “is legally subject towards” holding
> between them.
>
> **A6.** Every Power Holder has the power of creating, modifying or extinguishing
> at least one legal relation in which Legal Agent as Subjection-Holder is holder
> of another legal position

[ufol-power-subjection-2022.pdf, Table 2]

And the rationale: “By means of an institutional act in a power-subjection
relation, the Power Holder creates, modifies, or extinguishes legal positions
held by the Subjection Holder.” … “Power Holder has the power to create, alter or
extinguish legal relations in which Subjection Holder participates. … This change
is possible because the legal power is performed as an action prescribed by law
(i.e., an institutional act). In addition, Power-Subjection relators are grounded
on Legal Events, for instance, the publishing of a law conferring powers to an
entity to institute taxes.” [ufol-power-subjection-2022.pdf, §3]

Note A5: it is stated as a **biconditional** (`iff`) over the material relation
and its converse. That is the correlativity invariant as an axiom, and it is the
cleanest available justification for “derive, don't store twice”.

**A caution: A4 is contested by the FLINT/eFLINT side.** UFO-L's A4 says every
exercise of legal power is a permissible action. eFLINT deliberately separates
the two: “An additional separation is needed between permissibility and the
concept of institutional power as formalised by Jones and Sergot. In essence, an
actor can manifest a power by performing an action that has normative
implications … **The absence of a permission does not necessarily imply the
absence of a power.**” [eflint-reflections.pdf, §2.5] Both positions are
defensible and the wedge does not need to resolve the jurisprudence — but the
schema must not silently pick one. Concretely: if the schema treats “permitted”
and “empowered” as the same flag, it has adopted A4 by accident.

**Griffo's power taxonomy also gives the second-order structure directly:**
Power `Kab(Xb)` — “Subject a has the legal power K in face of subject b to
create, change or extinguish a legal position X for subject b by means of
institutional actions … Power is created by a competence norm.”; Disability
`¬Kab(Xb)`, whose converse is immunity. [ufol-cmlr-2018.pdf, §2]

### 4.4 The n-ary aggregate shape UFO-L implies

Alexy's positions are **triadic**, not binary — `R a s (φ)`: “Subject a has the
right R, against subject s, to an act φ.” [ufol-cmlr-2018.pdf, §2] Griffo restates
this as UFO-L's basic shape: “legal relations are represented by triadic
structures based on legal positions of Alexy's theory and reified by means of
legal relators, which are relational entities existentially dependent on a number
of individuals playing legal roles.” [ufol-pattern-2016.pdf, §2]

Assembling the pieces gives the minimum aggregate:

```
LegalPositionRelator
  ├─ identity                       (relator is an endurant; it has its own id and lifecycle)
  ├─ moments: NonEmpty<Pair>        (each Pair = one correlative pair of legal moments)
  │    └─ Pair
  │         ├─ advantageMoment   inheres in RoleA, externally dependent on RoleB
  │         └─ burdenMoment      inheres in RoleB, externally dependent on RoleA   [derived]
  ├─ roles: { roleA, roleB }        (contingent, norm-prescribed; RoleMixin over Party kinds)
  ├─ object / content: Act | Omission   (Alexy's φ, with polarity)
  ├─ groundingEvent: LegalEvent     ("Power-Subjection relators are grounded on Legal Events")
  ├─ sourceNorm: LegalObject        (Legal Normative Description | Legal Norm; A3)
  └─ parts?: NonEmpty<LegalPositionRelator>   (complex relator composition; Liberty)
```

Arity: **at least 5-ary** even for a simple relator (two role-players, content,
grounding event, source norm), and unbounded once complex relators compose. A
binary edge cannot carry it — which is T1-F2's claim, now grounded.

### 4.5 Where the donors disagree (summary)

| Question | UFO-L | FLINT / eFLINT |
| --- | --- | --- |
| Which Hohfeldian pairs are modelled? | All four, plus Liberty as a complex relator [ufol-cmlr-2018.pdf §1, §4] | Two (duty-claim, power-liability); liberty-noclaim and immunity-disability **out of scope** [flint-ontology CQ README] |
| Is the relation reified? | Yes — the relator is the aggregate root [ufol-cmlr-2018.pdf §3] | No — Act frames are modelled “instead of directly modeling the underlying power-liability relation” [issue #14] |
| Omissions | First-class (Alexy's negative actions) [ufol-cmlr-2018.pdf §2] | **Out of scope** [flint-ontology CQ README] |
| Non-agentive legal change | Grounded on Legal Events generally [ufol-power-subjection-2022.pdf §3] | **Out of scope** (`cq-event-postcondition`) [flint-ontology CQ README] |
| Power vs permission | A4: power exercise is permissible [ufol-power-subjection-2022.pdf Table 2] | Explicitly separated [eflint-reflections.pdf §2.5] |
| Tooling exists? | “As far as we are aware, no tooling exists to generate interpretations of normative sources in UFO-L” [flint-toolset-ceur.pdf §2] | Yes — editor, ontology, reference interpreter |

Read together: **take the position domain and relator shape from UFO-L; take the
frame/slot/precondition/postcondition/source-reference machinery and the
validator severity split from FLINT.** That is a clean division and neither donor
objects to it — TNO's issue #14 names Griffo et al. as the ones who model the
relation directly.

---

## 5. Competency questions → required legal-relation fields (T1-F9)

T1-F9: “Competency questions translate directly into required legal-relation
fields. Bearer, counterparty, act or omission, result, grounding event, and
source rule should fail schema validation when absent.” [CAPTURE.md, T1-F9]

Two competency-question sets were read in full. UFO-L's power-subjection CQ table
[ufol-power-subjection-2022.pdf, Table 1] and its applicability checks [Table 3];
and the FLINT ontology's in-scope/out-of-scope CQ list
[flint-ontology/competency-questions/README.md]. UFO-L's right-duty pattern adds
four modeller questions: “i) who is the right holder? ii) who is the duty holder?
iii) What is the type of action that a duty holder must to do (or refrain from
doing)? iv) What should be the result of the action: a fact, a legal norm? And
what about the result of an omissive action …” [ufol-pattern-2016.pdf, §3]

### 5.1 Derived field table

| Field | Competency-question evidence | Required? | Notes |
| --- | --- | --- | --- |
| `bearer` (holder of the stored advantage-side position) | UFO-L CQ4 “Who are the bearers of each existing legal position?”; CQ2/CQ10 legal roles and role players; pattern Q(i) “who is the right holder?”; FLINT Act slot `actor`, Duty slot `duty_holder` | **REQUIRED** | Two donors make it a mandatory slot. eFLINT makes duty-holder a *mandatory field* of the type declaration. |
| `counterparty` (role of the correlative bearer) | UFO-L CQ4/CQ10; pattern Q(ii) “who is the duty holder?”; A5's biconditional; FLINT Act slot `recipient`, Duty slot `claimant` | **REQUIRED** | May be a **role class** rather than an individual for multital relations (§1.5). Required ≠ resolved-to-a-person. |
| `act` / `omission` (content φ, with polarity) | UFO-L CQ12 “What is the action/omission of the derived legal relation?”; pattern Q(iii); Alexy's action/omission doubling; FLINT Act slot `action` | **REQUIRED**, and **polarity required with it** | Without polarity the opposite bimap is unsound (§1.2). FLINT itself cannot express this (§2.5) — do not inherit that gap. |
| `result` (the postcondition / derived position) | UFO-L CQ5 “Which legal position Subjection Holder holds in the derived legal relation?”; CQ8 creates/alters/extinguishes; pattern Q(iv) “a fact, a legal norm?”; FLINT `cq-act-postcondition`, `flint:Postcondition` | **REQUIRED on exercise events; OPTIONAL on a standing position** | A standing right-duty relator has no “result” until a power is exercised. Making `result` required on the *position* would force fabrication. |
| `groundingEvent` | UFO-L CQ6 “Which events are the basis of each legal relation?”, CQ11 for the derived relation; V4 “Are the founding legal events (original legal event and derived legal event) … also modeled?”; “Power-Subjection relators are grounded on Legal Events” | **REQUIRED** | Note UFO-L wants **two** events for a derived relation: the founding event of the original relator and of the derived one. A single `groundingEvent` field under-models derivation chains. |
| `sourceRule` | UFO-L CQ9 “Which Legal Object (e.g. Legal Normative Description or Legal Norm) prescribes the institutional act performed?”, CQ13 for the derived relation; A3; V2; FLINT `cq-frame-source`, `flint:hasSource` / `flint:hasTextFragment` | **REQUIRED** | FLINT registers source references **for every element**, not only per frame [calculemus.pdf §3.1]. Per-element provenance is the stronger form. |
| `positionKind` | UFO-L CQ3 “What are the legal positions composing the legal relations?” | **REQUIRED** | Closed domain, LiteralKit; two orbits (§1.3). |
| `arity` / additional role slots | FLINT `cq-atom-degree` (“arity/degree/valency?”), `cq-atom-roles` | **OPTIONAL, open** | Both donors allow frame-specific extra slots beyond the defaults. |
| `slotCorrespondence` | FLINT `cq-atom-correspondence-precondition-act` / `-postcondition-act` / `-complex-fact` | **OPTIONAL** | Required only when a relator is bound to an exercise event. |
| `derivationKind` ∈ {creates, alters, extinguishes} | UFO-L CQ8; `flint:creates` / `flint:terminates`; Hohfeld's own “create / extinguish / both” | **REQUIRED on exercise events** | Hohfeld admits *simultaneous* create-and-extinguish, so this is not a three-way enum over a single value — it is a set. |
| `scope` (material, temporal, jurisdictional/territorial, quantitative, subjective) | Griffo's case-study method: “the following aspects of legal scope were identified: material …, temporal …, jurisdictional/territorial …, quantitative …, and subjective … aspects” [ufol-power-subjection-2022.pdf, §4] | **OPTIONAL at V1, REQUIRED before any comparison** | This is the primary-source grounding for `LegalScopeContext`. See §6. |

### 5.2 Two corrections to T1-F9 as written

1. **`result` cannot be required on a standing position.** T1-F9 lists it in the
   fail-validation set. UFO-L asks for the result of the *derived* relation
   (CQ5/CQ8), i.e. of a power exercise. A right-duty relator that no one has yet
   acted on has a *content* but no *result*. Requiring it would force placeholder
   values, which is the exact false-closure failure the sibling candor goal was
   built to prevent. **Move `result` to the exercise event.** T1-F9 otherwise
   survives.
2. **One grounding event is not enough.** UFO-L's V4 asks for “the founding legal
   events (original legal event and derived legal event)”. A derived relator needs
   a link to the exercise that produced it *and* to the founding event of the
   relator whose power was exercised. Model it as a lineage edge, not a scalar.

---

## 6. The never-compute boundary

This is the lane's most load-bearing deliverable (T4-F6 / T1-F3 / T3-F9). It is
drawn from what the sources say the machinery does **not** do, not from
engineering caution.

### 6.1 What the primary sources actually say

**Interpretation and qualification are subjective and human. Only assessment is
automated.** The eFLINT paper draws the line explicitly, with a figure:

> Note that interpretation and qualification are subjective, require legal
> expertise and may be the subject of disputes, e.g., in a courtroom. However, by
> formalising both the interpretation result and the details of the case,
> unambiguous assessment can be realised.

[eflint-reflections.pdf, §2.6]

“Qualification” is the step where a brute or social fact is ruled to *count as*
an institutional fact. FLINT names who does it: “To qualify a social fact as a
‘institutional fact’ a qualified official is needed. This can be the
administrator deciding on an application or objection, or it can be a judge
ruling on an appeal.” [calculemus.pdf, §3] A *qualified official* — not a
pipeline.

**The purpose of the formalism is agreement about interpretation, not decision.**
“The main purpose of Flint is to help multiple parties gain confidence that they
are in agreement about the interpretation of a set of normative sources.”
[flint-formalization-2023.pdf, §1] And the ontology exists “to express their
interpretation of legal sources” — plural interpretations of the same source are
the design premise [flint-ontology/competency-questions/README.md, Introduction].

**Priority between conflicting norms is explicitly not solved — by the leading
executable normative language.**

> Permissions and prohibitions can then conflict, and a priority mechanism is
> needed to resolve such conflicts. For example, permissions and prohibitions may
> be assigned by actors with different levels of authority or may originate from
> different sources of norms that differ in precedence or specificity. **FLINT and
> eFLINT currently lack an explicit mechanism for conflict resolution (norm
> priorities).** The eFLINT semantics give an implicit priority to prohibitions
> over permissions, and to powers over prohibitions, due to how violations are
> generated and the effects of actions manifest.

[eflint-reflections.pdf, §7; emphasis added]

Read that last sentence carefully: where priority *does* emerge, it is an
accident of the operational semantics, and the authors flag it as a gap rather
than a result. Any system that computes priority is therefore either (a) making a
legal judgement, or (b) leaking an implementation detail as a legal conclusion.
Both are the same failure.

**Normative systems are incomplete in principle, so verdicts cannot be derived.**

> Since no sufficiently complex normative system (defined at the level of general
> norms) can be guaranteed to be complete (i.e., accounting for all particular
> situations), judicial decision-making should be supported by a framework that
> allows for …

[ufol-fois-2020.pdf, §5]

and the mechanism by which collisions arise:

> the collision emerges because the same individual can play different roles (and
> each of which can entail conflicting positions).

[ufol-fois-2020.pdf, §5]

**The ontology's job in a collision is to represent the competing perspectives,
not to pick one.** “UFO-L allows the representation of several existing
perspectives in a case, according to the existence of legal relations and their
relation to rules and principles. Furthermore, … it permits the judge to insert
prescriptions in the normative system by means of judicial decisions in concrete
cases.” [ufol-fois-2020.pdf, §4] The judge inserts; the ontology records.

**Formal machinery does not establish legal validity.** The void/penalised
distinction (§2.3) means validity is a *legal* question about whether an act was
constituted at all — “if we do something without power, we regard the act as
having never been constituted” [flint-ontology-formalizing.pdf, §2.3]. Whether an
actor had the power is A3's question — was the act “prescribed by an institutional
agent in a Legal Object” [ufol-power-subjection-2022.pdf, A3] — which is an
interpretation question, hence human by §6.1's first quote. T4-F6's “Technical
success or formal verification never establishes legal authority or validity” is
therefore not merely prudent; it follows from the donors' own architecture.

### 6.2 The boundary table

A SPEC can inherit this table directly. “Records” means the system may store it,
index it, validate its shape, and render it. “Derives” means the system may
compute it as a pure total function over stored data, presented as a view.
“Never computes” means the system must not produce it, and must not present a
proxy for it.

| # | Concern | System **records** | System **derives** (pure view) | System **NEVER computes** | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Legal position | The stored directed position: bearer, counterparty role, kind, content+polarity, source rule, grounding event, asserting interpreter, valid/transaction time | Correlative view; opposite view over `(kind, content)`; molecular/aggregate views | Whether the position *actually obtains in law* | §1.2–§1.3; ufol-cmlr-2018 §4 |
| 2 | Interpretation | That interpreter I read source S as frame F, at time T, with a text fragment reference | Diffs between two interpretations of the same source | Which interpretation is correct | eflint-reflections §2.6; flint-formalization-2023 §1 |
| 3 | Qualification | That official O qualified brute fact B as institutional fact iF, with basis | Which stored facts lack a qualification record | Whether B *counts as* iF | calculemus §3; eflint-reflections §2.6 |
| 4 | Authority of a party | The **asserted** authority basis: the Legal Object cited, the role claimed, the conferring event | Whether an authority basis is present, cited, and internally consistent | Whether the party **has** the authority | ufol-power-subjection-2022 A3, V2; CAPTURE.md T4-F6 |
| 5 | Validity / effectiveness of an act | The attempted act as an event; its asserted preconditions; the human disposition (effective / void / disputed / undetermined) | Which asserted preconditions have no supporting stored fact | Whether the act was **legally valid**, or whether effects apply | §2.3; flint-ontology-formalizing §2.3 |
| 6 | Violation | That a duty's violation condition was **asserted** met, by whom, on what basis | Which duties have violation conditions with no evaluation record | Whether a violation legally occurred, and its consequences | eflint-reflections §3; flint-ontology CQ README (duty violations **out of scope**) |
| 7 | Scope alignment | Material, temporal, jurisdictional/territorial, quantitative, subjective scope as recorded values | Whether two positions' recorded scopes **overlap on every axis** — a set-theoretic fact | Whether two positions are *legally comparable* | ufol-power-subjection-2022 §4; CAPTURE.md T3-F9 |
| 8 | Contradiction candidacy | Candidate pairs whose scopes overlap and whose positions are prima facie opposed | Candidate generation, duplicate suppression, unresolved visibility | That the pair **is** a contradiction | CAPTURE.md T3-F9 caution; goals/epistemic-contradiction-triage SPEC (per CAPTURE.md) |
| 9 | Contradiction verdict family | The attorney-assigned family: rule conflict / principle collision / interpretation dispute / factual dispute | Which candidates lack a family assignment | Which family a candidate belongs to | ufol-fois-2020 §5 (collisions arise from role multiplicity, not from rule text) |
| 10 | Priority between conflicting positions | The **basis** for a priority claim: asserting authority level, source precedence, specificity, time, forum | Whether two priority claims cite incompatible bases | Which position **wins** | eflint-reflections §7 |
| 11 | Completeness / closure | Which competency questions a given relator answers and which it leaves blank | Coverage gaps against a required-field set | That the legal picture is complete | ufol-fois-2020 §5 (incompleteness in principle) |

### 6.3 Three concrete failure modes this boundary prevents

1. **Authority laundering.** A pipeline records `PowerExercise{actor: Agent-7}`,
   a downstream view renders “Agent-7 exercised the power to …”, and a reader
   concludes the exercise was authorised. Fix: authority is a *cited basis with a
   human disposition*, and the renderer must be unable to show an exercise
   without showing the disposition state (including `undetermined`).
2. **Priority by implementation accident.** Two positions conflict; the query
   returns them ordered by `updatedAt`; a UI shows the first. That is eFLINT's
   implicit-priority failure reproduced (§6.1). Fix: conflicting positions are
   returned as an unordered set with their recorded priority *bases*, and any
   ordering is an explicit, attributed human act.
3. **Correlative drift.** Both ends of a pair get persisted; one is superseded;
   the other is not; the graph now asserts a duty with no claim. Fix:
   T1-F1-INV — one stored directed relation, derived views only. UFO-L's A5
   biconditional and Hohfeld's “(and equivalent)” both say the two ends are one
   fact.

---

## 7. What the align session must decide

Four named questions, with the evidence from this lane that bears on each.
Decisions are Benjamin's; recommendations below are marked as such and are
optional to accept.

Two cheap repo facts were confirmed for this section on 2026-08-05, and only
these two:

- `rg` over `packages/**/src/**/*.{ts,tsx}` returns **zero** files for each of
  `Hohfeld`, `LegalPositionRelator`, `PowerExercise`, `ActFrame`,
  `SlotCorrespondence`, `LegalScopeContext`, `PriorityBasis`, `CorrectionDelta`.
  [rg-net-new-2026-08-05]
- `packages/law-practice/` exists with `domain`, `server`, `tables`, `use-cases`;
  `packages/ontology/` also exists at top level. [ls-packages-2026-08-05]

Everything else about repo surfaces is Lane A's, not this lane's.

### 7.1 V1 scope — scheme-first or full relator?

**Scheme-first** = ship the closed `HohfeldPosition` domain, the correlative and
opposite bimaps, and a directed position record; defer the n-ary relator.

**Full relator** = ship `LegalPositionRelator` with roles, moments, grounding
event, source norm, and complex composition from the start.

Evidence for scheme-first: the two bimaps are provably total and involutive over
a closed eight-element domain (§1.3), so they are testable to exhaustion in
V1 — 8 positions, 2 involutions, 2 orbits, no external dependency. The
position domain is also the part both donors agree on least (§4.5), so pinning it
first resolves the largest boundary question with the smallest surface.

Evidence against scheme-first: §1.2's content-negation trap means the opposite
bimap is *unsound* without act/omission polarity, and polarity is part of the
relator's content field — so “scheme only” is not actually separable from
content. And §4.2's “essential and inseparable parts” means the correlative pair
*is* the simple relator; a scheme without a relator has nowhere to hang the pair.

Evidence for full relator: T1-F2 is a 3/3-survived nugget and its shape is fully
determined by §4.4; the field set is fully determined by §5.1; both donors
independently converge on create/alter/extinguish.

*Recommendation (optional):* **scheme-plus-simple-relator**. Ship the closed
position domain, the two bimaps over `(kind, content)` with polarity, and the
*simple* legal relator (one correlative pair + roles + source norm + grounding
event). Defer complex-relator composition, `SlotCorrespondence`, and
`PowerExercise` to rung 2. This keeps §1.2's soundness requirement satisfied and
avoids shipping a scheme that cannot express its own invariant.

### 7.2 Package home

Evidence: campaign constraint 8 fixes only that legal vocabulary lives in a legal
consumer domain [CAPTURE.md, “Phase-2 grill pointers”]. `packages/law-practice/domain`
exists today [ls-packages-2026-08-05], as does a separate top-level
`packages/ontology`.

Evidence from the sources that bears on the choice: UFO-L is explicitly a **core
ontology** — “a kind of legal ontology that represents a shared conceptualization
of generic legal concepts, which can be used and reused in the construction of
other more specific legal ontologies” [ufol-pattern-2016.pdf, §1], layered as
UFO-A → UFO-C → UFO-L → domain. The literature's own layering says the Hohfeld
position domain and the relator pattern are **one layer above** patent practice
and **one layer below** any specific legal domain. A home that co-locates them
with patent entities flattens a distinction the donors treat as structural; a
separate legal-core package preserves it but adds a package.

Note the counterweight: the packet's caution “[T1-F1] Keep correlativity outside
plain SKOS triples unless Benjamin later approves a different boundary”
[CAPTURE.md, Cautions] rules out folding the bimaps into `@beep/ontology`'s SKOS
machinery regardless of which package wins.

*No recommendation offered* — this is a repo-topology call that needs Lane A's
inventory alongside this evidence.

### 7.3 Generic vs legal Party/Role split

Evidence: UFO-L splits them at the ontology level. Roles “classify, in a
contingent and relationally dependent way, instances of the same kind”
[ufol-cmlr-2018.pdf, §3]; legal roles specialise UFO-C **social** roles and “are
prescribed by a legal norm before their assignment to an agent or group of
agents and are played within the scope of legal relations”
[ufol-pattern-2016.pdf, §2]. So: `Party` is generic and persistent; `LegalRole`
is *norm-prescribed*, *contingent*, and *scoped to a relator*. They are not the
same abstraction and the legal one carries a `sourceNorm` the generic one does
not.

Second data point: UFO-L uses **RoleMixins**, not plain Roles, for legal
positions, “given that they may be played by agents of different kinds”
[ufol-power-subjection-2022.pdf, §3] — a taxpayer may be a natural person or a
juristic person. A `LegalRole` typed as a role over a single `Party` kind will
not model taxpayers, assignees, or applicants.

Third: T4-F6 requires “persistent Party identity, context-specific Role”
[CAPTURE.md, T4-F6] — which is the same split, from the campaign side.

Fourth, from §6.1: role multiplicity is the *mechanism* by which principle
collisions arise — “the same individual can play different roles (and each of
which can entail conflicting positions)” [ufol-fois-2020.pdf, §5]. If Party and
Role are collapsed, the system structurally cannot represent the collision it is
supposed to record.

*Recommendation (optional):* split them, with `LegalRole` carrying `sourceNorm`
and a role-mixin-style multi-kind player constraint. The fourth point above makes
this closer to a requirement than a preference.

### 7.4 `CorrectionDelta` shape

T4-F8 requires: source, initial candidate, validator report, semantic
checkpoints, explicit delta, revised candidate, reviewer action; unresolved
differences become contradiction candidates [CAPTURE.md, T4-F8].

Evidence from this lane bearing on the shape:

- **`validatorReport` needs two severities, not a boolean.** FLINT ships exactly
  this split: hard shapes (“it is not a well-formed FLINT graph”) vs advisory
  shapes (“it could still be a well-formed FLINT graph, but it is advisable to
  check the accuracy”). [flint-ontology/shacl/full-flint.ttl;
  shacl/flint-warnings.ttl] A single pass/fail flag would force advisory findings
  into either silence or false blocking.
- **`semanticCheckpoints` maps naturally onto the interpretation → qualification
  → assessment triple** [eflint-reflections.pdf, §2.6]. A correction that changes
  an *interpretation* is a different animal from one that changes a
  *qualification* or an *assessment input*; the delta should name which stage it
  touches, because only the last is machine-checkable.
- **`reviewerAction` must be able to say “undetermined”.** §6.1's incompleteness
  argument [ufol-fois-2020.pdf, §5] means a reviewer can legitimately decline to
  resolve. A vocabulary without an explicit undetermined state pushes reviewers
  toward false closure.
- **The unresolved → candidate path is the right default and has independent
  support.** eFLINT's authors face the same situation and decline to resolve it
  in the language (§6.1); deferring to a candidate is the same move.
- **`source` should be per-element, not per-record.** FLINT registers source
  references for every element of a normative relation, not once per frame
  [calculemus.pdf, §3.1], and `flint:hasTextFragment` attaches to frames with
  `hasSource` inferred [flint-ontology/flint.ttl]. A delta whose provenance is a
  single document pointer loses the ability to say *which slot* the correction
  touched.

*Recommendation (optional):* model `CorrectionDelta` as an append-only event with
a two-severity validator report, a stage tag from the
interpretation/qualification/assessment triple, per-element source pointers, and
a reviewer-action vocabulary that includes `undetermined`. Emission stays
caller-owned per the packet's compose-don't-widen decision.

---

## 8. NOT FOUND / NOT VERIFIED ledger

| Item | Status | Detail |
| --- | --- | --- |
| `src:` source ontology module (FLINT text-fragment offsets) | **NOT FOUND** | Referenced by `flint.ttl` as `http://ontology.tno.nl/normengineering/source#` and described in [flint-toolset-ceur.pdf §3]; its repository was not located by this lane. Whether text fragments carry character offsets or structural pointers is unknown. |
| `flint-ontology` issue #53, note 2478325492 | **NOT VERIFIED** | The CQ README links it as “a discussion of the relation between Flint and power–liability relations”. GitLab's notes API returns 401 for this project without authentication; the rendered issue page did not expose the note body. Only the issue title/description and the README's NOTE text were read. |
| `shacl/partial-flint.ttl` | **NOT FOUND** | Described in `shacl/README.md`; absent from the `main` tree. The two real profiles are `full-flint.ttl` and `flint-warnings.ttl`. Documentation defect in the upstream repo. |
| `flint-state-machine-ontology` | **NOT VERIFIED** | The CQ README points at it (`fsmo#21`) as possible additional power-liability support. Not opened by this lane. |
| Hohfeld 1913 via `digitalcommons.law.yale.edu` | **NOT FOUND at that host** | Yale's open repository is `openyls.law.yale.edu` (DSpace). `elischolar.library.yale.edu` returned HTTP 403. Both articles were obtained from openYLS instead (§9). |
| `van Doesburg & van Engers (2019a)` (the Kocourek reduction argument) | **NOT VERIFIED** | Cited by [flint-ontology-formalizing.pdf §2.3] as the source of the four-pairs-to-two reduction. This lane read the thesis's report of it, not the 2019 paper itself. Treat the reduction rationale as second-hand. |
| Kocourek (1930), Markovich (2018, 2020), Penner (1996), Smith (2012), A. Martin (2021) | **NOT VERIFIED** | Named as contest points via SEP and the thesis. Not opened. Cited here only as *reported by* the sources that were opened. |
| `goals/epistemic-contradiction-triage/SPEC.md` line references | **NOT VERIFIED by this lane** | Row 8 of the §6.2 table cites the SPEC as reported in `CAPTURE.md`. Lane A owns direct verification. |
| Alexy, *Theory of Constitutional Rights* | **NOT VERIFIED** | UFO-L's substrate. All Alexy content here is as reported by Griffo et al. |

---

## 9. Sources

All URLs below were fetched by this lane on **2026-08-05** and returned the
content described. HTTP status is noted where it was not a plain 200 on the first
try.

### Hohfeld (public domain)

| Key | URL | Notes |
| --- | --- | --- |
| `hohfeld-1913-yale` (record) | https://openyls.law.yale.edu/entities/publication/bc452662-31cb-4fdc-b094-acdff4ea6bb6 | Yale Law School open repository (openYLS). Reached via a 301 from the legacy handle `https://openyls.law.yale.edu/handle/20.500.13051/11079`. |
| `hohfeld-1913-yale.pdf` | https://openyls.law.yale.edu/bitstreams/aa2c294f-5ac3-431f-b13d-f8fd25b55435/download | 44-page PDF; embedded title “SOME FUNDAMENTAL LEGAL CONCEPTIONS AS APPLIED IN JUDICIAL REASONING”, author “WESLEY NEWCOMB HOHFELD”. *Yale Law Journal* 23(1):16–59 (1913). |
| `hohfeld-1917-yale` (record) | https://openyls.law.yale.edu/entities/publication/ee6cf0ed-9188-46e4-b414-d0293bc491f3 | openYLS record for the 1917 article. |
| `hohfeld-1917-yale.pdf` | https://openyls.law.yale.edu/bitstreams/d92371bc-345d-4ce4-acc1-da46fde31e7b/download | PDF; embedded title “FUNDAMENTAL LEGAL CONCEPTIONS AS APPLIED IN JUDICIAL REASONING”. *Yale Law Journal* 26(8):710–770 (1917). |
| `hohfeld-1913-wikisource` | https://en.wikisource.org/wiki/Some_Fundamental_Legal_Conceptions_as_Applied_in_Judicial_Reasoning | Proofread transcription; used as the independent cross-check on the tables and for clean quotation. Rendered form also fetched via https://en.wikisource.org/api/rest_v1/page/html/Some_Fundamental_Legal_Conceptions_as_Applied_in_Judicial_Reasoning |
| `hohfeld-book-1920` | https://archive.org/download/fundamentallegal00hohfuoft/fundamentallegal00hohfuoft_djvu.txt | OCR full text of *Fundamental legal conceptions as applied in judicial reasoning : and other legal essays* (Cook ed., 1920). Used **only** for Cook's editorial Introduction. OCR is noisy; every quotation taken from it was checked for sense against the Yale PDFs. Item located via https://archive.org/advancedsearch.php (JSON query). |

### Rights and property theory

| Key | URL | Notes |
| --- | --- | --- |
| `sep-rights` | https://plato.stanford.edu/entries/rights/ | Stanford Encyclopedia of Philosophy, “Rights”. Used for the Hohfeldian incidents, opposites/correlatives restatement, molecular rights, and the directedness controversy. |
| `sep-property` | https://plato.stanford.edu/entries/property/ | SEP, “Property and Ownership”. Used for the bundle-of-rights contest. |

### FLINT / eFLINT papers

| Key | URL | Notes |
| --- | --- | --- |
| `calculemus.pdf` | https://homepages.cwi.nl/~storm/publications/calculemus.pdf | van Doesburg, van der Storm & van Engers, “CALCULEMUS: Towards a Formal Language for the Interpretation of Normative Systems”. 5 pp.; PDF internally dated 2016-07-11. Hosted at CWI. Venue not stated in the document — **NOT VERIFIED**. |
| `eflint-reflections.pdf` | https://arxiv.org/pdf/2511.12276 | van Binsbergen, Esterhuyse & Müller, “Reflections on the design, applications and implementations of the normative specification language eFLINT”. arXiv:2511.12276v3 [cs.SE], stamped 4 Aug 2026. The paper states it is the arXiv version of an Elsevier article at doi:10.1016/j.cola.2026.101411 (DOI reported by the paper; **not resolved** by this lane). |
| `flint-toolset-ceur.pdf` | https://ceur-ws.org/Vol-3526/paper-03.pdf | van Gessel, Biagioni, Breteler, Tolios & Boertjes (TNO), “A Toolset for Normative Interpretations in FLINT”, SEMANTiCS ’23 Posters & Demos. CC BY 4.0 per the paper footer. |
| `flint-ontology-formalizing.pdf` | https://eprints.illc.uva.nl/id/eprint/2349/1/MoL-2024-21.text.pdf | Goossens, “Formalizing the FLINT Ontology: Building an action-oriented formal language for the interpretation of normative texts”, MSc Logic thesis, ILLC / Universiteit van Amsterdam (MoL-2024-21), supervised by van Gessel and McHugh. |
| `flint-formalization-2023.pdf` | https://thomvangessel.nl/downloads/flint2023.pdf | van Gessel, “Towards a Formalization of Flint: An Action-based Normative Language”. Self-described as “These notes are work in progress” — cite as a working note, not a publication. |

### `flint-ontology` repository (GitLab, TNO)

All raw file URLs below were confirmed to return HTTP 200 on 2026-08-05. File
contents were fetched via the GitLab REST API
(`https://gitlab.com/api/v4/projects/41344868/repository/files/<path>/raw?ref=main`);
the human-readable equivalents are listed for citation.

| Key | URL |
| --- | --- |
| `gitlab-project-41344868` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology (metadata via https://gitlab.com/api/v4/projects/normativesystems%2Fknowledge-modeling%2Fflint-ontology; recursive tree via `/repository/tree?recursive=true&ref=main`) |
| `flint-ontology/README.md` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/README.md |
| `flint-ontology/LICENSE` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/LICENSE |
| `flint-ontology/shacl/LICENSE` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/shacl/LICENSE |
| `flint-ontology/shacl/README.md` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/shacl/README.md |
| `flint-ontology/shacl/full-flint.ttl` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/shacl/full-flint.ttl |
| `flint-ontology/shacl/flint-warnings.ttl` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/shacl/flint-warnings.ttl |
| `flint-ontology/flint.ttl` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/flint.ttl |
| `flint-ontology/CHANGELOG.md` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/CHANGELOG.md |
| `flint-ontology/competency-questions/README.md` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/raw/main/competency-questions/README.md |
| `flint-ontology issue #14` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/issues/14 (fetched via https://gitlab.com/api/v4/projects/41344868/issues/14) — title “Act vs. power-liability relation”, state closed, closed 2025-11-06 |
| `flint-ontology issue #53` | https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology/-/issues/53 (API + rendered page) — title “Update CQs and/or add a note that they are outdated”, state open, created 2024-12-03 |

Licensing, restated for the ledger: repository content is **Apache-2.0, © 2022
TNO**, except `shacl/`, which is **MPL-2.0**. Apache-2.0 portions may be ported
with attribution; `shacl/` requires clean-room re-expression if adopted. See
§3.2 for the per-portion discipline.

### UFO-L papers

| Key | URL | Notes |
| --- | --- | --- |
| `ufol-cmlr-2018.pdf` | https://nemo.inf.ufes.br/wp-content/papercite-data/pdf/conceptual_modeling_of_legal_relations_2018.pdf | Griffo, Almeida & Guizzardi, “Conceptual Modeling of Legal Relations” (ER 2018). Author copy hosted by NEMO/UFES. |
| `ufol-pattern-2016.pdf` | https://nemo.inf.ufes.br/wp-content/papercite-data/pdf/a_pattern_for_the_representation_of_legal_relations_in_a_legal_core_ontology_2016.pdf | Griffo, Almeida & Guizzardi, “A Pattern for the Representation of Legal Relations in a Legal Core Ontology”. Author copy hosted by NEMO/UFES. |
| `ufol-power-subjection-2022.pdf` | https://ris.utwente.nl/ws/files/300281715/978_3_031_17995_2_5.pdf | Griffo, Sales, Guizzardi & Almeida, “Legal Power-Subjection Relations: Ontological Analysis and Modeling Pattern” (ER 2022, LNCS). Copy hosted by University of Twente Research Information. |
| `ufol-fois-2020.pdf` | https://www.inf.ufes.br/~gguizzardi/FOIS_2020_CristineGriffo_Paper_(8).pdf | Griffo, Almeida & Guizzardi, “Legal Theories and Judicial Decision-Making: An Ontological Analysis” (FOIS 2020). Author copy hosted by UFES. |
| `ufol-doctoral-2015.pdf` | https://www.scitepress.org/papers/2015/56477/56477.pdf | Griffo, “UFO-L: A Core Ontology of Legal Concepts Built from a Legal Relations Perspective”. **Opened and skimmed; not cited substantively** — listed for completeness of the fetch record. |

### In-repo commands run by this lane

| Key | Command | Result |
| --- | --- | --- |
| `rg-net-new-2026-08-05` | `rg -c "<symbol>" packages --glob '**/src/**/*.{ts,tsx}'` for each of `Hohfeld`, `LegalPositionRelator`, `PowerExercise`, `ActFrame`, `SlotCorrespondence`, `LegalScopeContext`, `PriorityBasis`, `CorrectionDelta` | 0 matching files for every symbol |
| `ls-packages-2026-08-05` | `ls -d packages/law-practice/*` and `ls packages/` | `law-practice/{domain,server,tables,use-cases}` present; top-level package groups include `agents`, `architecture-lab`, `documents`, `drivers`, `epistemic`, `foundation`, `law-practice`, `ontology`, `shared`, `tooling`, `workspace` |

### Failed fetches (recorded so nobody retries them blind)

| URL | Result |
| --- | --- |
| https://elischolar.library.yale.edu/cgi/viewcontent.cgi?article=3421&context=ylj | HTTP 403 |
| `https://gitlab.com/api/v4/projects/41344868/issues/53/notes` | HTTP 401 (authentication required) |
| GitHub repository search for `flint ontology` | 0 results — the repository is on GitLab, not GitHub |
