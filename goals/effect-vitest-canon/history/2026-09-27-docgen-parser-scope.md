# Docgen parser scope and teardown controls

The parser suite obtains Path through it.layer and retains concurrent:false.
Pure per-case Source/configuration values are supplied through Context; private
Layer.build wrappers and runSync boundaries are removed. Four synchronous
re-export registrations now use it.effect, preserving every source and oracle.
Full package audit and docgen pass.

Two temporary controls exercise the actual docgen fixture acquisition and
child: one fails after acquisition, the other interrupts the running test fiber.
Both verify child termination and directory removal after scope closure.
Control source is restored byte-for-byte. These controls supplement the normal
completion cleanup checks; no production process or filesystem is mocked.
