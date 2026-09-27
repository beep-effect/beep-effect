# Agents Server assertions

Use assertSome for the original finalization stop reason and assertTrue for
complete Option/Exit branch predicates. All existing conditional payload,
index, typed error and message checks remain. This includes newer branch checks
already present in the owned BlockRepair file. No expected value is invented.
Agents Server package audit and docgen pass before the property step.
