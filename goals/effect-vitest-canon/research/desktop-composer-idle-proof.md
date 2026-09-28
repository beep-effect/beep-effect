# Composer send regression witnesses idle eviction

The test retains the actual editor, draft, 40 ms registry TTL, original 200 ms
wait, Send-button click, exact single-send assertion, and explicit unmount. Its
registry is now acquired in the Effect test scope and supplied through the
public RegistryContext, using the same React scheduler as RegistryProvider.

An unmounted state atom starts at zero, is written to one, and is positively
observed at one before rendering. After the existing wait it must read zero,
proving that an idle state actually expired in the same registry. The mounted
send-handler atom must survive: expecting that handler itself to expire would
contradict the production lifetime fix.

Two controls were restored after execution:

- Extending only the registry TTL beyond the unchanged wait passed the original
  test but failed the new probe assertion.
- Removing only the production onSendAtom lifetime mount failed the strengthened
  test, preserving detection of the original silent-send regression.

The normal Node run passed both original cases. No production behavior changed.

Full Desktop package verification passed (audit and docgen), along with the
Effect/Vitest ratchet (zero introduced findings), schema-first checks, and strict
baseline/census/ledger validation. A reverse-edit comparison exactly reproduced
the original file after removing only the registry ownership change and new
probe, confirming preservation of the original test cases and assertions.
The Desktop ledger remains open for complete package reconciliation.
