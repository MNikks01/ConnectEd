# ADR-0009 — S3-compatible object storage for media

Status: Accepted
Date: 2026-07-28

## Context

The product stores media: profile pictures, timeline post images, homework attachments, school posts, class
timetables (legacy Firebase Storage paths). The app server must not proxy large binaries, and media must never be
world-writable (a legacy gap — no storage rules).

## Decision

Store all media in **S3-compatible object storage** (AWS S3 in cloud; MinIO for local Docker Compose). Uploads
and downloads use **short-lived signed URLs** issued by the API after authorization. The API stores only object
keys + metadata in Postgres. File type and size are validated; images are processed/normalized asynchronously.

## Consequences

- **Positive:** offloads bandwidth from the app server; access controlled by authZ-gated signed URLs; portable
  across clouds; local parity via MinIO.
- **Negative:** signed-URL lifecycle and CORS config to manage; async image processing pipeline to build.
- **Follow-ups:** bucket layout (`users/<id>/profile`, `.../timeline`, `classes/<id>/timetable`, etc.), CDN in
  front for public assets, lifecycle rules for orphaned objects.

## Alternatives

- **Serve media from the API/DB** — rejected: scales poorly, bloats the DB, ties up app workers.
- **Firebase Storage** — rejected: same governance gaps and vendor coupling we're leaving.
