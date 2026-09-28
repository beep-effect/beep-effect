# Ontology MCP platform fixture ownership

Native platform services now enter through public `it.layer` in the ontology HTTP
suite and each existing execution-authority acceptance layer. The HTTP suite has
a 10-second hook bound for the stateless platform fixture; its 120-second case
budget and the acceptance layers' five-minute hook budgets remain unchanged.

Every harness call retains its own scoped workspace, transport configuration,
ledger, MCP session headers, handler and client. The in-process web handler starts
an independent runtime, so filesystem and path services are explicitly bridged
from the outer fixture. The socket path continues to bind its own ephemeral port.

The original 13 cases passed under Node in both in-process and real loopback
socket modes, and under Bun in both modes. A temporary focused probe invoked
two harness calls, one succeeding and one failing after acquiring its workspace.
Both modes proved distinct workspace roots and directory removal before the
wrapper returned. The probe was removed; it does not increase the accepted test
count. This is lifetime preservation evidence, not a measured rebuild speedup.

The complete Desktop package audit and docgen passed. Syntax-tree comparison
preserved all 118 assertion subjects and all 13 original test titles. The root
ratchet keeps one existing wrapper finding open with its same occurrence identity;
only its formatting-dependent evidence excerpt and line positions moved. Two new
platform-import findings document the reviewed native integration exceptions.
