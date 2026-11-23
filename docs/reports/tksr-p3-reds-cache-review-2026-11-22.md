# P3 dependency correction cache input review

Lejeune drops its unused nlp dependency. Law-practice use-cases declares semantic-web
as a development dependency because OfficeActionReview.flow.test.ts imports it.
Generated configuration now reflects those exact edges. Commands, outputs and
environment declarations are unchanged. Existing qualification scope and epoch
are preserved; this configuration review grants no new qualification.
