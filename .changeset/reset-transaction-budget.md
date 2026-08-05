---
---

The integration suite's database reset no longer shares a five-second budget between its lock timeout and Prisma's transaction timeout, and refuses to run against a database it is not allowed to empty. Test harness only.
