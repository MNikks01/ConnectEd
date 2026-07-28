# 14 — Search Capabilities & File / Media Management

## Part A — Search & Discovery

### A.1 What users can search / browse
- **Schools** — via **Find Schools** (mobile) / **Find to Follow › Schools** (web). Users browse the `SCHOOLS` collection and can follow a school or open its profile.
- **People (users / teachers / friends)** — via **Find Friends** (mobile) / **Find to Follow › Accounts / Teachers & Friends** (web). Users browse the `USERS` collection to follow or send connection requests.

### A.2 Search mechanics (observed)
- Discovery is implemented as **client-side browsing/filtering over the collection**, not a dedicated search index. **Assumption:** matching is done by loading candidate documents and filtering them in the client (name/handle), since there is no external search service (Algolia/Elastic) and no server query beyond Firestore reads.
- Web separates discovery into **tabs** (Accounts, Schools, Teachers & Friends), implying category-based filtering.

### A.3 Filters, sorting, recommendations
- **Sorting:** Notices and posts are ordered by **timestamp (newest first)** (`orderBy('NOTICE_TIMESTAMP','desc')`, and analogous for feeds).
- **Filters:** Academic content is inherently **filtered by scope** — a user only ever sees their own class/school data (medium+class+section). Homework is filtered by **subject** and **work type**.
- **Recommendations:** **None.** There is no recommendation/ranking engine — feeds are chronological aggregations of followed accounts; discovery is manual browsing.

### A.4 Search limitations
- No full-text search, fuzzy matching, or relevance ranking is evident.
- No global search across content types (you search *people* or *schools*, not "everything").

---

## Part B — File & Media Management

### B.1 Uploads
Users and schools upload images through **Firebase Storage** (via the mobile image picker / web file input):

| Upload | Path | By |
|---|---|---|
| User profile picture | `USERS/{uid}/Profile[/{key}]` | User |
| User post image(s) | `USERS/{uid}/Timeline[/{postId}]` | User |
| Homework/assignment/project image | `USERS/{uid}/Homeworks/{key}` | Teacher |
| School profile picture | `SCHOOLS/{uid}/Profile[/{key}]` | School |
| School post image(s) | `SCHOOLS/{uid}/Timeline/{key}` | School |
| Class timetable image | `SCHOOLS/{uid}/Timetable/{classKey}` | School |

- Images are converted to blobs and uploaded; the resulting download URL is stored on the related Firestore document.
- **Media type:** Predominantly **images**. No video or arbitrary-document (PDF/Doc) upload paths were found.

### B.2 Downloads / viewing
- Media is displayed via its Storage **download URL** referenced in Firestore.
- Timetables are viewed as images; posts and profiles render their image URLs; homework attachments are shown inline.
- Web uses an image slider/carousel for multiple post images (`react-simple-image-slider`); mobile uses an image slider box.

### B.3 Deletion / replacement
- Profile and timeline images can be **replaced/removed** (Storage `ref` deletions on `Profile`/`Timeline` observed). **Assumption:** replacing a profile picture deletes the previous object; full lifecycle management (orphan cleanup) is not guaranteed since it is client-driven.

### B.4 Storage governance
- **No Storage security rules** file exists — media access control is not enforced server-side (see [Missing Features](./16-missing-features.md)).
- No quota/size-limit enforcement was found in the client; **Assumption:** relies on Firebase defaults.

### B.5 Not supported (media)
- Video uploads, document/PDF attachments, audio/voice notes, and file-type validation are **not implemented**.
