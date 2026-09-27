# Docgen native schema parity property

The original single grouped registration becomes native it.prop with nine
named schema-derived inputs. All schema equivalence and codec operations stay
intact. Eight schema families retain the 12-run minimum; Printable increases
from four to twelve runs to share the same group. The original registration
deadline is unchanged. fcRuns now carries the environment floor and seed.

The package audit and docgen pass. All five SchemaParity tests pass with
BEEP_FC_NUM_RUNS=400 and BEEP_FC_SEED=20260708. An inverted equivalence assertion
fails the native property with replay details; source bytes are restored.
The direct test-utils development dependency and generated references support
the existing shared floor helper. Cache review will accompany runner adoption.
