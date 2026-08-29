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
