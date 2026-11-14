---
title: "Stop B2 at the descriptor depth conflict"
date: 2026-11-14
lane: "feat/citation-regex-session"
reversal: "Resolve the v3 depth and descriptor contract explicitly, then resume B2."
---

B2 is stopped before implementation under the implementation brief's explicit
conflict rule. The required per-job descriptor shape and the required structural
depth ceiling cannot both be honored by the existing JSON preflight.

## Evidence

- Binding design rev 2, explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md:106-110 requires
  descriptor: CitationRegexPatternDescriptor inside Evaluate.
- The same design at lines 125-128 requires depth 3, an expanded property ceiling
  and capture-name length accounting. The implementation brief repeats depth 3
  as a hard deliverable and forbids weakening safety guards.
- packages/law-practice/server/src/internal/Citation/RegexDescriptors.ts:77-80
  puts profile inside the descriptor; lines 41-46 put names inside profile.
- packages/law-practice/server/src/internal/Citation/RegexProgram.ts:162 defines
  names as a required S.Record. Empty names still encode as an object.
- packages/law-practice/server/src/internal/Citation/NativeJson.ts:78-87 starts
  depth at zero and increments at every opening object, including the root.
  Lines 104-106 apply that rule to every unquoted opening brace.

The required nesting is Evaluate (1), descriptor (2), profile (3), names (4).
Even a job with no named captures therefore exceeds depth 3.

A read-only Bun probe in the server package built an S.Struct from the existing
CitationRegexWorkerJob.fields, replaced the version with the v3 tag, and added
sequence: S.Natural and descriptor: CitationRegexPatternDescriptor, exactly as
the design specifies. Schema encoding succeeded and retained an empty names
object. Calling the actual preflightCitationNativeJson with propertyCeiling 100
rejected the encoded bytes at maximumDepth 3 and accepted the identical bytes
at maximumDepth 4. The synthetic fingerprint was schema-valid placeholder data;
this probe proves structure only, not registry binding or execution authority.
A second minimal structural probe gave the same result.

## Options for the owner

1. Recommended: amend the v3 design and implementation brief to depth 4 using
   the existing root-inclusive guard semantics. Retain the exact encoded-byte
   preflight, a finite total property ceiling, the capture-name bounds, strict
   schema decoding and all other safety guards. Add regression cases accepting
   the required names object and refusing depth 5 before implementing B2.
2. Redesign the descriptor wire representation to fit depth 3. Specify the
   codec, identity/profile validation and exact preflight before implementation;
   this changes the currently required descriptor schema on the wire.
3. Explicitly define a different v3-only depth convention or structural guard,
   with equivalent limits proved. Do not silently change the shared guard's
   root-inclusive semantics, which would affect existing protocols.

No option was implemented. No production code or tests changed; no guard was
weakened and no existing test was deleted. B2 remains pending and has no
ten-process count result, real-process proof result or in-review checkpoint.
Protocol v2 and B1 remain intact. The implementation lane is
feat/citation-regex-session; publication remains with the owner.
