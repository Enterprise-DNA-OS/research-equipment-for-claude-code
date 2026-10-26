# Equipment readiness checks

Checked 26 October 2026. The commands implement facility record controls. They do not determine legal compliance or authorise equipment use.

## NZ training principles

[WorkSafe: information, training, instruction and supervision](https://www.worksafe.govt.nz/managing-health-and-safety/businesses/general-requirements-for-workplaces/providing-information-training-instruction-or-supervision-for-workers/) explains the duty to provide suitable training and supervision. It explicitly says training records are not required by that rule, although useful. This project uses evidence and expiry records as an internal control, not a claim that the law mandates a certificate or a fixed renewal interval.

TRAINING flags a requested or approved session without non-revoked equipment-specific evidence covering the entire interval. The assessor, evidence reference, valid-from and valid-until are entered by the business. No automatic interval is invented. The base does not model supervised exceptions; assess those separately. Recorded evidence is not proof of competence.

## Maintenance principles

[Safe Work Australia: managing plant risks, November 2024 model code](https://www.safeworkaustralia.gov.au/sites/default/files/2024-11/model_code_of_practice-managing_the_risks_of_plant_in_the_workplace-nov24.pdf) describes inspection and maintenance systems and competent people. A model code is not automatically the applicable law in every state or territory. Confirm the local rules, manufacturer instructions and equipment-specific hazards before adoption.

MAINTENANCE flags a session overlapping an open hold. MAINTENANCE_OVERDUE finds an open hold whose end has passed. Closing requires an evidence reference. A scheduled end is not proof that work finished, and this software has no physical interlock. Equipment still unavailable needs a current hold covering affected time.

## House rules, not statutory thresholds

RESOURCE_REVIEW: imported equipment starts unreviewed. A facility owner supplies rules and rates before live approval.
INACTIVE: inactive equipment or people cannot pass approval.
CONFLICT: one exclusive resource cannot be approved for overlapping sessions. Adjacent intervals are valid.
USAGE_MISSING: a session ended without actual minutes. This is follow-up work, not a regulatory offence.
IMPORT_REVIEW: historic rows do not become live bookings automatically.

The thirty-day training warning and seven-day weekly view are convenience windows. They are not legal deadlines. The approval command checks future requested bookings in one transaction. New evidence changes and holds can affect already-approved bookings; run compliance before use. The database owner can bypass these checks, actor labels are unauthenticated, and specialist hazards or mandatory registrations are outside this base. No accreditation, qualification, clinical decision or regulatory filing is issued.
