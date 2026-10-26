# Import fixture

qreserve-details.csv is fictional test data using column names from QReserve's [Activity Reports documentation](https://get.qreserve.com/documentation/activity-reports), checked 26 October 2026. It is not a captured customer export. The importer reads Details CSV Reservation rows for single-unit equipment. All other columns survive in source_row. Currency and fees are preserved as source text, not turned into a live rate or invoice. Dates in this fixture include explicit offsets.
