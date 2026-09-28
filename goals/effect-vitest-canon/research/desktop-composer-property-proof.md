# Composer schema property run count and seed

The existing public `it.effect.prop` now receives `{ arbitrary: fcRuns(100) }`.
The installed Effect Arbitrary runner's omitted-options default is 100 cases;
that historical floor is retained. The shared helper forwards the environment
run-count maximum and seed pin without changing the ComposerFeatures arbitrary,
codec equality assertion, or accepted sendOn values. Removing just the helper
import and options argument reproduces the previous file exactly.

A temporary observer recorded the actual property inputs. Each profile ran the
real property in a fresh Node process, then the observer was removed:

| Profile | Environment runs | Seed | Actual cases | Sequence |
| --- | ---: | ---: | ---: | --- |
| Original property | 137 | 4242 | 100 | Missing run-count forwarding |
| Updated floor | 1 | 4242 | 100 | Historical minimum retained |
| Updated raised | 137 | 4242 | 137 | Recorded |
| Updated replay | 137 | 4242 | 137 | Identical to raised |
| Updated alternate seed | 137 | 4243 | 137 | Different from raised |

No permanent probe, extra test, narrowed arbitrary, reduced case budget, or
changed timeout was introduced. The saved lens row describes an older native
`checkEffect` implementation; the current source already had canonical syntax,
so this repair targets the remaining option-forwarding gap.
