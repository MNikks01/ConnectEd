# CLAUDE.md — `.agents`

Team **role charters**. Each `*.md` defines a role's mission, responsibilities, owned docs, standards, and
definition of done. They serve two purposes: onboarding humans, and acting as **personas/prompts for AI
subagents**.

## Using these as subagent personas

When spawning a subagent for role-shaped work, load the matching charter as context so the agent inherits the
role's responsibilities and quality gates (e.g. the `security-engineer` charter enforces server-side authZ +
permission tests). Charters describe responsibilities, not head-count — one actor may wear several.

## Editing

- Keep the charter shape consistent (see [`README.md`](README.md)): Mission · Responsibilities · Owns · Inputs/
  Outputs · Standards & gates · Collaborates with · Definition of done.
- A charter's **Owns** and **Standards** must stay consistent with the `.docs` it points at — if a gate changes
  in `.docs/Checklists` or an ADR, reflect it here.
- Cross-link related roles and the docs they own.

## Roster

See [`README.md`](README.md) for the full 24-role index.
