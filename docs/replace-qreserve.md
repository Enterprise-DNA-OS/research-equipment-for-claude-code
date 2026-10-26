# Bring QReserve activity across

Source checked 26 October 2026: [QReserve Activity Reports](https://get.qreserve.com/documentation/activity-reports). The vendor documents Details CSV with reservation IDs, resources, users, dates, status and usage. This adapter does not need an account connection.

1. In QReserve, open Activity Reports, choose the full date range and resources, and download Details CSV. Retain an untouched private copy.
2. Keep Type=Reservation rows for one unit of exclusively booked equipment. Export requests, loans, instrument logins, pooled capacity and other activity separately for scoped migration.
3. Check Date and Date End. Use ISO timestamps with offsets. For a file with one known offset, --offset=+13:00 attaches it to naive ISO timestamps. Do not apply one offset across a daylight-saving change. Convert regional date formats explicitly before importing.
4. Run node scripts/facility.mjs import qreserve FILE.csv --source="YOUR SITE" --actor="YOUR NAME" --dry-run. Then repeat without --dry-run. Use the same source label for repeat imports.
5. Reconcile source and destination reservation/resource counts, date ranges and actual minutes. Every original field remains in source_row. Repeated unchanged rows skip; a changed source row rejects the file rather than erasing previous evidence.
6. Review resource identities, locations, owners and rates, and operator name collisions. This export does not supply stable operator/resource IDs, so the source label and exact display names identify imported placeholders. Two people or resources with identical names require separate migration mapping before operational use.
7. Record equipment-specific training and maintenance. Historical source approvals stay imported. For future sessions create new requested bookings after reconciliation and approve against current records.

Required columns: Reservation ID, Type, Status, Date, Date End, Resource and User. Units may be blank or numeric one; named/multiple units reject. Projects, Purpose and Actual Minutes are optional. Fees, notes, source approval and every extra column remain in the raw source row. No fee is treated as an hourly rate. No imported row blocks a live slot or grants equipment access.

examples/qreserve-details.csv is a synthetic compatibility fixture. It verifies the documented headers, not every vendor configuration. Resource settings, attachments, training certificates, approval identities, recurring rules, payments, custom scripts and integrations need separate reconciliation. Keep evidence files as well as references. This is a one-command activity import, not a claim that all configuration migrates automatically in a day.
