# @connected/ui

## 0.0.1

### Patch Changes

- d5f912b: Fix a horizontal scroll at 320px on `/school/classes` (NFR-011).

  A grid item's automatic minimum size is content-based, so the class table's min-content width made
  its column 321px inside a 288px page and scrolled the whole document sideways. `overflow-x: auto`
  on the table's own scroll container cannot shrink its parent — the track has to be told it may
  shrink, with `minmax(0, 1fr)`.

  **It had been red on `development` since 2026-08-09** and was merged anyway; this is the fix. It
  does not reproduce on macOS — the margin is a few pixels of font metrics — which is the same shape
  as the WebKit session-cookie defect S9-17 found: an environment-dependent failure the machine it
  was written on cannot see.

  The design system's scroll container now also carries `min-width: 0; max-width: 100%`, which is the
  half it can defend on its own, and the responsive suite gained the case that found this — a school
  with no classes yet, whose empty table is _wider_ than a populated one because the empty-state cell
  spans every column and does not wrap.
