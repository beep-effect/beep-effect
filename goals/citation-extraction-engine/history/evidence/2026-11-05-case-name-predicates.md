# Source case-name boundary predicates and character facts

The private CaseNamePredicates adapter ports the three built-in string predicates
_is_lowercase_after_v_token, _is_capitalized_abbreviation and
_is_lowercase_without_v_token from the pinned eyecite helpers.py. Their native
word arguments are prepared once by the existing Unicode owner and remain
immutable through the enclosing case-name scan. Presence means v_token is not
None, including a falsey present value; it does not mean bool(v_token).

The source's first-character access and short circuit order are retained. Empty
words fail with a closed empty-word failure only when word_str[0] is reached:
without v, after-v and abbreviation return false but without-v fails; with v,
after-v and abbreviation fail but without-v returns false. Source IndexError
outcomes remain distinct from boolean false. The source's "lowercase" checks
mean not-uppercase, followed in the without-v helper by alphabetic; they do not
mean str.islower. Connector exclusions are the exact case-sensitive ASCII words
of/the/an/and. Abbreviations require the first point to be uppercase, more than
four Python points, a terminal dot and plaintiff_length greater than one.

## Exact Python character facts

PythonCharacters reuses the existing sorted-interval search and frozen native
point access. It supplies one-point isupper/islower/isalpha from observations of
Python 3.11.15 / Unicode 14.0.0. Lowercase mappings or the host runtime's Unicode
tables cannot safely replace these properties: titlecase, other-uppercase/lowercase,
non-alphabetic cased points and newer Unicode assignments have distinct behavior.
No regex, worker, scheduler, mutable registry or timer implementation is added.

The generated character data uses its one existing schema with Schema's Effect JSON
decoder as a compact static carrier. Independent upper/lower/alpha properties
remain complete; overlapping numeric intervals are not incorrectly conflated
with the existing cased/contextual-lowercase properties. The canonical source
data is 651 upper ranges, 668 lower ranges and 648 alphabetic ranges. The runtime
predicate functions use those ranges without expanding a 131,756-point alphabetic
set or copying native words. Only the enclosing scan owns admission, cumulative
text reservation and captured deadline. Predicate loops cooperate every 256
points and returned effects have R = never.

## Source and target proof

The producer requires the clean oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, Python 3.11.15,
Unicode 14.0.0 and regex 2023.12.25. It executes each original helper directly
for 224 distinct native words, two v-token presence states and six plaintiff
lengths: 2,688 input states / 8,064 complete helper calls. Controls include empty
words, all four exact connectors, whitespace/non-space, titlecase, numeric/cased
nonletters, ASCII and supplementary four/five-point abbreviation thresholds,
literal surrogates, supplementary scalars and future-Unicode assignments.

Every one of the 1,114,112 Python points is independently observed through the
three real Python str predicates. Upper/lower/alpha counts are respectively
1,951 / 2,471 / 131,756. Each point's three result bits are stored in the producer's
complete mask hash; the target constructs the corresponding full mask through
its actual interval predicates and compares SHA-256:
fded3cfd80e6cb1e875eca76827bf4f6b2be0b522811403f456725aba14472ad.
The target also checks complete schema equivalence between committed source
facts and installed facts, and compares every original helper value/error.

Producer SHA-256:
a33d0f75a9b5c367d66dfbf4388fc9b6947b752e18b5a606e58659bfc32bb584.
Canonical source-data SHA-256:
5a72be32d49768ac84c2460d4ad566045d45855025621c95597c74d8456dd161.
Committed case-name-predicates.json is 158,403 bytes, SHA-256
6477311fbd6e280de43ce8368d1f36826319b808ff8640a536b0f11a0b800259.
Producer runs under PYTHONHASHSEED 251 and 257 produce byte-identical source
corpora and generated module inputs before standard formatting. Generated facts
copy no CPython or Unicode implementation; existing PSF attribution applies.

Twelve focused tests across case-name predicates, Python lowercase and court
lookup pass. They include all-point classification, every original predicate
call, schema-derived native-word presence short circuits, native whitespace-scan
interruption and existing native normalization
regressions. Scoped package lint/type checks, Oxlint, schema-first, schema-tag idioms and
Fallow pass without introduced findings. The focused Effect/Vitest detector
reports zero findings; its full rerun is recorded at publication. The test uses
the existing shared fixture environment to authenticate committed source bytes. Broad local aggregate/head-install verification
remains deferred to hosted CI under the operator's instruction.

This is a dependency for source-faithful case-name discovery, not completion of
find_case_name. The backward scanner, candidate processing/stop-word removal,
HTML discovery and full case/supra/short method composition remain open. The
enclosing engine's budget/deadline adoption, general custom object protocols,
fresh-process hash paths, nullable/repeated regex semantics, 110 family safety
reviews, public service/Layer, exhaustive accounting/coverage and lifecycle proof
also remain open. The audit retains 11 representation laws, four fidelity
questions and 15 unfinished proof rows; no semantic waiver or completion claim
is added.
