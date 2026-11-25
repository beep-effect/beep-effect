---
title: "P4: select stance and retraction independently at explicit as-of time"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Version the view and readmission event rules together while retaining immutable prior events."
---

Design section 3.1 defines explicit core/event/snapshot/asOf inputs. Stance selects latest eligible stance/admission event; missing or conflicting events remain unresolved. Eligibility additionally requires selected core, verified authorization and grounding, no effective direct retraction and no wholly orphaned derivation. Retraction dominates eligibility even when stance remains admitted. Historical views select historical events and snapshot or return unknown. Readmission requires a new authorized action revision, fresh grounding and exact reference to the prior retraction being cleared; ordinary admission does not clear it. Readmission ends only that earlier retraction interval; equal-time retraction wins and later retractions block. Derived orphan clears only with live support. Test direct retraction, derived orphan, historical as-of and readmission.

Admission.clearsRetraction is an optional digest of the exact canonical encoded prior Retraction record. The trusted new action revision authorizes clearing that digest as well as the exact claim. Original events remain append-only.
