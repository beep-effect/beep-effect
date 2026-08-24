# Draft — OntologyValidator reports HermiT/Pellet consistency without running a reasoner

## Title

OntologyValidator reports HermiT/Pellet consistency without running a reasoner

## Body

`OntologyValidator` accepts `hermit`, `pellet`, or `auto` and logs that it is validating with the
selected reasoner. It does not load or invoke any reasoner. Instead, it creates a
`ValidationResult` whose `valid`, `consistent`, and `satisfiable` fields all default to `True`,
then leaves the consistency and satisfiability branches empty. A nonexistent ontology path or a
logically inconsistent ontology can therefore be reported as consistent and satisfiable.

`OntologyGenerator` copies these simulated values into its stage-six validation output. The
module-local usage guide also describes that stage as HermiT/Pellet reasoning. The current website
guide is more accurate: it says Semantica exports the ontology and reasoning runs in an external
tool. No page under `docs/` claims that Semantica itself runs HermiT or Pellet.

### Evidence (file:line)

- `semantica/ontology/ontology_validator.py:290-297` initializes every validation result with
  `valid=True`, `consistent=True`, and `satisfiable=True`.
- `semantica/ontology/ontology_validator.py:306-324` accepts and stores `hermit`, `pellet`, or
  `auto` plus consistency and satisfiability flags.
- `semantica/ontology/ontology_validator.py:326-361` labels the implementation as a placeholder,
  never loads string paths, and implements both reasoning checks as `pass` before returning the
  default result.
- `semantica/ontology/ontology_validator.py:371-382` implements the related constraint check as an
  unconditional `True`.
- `semantica/ontology/ontology_generator.py:197-208` calls the placeholder validator during
  "Stage 6" and publishes its `consistent` and `satisfiable` values in the generated ontology.
- `semantica/ontology/ontology_usage.md:89-96` advertises stage six as "HermiT/Pellet reasoning,"
  and `semantica/ontology/ontology_usage.md:309-337` presents reasoner selection and consistency
  checking as working validation options.
- `docs/guides/ontology.md:24-26` states the actual boundary: Semantica exports an ontology and
  reasoning runs in an external HermiT, Pellet, or ELK tool. `docs/guides/export.md:208-214`
  likewise describes exporting generated OWL for external reasoning and consistency checking.

### Reproduction sketch

1. Construct `OntologyValidator(reasoner="hermit")` and call `validate` with a path that does not
   exist, such as `"missing.owl"`.
2. Observe that no file-loading or reasoner error occurs and the result reports `valid=True`,
   `consistent=True`, and `satisfiable=True`.
3. Repeat with `reasoner="pellet"`; the result is identical because the selected reasoner is only
   used in the log message.
4. Pass an OWL ontology containing a direct contradiction and observe the same positive result.

### Suggested fix direction

Either implement the advertised backends or fail explicitly until they exist. A real
implementation should load dict and file inputs into an OWL reasoner, map `hermit` and `pellet` to
actual backend calls, and populate consistency and unsatisfiable-class results from the backend.
It should reject unknown reasoners and surface missing Java or reasoner dependencies as errors.
Add regressions for a consistent ontology, a contradictory ontology, an unsatisfiable class, and a
missing file. Until then, do not return positive consistency or satisfiability claims and remove
the module-local wording that presents stage six as implemented reasoning.

## Dedupe note

The 2026-08-24 tracker sweep found no issue or PR reporting this defect. Closed #228 only lists
HermiT/Pellet reasoning validation as an evals wishlist item.

Provenance: semantica-lab research, 2026-08-24 tracker sweep found zero tracker hits for this defect; local-source verification.
