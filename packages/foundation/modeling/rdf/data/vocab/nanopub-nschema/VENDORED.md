# Vendored: Nanopublication schema (nschema.ttl)

| | |
| --- | --- |
| File | `nschema.ttl` |
| Namespace | `http://www.nanopub.org/nschema#` (prefix `np`) |
| Upstream | <https://github.com/Nanopublication/Guidelines> |
| Path | `nschema.ttl` |
| Commit | [`8388dd90795b264f4b01c64d0f7218babcae4871`](https://github.com/Nanopublication/Guidelines/blob/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.ttl) |
| Pinned artifact | <https://raw.githubusercontent.com/Nanopublication/Guidelines/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.ttl> |
| Version | `dc:modified "2013-10-23"` |
| License | CC-BY-SA-3.0, Creative Commons Attribution-ShareAlike 3.0 Unported, <https://creativecommons.org/licenses/by-sa/3.0/>; the legal code is in `LICENSE` |
| sha256 | `1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649` |

The file is byte-for-byte the upstream file at the commit above. Its sha256 is
the digest the `np` NamespacePin records
(`packages/foundation/modeling/rdf/src/Vocab/generated/namespace-pins.data.json`),
so a changed byte breaks the pin. Do not reformat it. `LICENSE` is the
Creative Commons legal code exactly as published at
<https://creativecommons.org/licenses/by-sa/3.0/legalcode.txt>.

## Attribution

Nanopublication schema, from the *Guidelines for Nanopublication*, Nanopublication
Guidelines repository. The companion document `nschema.html` at the same commit
names its editors and authors as follows.

Editors: Erik Schultes (LUMC), Mark Thompson (LUMC), Paul Groth (VU), Zuotian
Tatum (LUMC).

Authors: Alasdair J G Gray (University of Manchester), Christine Chichester
(NBIC), Kees Burger (NBIC), Spyros Kotoulas (VU), Antonis Loizou (VU), Valery
Tkachenko (RSC), Andra Waagmeester (Maastricht University), Sune Askjaer
(Lundbeck), Steve Pettifer (University of Manchester), Lee Harland (Pfizer/CD),
Carina Haupt (Uni Bonn / Fraunhofer), Colin Batchelor (RSC), MiguelVazquez
(CNIO), José María Fernández (CNIO), Jahn Saito (Maastricht University), Andrew
Gibson (LUMC), Louis Wich (DTU).

`nschema.html` carries the notice: "This document is licensed under a Creative
Commons ShareAlike Attribution 3.0 License"
(<http://creativecommons.org/licenses/sa-by/3.0/>). `nschema.ttl` carries no
notice of its own. By operator ruling of 2026-11-23 ("Treat the nschema.html
CC BY-SA 3.0 notice as covering the TTL. Vendor it with attribution and the
license text, and record a decision file."), the file is vendored here under
CC BY-SA 3.0.

No changes were made to the file. No endorsement by the authors or editors is
implied.

## Share-alike scope

- `nschema.ttl`, and any work derived from it such as a term list generated
  from its content or a fixture built from its triples, stays under CC BY-SA
  3.0 and is kept in this directory, apart from the MIT-licensed package
  source.
- The repository's own code that names the `np` term IRIs is not derived from
  this file: the curated term list in the `pinned-vocabularies` target, the
  identity registry shard `np.json`, the generated `@beep/rdf` term constants
  and the nanopublication codec all refer to published identifiers, and stay
  under the package licenses.
