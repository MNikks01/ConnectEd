---
'@connected/types': patch
---

Report cards on screen (S8-7), and the term list a class teacher needs to reach them.

A school defines its terms at `/school/terms`; a class teacher issues a class's cards at
`/classes/:id/report-cards`, and pupils and parents read their own there. The card renders the
stored snapshot and computes nothing — the whole point of the feature is that what it says was
decided when it was issued.

Listing a school's terms is now open to any verified member of that school, rather than to the
school account alone. Issuing names a term and the class teacher who issues is not the school, so
the narrower rule allowed the action while hiding the only list to choose from.
