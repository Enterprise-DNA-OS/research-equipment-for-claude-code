# Commands

Run node scripts/facility.mjs COMMAND. All commands accept --json. Flags use --name=value; quote values containing spaces. Names match case-insensitively; exact codes take precedence. Ambiguous references list candidates and exit 1. A mutation needs --actor. Times must be ISO with Z or an explicit offset, dates YYYY-MM-DD. Rate cents are integers and actual minutes allow two decimal places.

| Command | Arguments or result |
|---|---|
| help | Show this command list |
| resources | Equipment and rules |
| people | Operators |
| bookings | All booking records |
| lab-week | Bookings in the next seven days |
| training-due | Expired, revoked or expiring recorded training |
| maintenance-board | Open equipment holds |
| usage-review | Completed booked versus actual minutes |
| charge-review | Estimates by project and currency, never invoices |
| attention | Work needing attention |
| compliance | Record checks, not certification |
| insights | Ten cross-record answers |
| show | BOOKING: detail and history |
| history | SUBJECT: event history |
| add-resource | --code --name --location --owner --rate-cents --currency --training=yes / no --actor |
| review-resource | RESOURCE --owner --rate-cents --currency --training=yes / no --actor |
| add-person | --code --name --actor |
| set-active | resource / person REF --active=yes / no --actor |
| record-training | --person --resource --from=DATE --until=DATE --evidence --assessor --actor |
| revoke-training | CREDENTIAL_ID --reason --actor |
| book | --code --resource --person --project --purpose --start=ISO --end=ISO --actor |
| approve | BOOKING --actor |
| cancel | BOOKING --reason --actor |
| record-usage | BOOKING --minutes --actor |
| hold-equipment | RESOURCE --start=ISO --end=ISO --reason --owner --actor |
| close-hold | HOLD_ID --evidence --actor |
| log | BOOKING --note --actor |
| weekly-review | Write a local weekly review from three reports |
| draft-booking-brief | BOOKING: write a local brief |
| import | qreserve FILE.csv --source=SITE --actor [--offset=+13:00] [--dry-run] |
| imports | Import receipts |
| export | --out=NEW_FILE.json: all records |

history takes a subject UUID or a unique prefix of at least eight characters. /training-due covers existing credential records; /compliance finds missing training for bookings. /bookings includes all dates and imported history. /lab-week excludes imported history and cancelled sessions.

Read outputs use UTC. Booking intervals are half-open: an end at 10:00 does not conflict with a start at 10:00. Credentials cover inclusive UTC dates. Maintenance holds stop approval only where their time window overlaps. A closed hold remains in history. Record a new open hold when equipment remains unavailable.

Import defaults to documented Details CSV headers. --offset is only for naive ISO timestamps in a file whose offset is known to be uniform. Split exports crossing a daylight-saving change or normalise each timestamp to an offset first. Unsupported activity types, quantities, invalid dates and changed rows reject the entire import. --dry-run rolls back all import writes.
