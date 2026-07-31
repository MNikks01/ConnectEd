# Claude Code Skills — Catalogue

`Status: Reference` · `Last updated: 2026-07-28`

Skills the team uses with Claude Code, grouped by purpose. **Nothing here is installed automatically** — install
deliberately (most are global `-g`, modifying your `~/.claude`). See
[`../../scripts/setup-claude.sh`](../../scripts/setup-claude.sh).

> Vetting note: these are third-party tools sourced from the project owner. Review each before installing;
> `-g` installs and `npm i -g` affect your whole machine/Claude config.

## Skill discovery / management

| Skill                     | Install                                               |
| ------------------------- | ----------------------------------------------------- |
| find-skills (Vercel Labs) | `npx skills add vercel-labs/skills@find-skills -g -y` |

## Design / frontend / UI

| Skill                                   | Source                                                          | Install                                                                          |
| --------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Vercel agent-skills (design guidelines) | vercel-labs/agent-skills · https://vercel.com/design/guidelines | `npx skills add vercel-labs/agent-skills`                                        |
| brandkit                                | Leonxlnx/taste-skill                                            | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "brandkit"`      |
| image-to-code                           | Leonxlnx/taste-skill                                            | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "image-to-code"` |
| Emil Kowalski design-eng skills         | emilkowalski/skills                                             | `npx skills@latest add emilkowalski/skills`                                      |
| ui-ux-pro-max (CLI)                     | nextlevelbuilder/ui-ux-pro-max-skill                            | `npm i -g uipro-cli && uipro init --ai claude`                                   |
| ai-website-cloner-template              | JCodesMore/ai-website-cloner-template                           | `git clone https://github.com/JCodesMore/ai-website-cloner-template.git`         |

## Planning / engineering strategy

| Skill                              | Source                            | Install                                                                                                                                       |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| gstack (YC-CTO "engineering team") | garrytan/gstack                   | `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup` |
| Andrej Karpathy skills             | multica-ai/andrej-karpathy-skills | `git clone https://github.com/multica-ai/andrej-karpathy-skills.git`                                                                          |

## Marketing / product

| Skill                                    | Source                        | Install                                                          |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| marketing skills                         | coreyhaines31/marketingskills | `git clone https://github.com/coreyhaines31/marketingskills.git` |
| last30days (agent search, upvote-scored) | mvanhorn/last30days-skill     | `git clone https://github.com/mvanhorn/last30days-skill.git`     |

## Memory / context / token optimization

| Skill / tool                               | Source                | Install / use                                            |
| ------------------------------------------ | --------------------- | -------------------------------------------------------- |
| headroom-ai (token optimization)           | npm                   | `npm install headroom-ai`                                |
| caveman (≈65% fewer output tokens)         | JuliusBrussee/caveman | `git clone https://github.com/JuliusBrussee/caveman.git` |
| claude-mem (persistent memory compression) | thedotmack/claude-mem | `git clone https://github.com/thedotmack/claude-mem.git` |
| mempalace (local-first AI memory)          | MemPalace/mempalace   | `git clone https://github.com/MemPalace/mempalace.git`   |

## Reference / graph / security

| Skill / tool                               | Source                                      | Notes                                                                          |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------ |
| graphify (graph for AI code understanding) | safishamsi/graphify                         | `git clone https://github.com/safishamsi/graphify.git`                         |
| defending-code reference harness           | anthropics/defending-code-reference-harness | `git clone https://github.com/anthropics/defending-code-reference-harness.git` |
| awesome-claude-skills (1000+ curated)      | ComposioHQ/awesome-claude-skills            | Catalogue to browse: https://github.com/ComposioHQ/awesome-claude-skills       |

## Official docs

- Using skills: https://support.claude.com/en/articles/12512180-using-skills-in-claude
- Creating custom skills: https://support.claude.com/en/articles/12512198-creating-custom-skills
- Anthropic skills repo: https://github.com/anthropics/skills
