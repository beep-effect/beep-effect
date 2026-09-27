# Phoenix assertion checkpoint

Four exact Boolean expectations now use assertTrue/assertFalse. The prompt
existence operand and all three declared schema-equivalence comparisons retain
their original polarity and inputs. No generic error equality replaces the
schema's declared equivalence function. Existing transport/config error class,
operation, reason and cause assertions remain intact.

The token comparison permits only the four replacements and import changes;
all remaining test bodies, SDK fixtures, property domains, fcRuns(5), layer
options and deadlines are identical. Package audit/docgen pass. Configured
Node/Bun both pass nine cases with stable source hashes in 3.621/1.516 seconds.
Property, flake, runner and final inventory work remain.
