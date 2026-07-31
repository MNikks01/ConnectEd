#!/usr/bin/env bash
#
# setup-claude.sh — OPTIONAL installer for the Claude Code skills the ConnectEd
# team uses. This is DOCUMENTATION-as-script: it is NOT run automatically and is
# NOT required to work on the repo.
#
# Read it fully before running. Most of these are GLOBAL installs that modify
# your ~/.claude directory and/or install global npm packages. They are
# third-party tools — vet each one. See:
#   .docs/Setup/01-claude-skills.md
#   .docs/Setup/02-claude-plugins.md   (plugins are installed via /plugin in Claude Code, not here)
#
# Usage:
#   bash scripts/setup-claude.sh            # interactive: asks before each group
#   bash scripts/setup-claude.sh --all      # install everything (still prompts once)
#
set -euo pipefail

confirm() {
  # $1 = prompt
  if [[ "${INSTALL_ALL:-0}" == "1" ]]; then return 0; fi
  read -r -p "$1 [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

INSTALL_ALL=0
[[ "${1:-}" == "--all" ]] && INSTALL_ALL=1

SKILLS_DIR="${HOME}/.claude/skills"
mkdir -p "$SKILLS_DIR"

echo "== ConnectEd :: optional Claude skills setup =="
echo "Target skills dir: $SKILLS_DIR"
echo "NOTE: plugins (Obsidian, ui-ux-pro-max, vercel, etc.) are installed via /plugin"
echo "      inside Claude Code — see .docs/Setup/02-claude-plugins.md."
echo

if confirm "Install skill-discovery (find-skills, global)?"; then
  npx skills add vercel-labs/skills@find-skills -g -y
fi

if confirm "Install Vercel agent-skills (design guidelines)?"; then
  npx skills add vercel-labs/agent-skills
fi

if confirm "Install taste-skill: brandkit + image-to-code?"; then
  npx skills add https://github.com/Leonxlnx/taste-skill --skill "brandkit"
  npx skills add https://github.com/Leonxlnx/taste-skill --skill "image-to-code"
fi

if confirm "Install Emil Kowalski design-eng skills?"; then
  npx skills@latest add emilkowalski/skills
fi

if confirm "Install ui-ux-pro-max CLI (global npm) + init for claude?"; then
  npm i -g uipro-cli
  uipro init --ai claude
fi

if confirm "Install gstack (planning/engineering-team) into ~/.claude/skills?"; then
  if [[ ! -d "$SKILLS_DIR/gstack" ]]; then
    git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$SKILLS_DIR/gstack"
    ( cd "$SKILLS_DIR/gstack" && ./setup )
  else
    echo "gstack already present, skipping clone."
  fi
fi

if confirm "Install token-optimization helper (headroom-ai, local npm in cwd)?"; then
  npm install headroom-ai
fi

cat <<'NEXT'

Done with the selected groups.

Other tools catalogued in .docs/Setup/01-claude-skills.md that you may clone manually:
  - andrej-karpathy-skills, marketingskills, last30days-skill
  - caveman, claude-mem, mempalace (memory/token tools)
  - graphify, defending-code-reference-harness
  - awesome-claude-skills (browse the 1000+ catalogue)

Plugins (run inside Claude Code):
  /plugin marketplace add anthropics/skills && /plugin install example-skills@anthropic-agent-skills
  /plugin marketplace add kepano/obsidian-skills && /plugin install obsidian@obsidian-skills
  /plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill && /plugin install ui-ux-pro-max@ui-ux-pro-max-skill
NEXT
