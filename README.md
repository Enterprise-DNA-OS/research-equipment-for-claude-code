# Research Equipment for Claude Code

Own the equipment booking desk: reservations, training evidence, maintenance holds and actual usage in one database.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code. Install and operate it yourself. | Your equipment rules, reports, records and connections. | Installed and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | One setup fee, then a retainer. [Build our version](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=qreserve) | One setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=qreserve) |

## The annual bill

[QReserve Premium](https://get.qreserve.com/pricing) lists US$10,000 per year, checked 26 October 2026. Core is US$3,000 and Standard is US$6,000 per year. Enterprise is quoted privately. This project addresses the internal research facility scheduling desk. It is independent of QReserve and does not reproduce every platform feature. Compare the work you actually use with your own contract.

## Quick start

Node 20 or later. PGlite runs locally without a database server; Postgres 15 or later supports a shared deployment.

```bash
git clone https://github.com/Enterprise-DNA-OS/research-equipment-for-claude-code.git
cd research-equipment-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
node scripts/facility.mjs help
```

The demo is fictional. Its dates are relative to the first seed. An overdue spectrometer service, expired cytometer training and an unreported microscope session make the weekly review concrete. Seeding is idempotent and refuses a remote working database. For an empty working database run only npm run migrate. DATA_DIR selects an embedded database; DATABASE_URL selects Postgres.

## The facility's week

32 CLI commands and 34 agent recipes. Claude Code, Codex, OpenCode and Cursor use the same files.

- /lab-week lists requested and approved sessions in the next seven days.
- /training-due lists recorded training that has expired, been revoked or is due within thirty days. /compliance also finds bookings with no training at all.
- /maintenance-board lists equipment holds and their owners.
- /usage-review compares booked and actual time for completed sessions.
- /charge-review groups internal usage estimates by project and currency.
- /weekly-review writes an internal draft from the week, attention and usage reports.
- /draft-booking-brief creates a local brief. Nothing sends.

Every CLI command supports --json. Codes match without case sensitivity, unique ID prefixes work, and partial names list candidates and exit 1 when ambiguous. All timestamps require explicit UTC offsets. Stored and displayed dates use UTC; convert local daylight-saving times before entry. [Full command reference](docs/cli.md).

## Approval has a reason

A booking starts requested. Approval checks equipment review, active equipment and operator, training coverage for the whole session, open maintenance windows and overlaps with approved reservations. Adjacent bookings are allowed. Database transactions serialize CLI mutations so two operators cannot approve conflicting slots at once.

Training dates are inclusive UTC calendar days. Evidence and assessor are required. Expiry periods are the facility's policy, not a statutory interval. A new hold or revoked training flags an already-approved session in /compliance; this software cannot stop the instrument. Operators check the record and physical safety before use.

Recording actual minutes completes an approved session and preserves the rate captured on approval. Estimates use actual minutes times the hourly rate, rounded to the nearest cent per statement. Project summaries add the rounded session estimates. Currencies stay separate. This is an internal estimate, not an invoice, tax calculation or payment system. Imported fees are source text, never assumed rates.

## Bring your QReserve history

Export Activity Reports > Download > Details CSV. Keep Reservation rows for single-unit equipment. Run one command after checking date formats:

```bash
node scripts/facility.mjs import qreserve examples/qreserve-details.csv --source="Example site" --actor="Migration operator" --dry-run
node scripts/facility.mjs import qreserve examples/qreserve-details.csv --source="Example site" --actor="Migration operator"
```

The fixture uses documented column names and fictional values, not a captured customer export. Imported bookings stay historical, with the original row preserved. Source approvals never become live permission. Resource rules, identity collisions, rates and training need reconciliation; create a fresh requested booking for future work. Repeating identical rows adds no bookings; changed source rows stop for explicit reconciliation. Any invalid row rolls back the file. [Export and reconciliation guide](docs/replace-qreserve.md).

## Ten questions across your records

The insights command answers each on the data today. QReserve offers custom reports and scripting; these are useful combined checks, not claims that its platform cannot answer them.

1. Which requested bookings lack current training?
2. Which reservations overlap maintenance holds?
3. Which approved sessions ended without usage?
4. Which instruments used more time than booked?
5. Which projects have recorded usage estimates by currency?
6. Which equipment rules still need review?
7. Which instruments have no completed usage?
8. Which operators have expired training?
9. Which equipment holds are overdue?
10. Which imported bookings still need reconciliation?

## Documents and views

brand.json sets business name, logo and colours. npm run docs creates equipment booking briefs, internal usage statements and equipment training/maintenance records. npm run view creates the coming week, attention and usage reports. Generated HTML is read-only and escapes imported text. /new-view adds another report. No browser application or server is required.

## Your first hour: ten things to ask for

1. Put our business name and colours on the reports.
2. Show tomorrow's equipment bookings.
3. Explain why the cytometer booking cannot be approved.
4. Find the expired training evidence.
5. Find the missing spectrometer service report.
6. Record actual minutes for the overdue microscope session.
7. Compare booked time with actual usage.
8. Do a test import and reconcile counts against the source.
9. Draft the facility's weekly review.
10. Add a cost-centre field with /customise and a tested migration.

## Operating boundaries and verification

One database per business and trusted internal operators only. No researcher login, self-service booking portal, hardware control, calendar synchronisation or tenant isolation exists in this base. Actor names are supplied labels, not authenticated signatures. RLS denies untrusted roles and views use caller permissions, but the owner can bypass application checks. Protect local files, source exports, evidence, outputs and backups. Test native backup restoration before live use. JSON export supports portability; it is not a tested disaster-recovery backup.

[Compliance sources and exact limits](docs/compliance.md). [Why no front end](docs/why-no-front-end.md). This is not an accreditation system, instrument interlock or certification of competence. No email, publishing, source-system mutation or payment operation exists.

npm test uses disposable data and exercises every command, conflicts, expired and revoked training, maintenance holds, inactive operators, rate snapshots, import rollback and idempotence, strict dates, CSV parsing, escaped HTML and CLI exit codes. Manual CI defines Windows/Linux Node 20/22 and Postgres checks. Local Linux results do not claim remote CI passed.

MIT. QReserve is its owner's trademark. This project is not affiliated with QReserve.
