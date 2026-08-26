# LeJeune Bolt first-party site mining

Accessed 2026-08-25. This report treats LeJeune's own pages and documents as
first-party claims, not independent verification. “INFERRED” marks a proposed
data model; “UNVERIFIED” marks brief-supplied or expected facts that the public
corpus did not substantiate.

## Scope and method

The corpus covers `lejeunebolt.com`, its directly linked rental store at
`rentals.lejeunebolt.com`, and its directly linked TNA microsite at
`tightenright.com`. Enumeration used `robots.txt`, the eight sitemaps in the
sitemap index, recursive same-site link discovery, and seven first-party search
pages for named gaps. The run made 550 source URL requests: 538 returned HTTP
200 and 12 returned HTTP 404. The retained corpus has 390 page/search dumps, 148 PDF
records, and 12 records for DOCX, XLSX, DXF, and DWG attachments.
[`raw/site/INDEX.md`](raw/site/INDEX.md) lines 3–20.
The corpus location and public-repo boundary are recorded in
[`raw/README.md`](raw/README.md).

Firecrawl could not run because its local shim had no configured version, so the
authorized fallback was used: direct HTTP retrieval, sitemap/link closure,
HTML-content extraction, PDF text extraction, and office-document extraction.
All retained Markdown artifacts are below 200 KB; PDF and attachment records
carry retrieval metadata and hashes, while source binaries were inspected from
temporary storage. `explorations/lejeune-bolt-agentic-demo/research/OPPORTUNITIES.md:3-11`;
[`raw/site/INDEX.md`](raw/site/INDEX.md) lines 3–20;
[`raw/site/pdf/INDEX.md`](raw/site/pdf/INDEX.md) lines 3–14.

## 1. Company profile

- LeJeune presents itself as a structural-fastener and installation-tool
  supplier serving steel and concrete construction. Its public operating model
  combines project sales, warehousing, logistics, technical support, tool sales,
  rentals, and repair. [Homepage](https://lejeunebolt.com/), [2021 capability
  statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf),
  [repair](https://lejeunebolt.com/repair/), [rental store](https://rentals.lejeunebolt.com/).
- The current homepage identifies headquarters in Burnsville, Minnesota and a
  Western Region office/warehouse in Chino, California. A 2021 capability
  statement says the western facility was added in 2013. [Homepage](https://lejeunebolt.com/),
  [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf).
- The public history conflicts. The homepage says the company began in a small
  Burnsville warehouse in 1976; an older brochure says a small Minneapolis
  garage in 1977; the 2021 capability statement says “Founded 1977.” The start
  year and place therefore require primary-record confirmation. [Homepage](https://lejeunebolt.com/),
  [older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf),
  [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf).
- The homepage attributes the 1976 co-founding to Thomas LeJeune and Brandt
  Dahlberg. It says Dahlberg later helped bring tension-control bolts to the U.S.
  market and returned part-time in 2015 to develop project information for the
  sales team. These are useful signals that product history and sales knowledge
  are embodied in long-tenured staff. [Homepage](https://lejeunebolt.com/).
- A 2021 document reports more than 70,000 square feet of warehouse space,
  next-day or two-day service to most U.S. points, and work across the U.S.,
  Canada, South America, Mexico, and Europe. These are dated company claims, not
  confirmed current capacity. [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf).

### Published team signal

The homepage publishes two duplicated roster variants with conflicting role
titles and different warehouse names, so it is not a clean current employee
master. Across those variants, the named staff are Larry Byrd, Gabriel Conde,
David Kay, Chad Larson, Jeff Greene, Rob Bomsta, Jon Caven, Karla Berg, Lisa
Countryman, Mike Feyder, Wulfrano Lozano, Jason Martie, Jeff Nichols, Ricardo
Huerta, Andrew Johnson, Sebastian Antilla, Rick Fairman, Kelly Tobin, James
Jimenez, Anthony Galvez, Tony Chavez, Chris Arriaga, Brandon Fairman, Marlon
Salazar, and Noe Gonzalez. The functions exposed are leadership, inside sales,
account representation, market development, finance, office administration,
warehouse management, shipping/receiving, testing, tool repair, and delivery.
[Homepage](https://lejeunebolt.com/).

The biographies also disclose cross-functional work histories: purchasing,
logistics, sales, customer service, shipping/receiving, testing, tool repair,
warehouse management, operations, field training, project support, inventory
coordination, and distribution-center work. This is a strong public signal that
an internal knowledge capture should model both formal roles and the tasks a
person has performed. [Homepage](https://lejeunebolt.com/).

Jackson LeJeune is named in the internal brief but did not appear in the crawled
first-party website corpus; his relationship, role, and authority are
**UNVERIFIED** from the site. `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:9-10`;
[first-party site search for “Jackson”](https://lejeunebolt.com/?s=Jackson).

## 2. Product taxonomy as a draft ontology

The following is an **INFERRED** ontology derived from the live product and tool
pages, the 2021 capability statement, the older brochure, and the TNA technical
site. It should be seeded as claims with source and publication date, then
reconciled against inventory, supplier, certification, and order records before
an agent treats a variant as sellable. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
[tool portfolio](https://lejeunebolt.com/tool-portfolio/), [2021 capability
statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf),
[older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf),
[TNA bolts](https://www.tightenright.com/bolts/).

### Core classes and relations

| Class | Key properties | Important relations | Evidence |
| --- | --- | --- | --- |
| `ProductFamily` | family name, application, active/legacy state | has `ProductVariant`; compatible with `InstallationMethod` | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [tool portfolio](https://lejeunebolt.com/tool-portfolio/) |
| `FastenerAssembly` | specification, grade/strength group, type, diameter, length, finish, origin, head/spline form | consists of bolt, nut, washer; belongs to lot; installed by tool/method | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [TNA bolts](https://www.tightenright.com/bolts/) |
| `FastenerComponent` | component kind, material/grade, thread, dimensions, finish | member of assembly; substitutes for specified item only with approval | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf) |
| `Standard` | publisher, designation, revision, governed property/test/method | constrains product, coating, test, or installation | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [combined-method article](https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/) |
| `FinishCoating` | process, specification/class, corrosion environment, compatibility restrictions | applied to variant; paired with nut lubrication and washer | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [zinc-aluminum bulletin](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/Bulletin-on-Zinc-Aluminum-Coatings.pdf) |
| `Tool` | manufacturer, model, tool family, power source, voltage, torque/angle capacity, RPM, weight | installs compatible bolt diameter/family; accepts sockets/accessories; sale/rental/repair state | [Tool portfolio](https://lejeunebolt.com/tool-portfolio/), [rental store](https://rentals.lejeunebolt.com/) |
| `LotAndCertification` | lot number, heat/mill provenance, assembly match, test report, mechanical/physical properties | certifies assembly/variant; travels with order/shipment | [Older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf), [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf) |
| `ProjectRequirement` | project, connection/joint type, governing specification, domestic/coating rule, schedule, sequence, inspection plan | requests variants, documents, tools, services, substitutions | [TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf), [terms](https://lejeunebolt.com/terms-and-conditions/) |
| `FulfillmentUnit` | quote line, order line, keg/package, quantity, weight, sequence, delivery window, ship method, destination | reserves lots; emits confirmations, invoices, test reports | [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf), [TC keg table](https://lejeunebolt.com/lbc/wp-content/uploads/2019/08/05-009-Tension-Control-Bolt-Keg-Quantity-and-Weights.pdf) |
| `ApprovalAndTest` | approver, status, date, sample, calibrator, initial/final tension, angle, inspection result | approves substitution/repair; verifies product and installation | [TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf), [pre-installation procedure](https://www.tightenright.com/wp-content/uploads/16-140-Pre-Installation-Verification-Testing-of-ASTM-F3148-TnA-144-Assemblies.pdf) |

### Product families

| Family | Site-visible variants and standards | Ontology attributes that matter | Evidence |
| --- | --- | --- | --- |
| Tension-control assemblies | ASTM F1852/A325TC Type 1 plain, Type 1 ASTM B695 Class 55 mechanically galvanized, Type 3 weathering; ASTM F2280/A490TC Type 1 plain; domestic and import availability varies | specification, legacy/common name, type, diameter, length, finish, domestic/import, bridge/DOT use, matched bolt/nut/washer set | [Product portfolio](https://lejeunebolt.com/product-portfolio/) |
| Heavy-hex structural assemblies | ASTM F3125/A325 Types 1 and 3; ASTM F3125/A490 Type 1; plain, ASTM B695 mechanical galvanizing, ASTM F2329 hot-dip galvanizing, and ASTM F1136 zinc/aluminum variants | head form, specification/grade/type, diameter, length, coating, nut/washer compatibility, installation method | [Product portfolio](https://lejeunebolt.com/product-portfolio/) |
| TNA fixed-spline assemblies | ASTM F3148, 144 ksi, Types 1 and 3, plain or ASTM B695 Class 55 mechanical galvanizing; fixed-spline matched bolt/nut/washer assembly | patented/proprietary flag, strength group, fixed spline, diameter, length, finish, domestic melt/manufacture, snug angle, final angle, tool compatibility | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [TNA bolts](https://www.tightenright.com/bolts/), [combined-method article](https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/) |
| Nuts and washers | ASTM A563 heavy-hex nuts, including DH/DH mechanically galvanized/DH3 in the older brochure; ASTM F436 washers Types 1/3/mechanically galvanized; finished hex nuts; USS, SAE, fender, lock, and beveled washers | component kind, grade/type, thread, dimensions, finish, lubrication, compatible bolt lot | [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf), [older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf), [product portfolio](https://lejeunebolt.com/product-portfolio/) |
| Anchor bolts and threaded rod | anchor bolts/templates; custom bent anchors in ASTM A36 and F1554; threaded rod grades A, B7, 36, 55, 60, 75, and 105; stock lengths plus cut-to-length | geometry/template, grade, diameter/thread, length, bend, finish, stock/custom, cut length | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf) |
| Mechanical anchors | Wedge-Bolt, Power-Stud SD1/SD2, Lok-Bolt AS, Power-Bolt, shell-expansion, Snake+, and Drop-In systems | mechanism, base material, cracked/uncracked use, head, diameter, material/finish, ICC-ES approval | [Product portfolio](https://lejeunebolt.com/product-portfolio/) |
| Adhesive anchors | AC100+ Gold vinylester, PE1000+ epoxy, hammer capsules, dispensing tools, nozzles, screens, seal plugs, and brushes | chemistry, package/cartridge, base material, hole condition, accessory, ICC-ES approval | [Product portfolio](https://lejeunebolt.com/product-portfolio/) |
| Miscellaneous structural hardware | clevises, clevis pins, turnbuckles, SAE Grade 2/5/8 and ASTM A307/A449/A394/A354 hex bolts, Tek screws, and custom/customer-specific fasteners | component family, material/grade, standard, dimensions, finish, custom drawing/specification | [Product portfolio](https://lejeunebolt.com/product-portfolio/), [older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf) |
| Weld studs | threaded mild and stainless studs, capacitor-discharge studs, deformed-bar anchors, concrete anchors, and shear connectors under AWS D1.1 and cited ASTM material standards | stud kind, weld process, material, diameter/length, AWS/ASTM/approval basis | [Product portfolio](https://lejeunebolt.com/product-portfolio/) |
| Installation and verification tools | TNA torque-and-angle tools, electric/manual/pneumatic/cordless shear wrenches, heavy-hex nut runners, digital torque meters, Skidmore-Wilhelm calibrators/plates/bushings, sockets, extensions, batteries/chargers, torque multipliers, and rebar-tying tools | manufacturer/model, compatible bolt diameter/family, power, torque/angle range, RPM, weight, socket, accessory, calibration, sale/rental/repair eligibility | [Tool portfolio](https://lejeunebolt.com/tool-portfolio/), [shop](https://lejeunebolt.com/shop/), [Skidmore category](https://lejeunebolt.com/product-category/skidmore/) |

The site has a 2024 technical bulletin on using direct-tension indicators with
TC bolts, but the mined catalog did not establish a current DTI SKU. Model DTI
as an installation/inspection component whose `offered_for_sale` state is
**UNVERIFIED**, not as confirmed stock. [DTI bulletin](https://lejeunebolt.com/lbc/wp-content/uploads/2024/12/03-056-Using-DTIs-with-TC-Bolts.pdf),
[shop](https://lejeunebolt.com/shop/).

### Standards and controlled vocabularies

- Structural fastener and component standards named include ASTM F3125, F1852,
  F2280, F3148, A325, A490, A307, A449, A394, A354, A563, F436, F1554, A36,
  A668, A108, A493, and A496. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
  [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf).
- Coating/process standards named include ASTM B695 Class 55 mechanical
  galvanizing, ASTM F2329 hot-dip galvanizing, and ASTM F1136 zinc/aluminum;
  plain, electro-zinc, Dacromet, Geomet, stainless, and weathering variants also
  appear. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
  [zinc-aluminum bulletin](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/Bulletin-on-Zinc-Aluminum-Coatings.pdf),
  [Gerald Desmond Bridge](https://lejeunebolt.com/portfolio-items/gerald-desmond-bridge/).
- Installation/design authorities named include AISC, RCSC, AWS D1.1, AASHTO,
  AREMA, ICC-ES, and IBC; the older brochure additionally names DIN/ISO, JIS,
  SAE, MIL, and A325M families. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
  [older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf),
  [TNA bolts](https://www.tightenright.com/bolts/).
- The RCSC 2020 article maps strength groups 120 to F3125/A325 and F1852, 150
  to F3125/A490 and F2280, and 144 to F3148 TNA, and says the Combined Method
  became the fifth recognized installation method. [Combined-method article](https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/).

## 3. Service and process signals

| Process | First-party signal | Agent/graph implication |
| --- | --- | --- |
| Product sourcing | The company describes broad manufacturer partnerships; project pages describe qualified-supplier coordination for special F1852 Type 3 mechanical-galvanized and A490 Type 3 Geomet material. [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf), [Gerald Desmond Bridge](https://lejeunebolt.com/portfolio-items/gerald-desmond-bridge/) | Model approved supplier, manufacturer, promised lead time, product/finish capability, qualification evidence, and substitution approval separately. |
| Quote and contract review | Published terms say quotations are valid for 14 days unless otherwise stated; custom packaging must be specified; buyer drawings/specifications affect responsibility; custom orders have restricted cancellation/return terms. [Terms](https://lejeunebolt.com/terms-and-conditions/) | Quote facts need effective dates, exceptions, customer drawings, approvals, and policy snapshots rather than free-text memory alone. |
| Project management | The capability statement calls out complex project management and accurate order fulfillment; project cases show fabricator/erector coordination and constrained schedules. [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf), [Boeing 777X](https://lejeunebolt.com/portfolio-items/boeing-777x-wing-factory/) | Relate owner, GC, fabricator, erector, supplier, project, connection package, milestone, and responsible person. |
| Sequencing and kitting | LeJeune advertises sequence packaging and JIT delivery; cases describe gang boxes and no-laydown pick-and-lift delivery. “Kitting” is an **INFERRED** label for this disclosed sequencing behavior. [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf), [110 North Wacker](https://lejeunebolt.com/portfolio-items/110-north-wacker/), [Wilshire Grand](https://lejeunebolt.com/portfolio-items/wilshire-grand-center/) | Preserve sequence/package identifiers, destination floor/zone, release date, contents, lot integrity, and delivery window. |
| Shipping and delivery | Disclosed modes include parcel, LTL, truckload, flatbed, will-call, and company truck; cases add crane-direct delivery, secure-site preclearance, and timed delivery windows. [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf), [Hyatt Center](https://lejeunebolt.com/portfolio-items/hyatt-center-71-south-wacker/), [American Airlines Hangar](https://lejeunebolt.com/portfolio-items/american-airlines-hanger-2-ohare/) | A delivery agent needs explicit ship method, carrier/driver clearance, appointment, site constraint, proof of delivery, and exception approval. |
| Quality and certification | The older brochure claims steel-mill traceability, lot integrity, sampling/inspection, product certification, and rotational-capacity testing; the 2021 statement says electronic test reports are standard. [Older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf), [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf) | Treat lot, heat, mill, assembly match, test, certificate, inspection, and customer document delivery as first-class provenance nodes. |
| Tool rental | Rental is a recurring 30-day cycle; the user chooses a tool/socket configuration and delivery schedule, pays by major credit card, and receives credit for the unused portion of the current cycle after return. [Rental store](https://rentals.lejeunebolt.com/) | Model rental asset/model, socket compatibility, ship/return timestamps, recurring cycle, condition, payment state, and credit. |
| Tool repair | Intake captures up to ten model/serial pairs and diagnostic details; technicians diagnose, estimate, wait for customer approval, repair, and return. [Repair](https://lejeunebolt.com/repair/) | This is an explicit approval workflow: intake → diagnosis → estimate → authorization → work → return. |
| Field support and training | TNA support covers inspection, pre-installation verification, installation training, technical support, and field/shop/mobile-unit delivery. [TNA support](https://www.tightenright.com/on-site-support-training-144/) | Store training event, project/site, participants, product/tool, procedure revision, test evidence, trainer, and follow-up. |
| Installation and inspection | TNA uses controlled snug torque followed by a specified angle; tool feedback and visual/match-marking checks support inspection. [TNA system](https://www.tightenright.com/system/), [pre-installation procedure](https://www.tightenright.com/wp-content/uploads/16-140-Pre-Installation-Verification-Testing-of-ASTM-F3148-TnA-144-Assemblies.pdf) | Separate prescribed procedure, tool setting, sample/test result, observed installation, and approval; never let an agent infer acceptance from product identity alone. |

### Markets served

The site's portfolio taxonomy is bridges, commercial, government/municipal, and
industrial. The individual cases extend that evidence to stadiums and sports
facilities, rail and transportation, airports/aviation, power and energy,
healthcare, civic buildings and convention centers, manufacturing/OEM, offices,
residential/senior living, and large commercial towers. [Project portfolio](https://lejeunebolt.com/project-portfolio/),
[TNA projects](https://www.tightenright.com/projects/).

The customer roles named by the product and project material are steel
fabricators, erectors, general contractors, OEMs, owners, architects/engineers,
and government or transportation authorities. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
[TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf),
[Lock and Dam 17](https://www.tightenright.com/portfolio-items/lock-and-dam-17/).

## 4. Named projects and clients

### Main LeJeune portfolio: all 38 discovered case pages

Each row is a first-party “supplied/supported” project claim; it does not prove
contract value, exact scope, or the identity of every contracting party.
[Project portfolio](https://lejeunebolt.com/project-portfolio/).

| Project or client named | Disclosed signal | First-party case |
| --- | --- | --- |
| 110 North Wacker | JIT delivery and sequence packing for a no-laydown urban site | [Case](https://lejeunebolt.com/portfolio-items/110-north-wacker/) |
| 333 North Green Street | Listed commercial project | [Case](https://lejeunebolt.com/portfolio-items/template-2/) |
| American Airlines Hangar 2, O'Hare | Long 1-1/8-inch F2280 TC bolts, multiple truckloads, secure-site clearance, timed delivery | [Case](https://lejeunebolt.com/portfolio-items/american-airlines-hanger-2-ohare/) |
| Audi Field / D.C. United | Nationwide logistics and project-management example | [Case](https://lejeunebolt.com/portfolio-items/audi-field-dc-united/) |
| Banc of California Stadium / LAFC | Stadium supply and expedited/on-time delivery example | [Case](https://lejeunebolt.com/portfolio-items/bank-of-california-stadium/) |
| Boeing 777X Wing Factory | Chino-led sequences, demanding schedule, fabricator/erector coordination | [Case](https://lejeunebolt.com/portfolio-items/boeing-777x-wing-factory/) |
| Caesars Forum | Listed convention/commercial project | [Case](https://lejeunebolt.com/portfolio-items/caesars-forum/) |
| Denver Art Museum | Listed civic/commercial project | [Case](https://lejeunebolt.com/portfolio-items/denver-art-museum/) |
| Digi-Key Manufacturing | Listed industrial/manufacturing project | [Case](https://lejeunebolt.com/portfolio-items/digikey/) |
| Dignity Health Hospital | Listed healthcare project | [Case](https://lejeunebolt.com/portfolio-items/dignity-health/) |
| General Motors Parma | TNA used in a time-critical crane-rail retrofit | [Case](https://lejeunebolt.com/portfolio-items/general-motors/) |
| Gerald Desmond Bridge | Special F1852 Type 3 mechanical-galvanized and A490 Type 3 Geomet sourcing/logistics | [Case](https://lejeunebolt.com/portfolio-items/gerald-desmond-bridge/) |
| Halas Hall / Chicago Bears | Listed sports/training facility | [Case](https://lejeunebolt.com/portfolio-items/halas-hall-chicago-bears/) |
| Hard Rock Stadium Canopy | Special long A490/F1136 and F1852 mechanical-galvanized TC supply with partner coordination | [Case](https://lejeunebolt.com/portfolio-items/hard-rock-stadium-canopy/) |
| Honolulu Rail | Temporary truss splice use and single-sided TNA installation/removal | [Case](https://lejeunebolt.com/portfolio-items/honolulu-rail-2/) |
| Hyatt Center / 71 South Wacker | Full-load JIT flatbed delivery directly to crane | [Case](https://lejeunebolt.com/portfolio-items/hyatt-center-71-south-wacker/) |
| Johnson Street Bridge | TNA selected for single-sided, angle-based bridge installation in Canada | [Case](https://lejeunebolt.com/portfolio-items/johnson_street_bridge/) |
| Kansas City Southern / Redlands Bridge | Rivet replacement, confined access, non-impact installation, shutdown deadline | [Case](https://lejeunebolt.com/portfolio-items/kc-railways/) |
| LAX Midfield Terminal | Listed airport/transportation project | [Case](https://lejeunebolt.com/portfolio-items/lax-midfield-terminal/) |
| Lackawanna Energy Center | Listed energy/industrial project | [Case](https://lejeunebolt.com/portfolio-items/lackawanna-energy-center/) |
| Laramie River Station | Listed power/industrial project | [Case](https://lejeunebolt.com/portfolio-items/laramie-river-station/) |
| Las Vegas Convention Center | Listed convention/commercial project | [Case](https://lejeunebolt.com/portfolio-items/las-vegas-convention-center/) |
| Lifetime Fitness, Edina | Listed commercial/fitness project | [Case](https://lejeunebolt.com/portfolio-items/lifetime-fitness/) |
| Loma Linda Medical Center | Listed healthcare project | [Case](https://lejeunebolt.com/portfolio-items/loma-linda-medical-center/) |
| Main Street Bridge | Listed bridge project | [Case](https://lejeunebolt.com/portfolio-items/main-street-bridge/) |
| Memorial Stadium / Mizzou | Listed stadium project | [Case](https://lejeunebolt.com/portfolio-items/memorial-stadium/) |
| Northwestern Mutual Tower | Listed commercial tower | [Case](https://lejeunebolt.com/portfolio-items/northwestern-mutual-tower/) |
| OATI South Campus Microgrid | Mechanically galvanized F3148 TNA for exposed renewable-energy steel | [Case](https://lejeunebolt.com/portfolio-items/oati-microgrid/) |
| OPPD Power Plant | Mechanically galvanized A325 hex bolts and rotational-capacity testing | [Case](https://lejeunebolt.com/portfolio-items/oppd-power-plant/) |
| San Francisco–Oakland Bay Bridge SAS span | A490 Geomet development, testing, production, and inspection | [Case](https://lejeunebolt.com/portfolio-items/sas-bridge/) |
| SoFi Stadium | Listed stadium project | [Case](https://lejeunebolt.com/portfolio-items/sofi-stadium/) |
| Thrivent headquarters | Listed corporate-headquarters project | [Case](https://lejeunebolt.com/portfolio-items/thrivent/) |
| Trinity Health | Listed healthcare project | [Case](https://lejeunebolt.com/portfolio-items/trinity-health/) |
| U.S. Bank Stadium | LeJeune says it supplied and supported steel construction and erection | [Case](https://lejeunebolt.com/portfolio-items/us-bank-stadium/) |
| Vikings TCO Performance Center | Follow-on Minnesota Vikings headquarters/training facility | [Case](https://lejeunebolt.com/portfolio-items/vikings-tco-performance-center/) |
| Washington State Convention Center | Technical support and on-time structural-product delivery claim | [Case](https://lejeunebolt.com/portfolio-items/washington-state-cc/) |
| Will County Courthouse | LeJeune claims exclusive supply of the steel-connection products | [Case](https://lejeunebolt.com/portfolio-items/will-county-courthouse/) |
| Wilshire Grand Center | Gang-box sequencing, Chino will-call/truck delivery, JIT pick-and-lift | [Case](https://lejeunebolt.com/portfolio-items/wilshire-grand-center/) |

### Additional TNA microsite cases

The TNA microsite repeats General Motors, Honolulu Rail, Johnson Street Bridge,
Kansas City Southern, and OATI; seven additional named portfolio pages were found.
[TNA projects](https://www.tightenright.com/projects/).

| Additional case | Disclosed signal | First-party case |
| --- | --- | --- |
| Allegro Senior Living | Fabricator/erector moved from hex bolting to TNA | [Case](https://www.tightenright.com/portfolio-items/allegro-senior-living/) |
| Cooling Platform | Application-specific move from hex bolting to ASTM F3148/TNA | [Case](https://www.tightenright.com/portfolio-items/cooling-platform/) |
| Lock and Dam 17 | U.S. Army Corps of Engineers maintenance use; confined-space, noise, and removal concerns | [Case](https://www.tightenright.com/portfolio-items/lock-and-dam-17/) |
| Mercy Health | Delayed pretensioning after an extended snug-tight period | [Case](https://www.tightenright.com/portfolio-items/mercy-health/) |
| Parry Bridge rehabilitation | Round-head/rivet appearance and Canadian angle-method constraints | [Case](https://www.tightenright.com/portfolio-items/parry-bridge-rehabilitation/) |
| Umauma Stream Bridge | Clean-Lube S3 nut option for topcoat contamination concerns | [Case](https://www.tightenright.com/portfolio-items/umauma-stream-bridge/) |
| Unytite manufacturing plant | Manufacturing partner and first-use project; snug-tight and pretensioned connections | [Case](https://www.tightenright.com/portfolio-items/unytite-manufacturing-plant/) |

The microsite also names BlueScope Buildings and Phalen Steel on the first TNA
project, Unytite as a TNA manufacturing partner, General Motors as a user,
CoreBrace in buckling-restrained-brace testing, SidePlate Systems in a design
approval, and Boulons Plus/Precision Bolt as the announced Canadian distributor.
[First TNA project](https://www.tightenright.com/first-tna-project/),
[Unytite case](https://www.tightenright.com/portfolio-items/unytite-manufacturing-plant/),
[General Motors case](https://www.tightenright.com/portfolio-items/general-motors/),
[CoreBrace](https://lejeunebolt.com/corebrace-uses-tna-bolts-for-brb-brace-testing/),
[SidePlate](https://lejeunebolt.com/sideplate-plus-approval/),
[Boulons Plus announcement](https://www.tightenright.com/boulons-plus-canadian-distributor/).

U.S. Bank Stadium is site-verified. The internal brief's Mystic Lake
Amphitheater and NASA claims are **UNVERIFIED** by this corpus: neither appears
in the mapped portfolio, sitemap/link closure, or the corresponding first-party
site-search result. `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:16-24`;
[U.S. Bank case](https://lejeunebolt.com/portfolio-items/us-bank-stadium/),
[Mystic Lake search](https://lejeunebolt.com/?s=Mystic+Lake),
[NASA search](https://lejeunebolt.com/?s=NASA).

## 5. Intake data model inferred from forms

### Observed forms and documents

| Intake surface | Observed fields or choices | Process meaning | Source |
| --- | --- | --- | --- |
| General contact | Required first name, last name, email, phone, and state/province; optional subject and message | A lead/contact envelope, not a structured fastener RFQ | [Contact form](https://lejeunebolt.com/contact-us/) |
| Repair intake | Tool count from 1–10; model and serial for each tool; diagnostic details; Burnsville or Chino service center; primary contact; optional alternate estimate recipient; billing-contact choice and address; shipping-contact/address choice; comments | Asset-level intake with conditional parties and a separate estimate/approval workflow | [Repair form](https://lejeunebolt.com/repair/) |
| TNA product submittal | Recipient, project, specified item, product submitted or requested as substitution; submitter name/company/address/phone/fax/email/date; architect/engineer decision, remarks, signer, and decision date | Formal specification/substitution record with explicit technical approval | [TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf) |
| Webinar request | Company, attendee name/email, attendee count, three preferred dates/times, previous-webinar/trade-show questions, and comments; a Calendly path is also offered | Technical-sales/training intake and scheduling | [Webinar form](https://www.tightenright.com/attend-a-webinar/) |
| Credit application | Company and mail/ship addresses; business classification; ownership form and establishment date; tax ID and principals; bank data; three trade references; authorizer/title/contact/date | Account onboarding and credit approval, containing restricted financial and identity data | [Credit application](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/creditapplication.docx) |
| F3148 verification worksheet | Diameter, length, finish, angle buckets, and initial/final values in a worksheet template | Product/test configuration linked to pre-installation verification evidence | [Verification worksheet](https://www.tightenright.com/wp-content/uploads/11-108-F3148-Pre-Installation-Verification-Worksheet.xlsx) |
| Rental selection | Tool and socket configuration, delivery schedule, cart, major-credit-card payment, recurring rental cycle, return, and unused-cycle credit | Asset/configuration order with shipment and recurring billing state | [Rental store](https://rentals.lejeunebolt.com/) |

No structured bolt quote/RFQ form was found. The general contact form does not
ask for specification, grade, type, diameter, length, finish, quantity, domestic
requirement, project, delivery need, lot/certification requirement, or
substitution permission. Those quote-critical fields are therefore a public-site
gap, not evidence that LeJeune omits them from its internal process. [Contact
form](https://lejeunebolt.com/contact-us/), [product portfolio](https://lejeunebolt.com/product-portfolio/),
[terms](https://lejeunebolt.com/terms-and-conditions/).

### Draft canonical intake model

This **INFERRED** model combines the public forms with the attributes and
approval states disclosed elsewhere on the site. It is a candidate schema for
office-data ingestion, not a claim about LeJeune's current database. [Contact
form](https://lejeunebolt.com/contact-us/), [repair form](https://lejeunebolt.com/repair/),
[TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf),
[terms](https://lejeunebolt.com/terms-and-conditions/).

| Entity | Proposed fields |
| --- | --- |
| `Organization` | legal/display name, business classification, ownership/account state, billing terms, tax-exempt/domestic/compliance profile, approved contacts |
| `PersonRole` | person, organization, project/account role, email/phone, authority scope, preferred channel |
| `Project` | name, location, owner, GC, fabricator, erector, engineer, governing authorities, bid/job number, schedule, site constraints |
| `RFQ` | request id/date/channel, customer/project, due date, requester, estimator/approver, source message/document, status |
| `RFQLine` | product family, specification/revision, strength/grade/type, diameter, length, thread, finish/coating/class, quantity/UOM, origin rule, packaging/sequence, requested delivery, acceptable substitute |
| `ComplianceRequirement` | domestic/Buy America/Buy American/DFARS wording, governing clause, mill/heat origin, test/cert package, special inspection, approved manufacturer/supplier |
| `QuoteLine` | selected SKU/variant, manufacturer/supplier, cost and sell basis, lead time, stock/reservation, freight, packaging, validity, exclusions, substitution status, source evidence |
| `LotCertification` | assembly/lot/heat/mill identifiers, matched components, mechanical/physical tests, coating/lubrication tests, rotational-capacity result, certificate/test-report document |
| `Approval` | subject, requested-by, approver/authority, decision, conditions/remarks, timestamp, supporting document, superseded decision |
| `Fulfillment` | order/release, sequence/package/keg, lots allocated, ship method, carrier, clearance/appointment, destination/zone, promised/actual dates, proof/exception |
| `ToolAssetOrRental` | manufacturer/model/serial, compatible fastener, socket/accessories, calibration, condition, repair diagnosis/estimate/authorization, rental cycle and return |

The credit application contains bank, tax, principal, and trade-reference data;
those fields should be excluded from a general agent-memory index and placed
behind finance-specific access controls if office ingestion includes the form.
This is a risk inference from the document's field set. [Credit application](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/creditapplication.docx).

## 6. Systems, suppliers, and named vendors

### Product, manufacturing, and engineering ecosystem

| Name | Relationship stated or evidenced on the site | Source |
| --- | --- | --- |
| TONE | LeJeune says it is the largest North American supplier of TONE installation tools; TONE models dominate the tool/rental catalog | [Homepage](https://lejeunebolt.com/), [tool portfolio](https://lejeunebolt.com/tool-portfolio/), [rental store](https://rentals.lejeunebolt.com/) |
| Powers Fasteners | Product page presents Powers anchoring systems and calls LeJeune an exclusive supplier; the page contains dated code references, so current exclusivity is **UNVERIFIED** | [Product portfolio](https://lejeunebolt.com/product-portfolio/) |
| Makita | Named cordless shear-wrench offering and manuals | [Tool portfolio](https://lejeunebolt.com/tool-portfolio/) |
| Metabo HPT | Batteries, chargers, and AC adapters sold with or alongside current cordless TONE tools | [Cordless nut runner](https://lejeunebolt.com/product/cnr50-uc-cordless-nut-runner/), [Metabo battery](https://lejeunebolt.com/product/metabo-36v-4-0-ah-18v-8-0-ah-li-ion-battery/) |
| DeWalt | Named SDS MAX carbide-bit SKU | [DeWalt bit](https://lejeunebolt.com/product/dewalt-sds-max-carbide-bit-3-4-x-13/) |
| Skidmore-Wilhelm | Tension calibrator, plates, bushings, and spacer products; TNA procedure requires annual calibration by Skidmore-Wilhelm or another NIST-accredited agency | [Skidmore category](https://lejeunebolt.com/product-category/skidmore/), [TNA submittal form](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf) |
| SURSPIDER | Rebar-tying tools and tie wire in the shop | [ZKZ-40A kit](https://lejeunebolt.com/product/surspider-zkz-40a-tie-wire-tool-kit/), [tie wire](https://lejeunebolt.com/product/surspider-tie-wire/) |
| Unytite | Identified as LeJeune's TNA assembly manufacturing partner and an early user | [Unytite case](https://www.tightenright.com/portfolio-items/unytite-manufacturing-plant/) |
| Boulons Plus / Precision Bolt | Announced in 2018 as the exclusive Canadian TNA distributor, with Precision Bolt identified as its subsidiary; current status is **UNVERIFIED** | [Announcement](https://www.tightenright.com/boulons-plus-canadian-distributor/) |
| SidePlate Systems | TNA was announced as approved for SidePlate Plus applications | [SidePlate article](https://lejeunebolt.com/sideplate-plus-approval/) |
| CoreBrace | TNA bolts were used in buckling-restrained-brace testing at UC San Diego | [CoreBrace article](https://lejeunebolt.com/corebrace-uses-tna-bolts-for-brb-brace-testing/) |

The site also names Geomet and Dacromet finishes, but the corpus does not establish
which coating licensee, applicator, or commercial supplier fulfilled a given
order. They should be modeled as coating/trade-name values until purchase and
supplier records establish the vendor relation. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
[Gerald Desmond Bridge](https://lejeunebolt.com/portfolio-items/gerald-desmond-bridge/).

### Public web and scheduling systems

The public HTML identifies WordPress, WooCommerce, and Avada/Fusion as the web
publishing and storefront stack. The contact page links ProvideSupport live chat,
and the TNA webinar page links Calendly. These are public-channel systems, not
evidence of the internal ERP, inventory, pricing, or order system. [Shop](https://lejeunebolt.com/shop/),
[contact](https://lejeunebolt.com/contact-us/), [webinar](https://www.tightenright.com/attend-a-webinar/).

The internal brief says Microsoft Office is the system of record, but the public
site search returned no Microsoft Office result. M365/Office as the operational
system of record is therefore **UNVERIFIED by the site** and should be confirmed
in discovery. `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:57-58`;
[Microsoft Office search](https://lejeunebolt.com/?s=Microsoft+Office).

No careers page, job description, ERP name, customer portal, procurement portal,
warehouse-management system, EDI platform, CRM, or document-management product
was identified in the first-party corpus. The careers search returned no result;
absence from the public site is not evidence that those systems do not exist.
[Careers search](https://lejeunebolt.com/?s=careers), [raw corpus index](raw/site/INDEX.md).

## 7. Certifications and compliance posture

- The live product page says the quality program is “designed on ISO
  requirements.” The older brochure says LeJeune follows internal requirements
  based on ISO guidelines and required key suppliers to maintain ISO-9000,
  QS-9000, NVLAP, A2LA, or other recognized standards. Neither statement proves
  that LeJeune itself holds a current ISO certificate. ISO certification is
  **UNVERIFIED**. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
  [older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf).
- The older brochure claims full product traceability to the steel mill, lot
  integrity, pre-shipment sampling/inspection, and a product certificate; the
  2021 statement adds electronic test reports. The site search for the literal
  phrase “mill certificates” returned no result, so the exact mill-cert format,
  retention, and customer-delivery workflow remain **UNVERIFIED**. [Older
  brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf),
  [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf),
  [mill-certificate search](https://lejeunebolt.com/?s=mill+certificates).
- LeJeune states that all ASTM F3148 fixed-spline TNA assemblies are 100% melted
  and manufactured in the United States; other product families separately show
  domestic-only or domestic-and-import availability. This is product-origin
  evidence, not by itself proof of DFARS, Buy American, or project-specific Buy
  America compliance. [TNA domestic FAQ](https://lejeunebolt.com/faq-items/domestic/),
  [TNA bolts](https://www.tightenright.com/bolts/), [product portfolio](https://lejeunebolt.com/product-portfolio/).
- No DFARS or Buy American claim/certificate was found; both first-party site
  searches returned no result. Their compliance status is **UNVERIFIED**, not
  negative. [DFARS search](https://lejeunebolt.com/?s=DFARS), [Buy American
  search](https://lejeunebolt.com/?s=Buy+American).
- The 2021 capability statement lists dated memberships in AGC Minnesota, SEAA,
  and AISC. Membership is not certification, and current membership status was
  not verified. [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf).
- The site publishes technical approval signals for ASTM F3148, the RCSC 2020
  Combined Method, and SidePlate Plus. Those approvals apply to the product or
  installation/design method described, not to the company as a general-purpose
  certifying body. [F3148 article](https://lejeunebolt.com/astm-f3148-standard-specification-for-tna/),
  [combined-method article](https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/),
  [SidePlate article](https://lejeunebolt.com/sideplate-plus-approval/).

## 8. News, technical library, and PDFs

The main news surface contains ASTM F3148, CoreBrace testing, temporary bolting,
RCSC Combined Method, SidePlate approval, and a COVID-19 update. The TNA
microsite adds product, project, distributor, webinar, trade-show, and award
posts. [Main news](https://lejeunebolt.com/news/), [TNA news](https://www.tightenright.com/tna-news/).

The PDF crawl discovered 148 URLs. It successfully downloaded and extracted
text from 146; two linked TightenRight PDFs returned HTTP 404. The collection
includes company/terms material, product bulletins, size and keg tables, TNA
submittal/testing/installation documents, and extensive tool specifications,
manuals, schematics, and parts diagrams. [`raw/site/pdf/INDEX.md`](raw/site/pdf/INDEX.md)
lines 3–13.

| Document | What it contributes | Source |
| --- | --- | --- |
| 2021 capability statement | Dated company profile, capacity, products, fulfillment, competencies, geography, memberships, projects | [PDF](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf) |
| Older company brochure | Legacy history, expanded product families, standards, ISO-based QA, traceability, certification, logistics, testing, rental, and repair claims | [PDF](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf) |
| Terms and conditions | Quote, packaging, delivery, warranty/claims, return authorization, payment, cancellation, and custom-specification rules | [PDF](https://lejeunebolt.com/lbc/wp-content/uploads/2020/11/03-007-Terms-and-Conditions-of-Sale-LeJeune.pdf) |
| TNA submittal form | Product/substitution request and architect/engineer approval model, plus technical procedure content | [PDF](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf) |
| F3148 pre-installation procedure | Verification procedure and evidence model | [PDF](https://www.tightenright.com/wp-content/uploads/16-140-Pre-Installation-Verification-Testing-of-ASTM-F3148-TnA-144-Assemblies.pdf) |
| F3148 installation procedure | Formal installation workflow | [PDF](https://www.tightenright.com/wp-content/uploads/16-141-ASTM-F3148-TnA-144-Torque-and-Angle-Installation-Procedure.pdf) |
| Final TNA testing report | 252-page technical testing record | [PDF](https://www.tightenright.com/wp-content/uploads/20170523-Final-Report-on-TnA144-Testing.pdf) |
| DTI with TC bolts | 2024 guidance on an inspection/installation accessory not established as a catalog SKU | [PDF](https://lejeunebolt.com/lbc/wp-content/uploads/2024/12/03-056-Using-DTIs-with-TC-Bolts.pdf) |
| TC and TNA keg tables | Diameter/length packaging quantities and weights | [TC PDF](https://lejeunebolt.com/lbc/wp-content/uploads/2019/08/05-009-Tension-Control-Bolt-Keg-Quantity-and-Weights.pdf), [TNA PDF](https://www.tightenright.com/wp-content/uploads/05-024-F3148-TnA-144-Keg-Quantity-and-Weights.pdf) |
| Zinc-aluminum coating bulletin | Coating/application guidance and named coating families | [PDF](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/Bulletin-on-Zinc-Aluminum-Coatings.pdf) |
| F3148 drawings and verification worksheet | CAD dimensions plus a structured diameter/length/finish/angle/tension template | [Attachment index](raw/site/attachments/INDEX.md), [XLSX](https://www.tightenright.com/wp-content/uploads/11-108-F3148-Pre-Installation-Verification-Worksheet.xlsx) |

The non-retrievable PDF links were `03-104-Reuse-of-F3148-Assemblies.pdf` and
`TNA-144-Drawings-Merged-1.pdf`; their titles suggest useful subjects, but their
contents are **UNVERIFIED** because the server returned 404. [PDF corpus
index](raw/site/pdf/INDEX.md).

## 9. What the public corpus can seed for the demo

The corpus can seed a provenance-bearing graph of product families, standards,
grades, finishes, dimensions, installation methods, compatible tools, technical
documents, project examples, organizations, services, and approval/test types.
It can also seed tentative identity resolution between common and current
designations such as A325/F3125 and F1852/A325TC, provided each mapping retains
its source and revision context. [Product portfolio](https://lejeunebolt.com/product-portfolio/),
[combined-method article](https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/),
[PDF index](raw/site/pdf/INDEX.md).

The public corpus cannot safely supply current inventory, customer-specific
pricing, costs/margins, actual supplier lead times, open quotes/orders, approved
vendor lists, current employees/authority, project-specific compliance, or the
latest certificate attached to a lot. Those require office and operational data
plus approval gates; this limitation follows from the public forms, dated
documents, and contradictory roster/history. [Contact form](https://lejeunebolt.com/contact-us/),
[homepage](https://lejeunebolt.com/), [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf),
[older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf).

## 10. Gaps and verification queue

1. **Company master:** Resolve 1976/Burnsville versus 1977/Minneapolis and the
   duplicated, contradictory staff rosters against corporate and HR records.
   [Homepage](https://lejeunebolt.com/), [older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf),
   [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf).
2. **Jackson LeJeune:** Confirm identity, role, relationship to the company, and
   approval authority; the site corpus does not name him. `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:9-10`;
   [site search](https://lejeunebolt.com/?s=Jackson).
3. **Mystic Lake and NASA:** Both remain **UNVERIFIED** from the site; obtain the
   project files, photos, customer permission, and exact LeJeune scope before a
   demo agent repeats either claim. `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:16-24`;
   [Mystic Lake search](https://lejeunebolt.com/?s=Mystic+Lake), [NASA search](https://lejeunebolt.com/?s=NASA).
4. **RFQ schema:** Find real quote request emails, spreadsheets, takeoffs, and
   line-item templates; the public contact form is not a bolt RFQ. [Contact](https://lejeunebolt.com/contact-us/).
5. **Product and inventory master:** Reconcile site families and shop SKUs with
   active/inactive status, stocked dimensions, manufacturer, warehouse, cost,
   sell price, lead time, substitution rules, and lot/cert availability. [Product
   portfolio](https://lejeunebolt.com/product-portfolio/), [shop](https://lejeunebolt.com/shop/).
6. **Compliance:** Obtain current ISO certificate or confirm none, quality-manual
   revision, DFARS/Buy American/Buy America decision rules, domestic definitions,
   approved mills, test-report/mill-cert examples, and retention policy. [Product
   portfolio](https://lejeunebolt.com/product-portfolio/), [DFARS search](https://lejeunebolt.com/?s=DFARS),
   [Buy American search](https://lejeunebolt.com/?s=Buy+American), [mill-cert search](https://lejeunebolt.com/?s=mill+certificates).
7. **Systems:** Validate the brief's M365 claim and identify ERP, inventory,
   accounting, CRM, e-commerce integration, shared drives/mailboxes, quoting
   spreadsheets, carrier tools, EDI, and vendor/customer portals. The site and
   careers search disclose none of these internal systems. `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:57-58`;
   [careers search](https://lejeunebolt.com/?s=careers), [Microsoft Office search](https://lejeunebolt.com/?s=Microsoft+Office).
8. **Workflow authority:** Capture who may approve price, margin, substitute,
   supplier, purchase order, credit, repair estimate, shipment exception, and
   compliance representation. The public submittal and repair flows prove that
   approval states matter but do not identify internal authority rules. [Repair](https://lejeunebolt.com/repair/),
   [TNA submittal](https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf).
9. **Project provenance:** For each public project, obtain customer/contract
   records that distinguish owner, GC, fabricator, erector, supplier, product,
   dates, quantity, value, and permission to use the name. [Project portfolio](https://lejeunebolt.com/project-portfolio/).
10. **Legacy content:** Date and supersede the older brochure, anchoring-system
    code references, manuals, price pages, distributor announcement, and staff
    bios instead of importing them as timeless truth. [Older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf),
    [product portfolio](https://lejeunebolt.com/product-portfolio/), [Boulons Plus
    announcement](https://www.tightenright.com/boulons-plus-canadian-distributor/).
11. **DTIs:** Confirm whether LeJeune stocks, sources, or only advises on direct
    tension indicators, and which variants and approved manufacturers apply.
    [DTI bulletin](https://lejeunebolt.com/lbc/wp-content/uploads/2024/12/03-056-Using-DTIs-with-TC-Bolts.pdf),
    [shop](https://lejeunebolt.com/shop/).
12. **Sensitive-data boundary:** Keep credit, tax, bank, principals, and trade
    references outside general agent memory; define field-level access and audit
    controls before ingestion. [Credit application](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/creditapplication.docx).

## Sources

All web sources below are first-party LeJeune Bolt, LeJeune Rental, or
TightenRight pages/documents and were accessed 2026-08-25. No web-source license
was evaluated; the repository rows identify their provenance separately.

| URL or repository path | What it evidenced | Access date | License if repo |
| --- | --- | --- | --- |
| `explorations/lejeune-bolt-agentic-demo/CAPTURE.md:9-10,16-24,57-58` | Brief-only Jackson, Mystic Lake, NASA, and Microsoft Office assertions | 2026-08-25 | Repository artifact; license not stated in source |
| `explorations/lejeune-bolt-agentic-demo/research/OPPORTUNITIES.md:3-11` | Firecrawl shim failure and fallback rationale | 2026-08-25 | Repository artifact; generated research |
| `explorations/lejeune-bolt-agentic-demo/research/raw/site/INDEX.md:3-20` | Crawl scope, method, counts, statuses, formats, and storage convention | 2026-08-25 | Repository artifact; generated research |
| `explorations/lejeune-bolt-agentic-demo/research/raw/site/pdf/INDEX.md:3-14` | PDF counts, retrieval status, content classes, and storage convention | 2026-08-25 | Repository artifact; generated research |
| `explorations/lejeune-bolt-agentic-demo/research/raw/site/attachments/INDEX.md:3-9` | Non-PDF attachment inventory | 2026-08-25 | Repository artifact; generated research |
| <https://lejeunebolt.com/> | Company history, locations, team, functions, TONE claim, service positioning | 2026-08-25 | — |
| <https://lejeunebolt.com/product-portfolio/> | Fastener, anchor, hardware, stud, coating, standards, and quality taxonomy | 2026-08-25 | — |
| <https://lejeunebolt.com/tool-portfolio/> | Tool families, models, compatibility, Makita, sales/rental links | 2026-08-25 | — |
| <https://lejeunebolt.com/shop/> | Current public product/SKU storefront and DTI gap | 2026-08-25 | — |
| <https://lejeunebolt.com/project-portfolio/> | Main project taxonomy and portfolio | 2026-08-25 | — |
| <https://lejeunebolt.com/repair/> | Repair services, fields, service centers, estimate and approval workflow | 2026-08-25 | — |
| <https://lejeunebolt.com/contact-us/> | Contact fields, locations, live-chat link, lack of structured RFQ fields | 2026-08-25 | — |
| <https://lejeunebolt.com/terms-and-conditions/> | Quote, order, packaging, delivery, claim, payment, cancellation, and return rules | 2026-08-25 | — |
| <https://rentals.lejeunebolt.com/> | Rental tool scope, configuration, 30-day cycle, payment, shipment, and return credit | 2026-08-25 | — |
| <https://www.tightenright.com/bolts/> | F3148/TNA properties, domestic origin, standards, matched assemblies | 2026-08-25 | — |
| <https://www.tightenright.com/system/> | TNA snug/angle installation and inspection signals | 2026-08-25 | — |
| <https://www.tightenright.com/on-site-support-training-144/> | Inspection, verification, installation training, and field support | 2026-08-25 | — |
| <https://www.tightenright.com/projects/> | TNA portfolio and sector coverage | 2026-08-25 | — |
| <https://www.tightenright.com/attend-a-webinar/> | Webinar intake fields and Calendly | 2026-08-25 | — |
| <https://lejeunebolt.com/news/> | Main news inventory | 2026-08-25 | — |
| <https://www.tightenright.com/tna-news/> | TNA news inventory | 2026-08-25 | — |
| <https://lejeunebolt.com/astm-f3148-standard-specification-for-tna/> | ASTM F3148 announcement and approval context | 2026-08-25 | — |
| <https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/> | RCSC strength groups and Combined Method | 2026-08-25 | — |
| <https://lejeunebolt.com/corebrace-uses-tna-bolts-for-brb-brace-testing/> | CoreBrace/UCSD testing relationship | 2026-08-25 | — |
| <https://lejeunebolt.com/sideplate-plus-approval/> | SidePlate Plus approval | 2026-08-25 | — |
| <https://www.tightenright.com/first-tna-project/> | First TNA project and BlueScope/Phalen names | 2026-08-25 | — |
| <https://www.tightenright.com/boulons-plus-canadian-distributor/> | 2018 Boulons Plus/Precision Bolt distributor announcement | 2026-08-25 | — |
| <https://lejeunebolt.com/product-category/skidmore/> | Skidmore-Wilhelm catalog | 2026-08-25 | — |
| <https://lejeunebolt.com/product/cnr50-uc-cordless-nut-runner/> | TONE and Metabo HPT current product relationship | 2026-08-25 | — |
| <https://lejeunebolt.com/product/metabo-36v-4-0-ah-18v-8-0-ah-li-ion-battery/> | Metabo HPT accessory | 2026-08-25 | — |
| <https://lejeunebolt.com/product/dewalt-sds-max-carbide-bit-3-4-x-13/> | DeWalt SKU | 2026-08-25 | — |
| <https://lejeunebolt.com/product/surspider-zkz-40a-tie-wire-tool-kit/> | SURSPIDER tying tool | 2026-08-25 | — |
| <https://lejeunebolt.com/product/surspider-tie-wire/> | SURSPIDER consumable | 2026-08-25 | — |
| <https://lejeunebolt.com/faq-items/domestic/> | Domestic F3148 FAQ | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf> | Dated profile, capacity, products, fulfillment, documents, markets, memberships, projects | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf> | Legacy history, products, traceability, ISO-based QA, certification, logistics, services | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2020/11/03-007-Terms-and-Conditions-of-Sale-LeJeune.pdf> | PDF form of sales terms | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/creditapplication.docx> | Account and credit-intake fields | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/Bulletin-on-Zinc-Aluminum-Coatings.pdf> | Zinc/aluminum coating guidance | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2019/08/05-009-Tension-Control-Bolt-Keg-Quantity-and-Weights.pdf> | TC packaging quantities and weights | 2026-08-25 | — |
| <https://lejeunebolt.com/lbc/wp-content/uploads/2024/12/03-056-Using-DTIs-with-TC-Bolts.pdf> | DTI technical guidance | 2026-08-25 | — |
| <https://www.tightenright.com/wp-content/uploads/tna/TnA-Submittal-Form.pdf> | Submittal fields, technical data, architect/engineer approval, calibrator rule | 2026-08-25 | — |
| <https://www.tightenright.com/wp-content/uploads/11-108-F3148-Pre-Installation-Verification-Worksheet.xlsx> | Verification worksheet fields | 2026-08-25 | — |
| <https://www.tightenright.com/wp-content/uploads/16-140-Pre-Installation-Verification-Testing-of-ASTM-F3148-TnA-144-Assemblies.pdf> | F3148 verification procedure | 2026-08-25 | — |
| <https://www.tightenright.com/wp-content/uploads/16-141-ASTM-F3148-TnA-144-Torque-and-Angle-Installation-Procedure.pdf> | F3148 installation procedure | 2026-08-25 | — |
| <https://www.tightenright.com/wp-content/uploads/20170523-Final-Report-on-TnA144-Testing.pdf> | TNA technical testing report | 2026-08-25 | — |
| <https://www.tightenright.com/wp-content/uploads/05-024-F3148-TnA-144-Keg-Quantity-and-Weights.pdf> | TNA packaging quantities and weights | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/110-north-wacker/> | 110 North Wacker sequencing and JIT case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/template-2/> | 333 North Green Street case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/american-airlines-hanger-2-ohare/> | American Airlines Hangar bolt and secure-delivery case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/audi-field-dc-united/> | Audi Field logistics case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/bank-of-california-stadium/> | Banc of California Stadium case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/boeing-777x-wing-factory/> | Boeing sequencing and fabricator/erector coordination | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/caesars-forum/> | Caesars Forum case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/denver-art-museum/> | Denver Art Museum case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/digikey/> | Digi-Key case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/dignity-health/> | Dignity Health case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/general-motors/> | General Motors case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/gerald-desmond-bridge/> | Gerald Desmond Bridge sourcing/coating case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/halas-hall-chicago-bears/> | Halas Hall case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/hard-rock-stadium-canopy/> | Hard Rock Stadium special-product case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/honolulu-rail-2/> | Honolulu Rail temporary-support/TNA case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/hyatt-center-71-south-wacker/> | Hyatt Center JIT flatbed/crane case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/johnson_street_bridge/> | Johnson Street Bridge case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/kc-railways/> | Kansas City Southern/Redlands Bridge case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/lax-midfield-terminal/> | LAX Midfield Terminal case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/lackawanna-energy-center/> | Lackawanna Energy Center case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/laramie-river-station/> | Laramie River Station case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/las-vegas-convention-center/> | Las Vegas Convention Center case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/lifetime-fitness/> | Lifetime Fitness case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/loma-linda-medical-center/> | Loma Linda Medical Center case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/main-street-bridge/> | Main Street Bridge case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/memorial-stadium/> | Memorial Stadium case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/northwestern-mutual-tower/> | Northwestern Mutual Tower case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/oati-microgrid/> | OATI Microgrid F3148/coating case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/oppd-power-plant/> | OPPD rotational-capacity-testing case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/sas-bridge/> | Bay Bridge SAS A490 Geomet case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/sofi-stadium/> | SoFi Stadium case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/thrivent/> | Thrivent headquarters case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/trinity-health/> | Trinity Health case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/us-bank-stadium/> | U.S. Bank Stadium supply/support claim | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/vikings-tco-performance-center/> | Vikings TCO Performance Center case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/washington-state-cc/> | Washington State Convention Center case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/will-county-courthouse/> | Will County Courthouse case | 2026-08-25 | — |
| <https://lejeunebolt.com/portfolio-items/wilshire-grand-center/> | Wilshire Grand sequencing and delivery case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/allegro-senior-living/> | Allegro Senior Living case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/cooling-platform/> | Cooling Platform case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/general-motors/> | Detailed General Motors TNA case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/honolulu-rail-system/> | Detailed Honolulu Rail TNA case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/johnson-street-bridge/> | Detailed Johnson Street Bridge TNA case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/kc-southern-railways/> | Detailed Kansas City Southern TNA case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/lock-and-dam-17/> | Lock and Dam 17 case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/mercy-health/> | Mercy Health delayed-pretension case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/oati-south-campus-microgrid/> | Detailed OATI TNA case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/parry-bridge-rehabilitation/> | Parry Bridge case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/umauma-stream-bridge/> | Umauma Stream Bridge Clean-Lube case | 2026-08-25 | — |
| <https://www.tightenright.com/portfolio-items/unytite-manufacturing-plant/> | Unytite manufacturing relationship and first-use case | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=Jackson> | No-result first-party search for Jackson | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=Mystic+Lake> | No-result first-party search for Mystic Lake | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=NASA> | No-result first-party search for NASA | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=careers> | No-result first-party search for careers | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=DFARS> | No-result first-party search for DFARS | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=Buy+American> | No-result first-party search for Buy American | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=mill+certificates> | No-result first-party search for mill certificates | 2026-08-25 | — |
| <https://lejeunebolt.com/?s=Microsoft+Office> | No-result first-party search for Microsoft Office | 2026-08-25 | — |
