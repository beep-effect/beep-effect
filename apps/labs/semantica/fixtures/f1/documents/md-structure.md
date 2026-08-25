# Relational Cartography for Tidal Sensor Networks

## Abstract

Mira Venn, affiliated with the fictional Northglass Institute, proposed the Lantern Graph Method
for linking station outages to tidal anomalies. The team evaluated the method on the synthetic
Harbor Loom Dataset and found that explicit station-to-estuary relations reduced ambiguous alerts.

## 1. Study design

### 1.1 Participants and institutions

The project joined Northglass Institute with the invented Caldera Field Office. Tomas Rill directed
the field office and supplied calibration records to Mira Venn.

### 1.2 Method

The Lantern Graph Method follows four stages:

1. normalize each station identifier;
2. align readings to a shared tidal interval;
3. link anomalies to upstream stations; and
4. retain the evidence sentence for each relation.

| Method | Dataset | Relation recall |
| --- | --- | ---: |
| Lantern Graph Method | Harbor Loom Dataset | 0.84 |
| Window baseline | Harbor Loom Dataset | 0.61 |

The pipeline configuration was pinned as data:

```ts
const run = { method: "lantern-graph", intervalMinutes: 15 }
```

## 2. Findings

Mira Venn, affiliated with Northglass Institute, proposed the Lantern Graph Method. Tomas Rill,
employed by Caldera Field Office, curated the Harbor Loom Dataset. The method consumed that dataset
and produced the Estuary Alert Ledger.

## References

1. Venn, M. (2024). *Lantern Graph Method: synthetic protocol note*.
2. Rill, T. (2024). *Harbor Loom Dataset: fictional data card*.
