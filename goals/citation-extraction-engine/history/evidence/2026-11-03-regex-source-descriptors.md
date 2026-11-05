# Source-bound regex descriptor registry

Extend the independent CPython 3.11.15 / Unicode 14 producer with 13,258 distinct
native pattern/flag descriptors and per-artifact indices covering all 13,610
source instances. Each captured tokenizer configuration retains exactly 6,805
bindings, within its unchanged 8,192-pattern default. All previous facts and
aggregate vectors remain byte-equivalent as JSON values, except the producer's
own content hash. A second complete data-only generation is byte-identical.

Fingerprints hash one canonical storage-width byte followed by little-endian
native words. They distinguish literal surrogate pairs from a scalar with the
same JavaScript display projection. Descriptor metadata records independently
observed capture count/names, minimum width and repetition profiles.

`makeCitationRegexDescriptorRegistry` captures validated trusted server bindings,
policy, Digest and Clock. It indexes records with Effect MutableHashMap. Binding
owns the native pattern, computes its width-sensitive SHA-256 with Effect Digest
and Bytes.concat, matches the exact flags, freshly compiles the original words,
and requires equality of the complete profile. Input/returned descriptor copies
do not share mutable names with installed metadata. It returns data and a bound
data-only program; it supplies no regex execution method or family approval.

The fixed hosted child now installs one registry per source configuration and
binds every source instance before native compilation. A new independent vector
hash binds ordered instance IDs to fingerprints and flags; the previous full
capture/name/minimum-width vector remains unchanged and required. Controlled
native captures continue through bounded collection. This strengthened native
branch is pending hosted execution, not a local qualification claim.

Verification:

- Twenty-nine descriptor/compiler/result tests pass, including eight new
  registry controls. These cover exact source/profile binding, wrong groups,
  names, width and repetition facts, duplicate keys, count-before-decode,
  incoherent names, scalar/surrogate separation, captured Digest/Clock, redacted
  digest failure and caller mutation during an asynchronous fingerprint.
- Server test compilation, scoped lint and package laws pass. New-only Fallow
  reports zero dead-code, complexity or clone findings.
- The fixed qualification subject bundles without executing native matching.
- The actual HTML smoke passes after replacing its manual asset assembly with
  Effect Bytes.concat; the asset length is still checked before concatenation.
- The expanded Python-owned fixture uses one descriptor per line for review.
  Biome delegates only this generated artifact to its deterministic producer,
  as for the other hash-bound oracle corpora. The fixed qualifier authenticates
  the complete fixture at SHA-256
  `e97ff71682bd3e377978ad23ec1b6e21936ca5534a75e38a9c1891f9c736590a`.
- Logs: `.beep/pr2511-regex-descriptor-source{,-repeat}.log`,
  `.beep/pr2511-regex-descriptors-types.log`,
  `.beep/pr2511-regex-descriptors-final-tests.log`,
  `.beep/pr2511-regex-descriptor-build.log`,
  `.beep/pr2511-regex-descriptors-html-smoke.log`.

Operator direction is to use Effect-provided solutions wherever they cover the
required behavior. The upstream audit now explicitly records configurable
ChildProcess kill controls and Worker.makePlatform hooks; the five-second stock
worker preset is not a limitation of Effect generally. PR #2637 owns the 4.1.2
dependency upgrade; this branch will consume it through main. Source inspection
of canonical 4.1.2 is distinct from runtime proof of that dependency after landing.

Reviewed family admission, matching/scaling proof, actual regex child/supervisor,
public composition and exhaustive source parity remain required. No original
source observation or safety threshold changed; no semantic waiver or family
approval was issued.
