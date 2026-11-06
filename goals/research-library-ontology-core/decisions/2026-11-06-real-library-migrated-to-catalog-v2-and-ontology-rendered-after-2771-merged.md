---
title: "Real library migrated to catalog v2 and ontology rendered after #2771 merged"
date: 2026-11-06
kind: checkpoint
lane: "docs/research-library-ontology-closeout"
reversal: "Copy catalog/history/e88cf95833389975bedc1143c9b8e20bd1fd3775ead6589cd931baa9b1054f52.json over catalog/library.json and delete ontology/"
---

With main's reader on v2 (#2771, merge 92b42155b3), research library migrate ran against the operator library. The dry run, then the write, both reported shacl conforms=true violations=0. Receipt ops/migrations/2026-11-06T17-32-07.946Z-catalog-v2.json records validator research-library-shapes/1, v1 to v2, catalog e88cf958... to 5cda99e5..., index.md 1048b6e6... (unchanged on disk), and intakes 2026-10-06 and 2026-10-14. The pre-migration catalog was backed up to catalog/history/e88cf958....json. A second migrate run was a no-op. ontology render wrote research-library.ttl (521755de...) and research-library.shacl.ttl (267e1e0d...), byte-identical to the lane fold. verify on v2 reports shacl conforms=true violations=0 plus the 10 inherited data-gap integrity issues that main also reports.
