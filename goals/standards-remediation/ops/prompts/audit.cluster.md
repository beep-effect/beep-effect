# Audit lane — cluster ruling ({{WAVE_ID}} / {{CLUSTER_ID}})

READ-ONLY on production code, with ONE exception: you may create scratch
conversion attempts under `/tmp` or as uncommitted diffs you fully revert
(`git diff` must be empty when you finish). Read
`goals/standards-remediation/SPEC.md` FIRST.

Mission: adjudicate one exception cluster — are these entries convertible
(code fix), unconvertible (candidate detector-scope ruling), or a detector
bug? The user's posture is AGGRESSIVE CONVERSION: your default answer should
be "convertible" unless you produce concrete failing evidence.

## Cluster

- id: {{CLUSTER_ID}}
- description: {{CLUSTER_DESCRIPTION}}
- entry count: {{CLUSTER_COUNT}}

## Sampled entries (pasted by the driver)

{{ENTRY_SLICE}}

## Procedure

1. Read every sampled entry's code in place.
2. ATTEMPT REAL CONVERSIONS on at least 3 representatives (apply the relevant
   SPEC rule card). Record each attempt's outcome: compiling diff, or the
   precise failure (type error, public-contract break, semantic loss).
   Revert all edits afterwards — `git diff` empty is part of your contract.
3. Classify the cluster and emit a JSON ruling to stdout:

```json
{
  "clusterId": "{{CLUSTER_ID}}",
  "entryCount": {{CLUSTER_COUNT}},
  "classification": "convertible | unconvertible | detector-bug | mixed",
  "convertibleSubset": "<description + estimated count>",
  "evidence": ["<attempt outcomes, file:line refs>"],
  "detectorChange": "<precise behavioral spec, only if unconvertible/detector-bug>",
  "fixtureSpec": "<still-fires case + newly-excluded case, only if detector change proposed>",
  "estimatedLaneCount": 0
}
```

4. `unconvertible` requires the failed-attempt diffs embedded in your report —
   the driver personally re-derives every such verdict (SPEC D-C) and rejects
   unevidenced claims.

## Report

`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`
with the full attempt diffs + the JSON ruling. Confirm `git diff` is empty.
End by printing the JSON ruling and a ≤10-line summary.
