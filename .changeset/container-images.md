---
---

The API, the worker and the web app can now be built as container images (S9-1). No product change.

`lib/api-client.ts` now prefers a runtime `API_URL` over the build-time `NEXT_PUBLIC_API_URL`. The
module is server-side only, and a `NEXT_PUBLIC_*` value is inlined into the bundle — so an image
built with one would be pinned to the API it was built against, and staging and production would
need different images of identical code. The public variable stays as a fallback.
