---
title: "Each census run is one JSON file under standards/agent-output-census/runs"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Move the run files and update the command's default directory."
---

The baseline is a tracked standard other goals cite, so it sits beside the repository's other measured baselines. One file per run, named by the window end and the rule version, decoded by the baseline file schema; the command refuses to overwrite an existing file, so no run edits another's. The reproduction run is the first file.
