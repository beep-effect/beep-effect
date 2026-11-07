# Retained CI Ops evidence

These committed fixtures remain executable inputs after the
`ciops-ontology-pipeline` goal packet was archived. They were copied from
accepted pre-archive commit `7e0288484841963d726c0ee69ac6dcf6688d32f9`.
The complete historical packet is retained in the
[goal archive](https://github.com/beep-effect/beep-effect-goals-archive/tree/f77d31261342f65d8d383ddedb153e898121a16d/goals/ciops-ontology-pipeline).

The adoption table and S7 replay evidence preserve their original bytes. The
KPI JSON and Markdown retain their measurements and source pins; only the
adoption-table locator changes to this package-owned fixture directory. The
adoption-table SHA-256 and the replay golden-render SHA-256 remain unchanged.
Historical authority citations inside the retained evidence stay historical.

The shared KPI pins, evidence reader and independent test pin now locate these
files in the owning package. No fixture is fetched from the network during a
test, and the archived packet is not recreated. Existing equality and digest
checks continue to validate the retained evidence.
