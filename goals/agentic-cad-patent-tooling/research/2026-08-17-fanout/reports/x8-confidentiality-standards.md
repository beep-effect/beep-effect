# x8 — Patent-figure / CAD pipeline rules: drawing standards, confidentiality, export control

**Lane:** x8-confidentiality-standards  
**As-of date:** 2026-08-17  
**Status:** COMPLETE (primary sources retrieved 2026-08-17)  
**Audience:** Engineer implementing an agentic CAD → USPTO/PCT figure pipeline  
**Method:** Primary legal/administrative sources first (eCFR / LII CFR text, MPEP, WIPO official texts, ABA Model Rules + Formal Opinion 512 PDF, USPTO Federal Register). Secondary sources used only to locate primary text. Items that could not be confirmed against a primary page are labeled `UNVERIFIED`.  
**Non-goals:** Product recommendations; client-specific advice; a legal opinion for a particular matter. This is a build spec, not a brief.  
**Confidentiality:** Public statutes, regulations, MPEP, WIPO standards, and bar/USPTO guidance only. No client invention content.

---

## How to read this report

Treat Part 1 as an implementable drawing/export spec. Treat Part 2 as the compliance envelope the software must not punch through. The last section is a one-page engineer checklist: hard rules (software-enforceable), soft rules (human gate), and data-flow boundaries that must never be crossed.

Citations are inline: URL + retrieval/publication date + CFR/MPEP/USC section. Where the live eCFR site returned 503 / anti-bot blocks on 2026-08-17, the same regulation text was taken from LII’s e-CFR mirror (`law.cornell.edu/cfr/text/…`), which reproduces the official e-CFR language. eCFR itself displayed “up to date as of 8/13/2026” on a successful 37 CFR 1.152 fetch the same day.

---

# PART 1 — DRAWING STANDARDS

## 1. Authority map (do not conflate)

| Instrument | Governs | Does **not** govern |
| --- | --- | --- |
| 37 CFR 1.81–1.85 | Whether a US utility/plant drawing is required; content; **form**; corrections | Sequence listings, XML exchange, 3D-model *file formats* |
| 37 CFR 1.121(d)–(f) | How drawings are **amended** after filing (Replacement/New/Annotated sheets; no new matter) | Initial-filing form |
| 37 CFR 1.152 + MPEP 1503.02 | **Design** drawings (solid vs broken lines, surface shading, photos) | Utility flowcharts / exploded views (those stay under 1.84) |
| 37 CFR 1.1026 | International (Hague) design reproductions designating the US | National Ch. 16 design drawings |
| MPEP 507, 608.02, 1302.05 | OPAP drawing review, examiner objections, allowance-time corrections | PCT international-stage form |
| Patent Center PDF Guidelines + Legal Framework PES (11 Sep 2025) | Electronic **file** constraints (PDF version, fonts, DPI, 25 MB, layers) | Line-weight aesthetics |
| PCT Rule 11 | Physical presentation of a **PCT** international application (A4 only; drawing-specific 11.13) | US national letter-size option |
| WIPO ST.91 | Recommendations on **digital 3D models and 3D images** (IPO-to-IPO / filing of 3D) | 2-D USPTO line drawings |
| WIPO ST.96 | XML schema for IP *information* exchange | How to draw a figure |
| WIPO ST.26 | Nucleotide/amino-acid **sequence listings** in XML | Drawings at all |
| **WIPO ST.94** | **Does not exist.** Official WIPO standards list (retrieved 2026-08-17) runs ST.90 → ST.91 → ST.92 → ST.96 → ST.97. There is no ST.94. | — |

Sources: [WIPO List of Standards](https://www.wipo.int/en/web/standards/part_03_standards) (retrieved 2026-08-17); [PCT Rule 11](https://www.wipo.int/pct/en/texts/rules/r11.html) (retrieved 2026-08-17); [37 CFR 1.84](https://www.law.cornell.edu/cfr/text/37/1.84) (retrieved 2026-08-17).

---

## 2. 37 CFR 1.84 — operational spec

Primary text: [37 CFR § 1.84 Standards for drawings](https://www.law.cornell.edu/cfr/text/37/1.84) (e-CFR via LII; last amended 80 FR 17962, Apr. 2, 2015 — no later amendment found as of 2026-08-17). Companion: [USPTO Utility Filing Guide — Drawings](https://www.uspto.gov/patents/basics/apply/utility-patent) (retrieved 2026-08-17).

### 2.1 Categories of drawings — 1.84(a)

Two acceptable categories for **utility and design**:

**(1) Black ink (default).** Black-and-white drawings are normally required. “India ink, or its equivalent that secures solid black lines, must be used.”

**(2) Color.**

| Application type | Color allowed? | Conditions |
| --- | --- | --- |
| **Design** | Yes, as of right | Must include the number of color sets in (a)(2)(ii) **and** the specification paragraph in (a)(2)(iii). |
| **Utility** | Only on petition | “On rare occasions, color drawings may be necessary as the only practical medium.” Color drawings **must** remain reproducible in black and white in the printed patent. Petition under 1.84(a)(2) required. |
| **International (PCT)** | **No** | “Color drawings are not permitted in international applications (see PCT Rule 11.13).” |

**Color petition contents (utility) — 1.84(a)(2):**

1. Fee under 37 CFR 1.17(h).
2. **One** set of color drawings if filed via the USPTO patent electronic filing system; **three** sets if not.
3. Amendment inserting, as the **first paragraph of the brief description of the drawings**, exactly:

> The patent or application file contains at least one drawing executed in color. Copies of this patent or patent application publication with color drawing(s) will be provided by the Office upon request and payment of the necessary fee.

Software implication: a utility color export path is a **gated** path (petition + boilerplate + fee), not a style toggle.

### 2.2 Photographs — 1.84(b)

**(1) Black and white.** Photographs (including photocopies of photographs) are **not ordinarily permitted**. Accepted only if they are “the only practicable medium.” Enumerated examples: electrophoresis gels; blots (immunological, western, Southern, northern); autoradiographs; cell cultures (stained and unstained); histological tissue cross-sections; animals; plants; in vivo imaging; TLC plates; crystalline structures; and, **in a design application**, ornamental effects.

If the subject matter admits of illustration by a drawing, the examiner may require a drawing in place of the photograph. Photographs must be of sufficient quality that **all details are reproducible in the printed patent**.

**(2) Color photographs.** Accepted only if **both** the color-drawing conditions of (a)(2) **and** the photograph conditions of (b)(1) are satisfied.

Photographs must be developed on paper meeting sheet-size (f) and margin (g) requirements.

### 2.3 Identification of drawings — 1.84(c)

Identifying indicia *should* be provided. If provided, they **must** include: title of the invention, inventor’s name, and application number, **or** docket number if no application number yet. Placement: **front of each sheet, within the top margin**.

Post-filing sheets **must** be labeled in the top margin:

| Label | When |
| --- | --- |
| `Replacement Sheet` | Replacing an existing sheet (§ 1.121(d)) |
| `New Sheet` | Adding a sheet with an additional figure |
| `Annotated Sheet` | Marked-up copy showing changes (§ 1.121(d)(1)) |

### 2.4 Graphic forms — 1.84(d)

Chemical/mathematical formulae, tables, and waveforms **may** be submitted as drawings and are subject to the same requirements.

- Each chemical or mathematical formula must be labeled as a **separate figure** (use brackets when necessary).
- Each group of waveforms = **one figure**, common vertical axis, time on the horizontal axis.
- Each individual waveform discussed in the specification must have a **separate letter designation adjacent to the vertical axis**.

### 2.5 Paper type — 1.84(e)

Flexible, strong, **white**, smooth, **non-shiny**, durable. Reasonably free from cracks, creases, folds. **Only one side** of the sheet. Reasonably free from erasures; **free from** alterations, overwritings, and interlineations.

### 2.6 Paper size — 1.84(f)  *(hard rule)*

**All drawing sheets in an application must be the same size.** One of the shorter sides is the top.

Only two sizes:

| Designation | Exact size |
| --- | --- |
| DIN A4 | 21.0 cm × 29.7 cm |
| US letter | 21.6 cm × 27.9 cm (8½ × 11 in) |

No mixing A4 and letter in one application. PCT international stage is **A4 only** (PCT Rule 11.5).

### 2.7 Margins and sight — 1.84(g)  *(hard rule)*

**No frames** around the sight (usable surface). Scan target points (cross-hairs) **should** be printed on two catercorner margin corners.

| Edge | Minimum margin |
| --- | --- |
| Top | 2.5 cm (1 in) |
| Left | 2.5 cm (1 in) |
| Right | 1.5 cm (⅝ in) |
| Bottom | 1.0 cm (⅜ in) |

Resulting **maximum sight**:

| Sheet | Max usable surface |
| --- | --- |
| A4 | 17.0 cm × 26.2 cm |
| Letter | 17.6 cm × 24.4 cm (6 15/16 × 9 5/8 in) |

Identifying indicia (c) and security markings (v) live **in the top margin**, outside the sight. Sheet numbers (t) live **in the sight**, not in the margin.

### 2.8 Views — 1.84(h)

“The drawing must contain as many views as necessary to show the invention.” Permitted: plan, elevation, section, perspective. Detail views of portions, on a larger scale if necessary, are allowed.

Arrangement rules:

- All views grouped together, arranged without wasting space, **preferably upright**, clearly separated.
- Views **must not** be included on sheets containing the specification, claims, or abstract.
- Views **must not** be connected by projection lines.
- Views **must not** contain center lines.
- Exception: waveforms of electrical signals **may** be connected by dashed lines to show relative timing.

#### 2.8.1 Exploded views — 1.84(h)(1)

Permissible, “with the separated parts embraced by a bracket, to show the relationship or order of assembly.” If an exploded view is on the same sheet as another figure, the exploded view **should** be placed in brackets.

#### 2.8.2 Partial views — 1.84(h)(2)

A large machine/device may be broken into partial views on one sheet or extended over several sheets **if there is no loss in facility of understanding**.

- Partial views on separate sheets **must always** be capable of being linked **edge to edge** so that **no partial view contains parts of another partial view**.
- Include a **smaller-scale view** showing the whole formed by the partial views and indicating positions of the parts.
- When a portion is enlarged for magnification, the view and the enlarged view **must each be labeled as separate views**.
- (i) Multi-sheet complete figure: arrange so the complete figure can be assembled **without concealing any part** of any view.
- (ii) A very long view may be divided into several parts placed one above the other on a single sheet; the relationship must be “clear and unambiguous.”

#### 2.8.3 Sectional views — 1.84(h)(3)  *(hatching is a hard visual rule)*

- The cutting plane **should** be indicated on the view from which the section is cut by a **broken line**.
- Ends of that broken line designated by **Arabic or Roman numerals corresponding to the view number** of the sectional view, with **arrows** indicating direction of sight.
- **Hatching must be used** to indicate section portions.
- Hatching = regularly spaced **oblique parallel lines**, spaced far enough to be distinguished without difficulty.
- Hatching **must not impede** reading of reference characters and lead lines.
- If a reference character must sit in a hatched area, **break the hatching** where the character is inserted.
- Hatching **must be at a substantial angle** to surrounding axes or principal lines, **preferably 45°**.
- A cross-section must show **all of the materials as they are shown** in the parent view.
- Parts in cross-section must show proper material(s) by hatching; spacing chosen on the basis of the **total area** to be hatched.
- Parts of the **same item** hatched the **same** way; hatching must “accurately and graphically indicate the nature of the material(s).”
- Juxtaposed **different** elements: hatching **angled differently**.
- Large areas: hatching **may** be confined to an edging around the inside of the outline.
- Different hatching types **should** have different conventional meanings as to material.

#### 2.8.4 Alternate position — 1.84(h)(4)

A moved position **may** be shown by a **broken line superimposed** on a suitable view if this can be done without crowding; otherwise use a separate view.

**Design conflict:** 1.152 **forbids** “alternate positions of a design component, illustrated by full and broken lines in the same view.” Utility (h)(4) permits it; design does not. The pipeline must branch on application type.

#### 2.8.5 Modified forms — 1.84(h)(5)

Modified forms of construction **must** be shown in **separate views**.

### 2.9 Arrangement of views — 1.84(i)

- One view **must not** be placed upon another or within the outline of another.
- All views on the same sheet **should** stand in the same direction and, if possible, be readable with the sheet upright.
- If a view is wider than the sheet, the sheet **may** be turned on its side so the top of the sheet (with the top margin as heading space) is on the **right-hand side**.
- Words must appear **horizontal, left-to-right** when the page is upright **or** when the top becomes the right side, except graphs using standard scientific X/Y convention.

### 2.10 Front-page view — 1.84(j)

One view should be suitable for the front page of the publication and patent. Views must not be connected by projection lines and must not contain center lines. Applicant **may suggest** a single view (by figure number) for the front page.

### 2.11 Scale — 1.84(k)  *(hard rule)*

Scale must be large enough to show the mechanism **without crowding when reduced to two-thirds** in reproduction.

**Prohibited on the drawing:** indications such as “actual size” or “scale 1/2” — they lose meaning under reproduction.

PCT analog (Rule 11.13(d)): if scale is given **in exceptional cases**, it shall be represented **graphically** (a bar), not as a numeric caption.

### 2.12 Character of lines, numbers, and letters — 1.84(l)  *(hard visual rule)*

All drawings must have satisfactory reproduction characteristics.

Every line, number, and letter must be:

- durable
- clean
- **black** (except color drawings)
- sufficiently dense and dark
- **uniformly thick and well-defined**

Weight of all lines and letters must be heavy enough to permit adequate reproduction. This applies to **all lines however fine**, to **shading**, and to lines representing cut surfaces in sectional views.

Lines and strokes of **different thicknesses may** be used in the same drawing **where different thicknesses have a different meaning**.

There is **no numeric millimeter line-weight in 1.84**. Practitioner folklore of “0.2 mm minimum” is `UNVERIFIED` as a regulatory requirement. The enforceable test is **two-thirds reduction remaining distinguishable** (1.84(k) + 1.84(l); PCT Rule 11.13(c) is the same two-thirds test).

### 2.13 Shading — 1.84(m)

- Use of shading is **encouraged** if it aids understanding **and** does not reduce legibility.
- Used to indicate surface/shape of spherical, cylindrical, and conical elements. Flat parts may also be **lightly** shaded.
- Preferred for parts shown in **perspective**, **not** for cross-sections (cross-sections use hatching under (h)(3)).
- **Spaced lines for shading are preferred.** Those lines must be **thin**, as few as practicable, and must **contrast** with the rest of the drawings.
- Substitute: heavy lines on the shade side of objects, except where they superimpose or obscure reference characters.
- Light comes from the **upper left corner at 45°**.
- Surface delineations should preferably be shown by proper shading.
- **Solid black shading areas are not permitted**, except when used to represent **bar graphs or color**.

Design overlay: 1.152 additionally requires “appropriate and adequate surface shading” and separately bans solid-black surface shading except for the color black / color contrast. See §5.

### 2.14 Symbols — 1.84(n)

Graphical drawing symbols may be used for conventional elements when appropriate. Elements so represented **must be adequately identified in the specification**. Known devices should use universally recognized conventional symbols. Other symbols may be used, subject to Office approval, if not likely to be confused with existing conventional symbols and if readily identifiable.

### 2.15 Legends — 1.84(o)

Suitable descriptive legends **may** be used subject to Office approval, or **may be required** by the examiner. They should contain as few words as possible.

PCT Rule 11.11 is stricter: drawings shall **not** contain text matter except a single word or words when **absolutely indispensable** (“water,” “steam,” “open,” “closed,” “section on AB,” and a few short catchwords on circuit/flow diagrams). Words must be placed so a translation can be pasted over without interfering with lines.

A US-only utility figure with long English legends will fail PCT Rule 11.11. Dual-jurisdiction export should default to the **stricter** (PCT) text-in-drawing rule.

### 2.16 Numbers, letters, and reference characters — 1.84(p)  *(core numeral spec)*

**(1) Form / placement**

- Reference characters (numerals preferred), sheet numbers, and view numbers must be **plain and legible**.
- Must **not** be used in association with brackets or inverted commas, or enclosed within outlines (e.g., **encircled**).
- Oriented in the **same direction as the view** (no rotating the sheet to read them).
- Should be arranged to follow the profile of the object.

**(2) Alphabet.** English alphabet, except where another is customary (Greek for angles, wavelengths, mathematical formulas).

**(3) Size — hard minimum.** Numbers, letters, and reference characters **must measure at least 0.32 cm (⅛ inch) in height**.

Must not:

- interfere with comprehension
- cross or mingle with the lines
- be placed upon hatched or shaded surfaces

When necessary (indicating a surface or cross-section), a reference character **may be underlined** and a **blank space left in the hatching or shading** so it appears distinct.

**(4) Identity — hard consistency.**

> The same part of an invention appearing in more than one view of the drawing must always be designated by the same reference character, **and the same reference character must never be used to designate different parts.**

**(5) Spec ↔ drawing bijection — hard consistency.**

> Reference characters not mentioned in the description **shall not** appear in the drawings. Reference characters mentioned in the description **must** appear in the drawings.

This is the statutory/regulatory hook for a numeral-dictionary audit. PCT Rule 11.13(l)–(m) is the same bijection plus “same features → same signs throughout the international application.”

### 2.17 Lead lines — 1.84(q)

Lead lines = lines between reference characters and the details referred to.

- May be straight or curved; **as short as possible**.
- Must originate in the **immediate proximity** of the reference character and extend to the feature indicated.
- **Must not cross each other.**
- **Required** for each reference character **except** those which indicate the surface or cross-section on which they are placed. Those **must be underlined** so it is clear a lead line was not omitted by mistake.
- Executed in the same way as lines in the drawing (i.e., 1.84(l) quality).

### 2.18 Arrows — 1.84(r)

Arrows may be used at the ends of lines, provided meaning is clear:

| Form | Meaning |
| --- | --- |
| Freestanding arrow on a lead line | the **entire section** toward which it points |
| Arrow **touching** a line | the **surface** shown by that line, looking along the arrow |
| Arrow generally | direction of **movement** |

### 2.19 Copyright or mask-work notice — 1.84(s)

May appear in the drawing **only**:

- within the sight, **immediately below** the figure representing the copyright/mask-work material
- letters 0.32 cm to 0.64 cm (⅛ to ¼ in) high
- content limited to elements provided by law (examples: `© 1983 John Doe` (17 U.S.C. 401); `*M* John Doe` (17 U.S.C. 909))
- **and** only if the authorization language of 37 CFR 1.71(e) is in the specification (preferably first paragraph)

### 2.20 Numbering of sheets — 1.84(t)

Sheets **should** be numbered in consecutive Arabic numerals, starting with 1, **within the sight**.

- Placement: **middle of the top of the sheet, but not in the margin**.
- May move to the right-hand side if the drawing extends too close to the middle of the top edge.
- Sheet numbering must be **clear and larger than reference characters**.
- Format: two Arabic numerals on either side of an oblique line — `sheet / total` — **with no other marking**. Example: `2/5`.

### 2.21 Numbering of views — 1.84(u)

**(1)**

- Consecutive Arabic numerals starting with 1, **independent of sheet numbering**, and if possible in the order they appear.
- Partial views intended to form one complete view: **same number + capital letter** (FIG. 3A, FIG. 3B).
- View numbers **must be preceded by the abbreviation `FIG.`**
- **Single-view exception:** if only a single view is used, it **must not** be numbered and `FIG.` **must not** appear.

**(2)** Numbers/letters identifying views must be simple and clear; **not** used with brackets, circles, or inverted commas. View numbers **must be larger than** reference characters.

PCT Rule 11.13(k): figures numbered in Arabic numerals consecutively and independently of sheet numbering (no `FIG.` mandate in Rule 11 itself; US practice adds `FIG.`).

### 2.22 Security markings — 1.84(v)

Authorized security markings may be placed on the drawings **outside the sight**, preferably centered in the top margin.

### 2.23 Corrections — 1.84(w)

Any corrections on drawings submitted to the Office must be **durable and permanent**. (The Office will not release drawings for correction — 1.85(b). Submit new corrected drawings.)

### 2.24 Holes — 1.84(x)

**No holes** should be made by applicant in the drawing sheets.

### 2.25 Types of drawings — 1.84(y)

Cross-references: § 1.152 design; § 1.1026 international design reproductions; § 1.165 plant; § 1.173(a)(2) reissue.

### 2.26 Prohibited / rejected content (compiled)

From 1.84 itself, plus 1.83 and 1.152:

| Prohibited | Source |
| --- | --- |
| Color in a PCT international application | 1.84(a)(2); PCT Rule 11.13(a) |
| Color in a US utility application without a granted petition | 1.84(a)(2) |
| Photographs when a drawing would suffice | 1.84(b)(1) |
| Frames around the sight | 1.84(g) |
| Projection lines connecting views | 1.84(h), (j) |
| Center lines | 1.84(h), (j) |
| Views on spec/claims/abstract sheets | 1.84(h) |
| One view inside/on another | 1.84(i) |
| Numeric scale callouts (“actual size”, “scale 1/2”) | 1.84(k) |
| Solid black shading (except bar graphs or color) | 1.84(m) |
| Solid black surface shading in **design** (except color black / color contrast) | 1.152 |
| Reference characters in circles / brackets / inverted commas | 1.84(p)(1) |
| Reference characters on hatched/shaded surfaces (unless underlined with a hatch gap) | 1.84(p)(3) |
| Same numeral for different parts; different numerals for the same part | 1.84(p)(4) |
| Numerals in drawings but not spec, or spec but not drawings | 1.84(p)(5) |
| Crossing lead lines | 1.84(q) |
| Holes in sheets | 1.84(x) |
| Mixing photographs and ink drawings as formal drawings in one **design** application | 1.152 |
| Design photographs that disclose environmental structure | 1.152 |
| Design: broken lines to show hidden planes through opaque materials | 1.152 |
| Design: full + broken lines showing alternate positions in the same view | 1.152 |
| Duplicating spec tables or sequence listings in the drawings | 1.83(a) |
| New matter in a later-filed drawing used to fill an enablement hole | 1.81(d); 1.121(f); 35 U.S.C. 132 |

---

## 3. Related drawing rules the pipeline must also implement

### 3.1 When a drawing is required — 37 CFR 1.81

Source: [37 CFR § 1.81](https://www.law.cornell.edu/cfr/text/37/1.81) (retrieved 2026-08-17).

- (a) Applicant **must** furnish a drawing “where necessary for the understanding of the subject matter sought to be patented.” Applicant should **retain the original** (corrections are applicant’s responsibility).
- (b) Drawings **may** include illustrations that facilitate understanding (flow sheets for processes; diagrammatic views).
- (c) If the subject matter *admits of* illustration even though a drawing is not *necessary*, and none was furnished, the examiner will require submission (not less than two months).
- (d) **Drawings submitted after the filing date may not** be used to overcome lack of enablement / inadequate disclosure, or to supplement the original disclosure for claim interpretation.

This is the new-matter wall for any “AI will add the missing figure later” product idea.

### 3.2 Content of drawing — 37 CFR 1.83

Source: [37 CFR § 1.83](https://www.law.cornell.edu/cfr/text/37/1.83) (retrieved 2026-08-17).

- (a) In a **nonprovisional**, the drawing **must show every feature of the invention specified in the claims**. Conventional features whose detailed illustration is not essential **should** be shown as a graphical symbol or labeled representation (e.g., a labeled rectangular box). Tables in the spec and sequences in sequence listings **should not be duplicated** in the drawings.
- (b) Improvement-on-old-machine: show the improved portion disconnected, **and** another view showing only so much of the old structure as will suffice to show the connection.
- (c) Noncompliance → examiner requires additional illustration (not less than two months). Corrections subject to 1.81(d).

Software implication: a claims→figures coverage matrix is a first-class audit, not a nice-to-have.

### 3.3 Amendments to drawings — 37 CFR 1.121(d)–(f)

Source: [37 CFR § 1.121](https://www.law.cornell.edu/cfr/text/37/1.121) (retrieved 2026-08-17).

- Any change must comply with § 1.84 (or, for a nonprovisional international design application, §§ 1.84(c) and 1.1026).
- Submit on a **replacement sheet** attached to the amendment, top-margin labeled `Replacement Sheet`.
- A replacement sheet **shall include all of the figures appearing on the immediate prior version of the sheet**, even if only one figure is amended.
- A new sheet with an additional figure: top-margin `New Sheet`.
- All changes explained in detail in the drawing-amendment or remarks section.
- (d)(1) A marked-up copy of any amended figure **may** be included; must be labeled `Annotated Sheet` and presented in the amendment/remarks that explain the change.
- (d)(2) A marked-up copy **must** be provided when required by the examiner.
- (e) Disclosure consistency: when required by the Office, amend to correct inaccuracies and to “secure substantial correspondence between the claims, the remainder of the specification, and the drawings.”
- (f) **No amendment may introduce new matter** into the disclosure.

### 3.4 Corrections to drawings — 37 CFR 1.85

Source: [37 CFR § 1.85](https://www.law.cornell.edu/cfr/text/37/1.85) (retrieved 2026-08-17).

- (a) A **utility or plant** application **will not be placed on the files for examination** until objections to the drawings have been corrected. Except as provided in § 1.215(c), a patent application publication **will not include drawings filed after** the application has been placed on the files for examination. Drawing objections in utility/plant **will not be held in abeyance**; a request to hold them in abeyance is **not** a bona fide attempt to advance the application (see § 1.135(c)).
- Design exception: if a design drawing meets 1.84(e), (f), and (g) and is suitable for reproduction, it **may be admitted for examination** even if otherwise non-compliant with 1.84.
- (b) Office **will not release drawings** for correction. File **new** corrected drawings within the time set.
- (c) If a corrected drawing is required or a drawing does not comply with § 1.84 (or 1.1026 for international design) **at allowance**, the Office may notify in a **notice of allowability** and set a **three-month** period from the mail date to file a corrected drawing — **not extendable** under § 1.136 (see § 1.136(c)). Failure = abandonment.

---

## 4. MPEP 608.02 and the objection / corrected-drawing workflow

Primary: [MPEP § 608](https://www.uspto.gov/web/offices/pac/mpep/s608.html) (retrieved 2026-08-17; subsections cited below); [MPEP § 507 Drawing Review in OPAP](https://www.uspto.gov/web/offices/pac/mpep/s507.html) (retrieved 2026-08-17); [MPEP § 1302.05](https://www.uspto.gov/web/offices/pac/mpep/s1302.html).

### 4.1 Two layers of review

**Layer A — OPAP (Office of Patent Application Processing) formal review (MPEP 507).**  
OPAP inspects incoming drawings for scan/reproduction fitness and formal 1.84(e)/(f)/(g) defects (paper size, margins, one-sidedness, cracks/creases). Typical formal defects flagged at this layer: wrong sheet size, missing required margins, unscanable quality. Result is commonly a **Notice to File Corrected Application Papers** (see §4.4). MPEP 507 [R-07.2015] expressly lists drawings that “do not have the appropriate margin or are not on the correct size paper” (citing 1.84(f) and (g)) as a review failure.

**Layer B — Examiner review (MPEP 608.02).**  
The examiner reviews completeness (every claimed feature — 1.83(a)), reference-numeral use, shading/hatching, new matter, and 35 U.S.C. 112 enablement/description. Formal 1.84 defects that survived OPAP can still be objected to here.

### 4.2 MPEP 608.02 subsection map (what each does)

| Subsection | Function |
| --- | --- |
| 608.02 | Drawing required when necessary for understanding; original retained by applicant (1.81) |
| 608.02(a) | New drawing — when required |
| 608.02(b) | Acceptability of drawings; quotes 1.85; utility/plant not examined until drawing objections corrected; design may be admitted if 1.84(e)/(f)/(g) + reproducible |
| 608.02(d) | Complete illustration in one application (cannot rely on another application’s drawings) |
| 608.02(e) | Examiner determines completeness of illustration |
| 608.02(f) | Modifications in drawings — modified forms in **separate views** (echoes 1.84(h)(5)) |
| 608.02(g) | Illustration of prior art |
| 608.02(h) | Additional, duplicate, or substitute drawings |
| 608.02(p) | Correction of drawings — quotes 1.85(b)–(c): no release for correction; new sheets; 3-month non-extendable clock at allowance |
| 608.02(w) | Drawing changes the Office may make without applicant’s annotated sheets |
| 608.02(x) | Drawing corrections or changes accepted unless notified otherwise |
| 608.02(z) | Allowable applications needing drawing corrections or corrected drawings |
| 1302.05 | Preparation for allowance — correction of drawing; points back to 608.02(z) |

MPEP 608.02(b) [R-10.2019] restates: if a drawing is objected to in an examiner’s action, a fully responsive amendment **must include corrected drawings** (citing 1.85(c) and 1.121(d)). The objection “will not be held in abeyance.” PTA consequence: 37 CFR 1.704(c)(10) can reduce patent-term adjustment for delayed drawing corrections.

### 4.3 Examiner objection vs. 35 U.S.C. 112 rejection

Keep these distinct in software status codes:

| Vehicle | Typical trigger | Cure |
| --- | --- | --- |
| **Objection** under 1.84 / 1.83 | Formal defects; missing claimed feature that is still *described*; numeral hygiene | Replacement sheets under 1.121(d); no new matter |
| **Rejection** under 35 U.S.C. 112(a)/(b) | Drawing so incomplete/inconsistent the invention is not enabled or not particularly pointed out | Often **cannot** be cured after filing if the missing appearance/structure was not originally disclosed (1.81(d), 1.121(f)) |

MPEP form paragraphs (MPEP Form Paragraphs chapter) include: “The drawings are objected to under 37 CFR 1.83(a) because they fail to show [1] as described in the specification.”

### 4.4 Notice to File Corrected Application Papers

Triggered when OPAP (or later processing) finds the application papers, **including drawings**, do not comply with 37 CFR 1.52 / 1.84 formal requirements — wrong page size, insufficient margins, unreadable scan, missing sheets, PDF that USPTO’s converter cannot ingest (see §6). Typical period is set in the notice (commonly two months; confirm against the face of the notice — do not hard-code). Failure to timely file corrected papers can cause the application to be **abandoned**. Drawings filed **after** the application is placed on the examination files generally **will not appear** in the application publication (1.85(a) / 1.215(c) exception).

Software implication: a “file now, fix figures later” workflow can cost the applicant a figure-less pre-grant publication.

### 4.5 Allowance-time clock

If drawings are still non-compliant at allowance, 1.85(c) + MPEP 608.02(p)/(z) + 1302.05: notice of allowability, **three months, not extendable**. This is a hard product deadline, not a “we’ll get to it.”

---

## 5. Design patent drawings — 37 CFR 1.152 + MPEP 1503.02

These differ **materially** from utility. A pipeline that applies 1.84 utility defaults to a design case will emit non-compliant sheets.

### 5.1 The regulation — 37 CFR 1.152

Source: [37 CFR § 1.152](https://www.law.cornell.edu/cfr/text/37/1.152) (eCFR “up to date as of 8/13/2026”; LII mirror retrieved 2026-08-17). Source note: 65 FR 54674, Sept. 8, 2000.

Verbatim operational requirements:

1. Drawing **must comply with § 1.84**.
2. **Sufficient number of views** to constitute a **complete disclosure of the appearance** of the design.
3. **Appropriate and adequate surface shading should be used** to show the character or contour of the surfaces represented.
4. **Solid black surface shading is not permitted** except when used to represent the color black as well as color contrast.
5. **Broken lines may be used to show visible environmental structure**, but **may not** be used to show hidden planes and surfaces that cannot be seen through opaque materials.
6. **Alternate positions** of a design component, illustrated by full and broken lines in the **same view**, **are not permitted**.
7. **Photographs and ink drawings are not permitted to be combined** as formal drawings in one application.
8. Photographs submitted in lieu of ink drawings **must not disclose environmental structure** but **must be limited to the design claimed** for the article.

### 5.2 MPEP 1503.02 [R-01.2024] — the examiner’s design-drawing spec

Source: [MPEP § 1503.02](https://www.uspto.gov/web/offices/pac/mpep/s1503.html) (retrieved 2026-08-17).

**Governing principle.** “As the drawing or photograph constitutes the **entire visual disclosure of the claim**, it is of utmost importance that the drawing or photograph be clear and complete, and that nothing regarding the design sought to be patented is left to conjecture.” Insufficient drawing can be **fatal to validity** under 35 U.S.C. 112(a). Inconsistencies among views: object and require consistency (*Ex parte Asano*, 201 USPQ 315 (Bd. Pat. App. & Inter. 1978)). Inconsistencies of such magnitude that overall appearance is unclear: **reject** under 112(a) and (b).

**Views (1503.02 I).**

- Sufficient views to disclose complete appearance: typically front, rear, top, bottom, sides.
- Where 3-D aspects are **not** claimed, a single plan/planar view **may** suffice. *In re Maatita*, 900 F.3d 1369 (Fed. Cir. 2018): a shoe-bottom design can be understood from one two-dimensional plan view; an entire shoe or teapot cannot.
- Perspective views are **suggested**. Surfaces clearly shown in perspective need not be repeated.
- Duplicative or flat/unornamented views may be omitted **if the specification says so explicitly** (e.g., “the right side is a mirror image of the left”; “the bottom is flat and devoid of surface ornamentation”). Do **not** use “unornamented” for visible surfaces that are clearly not flat (*Philco Corp. v. Admiral Corp.*, 199 F. Supp. 797 (D. Del. 1961)).
- Sectional views **solely** to show internal construction / functional features: object and cancel (*Ex parte Tucker*; *Ex parte Kohler*). A sectional view **may** be used to clarify exterior contour when it is not otherwise apparent (*Ex parte Lohman*). Adding a section during prosecution requires antecedent basis for hatching (1.84(h)(3); MPEP 608.02).

**Surface shading (1503.02 II) — the design/utility fork.**

| Topic | Utility 1.84(m) | Design 1.152 / 1503.02 II |
| --- | --- | --- |
| Shading required? | Encouraged if it aids understanding | “Should be used”; **may be necessary** to show 3-D character/contour and to distinguish open vs solid areas |
| Lack of shading | Formal objection, usually | Can render the design **nonenabling and indefinite under 112(a)/(b)**; adding shading later can be **new matter** |
| Shading on broken-line (unclaimed) structure | Not specially forbidden | **Do not shade unclaimed subject matter** — confuses claim scope |
| Solid black | Banned except bar graphs or color | Banned except color black / color contrast |
| Transparent / mirror | Not specified | **Oblique line shading** for transparent, translucent, highly polished, or reflective surfaces |
| Contrast in materials | Hatching conventions in section | Line shading in one area + stippling in another; claim then covers contrasting surfaces **unlimited by colors** |

**Broken lines (1503.02 III) — the design claim-scope language.**

Two legitimate uses:

1. **Environment** related to the claimed design (including unclaimed portions of the article). *In re Zahn*, 617 F.2d 261 (CCPA 1980).
2. **Boundary** of the claim, when the boundary does not exist in reality on the article. The claimed design extends **to** the boundary but does **not include** the boundary.

Broken lines are **not** permitted to mark “unimportant” portions of a claimed design. *In re Blum*, 374 F.2d 904 (CCPA 1967): there are **no** immaterial portions of a design.

Rules of execution:

- Broken lines should **not intrude upon or cross** the claimed (full-line) design, and should **not be heavier** than claimed lines.
- If broken lines **must** cross the claimed design, the specification **must explicitly identify their purpose** (environment vs. boundary). Different purposes in one application require a visual distinction plus a description, e.g. “The broken lines immediately adjacent the shaded areas represent the bounds of the claimed design while all other broken lines are directed to environment…; the broken lines form no part of the claimed design.”
- If environmental broken lines obscure the claimed design, put them in a **separate figure**.
- Adding a broken-line **boundary** by amendment must satisfy 112(a) written description. *In re Owens*, 710 F.3d 1362 (Fed. Cir. 2013). A straight broken line connecting ends of existing full lines can be OK; a novel-shaped boundary is typically new matter (35 U.S.C. 132; 1.121(f)).

Unclaimed subject matter **must be described** as forming no part of the claimed design. MPEP form paragraph 15.50.02 suggested language: “The broken line showing of [structure] is for the purpose of illustrating [portions of the article / environmental structure] and forms no part of the claimed design.”

**Surface treatment (1503.02 IV).** Indicia, contrasting color/materials, graphics applied to the article are part of ornamental appearance **if applied to an article of manufacture**. Surface treatment *per se* (not applied to an article) is not 35 U.S.C. 171 subject matter. Canceling 2-D surface treatment or reducing it to broken lines is permitted if the underlying configuration was possessed at filing (*In re Daniels*, 144 F.3d 1452 (Fed. Cir. 1998)). Removing **3-D** surface treatment that is integral to configuration (beads, grooves, ribs) is new matter.

**Photographs and color (1503.02 V).**

- Color drawings permitted in design under 1.84(a). One set via Patent Center; three sets on paper. Spec must include the 1.84(a)(2)(iii) color paragraph.
- Photographs accepted only if the only practicable medium (1.84(b)).
- **Do not combine photographs and ink drawings** in one application (inconsistency risk; 1.152).
- Color in an originally-filed color photo/drawing is an **integral part of the claimed design**. Omitting color later is permitted only if the underlying configuration was possessed at filing (*Daniels*).
- Lining for color (MPEP 608.02 IX graphic symbols) is an alternative to color drawings, but lining **entire** surfaces can block contour shading and create a 112(a) problem. Partial lining + a statement that the color extends across the surface, or a separate “shown only for clarity” uncolored view, is the examiner-suggested workaround.
- Design photographs **must not disclose environmental structure** (1.152). Disclaimer of logos/written matter in the original spec or on the photographs themselves is the accepted way to exclude them.

**New-matter warning (form ¶ 15.07 / 15.48).** “When preparing new or replacement drawings, be careful to avoid introducing new matter.” An insufficient original drawing “may have a negative effect with respect to the effective filing date of the claimed invention in a continuing application.”

---

## 6. Patent Center / EFS-Web practical file requirements (as of 2026-08-17)

EFS-Web is the legacy name; **Patent Center is the live electronic filing system**. The USPTO still publishes the requirements under the historical “EFS-Web PDF Guidelines” URL.

### 6.1 PDF technical profile

Source: [Patent Center PDF Guidelines](https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines) (retrieved 2026-08-17 via USPTO search-index extract of the live page).

| Constraint | Rule |
| --- | --- |
| Page size | A4 (21.0 × 29.7 cm) **or** letter (21.6 × 27.9 cm / 8.5 × 11 in). Larger pages are **reduced to 8.5 × 11**, which can destroy drawing readability and distort images. |
| PDF version | Must conform to Adobe PDF specification **1.1 through 1.6**. (PDF 1.7 / 2.0 / PDF/A-not-in-range is a reject risk.) |
| Fonts | **All characters (glyphs) that make up the text must be embedded.** |
| Raster resolution | Bi-tonal (B&W), color, or grayscale images should be scanned at a **minimum of 300 DPI**. |
| Layers | Images consisting of multiple layers **must be flattened** before embedding. USPTO’s own recovery path: Print as Image at 300 dpi. |
| External deps | **No** dependencies on external files or resources of any type to render the attached image. |
| Malware | Free of executables, worms, viruses, or potentially malicious content. |

Vector vs raster: the Guidelines do **not** forbid vector PDF. They require that whatever is inside is self-contained, flattened, and reproducible. A CAD-exported vector PDF with unembedded fonts, optional-content groups (layers), or transparency is a classic OPAP failure. Safest automated path: **flatten to a single content stream; embed all fonts; or rasterize line art at ≥300 DPI bi-tonal** while preserving 1.84 line quality.

### 6.2 Size limits (2025 Legal Framework + Patent Center FAQ)

Sources: [Legal Framework for Patent Electronic System (11 Sep 2025)](https://www.uspto.gov/sites/default/files/documents/2025LegalFrameworkPES.pdf) (“The Patent Electronic System accepts standard PDF documents up to **25 megabytes** for each file…”); [Patent Center FAQs](https://www.uspto.gov/patents/apply/patent-center/faq) (indexed 2026-08-17): PDF **25 MB**; DOCX **10 MB**; zip also accepted with its own cap (`UNVERIFIED` exact zip cap — confirm against the live FAQ page, which did not return body text to this lane).

Split a drawing set across multiple PDFs rather than emitting one 80 MB book.

### 6.3 DOCX drawings

[USPTO DOCX page](https://www.uspto.gov/patents/docx) (retrieved 2026-08-17): registered users may file specification, claims, abstract **and drawings** in DOCX. Drawing-in-DOCX is a **different** rendering pipeline than PDF-as-image. If the product’s figures are CAD/vector, **PDF remains the safer drawing container**; do not assume DOCX will preserve hairline weights or hatch angles.

### 6.4 What actually triggers a Notice to File Corrected Application Papers

Compiled from MPEP 507, 1.52, 1.84, 1.85, and the PDF Guidelines:

- Sheet size not A4 or letter, or mixed sizes in one application (1.84(f)).
- Margins below 2.5 / 2.5 / 1.5 / 1.0 cm (1.84(g)).
- Drawing not confined to one side; cracks/creases/folds that prevent scanning (1.84(e); MPEP 507).
- PDF version outside 1.1–1.6; unembedded fonts; layered/unflattened artwork; <300 DPI raster that fails reproduction; external font/image references.
- File > 25 MB.
- Color utility drawings filed **without** the 1.84(a)(2) petition + spec paragraph.
- Unreadable after USPTO reduction of an oversize page.
- Drawing content on a spec sheet (1.84(h)).

A Notice is a **formal** defect notice, not an examiner’s 1.83/112 action. It can still abandon the application if ignored.

---

## 7. WIPO / PCT international figures — and what ST.96 / ST.26 actually are

### 7.1 There is no WIPO Standard ST.94

The official WIPO standards index ([List of WIPO Standards](https://www.wipo.int/en/web/standards/part_03_standards), retrieved 2026-08-17) enumerates ST.90, **ST.91**, ST.92, **ST.96**, ST.97 in the “general / information-processing” block, and ST.25 / **ST.26** in the patent-documentation block. **ST.94 is not on the list.** A pipeline ticket that says “comply with ST.94” is mislabeled. The international **figure** instrument is **PCT Rule 11**, especially Rule 11.13. The international **3D-model** instrument is **ST.91**.

### 7.2 PCT Rule 11 — drawing-relevant provisions

Source: [PCT Rule 11, Physical Requirements of the International Application](https://www.wipo.int/pct/en/texts/rules/r11.html) (retrieved 2026-08-17).

**Sheet / reproduction (11.2–11.6)**

- Directly reproducible by photography, electrostatic, photo-offset, microfilming (11.2(a)).
- Free from creases and cracks; not folded; one side only; upright (short sides top and bottom) except 11.10(d) and 11.13(j) (11.2).
- Paper: flexible, strong, white, smooth, non-shiny, durable (11.3) — same words as 1.84(e).
- Each element (request, description, claims, drawings, abstract) commences on a **new sheet** (11.4).
- **Sheet size is A4 only** (29.7 × 21 cm). A receiving Office *may* accept other sizes, but the **record copy transmitted to the IB must be A4** (11.5).
- Drawing usable surface **shall not exceed 26.2 cm × 17.0 cm**. No frames. Minimum margins: top 2.5, left 2.5, right 1.5, bottom 1.0 cm (11.6(c)) — same numbers as 1.84(g) A4 sight.
- Margins must be completely blank except the applicant file reference in the top-left, within 1.5 cm of the top, character-count limited by the Administrative Instructions (11.6(e)–(f)).

**Sheet numbering (11.7):** consecutive Arabic numerals, centered at top **or** bottom, **not in the margin**. (US 1.84(t) is more specific: top-middle, `n/N` format, in the sight.)

**Text in drawings (11.11):** no text except indispensable single words; place words so a translation can be pasted over without interfering with lines.

**Special drawing requirements (11.13)** — the PCT figure spec:

| Rule | Requirement |
| --- | --- |
| 11.13(a) | Durable, **black**, sufficiently dense and dark, uniformly thick and well-defined lines and strokes **without colorings** |
| 11.13(b) | Cross-sections indicated by **oblique hatching** that does not impede reading of reference signs and leading lines |
| 11.13(c) | Scale and distinctness such that a photographic reproduction with **linear reduction to two-thirds** would enable all details to be distinguished |
| 11.13(d) | If scale is given (exceptional), it shall be represented **graphically** |
| 11.13(e) | Numbers, letters, reference lines simple and clear; **no** brackets, circles, or inverted commas associated with numbers and letters |
| 11.13(f) | All lines **ordinarily** drawn with the aid of drafting instruments |
| 11.13(g) | Each element of each figure in proper proportion to the other elements, except where a different proportion is indispensable for clarity |
| 11.13(h) | Height of numbers and letters **not less than 0.32 cm**. Latin alphabet; Greek where customary |
| 11.13(i) | Several figures on one sheet OK; multi-sheet complete figure assemblable without concealing any part |
| 11.13(j) | Arranged without wasting space, preferably upright, clearly separated. If not upright, sideways with **top of the figures at the left side of the sheet** (note: US 1.84(i) puts the **top of the sheet** on the **right** when landscape — **US and PCT landscape conventions are opposite**) |
| 11.13(k) | Figures numbered in Arabic numerals consecutively and independently of sheet numbering |
| 11.13(l) | Reference signs not mentioned in the description shall not appear in the drawings, **and vice versa** |
| 11.13(m) | Same features, when denoted by reference signs, denoted by the **same signs throughout the international application** |
| 11.13(n) | If many reference signs, **strongly recommended** to attach a separate sheet listing all signs and the features denoted |

**US vs PCT landscape is a real foot-gun.** US 1.84(i): turn the sheet so the top (heading) is on the **right**. PCT 11.13(j): sideways figures have their top at the **left**. A dual-jurisdiction exporter must pick one convention per filing package, not one convention per product.

### 7.3 ST.91 — 3D models and 3D images (the CAD-relevant WIPO standard)

[ST.91, Recommendations on digital three-dimensional (3D) models and 3D images](https://www.wipo.int/documents/d/standards/docs-en-03-91-01.pdf), latest update **October 2024** (WIPO standards list, retrieved 2026-08-17).

ST.91 is a recommendation to IPOs on accepting/processing **digital 3D models and 3D images**. It is **not** a substitute for 2-D line drawings under 1.84 or PCT Rule 11. A CAD pipeline may *keep* a 3D master for future IPO 3D-filing programs; the **USPTO utility/design filing artifact today is still a 2-D drawing sheet** that satisfies 1.84 / 1.152.

Full ST.91 file-format table was not re-parsed in this lane (`UNVERIFIED` exact recommended encodings as of Oct 2024 — read the PDF before implementing a 3D-deposit feature).

### 7.4 ST.96 — XML for IP information (not figures)

[ST.96, Processing of Intellectual Property information using XML](https://www.wipo.int/documents/d/standards/docs-en-03-96-01.pdf), latest update **April 2026** (WIPO list, retrieved 2026-08-17). Annexes at https://www.wipo.int/standards/en/st96/.

ST.96 is the IPO-to-IPO / applicant-to-IPO **XML vocabulary** for bibliographic and procedural IP data (successor-in-concept to ST.36 patents / ST.66 trademarks / ST.86 designs). It may **wrap a reference** to a drawing file. It does **not** specify line weights, hatching, or FIG. numbering.

### 7.5 ST.26 — sequence listings (not figures)

[ST.26](https://www.wipo.int/documents/d/standards/docs-en-03-26-01.pdf) (v1.7 current; v2.0 published, enters into force **1 July 2027** per WIPO list, retrieved 2026-08-17). USPTO implementation: MPEP 2412–2419; 37 CFR 1.831–1.835.

ST.26 is **only** for nucleotide and amino-acid sequence listings as a single UTF-8 XML file. 37 CFR 1.83(a) says those sequences **should not be duplicated in the drawings**. Do not emit a “FIG. 12 — SEQ ID NO:1 pretty-print” as a drawing.

### 7.6 ST.10 / ST.10a — published patent documents (downstream)

ST.10 / ST.10a concern the **format of published patent documents**, not applicant-filed drawing execution. Relevant only if the product also emits a publication-style pamphlet.

---

## 8. Reference-numeral consistency (spec ↔ drawings ↔ claims)

This is the single most implementable “legal” feature in a figure pipeline.

### 8.1 The rule (utility + PCT)

| Requirement | Source |
| --- | --- |
| Same part → same character in every view; never reuse a character for a different part | 37 CFR 1.84(p)(4) |
| Every character in a drawing is in the description; every character in the description is in a drawing | 37 CFR 1.84(p)(5) |
| Same pair of rules, application-wide | PCT Rule 11.13(l), (m) |
| Numerals preferred; min height 0.32 cm; not encircled; not on hatch/shade | 37 CFR 1.84(p)(1), (p)(3); PCT Rule 11.13(e), (h) |
| Lead line required unless the character sits on the surface/section and is underlined | 37 CFR 1.84(q) |
| Drawing must show every **claimed** feature (conventional features may be boxes) | 37 CFR 1.83(a) |
| Office may require amendment to secure “substantial correspondence between the claims, the remainder of the specification, and the drawings” | 37 CFR 1.121(e) |

### 8.2 Design patents do **not** use reference numerals the same way

A design claim is “the ornamental design for [article] as shown” (or “as shown and described”) — 37 CFR 1.153. The drawing **is** the claim. Reference characters on a design drawing are unusual and, if used, must not confuse claim scope (full-line vs broken-line). Do not auto-stamp a utility numeral dictionary onto a design sheet.

### 8.3 Recommended software audit (enforceable)

Build a single `NumeralIndex` with three projections:

1. `in_spec: Set<Token>` — tokens extracted from the detailed description (and figure descriptions).
2. `in_drawings: Map<Token, Set<FigId>>` — OCR/vector-text harvest from each FIG.
3. `in_claims: Set<Token>` — optional; claims often recite elements by name rather than number, but if a claim uses a numeral it must exist in both spec and drawings.

Fail closed on:

- `in_drawings \ in_spec` (orphan drawing numeral) — 1.84(p)(5)
- `in_spec \ in_drawings` (described but never shown) — 1.84(p)(5)
- same token bound to two different parts — 1.84(p)(4)
- claimed named feature with no supporting view — 1.83(a)
- character height < 0.32 cm at target print size — 1.84(p)(3)
- encircled / bracketed numerals — 1.84(p)(1)
- crossing lead lines — 1.84(q)
- numeral placed on hatch/shade without underline + hatch gap — 1.84(p)(3)

PCT extra: emit the optional 11.13(n) sign-list sheet when `|tokens|` is large.

---

# PART 2 — CONFIDENTIALITY / COMPLIANCE

## 9. ABA Model Rules 1.6(c) and 1.1 cmt. [8], applied to third-party AI / cloud CAD

### 9.1 The black-letter duties

**Rule 1.6(a).** A lawyer shall not reveal information relating to the representation of a client unless the client gives informed consent, the disclosure is impliedly authorized, or an exception in 1.6(b) applies.  
Source: [ABA Model Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/) (retrieved 2026-08-17).

**Rule 1.6(c).** “A lawyer shall make reasonable efforts to prevent the inadvertent or unauthorized disclosure of, or unauthorized access to, information relating to the representation of a client.”

**Rule 1.6 cmt. [18] — “Acting Competently to Preserve Confidentiality.”** Paragraph (c) requires the lawyer to act competently to safeguard information against unauthorized access by third parties and against inadvertent/unauthorized disclosure by the lawyer or persons participating in the representation. **Unauthorized access or disclosure is not a 1.6(c) violation if the lawyer made reasonable efforts to prevent it.** Reasonableness factors:

- sensitivity of the information
- likelihood of disclosure if additional safeguards are not employed
- cost of additional safeguards
- difficulty of implementing them
- extent to which safeguards adversely affect the ability to represent clients

A client may require *more* security than the Rule, or give **informed consent to forgo** measures the Rule would otherwise require. Sharing with nonlawyers outside the firm → Rule 5.3 cmts. [3]–[4].  
Source: [Comment on Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/) (retrieved 2026-08-17).

**Rule 1.6 cmt. [19].** When transmitting a communication that includes information relating to the representation, the lawyer must take reasonable precautions to prevent it from reaching unintended recipients. Special security measures are **not** required if the method affords a reasonable expectation of privacy — but special circumstances (sensitivity; whether privacy is protected by law or a confidentiality agreement) can require more.

**Rule 1.1 cmt. [8] — “Maintaining Competence.”** “To maintain the requisite knowledge and skill, a lawyer should keep abreast of changes in the law and its practice, **including the benefits and risks associated with relevant technology**…”  
Source: [Comment on Rule 1.1](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_1_competence/comment_on_rule_1_1/) (retrieved 2026-08-17).

**Predecessor cloud opinion.** ABA Formal Opinion **477R** (May 22, 2017) (cited throughout Formal Op. 512) applies the same 1.6(c) / 1.1 cmt. [8] framework to transmitting client information over the internet: a fact-specific reasonable-efforts standard, not a ban on cloud tools.

### 9.2 ABA Formal Opinion 512 (29 July 2024) — the governing GAI opinion

Source: [ABA Formal Opinion 512, *Generative Artificial Intelligence Tools* (July 29, 2024)](https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf) (PDF retrieved 2026-08-17). No ABA successor *replacing* 512 was found through 2026-08-17. Formal Opinion **517** (jury-selection discrimination; cites AI software only as one possible source of unlawful strikes) is not a 512 successor.

**Holdings that bind a CAD/figure pipeline used by or sold to lawyers:**

1. **Competence (Rule 1.1 + cmt. [8]).** Lawyers need not become GAI experts but **must have a reasonable understanding of the capabilities and limitations of the specific tool**, or draw on someone who does. This is “not a static undertaking.” Uncritical reliance on GAI output — including hallucinated facts — can violate 1.1. GAI “cannot replace the judgment and experience necessary” to advise clients or craft legal documents. Independent verification intensity is fact-specific (Op. 512 at 2–4).

2. **Confidentiality (Rule 1.6, 1.9(c), 1.18(b)).** Before inputting information relating to the representation, the lawyer **must evaluate** the risk it will be disclosed to or accessed by others **outside the firm** *and* by others **inside the firm** who will not adequately protect it (ethical walls; cross-matter leakage) (Op. 512 at 6–7).

3. **Self-learning tools → informed consent is required.** “Because many of today’s self-learning GAI tools are designed so that their output could lead directly or indirectly to the disclosure of information relating to the representation of a client, **a client’s informed consent is required prior to inputting information relating to the representation into such a GAI tool**.” (Op. 512 at 7, emphasis added.) Rationale: input from Client A can later appear in output to a lawyer working for Client B, or to users outside the firm on the same hosted model.

4. **Informed consent is not a boilerplate checkbox.** The client must receive the lawyer’s best judgment about *why* the tool is used, the *specific* information that will be disclosed, how others might use it against the client, the tool’s benefits, and the risk that later users/beneficiaries of the tool will have access. “Merely adding general, boiler-plate provisions to engagement letters purporting to authorize the lawyer to use GAI is not sufficient.” (Op. 512 at 7.)

5. **Baseline due diligence.** “All lawyers should read and understand the Terms of Use, privacy policy, and related contractual terms and policies of any GAI tool they use to learn who has access to the information that the lawyer inputs,” or consult someone who has. They “may need to consult with IT professionals or cyber security experts.” (Op. 512 at 7.)

6. **When consent is *not* required.** Using the tool for idea generation **without** inputting information relating to the representation does not require consent (Op. 512 at 7).

7. **Communication (Rule 1.4).** Separate from 1.6 consent. Disclose if the client asks; if the engagement letter / outside-counsel guidelines require it; if 1.6 informed consent is needed; if GAI use is relevant to the fee; if output will influence a significant decision in the representation (Op. 512 at 8–9).

8. **Candor / meritorious claims (Rules 3.1, 3.3, 8.4(c)).** Verify output before submitting to a tribunal. Hallucinated citations are a 3.3 problem (Op. 512 *passim*; the opinion flags this as a central risk at 3).

9. **Supervision (Rules 5.1, 5.3).** Partners/managers must make reasonable efforts to ensure the firm has measures giving reasonable assurance that employed lawyers **and nonlawyer assistants (including GAI vendors)** conform to the Rules. Outsourcing analysis of Formal Op. 08-451 is incorporated (Op. 512 at 2 n.15, and later supervisory discussion).

10. **Fees (Rule 1.5).** Charge for *work*, not for time the tool saved as if it were billable hours; expenses must be reasonable (flagged in the opinion’s issue list at 2; developed in later pages of the PDF).

**Application to this product.** An agentic CAD / figure generator that (a) is hosted, (b) trains on customer inputs, (c) retains prompts, or (d) allows vendor/staff access to invention drawings is, under 512, a **self-learning GAI tool that requires client informed consent before any invention disclosure, unpublished drawing, or spec excerpt is uploaded.** A local, non-training, access-controlled deployment changes the 1.6 risk analysis; it does not erase 1.1 competence or 3.3 candor duties on the output.

### 9.3 State-bar GAI opinions 2023–2026 (no ABA replacement; states fill in)

Formal Op. 512 itself cites, and this lane independently located:

| Authority | Date | Point of departure from 512 |
| --- | --- | --- |
| Florida Bar Professional Ethics Comm. Op. **24-1** | 2024 | Cited in Op. 512 nn. 4, 16, 34. Applies Florida rules to GAI chatbots / advertising (Fla. 4-7.13) as well as confidentiality. |
| California State Bar, *Practical Guidance for the Use of Generative Artificial Intelligence in the Practice of Law* | 2023–24 (PDF hosted at calbar.ca.gov; cited Op. 512 n.32) | Fact-specific reasonable-efforts standard; do not put confidential client information into a public GAI system. |
| Pennsylvania + Philadelphia Joint Formal Op. **2024-200** | 2024 | Cited Op. 512 n.4, n.33. Flags Rules 1.7 / 1.9 risk: a model that uses one representation to inform another can breach conflicts / former-client duties. |
| West Virginia Lawyer Disciplinary Board Op. **24-01** | 2024 | Cited Op. 512 nn. 34–35. Informed consent; boilerplate engagement language insufficient. |
| DC / NY / TX / others | 2024–2026 | 35+ state bars have issued some form of GAI guidance as of early 2026 (`UNVERIFIED` exact count; secondary compilation at thelegalprompts.com Feb 23, 2026). **None located that authorize training on unpublished patent disclosures without consent.** |

There is **no** ABA Formal Opinion after 512 that relaxes 1.6(c) for GAI training. Build for 512 + the most restrictive reasonably applicable state rule (for a national product: **no client technical content onto a training corpus without documented informed consent**).

---

## 10. USPTO guidance on AI use by practitioners

Two different USPTO documents are routinely conflated. They are not the same.

### 10.1 Practitioner / party use of AI tools — the one this pipeline must implement

**Authority:** *Guidance on Use of Artificial Intelligence-Based Tools in Practice Before the United States Patent and Trademark Office*, **89 Fed. Reg. 25609** (Apr. 11, 2024) ([govinfo PDF](https://www.govinfo.gov/content/pkg/FR-2024-04-11/pdf/2024-07629.pdf), retrieved 2026-08-17). Docket PTO-P-2024-0013. Effective **April 11, 2024**. Signed Katherine K. Vidal. **This guidance was not rescinded by the November 2025 inventorship revision** (that revision targets a different FR notice — see §10.2).

Disclaimer in the notice: it is **not** substantive rulemaking and does not have the force of law; if earlier USPTO guidance (including any MPEP section) is inconsistent, personnel are to follow **this** notice until the MPEP is updated (89 FR at 25611).

**Core propositions, with the drawing/CAD implications:**

1. **Existing rules already apply.** Duty of candor (37 CFR 1.56, 11.303, 42.11), signature certifications (37 CFR 11.18(b), 1.4(d)), confidentiality (37 CFR 11.106 ≈ Model Rule 1.6), foreign-filing/export (35 U.S.C. 184; 37 CFR 5.11), USPTO electronic-system terms, and duties to clients (37 CFR 11.101 / 11.103 / 11.104 ≈ Model Rules 1.1 / 1.3 / 1.4) all apply “regardless of any AI assistance” (89 FR at 25611).

2. **No general duty to tell the USPTO that AI was used** — **unless** the use is **material to patentability** under 1.56(b) (89 FR at 25614 n.58, 25615). Example of materiality: AI contributed so much that a named inventor did not significantly contribute; inputs/outputs of the AI system may then themselves be material (89 FR at 25615, citing the then-operative inventorship guidance).

3. **Signature / 11.18(b) is personal and non-delegable.** Every paper presented to the Office certifies, after an inquiry **reasonable under the circumstances**, that statements of the party’s own knowledge are true, legal contentions are warranted, and factual contentions have evidentiary support (37 CFR 11.18(b), [LII text](https://www.law.cornell.edu/cfr/text/37/11.18), retrieved 2026-08-17). “**Simply relying on the accuracy of an AI tool is not a reasonable inquiry.**” (89 FR at 25614.) The natural person must insert their own signature (1.4(d)); an AI system **cannot** obtain a USPTO.gov account or be sponsored as support staff (89 FR at 25616).

4. **Drawings and spec drafted with AI — extra 112 care.** “When the specification and/or **drawings** of the patent application are drafted using AI tools, practitioners need to take extra care to verify the **technical accuracy** of the documents and compliance with **35 U.S.C. 112**.” Prophetic examples must be identifiable as prophetic. Corrections after filing “may constitute **new matter**” (MPEP 608.04(a); 89 FR at 25615). AI-introduced alternate embodiments the inventor did not conceive can create inventorship and 112 problems (89 FR at 25615).

5. **IDS automation is constrained.** Auto-populating PTO/SB/08 is allowed only if a natural person **reviews each listed reference**. Dumping cumulative/irrelevant art can be an 11.18(b)(2) “improper purpose” paper (89 FR at 25616).

6. **Confidentiality + national security + export — the cloud-CAD paragraph.** 89 FR at 25617 § III(D):

   - Use of AI can result in **inadvertent disclosure** of client-sensitive or confidential information, “including **highly-sensitive technical information**, to third parties” (example given: inputting aspects of an invention into AI for prior-art search or draft generation).
   - Practitioners who supervise others must ensure supervised lawyers **and** nonlawyer assistants (including **AI-related third-party services**) comply with the USPTO Rules of Professional Conduct.
   - “**Such disclosures can also implicate national security, export control, and foreign filing license issues.**”
   - “Practitioners must be mindful of the possibility that **AI tools may utilize servers located outside the United States**, raising the likelihood that any data entered into such tools **may be exported outside of the United States**, potentially in violation of existing export administration and national security regulations or secrecy orders.”
   - “Even if the servers are located within the United States, **certain activities related to the use of AI systems hosted by these servers by non-U.S. persons may be deemed an export**.”
   - Developers/maintainers may suffer data breaches.
   - “**Before using these AI tools, it is imperative for practitioners to understand an AI tool’s terms of use, privacy policy, and cybersecurity practices.**”

7. **Foreign filing license does *not* cover preparing a *US* application abroad.** The notice quotes MPEP 140 / 73 FR 42781 (July 23, 2008): a USPTO foreign-filing license authorizes export of technical data for **foreign** filing/prosecution, **not** export of subject matter abroad to **prepare a US application**. That activity is an EAR/BIS question (89 FR at 25613).

8. **Patent Center / IT systems.** AI tools must not access applications they are not authorized to access; must not data-mine USPTO databases at abusive rates; must not share USPTO.gov credentials (89 FR at 25613–25616; Legal Framework PES).

Sanctions path for 11.18 violations: strike the paper; refer the practitioner to OED; preclude a party from submitting papers; reduce evidentiary weight; terminate the proceeding (37 CFR 11.18(c)). 18 U.S.C. 1001 is expressly invoked in 11.18(b)(1).

### 10.2 Inventorship guidance — Feb 2024 issued, Nov 2025 **rescinded**

| Instrument | Status as of 2026-08-17 |
| --- | --- |
| *Inventorship Guidance for AI-Assisted Inventions*, **89 FR 10043** (Feb. 13, 2024) | **Rescinded in its entirety** |
| *Revised Inventorship Guidance for AI-Assisted Inventions*, **90 FR ___** / FR Doc. **2025-21457** (published Nov. 28, 2025; USPTO alert Nov. 26, 2025) | **Operative** |

Sources: [89 FR 10043](https://www.federalregister.gov/documents/2024/02/13/2024-02623/inventorship-guidance-for-ai-assisted-inventions); [USPTO alert 2024-02-12](https://www.uspto.gov/subscription-center/2024/uspto-issues-inventorship-guidance-and-examples-ai-assisted-inventions); [Revised guidance FR 2025-11-28](https://www.federalregister.gov/documents/2025/11/28/2025-21457/revised-inventorship-guidance-for-ai-assisted-inventions); [USPTO alert 2025-11-26](https://www.uspto.gov/subscription-center/2025/revised-inventorship-guidance-ai-assisted-inventions).

**What changed.** The 2024 guidance applied the *Pannu* factors specifically to AI-assisted inventions and required a “significant contribution” analysis tailored to AI. The 2025 revision **rescinds that approach and the accompanying examples**. The 2025 rule of decision, per the USPTO alert: the **same** inventorship standard applies whether or not AI was used; only a **natural person** can be an inventor (35 U.S.C. 100(f)); AI systems are **tools** and “do not qualify for or elevate such assistance to inventor status.” The Office presumes named inventors on the ADS/oath are the actual human inventors.

**What did *not* change.** AI still cannot be named as an inventor (*Thaler v. Vidal*, 43 F.4th 1207 (Fed. Cir. 2022), cert. denied). A paper presented to the Office still cannot list an AI system as inventor. The April 2024 **practitioner-tools** guidance (signature, candor, export, confidentiality) remains in force. The 2024 notice’s *example* of 1.56 materiality tied to the *Pannu*/AI-contribution analysis should be read in light of the rescission: the **duty of candor itself** was not rescinded; the specific “document the Pannu factors for this AI interaction” flavor was.

`UNVERIFIED` against the full 2025-21457 PDF body in this lane (Federal Register anti-bot). The USPTO alert text was retrieved and is the basis for the rescission description above.

---

## 11. Foreign filing license and export control — is a cloud-CAD upload an “export”?

**Short answer:** Uploading an unpublished invention disclosure or technical drawing to a **foreign-hosted** cloud CAD/AI service is, in the ordinary case, an **export of technology** under the EAR (and, if the subject matter is on the USML, under the ITAR). It is **not automatically** a 35 U.S.C. 184 “filing in a foreign country,” but 37 CFR 5.11 **expressly treats export of technical data for preparation of a foreign application as license-gated**, and the USPTO has **expressly warned** that putting invention data into a foreign-hosted AI tool can violate export-administration rules and secrecy orders. A USPTO foreign-filing license **does not** authorize exporting the same data to have a **US** application (or US figures) prepared abroad.

### 11.1 The patent-law license — 35 U.S.C. 184 + 37 CFR 5.11

**35 U.S.C. 184(a).** “Except when authorized by a license obtained from the Commissioner of Patents a person shall not file or cause or authorize to be filed in any foreign country prior to six months after filing in the United States an application for patent … in respect of an invention made in this country.” Retroactive license possible if filed abroad “through error” and the application does not disclose an invention within § 181.  
Source: [35 U.S.C. § 184](https://www.law.cornell.edu/uscode/text/35/184) (retrieved 2026-08-17).

**35 U.S.C. 185** bars a US patent if the foreign filing was made without the required license. **35 U.S.C. 186** is the criminal counterpart.

**37 CFR 5.11** (full text retrieved 2026-08-17 from [LII](https://www.law.cornell.edu/cfr/text/37/5.11)):

- **(a)** A Commissioner’s license under 35 U.S.C. 184 is required **before filing** any application (including modifications, amendments, supplements, divisions) or registering a utility model / industrial design / model, **in a foreign country or in a foreign or international IP authority** (other than USPTO acting as PCT RO or Hague office of indirect filing), if the invention was **made in the United States** and either (1) a US application has been on file **less than six months**, or (2) **no** US application has been filed.
- **(b)** That same license **also authorizes the export of technical data abroad** for (1) preparation, filing or possible filing, and prosecution of a **foreign** application; and (2) use of a **WIPO online service** to prepare an international application for filing with USPTO-as-RO, **without separately complying** with ITAR (22 CFR 120–130), EAR (15 CFR 730–774), or DOE 10 CFR 810.
- **(c)** If technical data “in the form of a patent application, **or in any form**,” are being exported for purposes related to preparation/filing/prosecution of a **foreign** application **without** the 5.11(a)/(b) license, **or** the invention was **not** made in the US, then **ITAR, EAR, and 10 CFR 810 must be complied with**, unless a license is not required because a US application has been on file **at least six months** without a secrecy order. “The term ‘exported’ means export as it is defined in 22 CFR part 120, 15 CFR part 734, and activities covered by 10 CFR part 810.”
- **(d)** Secrecy order under 5.2 → cannot export or file except under 5.5.
- **(e)** No 5.11(a) license needed if: invention not made in the US; **or** corresponding US application is not under secrecy order **and** was filed ≥ six months earlier; **or** certain subsequent modifications that do not change the general nature so as to trigger 35 U.S.C. 181 inspection.
- **(f)** License revocable; six-month authorization revocable by imposition of a secrecy order.

**Scope limit the USPTO keeps repeating** (*Scope of Foreign Filing Licenses*, 73 FR 42781, July 23, 2008; MPEP 140; restated 89 FR at 25613):

> A foreign filing license from the USPTO does **not** authorize the exporting of subject matter abroad **for the preparation of patent applications to be filed in the United States.** … Applicants who are considering exporting subject matter abroad for the preparation of patent applications to be filed in the United States should contact **BIS**.

So: sending drawings to an offshore illustrator to prepare **US** figures, or to a foreign-hosted CAD agent to generate **US** 1.84 sheets, is **outside** the 184/5.11 license. It is an **EAR (and possibly ITAR) question**.

### 11.2 The EAR definition of “export” — this is the real hook

**15 CFR 734.13(a)** ([LII](https://www.law.cornell.edu/cfr/text/15/734.13), retrieved 2026-08-17):

Export means, except as set forth in §§ 734.17 or 734.18:

1. An **actual shipment or transmission out of the United States**, including the sending or taking of an item out of the United States, **in any manner**;
2. **Releasing or otherwise transferring “technology” or source code (but not object code) to a foreign person in the United States** (a “deemed export”);
3. Certain spacecraft registration/control transfers.

**(b)** Any release in the United States of “technology” or source code to a foreign person is a deemed export to that person’s **most recent country of citizenship or permanent residency**.

A CAD file, a parametric model, a dimensioned drawing, or a written invention disclosure is “technology” if it is “information necessary for the ‘development,’ ‘production,’ ‘use,’ operation, installation, maintenance, repair, overhaul, or refurbishing of an item” (15 CFR 772.1 definition of technology — standard EAR definition; wording `UNVERIFIED` against a 2026-08-17 772.1 pull, but this is the long-standing definition the USPTO itself relies on at 89 FR 25613 citing 15 CFR 730–774 and 734.13(b)).

**Therefore:**

| Act | EAR characterization |
| --- | --- |
| Upload unpublished technical drawings to a CAD/AI service whose servers are **outside the US** | **Actual export** of technology (734.13(a)(1)) — “transmission out of the United States … in any manner” |
| Same upload to a **US-hosted** service whose **admins / model-trainers / support staff include foreign persons** who can access the files | **Deemed export** (734.13(a)(2), (b)) |
| Same upload to a US-hosted, US-person-only, no-training, contractual-access-controlled service | Generally **not** an export — still a 1.6 / 11.106 confidentiality question |
| Foreign person **in the US** uses the tool and the tool releases the technology to that person | Deemed export to that person’s country |

Whether a **license is required** for that export is a **classification** question (ECCN vs. EAR99; destination; end-user; end-use). Most mechanical consumer-gadget drawings are EAR99 and eligible for NLR to most destinations — **but**:

- EAR99 is **not** “no rules”: embargoed destinations, prohibited end-users, and 15 CFR 744 end-use prohibitions still apply.
- **Encryption, firearms-manufacturing files, aerospace, semiconductors, toxins, etc.** can be listed on the CCL and require a license for the same upload.
- 15 CFR 734.7(c) (amended 89 FR 34698, Apr. 30, 2024) keeps **firearm / frame / receiver production software or technology** posted on the internet in AMF/G-code **subject to the EAR** even if “published.” A CAD pipeline that emits printable gun files has a dedicated EAR trap.

**Published exception (15 CFR 734.7(a))** ([LII](https://www.law.cornell.edu/cfr/text/15/734.7), retrieved 2026-08-17): unclassified technology is “published,” and thus **not** subject to the EAR, when “made available to the public **without restrictions upon its further dissemination**,” including posting on internet sites available to the public. **This is the opposite of what a patent-figure pipeline wants.** Do not try to “EAR-sanitize” an unpublished invention by publishing it.

**Fundamental research (15 CFR 734.8)** can take university-generated technology out of the EAR. It does not cover a law firm’s client invention.

### 11.3 ITAR

**37 CFR 5.18** (indexed 2026-08-17): export of technical data relating to arms, ammunition, and implements of war is generally subject to ITAR (22 CFR 120–130; USML at part 121). **If** a patent applicant complies with the Commissioner’s 35 U.S.C. 184 regulations, **no separate State Department approval is required unless** the applicant seeks to export technical data **exceeding that used to support a patent application in a foreign country**. That ITAR exemption is **tied to foreign patent filing**, not to commercial CAD SaaS.

ITAR “export” (22 CFR 120.50 / historically 120.17) includes sending technical data outside the US **and** disclosing it to a foreign person in the US. `UNVERIFIED` against a 2026-08-17 pull of the current 120.50 wording (ITAR was reorganized in 2022); the concept is unchanged.

A design for a USML article (or ITAR technical data about one) **cannot** ride a consumer cloud CAD tool. Full ITAR program (registration, licenses, Tech Control Plan) required.

### 11.4 Putting it together — the cloud-CAD question

**Q: Is uploading an invention disclosure to a cloud CAD service an “export”?**

**A:**

1. **If the service stores or processes the file on a server outside the United States** → **Yes, it is an EAR “export”** of whatever “technology” is in the file (15 CFR 734.13(a)(1)). USPTO said so, in terms, about AI tools (89 FR at 25617). 37 CFR 5.11(c) tells you to use the EAR/ITAR definition of “exported.”

2. **If the service is US-hosted but foreign persons can access the contents** (support, labeling, model training, offshore illustrators on the backend) → **Yes, it is a deemed export** (15 CFR 734.13(a)(2), (b)). The Legal Framework PES itself treats a **non-US-citizen sponsored support person** accessing Patent Center technology as a deemed export (quoted at 89 FR 25613 n.42).

3. **Is it a 35 U.S.C. 184 violation by itself?** **Not necessarily.** Section 184 is triggered by **filing (or causing to be filed) a foreign patent application** (or the 5.11(b) export-for-foreign-filing companion). Uploading to Onshape / a foreign LLM / an offshore illustrator to make **US figures** is **not** a 184 filing. It **is** still an EAR/ITAR export, and 73 FR 42781 / MPEP 140 say the 184 license **does not cover it**.

4. **Does a six-month-old US application without a secrecy order save you?** It saves you from the **5.11(a) patent-law license** for *foreign filing* and, under 5.11(c), from having to *separately* run the 5.11 license when the export is “for purposes related to the preparation, filing or possible filing and prosecution of a **foreign** application.” It does **not**, on the face of 5.11(c), create a general EAR holiday for sending the same drawings to a commercial CAD host for **US** figure generation. BIS still owns that question.

5. **Secrecy-ordered applications (35 U.S.C. 181; 37 CFR 5.2)** are a hard stop. 5.11(d): cannot export or file except under 5.5.

**Product consequence:** default the pipeline to **US-person, US-region, no-training, no-vendor-access** processing of unpublished technical drawings. Treat any other topology as an export-controlled release that requires a classified EAR/ITAR review **and** a 1.6 informed-consent record **before** the first byte leaves the firm.

---

## 12. Public-disclosure / novelty risk — does training-on-your-data create 35 U.S.C. 102 prior art?

**Short answer:** Uploading to a service that **trains on** the data is **not automatically** a 35 U.S.C. 102(a)(1) public disclosure. It **can** become one if the trained system (or the vendor’s practices) makes the claimed invention **available to the public**. It is a **fact-specific** inquiry under MPEP 2152.02(e). The ethical/export risk is certain; the 102 risk is **contingent and currently under-litigated**. Treat it as a **do-not-roll-the-dice** engineering constraint, not as a holding that “training = printed publication.”

### 12.1 The statute

**35 U.S.C. 102(a)(1)** ([LII](https://www.law.cornell.edu/uscode/text/35/102), retrieved 2026-08-17):

> A person shall be entitled to a patent unless — (1) the claimed invention was patented, described in a printed publication, or in public use, on sale, or **otherwise available to the public** before the effective filing date of the claimed invention.

**35 U.S.C. 102(b)(1)** grace period: a disclosure **1 year or less** before the effective filing date is not (a)(1) prior art if it was made by the inventor / joint inventor / one who obtained it from them, **or** if the inventor had already publicly disclosed the subject matter. Grace period is **not** a plan. Foreign absolute-novelty jurisdictions (EPO, etc.) will not care about the US grace period.

### 12.2 The categories, applied to a cloud upload

**Printed publication.** Classic test: publicly accessible to those interested and ordinarily skilled, exercising reasonable diligence. *In re Hall*, 781 F.2d 897 (Fed. Cir. 1986) (single catalogued thesis); *In re Klopfenstein*, 380 F.3d 1345 (Fed. Cir. 2004) (poster at a conference, no distribution, still a printed publication); *SRI Int’l v. Internet Sec. Sys.*, 511 F.3d 1186 (Fed. Cir. 2008); *Voter Verified*, 698 F.3d 1374 (Fed. Cir. 2012); MPEP 2128, 2152.02(b), 2152.02(e). A file sitting in a vendor’s private object store, behind auth, **not indexed, not listed**, is **not** a printed publication. A file the vendor later puts in a public training-data dump, a research paper, or a publicly reachable model card **can** be.

**Public use.** AIA 102(a)(1) public use is limited to uses **available to the public** (MPEP 2152.02(c) [R-07.2022]). An inventor showing the invention to a person “under no limitation, restriction, or obligation of confidentiality” is a public use (*American Seating*, 514 F.3d 1262 (Fed. Cir. 2008), discussed in 2152.02(c)). A vendor employee who can browse customer drawings **without** a confidentiality obligation is the dangerous fact pattern.

**On sale.** *Helsinn v. Teva*, 139 S. Ct. 628 (2019): a **confidential** commercial sale still bars. MPEP 2152.02(d) [R-07.2022] adopts Helsinn for AIA 102(a)(1). Paying a cloud CAD vendor a subscription to process **your own** unpublished invention is almost certainly **not** “on sale” of the **claimed invention** — you are buying a service, not selling the invention. Do not confuse Helsinn’s secret-sale rule with SaaS Terms of Use. (If the *invention* is sold or offered for sale under NDA, Helsinn still kills you — that is a commercial-law fact, not a CAD-pipeline fact.)

**“Otherwise available to the public” — the catch-all.** MPEP 2152.02(e) [R-10.2019]: Congress added this so decision-makers can “focus on whether the disclosure was ‘available to the public,’ rather than on the means.” Examples: catalogued thesis, conference poster, laid-open application, **document electronically posted on the Internet**, non-UCC commercial transaction. “Even if a document or other disclosure is not a printed publication, or a transaction is not a sale, either may be prior art under the ‘otherwise available to the public’ provision … provided that the claimed invention is made **sufficiently available to the public**.”

### 12.3 Training-on-data: the actual analysis

Apply 2152.02(e)’s “sufficiently available to the public” test to four vendor postures:

| Vendor posture | 102(a)(1) analysis |
| --- | --- |
| **A. No-training, encrypted-at-rest, US-only, contractual confidentiality, no human review** | Not printed publication, not public use, not on sale, not “otherwise available.” Closest analog is a confidential bailment. 102 risk: **low**. 1.6 / export still need their own analysis, but they will usually clear. |
| **B. Vendor employees *may* access inputs for support/safety, under an NDA** | Public-use cases turn on whether the viewer is under an **obligation of confidentiality**. A real, enforced NDA typically **defeats** public use / “available to the public.” 102 risk: **low-to-moderate** (depends on NDA quality, actual access logs, subcontractor chain). Ethical risk remains (1.6 cmt. [18] reasonableness). |
| **C. Inputs used to train a model that is **not** publicly queryable, and outputs are not shown to other customers** | No public accessibility. *Hall*/*Klopfenstein* do not bite. 102 risk: **low**, but residual risk if a later leak, bankruptcy sale of the corpus, or subpoena dumps the data into a public record. |
| **D. Inputs used to train a model that **is** publicly queryable, or the vendor’s ToS permit reuse / publication / “improving the service” in a way that can regurgitate customer content to other users** | This is the 102 problem. If another member of the interested public can, with reasonable diligence, cause the model (or a subsequent public dataset) to emit the claimed invention’s enabling disclosure, MPEP 2152.02(e) + *Voter Verified* / *SRI* internet-accessibility case law supply the argument that the invention was “otherwise available to the public.” **No Federal Circuit case has decided this exact fact pattern as of 2026-08-17** (`UNVERIFIED` absence of a on-point holding; none located). Formal Op. 512’s description of self-learning tools leaking Client A into Client B’s output is the **ethical** statement of the same mechanism. |

**Do not rely on the one-year grace period** as the product’s safety net. (b)(1) is US-only, claim-by-claim, and factually messy (what exactly was “disclosed”? did a third-party model output count as an inventor-originated disclosure?). EPO/absolute-novelty filings die on day one.

**USPTO’s own position** (89 FR at 25617) is that these uploads are an **inadvertent disclosure / export / national-security** problem. The Office did **not** say they are *per se* 102 prior art. That silence is not comfort; it is a gap. The conservative engineering rule is: **never put unpublished claimed subject matter into posture D; treat posture B/C as a human-gated exception with a recorded 1.6 consent and a reviewed ToS; default to posture A.**

### 12.4 35 U.S.C. 122 is not a safe harbor for vendor uploads

35 U.S.C. 122(a) keeps **USPTO-held** applications confidential until 122(b) publication (~18 months) or abandonment-without-publication. That duty binds **the Office**, not a CAD vendor. Uploading to a vendor waives nothing at the USPTO and gains nothing from § 122.

---

# ENGINEER CHECKLIST

One page. Implement this.

## Hard rules the software must enforce

**Drawing geometry / sheet**

1. Sheet size ∈ {A4 210×297 mm, Letter 216×279 mm}; **one size per application**; PCT package forced to A4 (1.84(f); PCT Rule 11.5).
2. Margins ≥ 25 / 25 / 15 / 10 mm (T/L/R/B); **no frame** around the sight; content inside the 1.84(g) sight (A4 ≤ 170×262 mm; Letter ≤ 176×244 mm).
3. One side only; no holes (1.84(e), (x)).
4. All figures of one application on drawing sheets only — never on spec/claims/abstract sheets (1.84(h)).
5. View IDs: `FIG. n` in consecutive Arabic numerals, independent of sheet numbers; single-view application emits **neither** `FIG.` nor a number (1.84(u)). Partial views that compose one view: `FIG. nA`, `FIG. nB`.
6. Sheet numbers in-sight, top-center, format `k/N`, larger than reference characters (1.84(t)). PCT package may use Rule 11.7 top-or-bottom centering instead.
7. Reference-character height ≥ 3.2 mm at print size; never encircled / bracketed / in inverted commas (1.84(p)(1), (p)(3)).
8. Numeral bijection: `in_drawings == in_spec`; same part → same number in every view; no reuse (1.84(p)(4)–(5); PCT 11.13(l)–(m)).
9. Lead lines do not cross; every off-surface numeral has a lead line; on-surface numerals are underlined with a hatch/shade gap (1.84(q)).
10. No projection lines, no center lines, no numeric scale callouts (1.84(h), (j), (k)).
11. No solid-black fill except bar graphs or (petitioned) color (1.84(m)). Design: no solid-black surface shading except color black / contrast (1.152).
12. Section hatching: 45°-ish oblique parallels, broken for numerals, different angle for juxtaposed parts (1.84(h)(3); PCT 11.13(b)).
13. Utility color = petition path only; PCT color = forbidden (1.84(a)(2); PCT 11.13(a)).
14. Design: no photo+ink mix; no environmental structure in photos; no same-view full+broken alternate positions; no hidden-plane broken lines through opaque material (1.152).
15. Post-filing sheets labeled `Replacement Sheet` / `New Sheet` / `Annotated Sheet`; a replacement sheet contains **every** figure from the prior version of that sheet (1.84(c); 1.121(d)).
16. Export PDF: version 1.1–1.6, **all fonts embedded**, layers flattened, raster ≥ 300 DPI, no external deps, **≤ 25 MB/file** (Patent Center PDF Guidelines; Legal Framework PES 11 Sep 2025).
17. Claims-coverage matrix: every claimed feature has a view (1.83(a)). Fail the build if not.

**Data / identity**

18. Unpublished client technical content **never** sent to a model or host whose ToS permit training, retention-for-training, or cross-customer reuse (ABA Formal Op. 512 at 7; 89 FR at 25617).
19. Unpublished client technical content **never** sent to a server outside the United States, and never released to a non-US person, unless an EAR/ITAR classification + license/NLR decision is on file **and** a 35 U.S.C. 184 / 5.11 analysis has been recorded for any foreign-filing purpose (15 CFR 734.13; 37 CFR 5.11; 89 FR at 25617).
20. No USPTO.gov credentials stored in or used by an AI agent; AI is not a Patent Center “user” (89 FR at 25616; 37 CFR 1.4(d), 11.18).
21. Secrecy-ordered matter (37 CFR 5.2) is a hard reject — no export, no foreign host, no cloud.

## Soft rules that need a human gate

1. **Informed consent** before *any* client technical content enters a third-party tool — not a boilerplate engagement clause (Op. 512 at 7; Rule 1.6(a), (c)).
2. **ToS / DPA / residency / subprocessors / training / breach-notification** review by a lawyer + IT, recorded (Op. 512 at 7; 89 FR at 25617; Rule 1.6 cmt. [18]).
3. **Inventorship / 112 review** of AI-proposed alternate embodiments, prophetic examples, and claim/figure pairs before filing (89 FR at 25615; 1.81(d); 1.121(f)).
4. **11.18(b) reasonable inquiry** — a named natural person reviews every figure, every citation, every factual assertion the tool emitted. The software can *present* a review checklist; it cannot *satisfy* 11.18.
5. **Color / photograph / petition** decisions (1.84(a)(2), (b)).
6. **Design broken-line claim-scope** language and *Owens* written-description analysis for any added boundary (MPEP 1503.02 III).
7. **EAR classification** of the technical content (EAR99 vs. CCL vs. USML) before any non-default topology is enabled.
8. **Foreign-filing license** status (no US filing; US filing < 6 months; secrecy order) before any foreign-host or foreign-filing path (35 U.S.C. 184; 5.11).
9. **Which view is the front-page figure** (1.84(j)) and whether shading/hatching conventions match the disclosed materials.
10. **New-matter** sign-off on every replacement sheet (1.121(f); 35 U.S.C. 132).
11. **Material-to-patentability** call on whether AI use itself must be disclosed under 1.56 (89 FR at 25614 n.58, read in light of the Nov 2025 inventorship rescission).

## Data-flow boundaries that must never be crossed

```
[client invention disclosure / unpublished CAD / unpublished figures / spec excerpts]
        │
        │  NEVER ──► public GAI (ChatGPT-class, any train-on-inputs default)
        │  NEVER ──► foreign-region cloud (any region ≠ US) without export sign-off
        │  NEVER ──► vendor training corpus / shared-tenant embedding store
        │  NEVER ──► offshore human illustrator / foreign-person support, for US-app prep,
        │              under a 184 license (that license does not cover this)
        │  NEVER ──► USPTO.gov credential store / Patent Center session of an AI agent
        │  NEVER ──► secrecy-ordered subject matter, anywhere off the authorized facility
        │
        ▼
[US-region, US-person, no-training, access-logged, contractually confidential processor]
        │
        ▼
[human practitioner review + 11.18 signature]
        │
        ▼
[Patent Center / PCT RO  —  1.84 / Rule 11 compliant PDF]
```

**The three crossings that destroy the client’s position if they happen:**

1. **Confidentiality crossing** — unpublished technical content into a self-learning third-party model (Rule 1.6(c) + Op. 512 at 7 + 37 CFR 11.106).
2. **Export crossing** — unpublished technical content onto a foreign server or to a foreign person (15 CFR 734.13; 37 CFR 5.11(c); 89 FR at 25617).
3. **Novelty crossing** — unpublished claimed invention made “sufficiently available to the public” via a regurgitating model, a public dataset, or a viewer under no confidentiality obligation (35 U.S.C. 102(a)(1); MPEP 2152.02(e)).

A figure pipeline that cannot prove it never makes those three crossings is not fit to sit on a patent matter.

---

## Sources

### Primary — drawing form
- 37 CFR 1.81, 1.83, 1.84, 1.85, 1.121, 1.152 — https://www.law.cornell.edu/cfr/text/37/1.84 (and sibling URLs). Retrieved 2026-08-17. eCFR 1.152 confirmed “up to date as of 8/13/2026.”
- PCT Rule 11 — https://www.wipo.int/pct/en/texts/rules/r11.html — retrieved 2026-08-17.
- MPEP 507, 608.02, 1302.05, 1503.01, 1503.02, 2152.02(c)–(e) — https://www.uspto.gov/web/offices/pac/mpep/ — retrieved 2026-08-17.
- Patent Center PDF Guidelines — https://www.uspto.gov/patents/apply/applying-online/efs-web-pdf-guidelines — retrieved 2026-08-17.
- Legal Framework for Patent Electronic System (11 Sep 2025) — https://www.uspto.gov/sites/default/files/documents/2025LegalFrameworkPES.pdf — 25 MB PDF cap.
- USPTO Utility Filing Guide (drawings) — https://www.uspto.gov/patents/basics/apply/utility-patent — retrieved 2026-08-17.
- WIPO standards index — https://www.wipo.int/en/web/standards/part_03_standards — retrieved 2026-08-17 (no ST.94; ST.91 Oct 2024; ST.96 Apr 2026; ST.26 v2.0 in force 2027-07-01).

### Primary — ethics / USPTO AI
- ABA Model Rule 1.6 + comments, Rule 1.1 cmt. [8] — americanbar.org Model Rules pages, retrieved 2026-08-17.
- ABA Formal Opinion 512 (July 29, 2024) — https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf
- 89 FR 25609 (Apr. 11, 2024) — https://www.govinfo.gov/content/pkg/FR-2024-04-11/pdf/2024-07629.pdf
- 37 CFR 11.18 — https://www.law.cornell.edu/cfr/text/37/11.18
- 89 FR 10043 (Feb. 13, 2024) inventorship guidance; rescinded by FR Doc. 2025-21457 (Nov. 28, 2025). USPTO alerts 2024-02-12 and 2025-11-26.

### Primary — export / novelty
- 35 U.S.C. 102, 184, 185 — https://www.law.cornell.edu/uscode/text/35/184 (and /102)
- 37 CFR 5.11 — https://www.law.cornell.edu/cfr/text/37/5.11
- 15 CFR 734.13 (Export), 734.7 (Published) — https://www.law.cornell.edu/cfr/text/15/734.13
- *Scope of Foreign Filing Licenses*, 73 FR 42781 (July 23, 2008); MPEP 140
- *Helsinn Healthcare S.A. v. Teva Pharms. USA, Inc.*, 139 S. Ct. 628 (2019)
- *In re Hall*, 781 F.2d 897 (Fed. Cir. 1986); *In re Klopfenstein*, 380 F.3d 1345 (Fed. Cir. 2004)
- *In re Maatita*, 900 F.3d 1369 (Fed. Cir. 2018); *In re Owens*, 710 F.3d 1362 (Fed. Cir. 2013); *In re Blum*, 374 F.2d 904 (CCPA 1967); *In re Zahn*, 617 F.2d 261 (CCPA 1980); *In re Daniels*, 144 F.3d 1452 (Fed. Cir. 1998)

### Cases / design / utility drawing doctrine cited via MPEP
- *Ex parte Asano*, 201 USPQ 315 (Bd. Pat. App. & Inter. 1978)
- *Thaler v. Vidal*, 43 F.4th 1207 (Fed. Cir. 2022)

---

*End of x8 report. Retrieval date for all live URLs: 2026-08-17 unless a publication date is given.*
