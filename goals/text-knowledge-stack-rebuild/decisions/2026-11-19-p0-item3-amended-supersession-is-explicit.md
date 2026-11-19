---
title: "P0 item 3 amended: a knowledge interval ends at the record that supersedes it, so several current records per key are allowed"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
reversal: "Return to one current record per (scope, logicalKey) by a decision file before P4 opens; the valid-time clause of L4-1 is then deleted as vacuous."
---

The first P0 decision on item 3 ended a record's knowledge interval at the next record of its partition. The design module showed the consequence: only one record per (scope, logicalKey) is ever current, which makes the valid-time disjointness clause vacuous and contradicts the database, where several unexpired rows of one logical key coexist with disjoint valid ranges. Amended: the claim core names the record it supersedes (an optional ClaimId in the hashed preimage, as ClaimVersion.supersedes is today). A record's knowledge interval ends at the knowledgeStart of the record that supersedes it and is open otherwise. The pure log checker tests, per partition (scope, logicalKey): supersession is acyclic by hash construction; a record is superseded at most once, and a second superseder is a reported fork; a superseder never starts earlier than the record it supersedes or than its own generation time; and the records not yet superseded have pairwise disjoint valid intervals, which mirrors the Postgres exclusion constraint. The rest of the first decision stands (half-open bounds, Instant, partition key, where the checks live).
