# Third-Party Notices

This file is the canonical repository notice for third-party code, data,
regular expressions, and fixtures incorporated into this project. Generated
artifact sidecars record source identity and checksums but do not replace this
notice.

## Free Law Project — BSD 2-Clause material

Upstream repositories:

- courts-db: <https://github.com/freelawproject/courts-db>
  - Pinned release: `v0.10.27`
  - Pinned commit: [`f353e51400a55cc8942b230b3e12540ad364fd23`](https://github.com/freelawproject/courts-db/commit/f353e51400a55cc8942b230b3e12540ad364fd23)
  - Affected material: generated court records, templating inputs, variable and
    place/state data, authored regular expressions, deterministic rendering
    fixtures, and any ported/reimplemented resolver-expression material.
- reporters-db: <https://github.com/freelawproject/reporters-db>
  - Pinned release: `v3.2.66`
  - Pinned commit: [`fad63b383b92f9446c223ddc12bf0b6fd1a6b44c`](https://github.com/freelawproject/reporters-db/commit/fad63b383b92f9446c223ddc12bf0b6fd1a6b44c)
  - Affected material: generated reporter records, editions, variations,
    case-name and state abbreviations, journals, laws, citation types, regular
    expression fragments, and parity fixtures.
- eyecite: <https://github.com/freelawproject/eyecite>
  - Pinned commit: [`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`](https://github.com/freelawproject/eyecite/commit/04d82c032ad5fd0f9ab72a61c87110c46ee8f52e)
  - Affected material: extraction-pipeline behavior, ported/reimplemented
    expressions and regular expressions, and attribution-safe parity fixtures.

The citation oracle fixture baseline also incorporates normalized output and
regex/extractor data from the official eyecite lock's `reporters-db 3.2.53` and
`courts-db 0.10.22`. These are retained behavioral-oracle inputs, separate from
the newer public vocabulary artifact pins above. The committed operation corpus
records their versions and the SHA-256 of the exact upstream `uv.lock`; it does
not silently replace the public vocabulary or add a runtime Python dependency.

Private citation resolver compatibility data also records observable character
classification facts from the frozen Python 3.11.15 runtime's Unicode 14.0.0
properties. The maintainer producer and fact provenance are recorded in the
citation-engine packet. Those character facts include no Python or Unicode
implementation source and introduce no Python runtime dependency. The separate
general-key table adaptation is attributed below.

Copyright (c) 2014, Free Law Project (reporters-db)

Copyright (c) 2020, Free Law Project (courts-db and eyecite)

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Zep Software, Inc. (Graphiti) — Apache-2.0 material

Upstream repository:

- graphiti: <https://github.com/getzep/graphiti>
  - Pinned release: `v0.29.2`
  - Pinned commit: [`ff7e29ccd127d8d9721b5cbb2163a6407ef915fe`](https://github.com/getzep/graphiti/commit/ff7e29ccd127d8d9721b5cbb2163a6407ef915fe)
  - Provenance inventory revision: default branch `main` at
    `448e57c5841f418f2a90586e53b11f7280f367a8` (2026-07-25); the files below are
    byte-identical between that revision and the pinned release.
  - Affected material: bitemporal edge temporal-field semantics (valid-time
    `valid_at`/`invalid_at` and transaction-time `created_at`/`expired_at`
    axes), the invalidate-don't-delete supersession contract (valid-time closes
    at the invalidating fact's valid time while only the transaction axis is
    stamped at ingestion), and the episode lineage shape linking episodes to the
    entity edges they produced.
  - Upstream locations consulted: `graphiti_core/edges.py:263-285`,
    `graphiti_core/nodes.py:318-351`,
    `graphiti_core/utils/maintenance/edge_operations.py:538-847`.
  - Form of use: **behavioral reimplementation in Effect/TypeScript against
    Postgres.** No Python source is copied, vendored, or redistributed; the
    donor is not a build-time or runtime dependency of this project. Storage
    shape, transaction boundaries, identity model, and error handling are
    this project's own and diverge from the donor.
  - Upstream ships no root `NOTICE` file at the pinned revision, so no
    Apache-2.0 §4(d) attribution-notice reproduction applies.

Copyright 2024, 2025 Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A full copy of the Apache License, Version 2.0 is included at
[`licenses/Apache-2.0.txt`](./licenses/Apache-2.0.txt).

## TNO (flint-ontology) — Apache-2.0 material

Upstream repository:

- flint-ontology:
  <https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology>
  - **The repository is hosted on GitLab, not GitHub.**
  - Pinned release: `v1.0.0` (dated 2025-12-03)
  - Affected material: the act-frame shape — named actor/object/recipient
    slots, preconditions, and the `creates`/`terminates` pair — together with
    the source-reference-per-element discipline in which each frame element
    names the norm text it was read from.
  - Form of use: **structural reimplementation in Effect/TypeScript over
    Postgres.** No upstream source, ontology file, or vocabulary term is
    copied, vendored, or redistributed; the donor is not a build-time or
    runtime dependency of this project. The donor's execution semantics are
    deliberately **excluded**: nothing in this project evaluates a
    precondition, fires a transition, or derives a violation. The positions a
    frame names are this project's own Hohfeldian kind-and-content pairs, a
    frame's effect on positions is a non-empty set of derivation kinds rather
    than a single act type, and preconditions carry an explicit
    present/absent polarity.
  - Repository locations carrying the attribution notice:
    `packages/law-practice/domain/src/values/NormSourceReference/NormSourceReference.model.ts`,
    `packages/law-practice/domain/src/entities/ActFrame/ActFrame.model.ts`,
    `packages/law-practice/domain/src/entities/ActFrame/ActFrame.values.ts`.
  - The repository's `shacl/` subdirectory is **MPL-2.0**, not Apache-2.0, and
    nothing is ported from it. The two-severity hard/advisory split in
    `packages/law-practice/domain/src/entities/CorrectionDelta/CorrectionDelta.values.ts`
    is a clean-room re-expression of a concept only; no shape text, constraint
    body, or file structure from that subdirectory was consulted or copied.

Copyright 2022 TNO.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A full copy of the Apache License, Version 2.0 is included at
[`licenses/Apache-2.0.txt`](./licenses/Apache-2.0.txt).

## SPAR document vocabularies

Selected class/property names are projected into TypeScript inventories, with
no ontology axioms redistributed. All four pinned artifacts and repository
licenses declare Creative Commons Attribution 4.0 International (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/. Changes: curated term selection
and TypeScript representation. No upstream endorsement is implied.

- **Doco** — Doco by David Shotton and Silvio Peroni. Contributors: Sebastian Barzaghi. CC BY 4.0. Commit `4c4109a64148c207f80d48a611a79a2d996a44b4`; artifact `docs/2026-06-25/doco.ttl`; version `1.4.0`. [Pinned artifact](https://raw.githubusercontent.com/SPAROntologies/doco/4c4109a64148c207f80d48a611a79a2d996a44b4/docs/2026-06-25/doco.ttl); [repository license](https://raw.githubusercontent.com/SPAROntologies/doco/4c4109a64148c207f80d48a611a79a2d996a44b4/LICENSE.md).
- **Deo** — Deo by David Shotton and Silvio Peroni. Contributors: Sebastian Barzaghi. CC BY 4.0. Commit `dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4`; artifact `docs/2026-08-14/deo.ttl`; version `1.2.0`. [Pinned artifact](https://raw.githubusercontent.com/SPAROntologies/deo/dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4/docs/2026-08-14/deo.ttl); [repository license](https://raw.githubusercontent.com/SPAROntologies/deo/dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4/LICENSE.md).
- **Fabio** — Fabio by David Shotton and Silvio Peroni. Contributors: Paolo Ciccarese, Sebastian Barzaghi and Tim Clark. CC BY 4.0. Commit `ea5b2cd49a7a8f4dc695d633c76bb05608c085db`; artifact `docs/2026-09-03/fabio.ttl`; version `2.3.1`. [Pinned artifact](https://raw.githubusercontent.com/SPAROntologies/fabio/ea5b2cd49a7a8f4dc695d633c76bb05608c085db/docs/2026-09-03/fabio.ttl); [repository license](https://raw.githubusercontent.com/SPAROntologies/fabio/ea5b2cd49a7a8f4dc695d633c76bb05608c085db/LICENSE.md).
- **Cito** — Cito by David Shotton and Silvio Peroni. Contributors: Paolo Ciccarese, Sebastian Barzaghi and Tim Clark. CC BY 4.0. Commit `d34b42e8d4d1c9d45bc530599328897805116994`; artifact `docs/2026-09-03/cito.ttl`; version `2.9.0`. [Pinned artifact](https://raw.githubusercontent.com/SPAROntologies/cito/d34b42e8d4d1c9d45bc530599328897805116994/docs/2026-09-03/cito.ttl); [repository license](https://raw.githubusercontent.com/SPAROntologies/cito/d34b42e8d4d1c9d45bc530599328897805116994/LICENSE.md).

## T3 Tools Inc. (t3code) — MIT material

Upstream repository: <https://github.com/pingdotgg/t3code>

- `packages/effect-acp`
  - Pinned commit: [`31dcc7c51309697af5fd5584d507a1359e0fb62f`](https://github.com/pingdotgg/t3code/commit/31dcc7c51309697af5fd5584d507a1359e0fb62f)
  - Affected material: the `@beep/acp` driver (`packages/drivers/acp`), including
    its JSON-RPC transport, protocol, client, agent, error model, ACP v1/v2
    compatibility layer, RPC groups, schema normalization in its code
    generator, and ported test cases and fixtures. The material is adapted to
    this repository's schema-first and Effect conventions.
  - Affected material: the ACP schema transforms of `@beep/codegen-kit`
    (`packages/tooling/library/codegen-kit/src/internal/transforms.ts`:
    `notDiscriminatorPattern`, `unevaluatedPropertiesOpen`,
    `uniqueDiscriminatorOneOfAsAnyOf` and `distributeAllOf`), which adapt the
    schema normalizations of `packages/effect-acp/scripts/generate.ts` into
    registered, opt-in generator transforms, and their test cases.
- `packages/provider-acp`
  - Pinned commit: [`e64766c56ac6fc1678e6107052feb0047a35337f`](https://github.com/pingdotgg/t3code/commit/e64766c56ac6fc1678e6107052feb0047a35337f)
  - Affected material: `@beep/acp/stderr` and `@beep/acp/terminals`
    (`packages/drivers/acp/src/AcpStderr.models.ts`,
    `packages/drivers/acp/src/AcpClientTerminals.service.ts`), adapted from
    `src/server/stderr.ts`, `src/server/clientTerminals.ts` and the stderr
    enrichment of `src/server/AcpSessionRuntime.ts`, with their ported test
    cases.

MIT License

Copyright (c) 2026 T3 Tools Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## eyecite-ts — MIT reference material

Upstream: <https://github.com/medelman17/eyecite-ts>

Pinned commit: `34133d03143ea65861f48a5ed0eb32c931581666`.
Affected material: citation-engine donor baseline logs. No donor runtime dependency is introduced.

MIT License

Copyright (c) 2026 medelman17

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## eyecite-js — BSD 2-Clause reference material

Upstream: <https://github.com/beshkenadze/eyecite-js>

Pinned commit: `53a49f2412da668aaf262e5f92584c2c3781043b`.
Affected material: citation-engine donor baseline logs. No donor runtime dependency is introduced.

BSD 2-Clause License

Copyright (c) 2020, Free Law Project (original Python eyecite library)
Copyright (c) 2025, Aleksandr Beshkenadze <beshkenadze@gmail.com> (TypeScript/JavaScript port)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## CPython 3.11.15 dictionary and candidate-set behavior

The private citation runtime table in
`packages/law-practice/server/src/internal/Citation/RuntimeDictionary.ts`
adapts the combined/general-key lookup, perturbation, deletion and stored-hash
resize behavior of CPython 3.11.15 `Objects/dictobject.c`:
<https://github.com/python/cpython/blob/v3.11.15/Objects/dictobject.c>.
Source SHA-256:
`474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8`.

The add-only candidate set in
`packages/law-practice/server/src/internal/Citation/RuntimeSet.ts` also adapts
CPython 3.11.15 `Objects/setobject.c` insertion, linear/perturbation probing,
stored-hash growth and bucket iteration:
<https://github.com/python/cpython/blob/v3.11.15/Objects/setobject.c>.
Source SHA-256:
`01462829ff1e731582656adf49ef1d662a5f48002ac49114acdae1ea3674ce57`.
Only the candidate-construction operations used by the resolver are exposed;
set deletion and reentrant mutation are not implemented by this helper.

Changes: the adaptation uses schema-owned TypeScript data, captured Effect
comparison/work services, bounded probes and allocations, typed redacted
failures, serialized operations and operation-local insertion identities.
It does not embed or depend on the Python runtime. It does not claim complete
CPython mapping compatibility, split tables or reentrant comparison mutation.
Source comparisons and remaining obligations are recorded in the citation
engine packet. The complete upstream license is reproduced below.

<!-- markdownlint-disable MD013 MD046 -->
<!-- cpython-3.11.15-license:begin -->

```text
A. HISTORY OF THE SOFTWARE
==========================

Python was created in the early 1990s by Guido van Rossum at Stichting
Mathematisch Centrum (CWI, see https://www.cwi.nl) in the Netherlands
as a successor of a language called ABC.  Guido remains Python's
principal author, although it includes many contributions from others.

In 1995, Guido continued his work on Python at the Corporation for
National Research Initiatives (CNRI, see https://www.cnri.reston.va.us)
in Reston, Virginia where he released several versions of the
software.

In May 2000, Guido and the Python core development team moved to
BeOpen.com to form the BeOpen PythonLabs team.  In October of the same
year, the PythonLabs team moved to Digital Creations, which became
Zope Corporation.  In 2001, the Python Software Foundation (PSF, see
https://www.python.org/psf/) was formed, a non-profit organization
created specifically to own Python-related Intellectual Property.
Zope Corporation was a sponsoring member of the PSF.

All Python releases are Open Source (see https://opensource.org for
the Open Source Definition).  Historically, most, but not all, Python
releases have also been GPL-compatible; the table below summarizes
the various releases.

    Release         Derived     Year        Owner       GPL-
                    from                                compatible? (1)

    0.9.0 thru 1.2              1991-1995   CWI         yes
    1.3 thru 1.5.2  1.2         1995-1999   CNRI        yes
    1.6             1.5.2       2000        CNRI        no
    2.0             1.6         2000        BeOpen.com  no
    1.6.1           1.6         2001        CNRI        yes (2)
    2.1             2.0+1.6.1   2001        PSF         no
    2.0.1           2.0+1.6.1   2001        PSF         yes
    2.1.1           2.1+2.0.1   2001        PSF         yes
    2.1.2           2.1.1       2002        PSF         yes
    2.1.3           2.1.2       2002        PSF         yes
    2.2 and above   2.1.1       2001-now    PSF         yes

Footnotes:

(1) GPL-compatible doesn't mean that we're distributing Python under
    the GPL.  All Python licenses, unlike the GPL, let you distribute
    a modified version without making your changes open source.  The
    GPL-compatible licenses make it possible to combine Python with
    other software that is released under the GPL; the others don't.

(2) According to Richard Stallman, 1.6.1 is not GPL-compatible,
    because its license has a choice of law clause.  According to
    CNRI, however, Stallman's lawyer has told CNRI's lawyer that 1.6.1
    is "not incompatible" with the GPL.

Thanks to the many outside volunteers who have worked under Guido's
direction to make these releases possible.


B. TERMS AND CONDITIONS FOR ACCESSING OR OTHERWISE USING PYTHON
===============================================================

Python software and documentation are licensed under the
Python Software Foundation License Version 2.

Starting with Python 3.8.6, examples, recipes, and other code in
the documentation are dual licensed under the PSF License Version 2
and the Zero-Clause BSD license.

Some software incorporated into Python is under different licenses.
The licenses are listed with code falling under that license.


PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2
--------------------------------------------

1. This LICENSE AGREEMENT is between the Python Software Foundation
("PSF"), and the Individual or Organization ("Licensee") accessing and
otherwise using this software ("Python") in source or binary form and
its associated documentation.

2. Subject to the terms and conditions of this License Agreement, PSF hereby
grants Licensee a nonexclusive, royalty-free, world-wide license to reproduce,
analyze, test, perform and/or display publicly, prepare derivative works,
distribute, and otherwise use Python alone or in any derivative version,
provided, however, that PSF's License Agreement and PSF's notice of copyright,
i.e., "Copyright (c) 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023 Python Software Foundation;
All Rights Reserved" are retained in Python alone or in any derivative version
prepared by Licensee.

3. In the event Licensee prepares a derivative work that is based on
or incorporates Python or any part thereof, and wants to make
the derivative work available to others as provided herein, then
Licensee hereby agrees to include in any such work a brief summary of
the changes made to Python.

4. PSF is making Python available to Licensee on an "AS IS"
basis.  PSF MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, PSF MAKES NO AND
DISCLAIMS ANY REPRESENTATION OR WARRANTY OF MERCHANTABILITY OR FITNESS
FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF PYTHON WILL NOT
INFRINGE ANY THIRD PARTY RIGHTS.

5. PSF SHALL NOT BE LIABLE TO LICENSEE OR ANY OTHER USERS OF PYTHON
FOR ANY INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES OR LOSS AS
A RESULT OF MODIFYING, DISTRIBUTING, OR OTHERWISE USING PYTHON,
OR ANY DERIVATIVE THEREOF, EVEN IF ADVISED OF THE POSSIBILITY THEREOF.

6. This License Agreement will automatically terminate upon a material
breach of its terms and conditions.

7. Nothing in this License Agreement shall be deemed to create any
relationship of agency, partnership, or joint venture between PSF and
Licensee.  This License Agreement does not grant permission to use PSF
trademarks or trade name in a trademark sense to endorse or promote
products or services of Licensee, or any third party.

8. By copying, installing or otherwise using Python, Licensee
agrees to be bound by the terms and conditions of this License
Agreement.


BEOPEN.COM LICENSE AGREEMENT FOR PYTHON 2.0
-------------------------------------------

BEOPEN PYTHON OPEN SOURCE LICENSE AGREEMENT VERSION 1

1. This LICENSE AGREEMENT is between BeOpen.com ("BeOpen"), having an
office at 160 Saratoga Avenue, Santa Clara, CA 95051, and the
Individual or Organization ("Licensee") accessing and otherwise using
this software in source or binary form and its associated
documentation ("the Software").

2. Subject to the terms and conditions of this BeOpen Python License
Agreement, BeOpen hereby grants Licensee a non-exclusive,
royalty-free, world-wide license to reproduce, analyze, test, perform
and/or display publicly, prepare derivative works, distribute, and
otherwise use the Software alone or in any derivative version,
provided, however, that the BeOpen Python License is retained in the
Software, alone or in any derivative version prepared by Licensee.

3. BeOpen is making the Software available to Licensee on an "AS IS"
basis.  BEOPEN MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, BEOPEN MAKES NO AND
DISCLAIMS ANY REPRESENTATION OR WARRANTY OF MERCHANTABILITY OR FITNESS
FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE SOFTWARE WILL NOT
INFRINGE ANY THIRD PARTY RIGHTS.

4. BEOPEN SHALL NOT BE LIABLE TO LICENSEE OR ANY OTHER USERS OF THE
SOFTWARE FOR ANY INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES OR LOSS
AS A RESULT OF USING, MODIFYING OR DISTRIBUTING THE SOFTWARE, OR ANY
DERIVATIVE THEREOF, EVEN IF ADVISED OF THE POSSIBILITY THEREOF.

5. This License Agreement will automatically terminate upon a material
breach of its terms and conditions.

6. This License Agreement shall be governed by and interpreted in all
respects by the law of the State of California, excluding conflict of
law provisions.  Nothing in this License Agreement shall be deemed to
create any relationship of agency, partnership, or joint venture
between BeOpen and Licensee.  This License Agreement does not grant
permission to use BeOpen trademarks or trade names in a trademark
sense to endorse or promote products or services of Licensee, or any
third party.  As an exception, the "BeOpen Python" logos available at
http://www.pythonlabs.com/logos.html may be used according to the
permissions granted on that web page.

7. By copying, installing or otherwise using the software, Licensee
agrees to be bound by the terms and conditions of this License
Agreement.


CNRI LICENSE AGREEMENT FOR PYTHON 1.6.1
---------------------------------------

1. This LICENSE AGREEMENT is between the Corporation for National
Research Initiatives, having an office at 1895 Preston White Drive,
Reston, VA 20191 ("CNRI"), and the Individual or Organization
("Licensee") accessing and otherwise using Python 1.6.1 software in
source or binary form and its associated documentation.

2. Subject to the terms and conditions of this License Agreement, CNRI
hereby grants Licensee a nonexclusive, royalty-free, world-wide
license to reproduce, analyze, test, perform and/or display publicly,
prepare derivative works, distribute, and otherwise use Python 1.6.1
alone or in any derivative version, provided, however, that CNRI's
License Agreement and CNRI's notice of copyright, i.e., "Copyright (c)
1995-2001 Corporation for National Research Initiatives; All Rights
Reserved" are retained in Python 1.6.1 alone or in any derivative
version prepared by Licensee.  Alternately, in lieu of CNRI's License
Agreement, Licensee may substitute the following text (omitting the
quotes): "Python 1.6.1 is made available subject to the terms and
conditions in CNRI's License Agreement.  This Agreement together with
Python 1.6.1 may be located on the internet using the following
unique, persistent identifier (known as a handle): 1895.22/1013.  This
Agreement may also be obtained from a proxy server on the internet
using the following URL: http://hdl.handle.net/1895.22/1013".

3. In the event Licensee prepares a derivative work that is based on
or incorporates Python 1.6.1 or any part thereof, and wants to make
the derivative work available to others as provided herein, then
Licensee hereby agrees to include in any such work a brief summary of
the changes made to Python 1.6.1.

4. CNRI is making Python 1.6.1 available to Licensee on an "AS IS"
basis.  CNRI MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, CNRI MAKES NO AND
DISCLAIMS ANY REPRESENTATION OR WARRANTY OF MERCHANTABILITY OR FITNESS
FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF PYTHON 1.6.1 WILL NOT
INFRINGE ANY THIRD PARTY RIGHTS.

5. CNRI SHALL NOT BE LIABLE TO LICENSEE OR ANY OTHER USERS OF PYTHON
1.6.1 FOR ANY INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES OR LOSS AS
A RESULT OF MODIFYING, DISTRIBUTING, OR OTHERWISE USING PYTHON 1.6.1,
OR ANY DERIVATIVE THEREOF, EVEN IF ADVISED OF THE POSSIBILITY THEREOF.

6. This License Agreement will automatically terminate upon a material
breach of its terms and conditions.

7. This License Agreement shall be governed by the federal
intellectual property law of the United States, including without
limitation the federal copyright law, and, to the extent such
U.S. federal law does not apply, by the law of the Commonwealth of
Virginia, excluding Virginia's conflict of law provisions.
Notwithstanding the foregoing, with regard to derivative works based
on Python 1.6.1 that incorporate non-separable material that was
previously distributed under the GNU General Public License (GPL), the
law of the Commonwealth of Virginia shall govern this License
Agreement only as to issues arising under or with respect to
Paragraphs 4, 5, and 7 of this License Agreement.  Nothing in this
License Agreement shall be deemed to create any relationship of
agency, partnership, or joint venture between CNRI and Licensee.  This
License Agreement does not grant permission to use CNRI trademarks or
trade name in a trademark sense to endorse or promote products or
services of Licensee, or any third party.

8. By clicking on the "ACCEPT" button where indicated, or by copying,
installing or otherwise using Python 1.6.1, Licensee agrees to be
bound by the terms and conditions of this License Agreement.

        ACCEPT


CWI LICENSE AGREEMENT FOR PYTHON 0.9.0 THROUGH 1.2
--------------------------------------------------

Copyright (c) 1991 - 1995, Stichting Mathematisch Centrum Amsterdam,
The Netherlands.  All rights reserved.

Permission to use, copy, modify, and distribute this software and its
documentation for any purpose and without fee is hereby granted,
provided that the above copyright notice appear in all copies and that
both that copyright notice and this permission notice appear in
supporting documentation, and that the name of Stichting Mathematisch
Centrum or CWI not be used in advertising or publicity pertaining to
distribution of the software without specific, written prior
permission.

STICHTING MATHEMATISCH CENTRUM DISCLAIMS ALL WARRANTIES WITH REGARD TO
THIS SOFTWARE, INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS, IN NO EVENT SHALL STICHTING MATHEMATISCH CENTRUM BE LIABLE
FOR ANY SPECIAL, INDIRECT OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

ZERO-CLAUSE BSD LICENSE FOR CODE IN THE PYTHON DOCUMENTATION
----------------------------------------------------------------------

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

<!-- cpython-3.11.15-license:end -->
<!-- markdownlint-enable MD013 MD046 -->

## lxml 5.1.0 — BSD 3-Clause material

The private citation HTML input preparation adapts Unicode encoding selection
from `parser.pxi`, the encoding-declaration detector from `apihelpers.pxi`, and
full-document recognition from `html/__init__.py` in lxml 5.1.0. Its frozen
source hashes and BSD notice hashes are recorded by the HTML input fixture
producer. lxml.html is copyright Ian Bicking; the remaining adapted lxml
material is copyright Infrae. The local implementation replaces the detector's
regex execution with bounded cooperative scans. No lxml binary, Python runtime,
libxml2 runtime asset or ElementTree implementation is incorporated by this
adaptation.

Upstream: <https://github.com/lxml/lxml/tree/lxml-5.1.0>

Copyright Ian Bicking (lxml.html).

Copyright (c) 2004 Infrae. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  1. Redistributions of source code must retain the above copyright
     notice, this list of conditions and the following disclaimer.

  2. Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in
     the documentation and/or other materials provided with the
     distribution.

  3. Neither the name of Infrae nor the names of its contributors may
     be used to endorse or promote products derived from this software
     without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL INFRAE OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
