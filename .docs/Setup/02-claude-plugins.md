# Claude Code Plugins — Catalogue

`Status: Reference` · `Last updated: 2026-07-28`

Plugins/marketplaces the team uses. Installed via Claude Code's `/plugin` commands (run them in the Claude Code
prompt, not the shell). **Not auto-installed.**

## Marketplaces & plugins

| Plugin | Commands |
|---|---|
| Vercel plugin | `npx plugins add vercel/vercel-plugin` |
| Obsidian skills | `/plugin marketplace add kepano/obsidian-skills` → `/plugin install obsidian@obsidian-skills` |
| ui-ux-pro-max | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` → `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| Anthropic example skills | `/plugin marketplace add anthropics/skills` → `/plugin install example-skills@anthropic-agent-skills` |
| Claude Code setup (official) | `/plugin install claude-code-setup@claude-plugins-official` |

## Maintenance commands

```
/reload-plugins
/plugin marketplace update claude-plugins-official
```

> Note: the last item was written as `claude-plugins-offiicial` in the source notes — the correct marketplace id
> is `claude-plugins-official`.

## Curated catalogue

- awesome-claude-skills (1000+ skills & plugins): https://github.com/ComposioHQ/awesome-claude-skills

## Guidance

- Prefer project-relevant plugins (design, UI/UX, planning) that map to our `.agents` roles.
- Review a marketplace's source before adding it; plugins can run code and read your workspace.
- Keep this list in sync as the team adopts/drops tools (technical-writer owns).
