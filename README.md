# Personal Dashboard

Personal Dashboard is the user-facing daily surface for the Personal Vault.

The dashboard should not own the user's durable memory. It should read from a headless Personal Vault boundary and render the human-facing surfaces:

- Today brief
- Vault browser and search
- Planner projection
- Recent changes
- Future mobile/PWA notification flow

## Architecture Direction

```text
Personal Vault
  raw/
  structured/
  indexes/
  config/
        |
        v
Vault API / MCP / CLI
        |
        v
Personal Dashboard
  Today
  Vault
  Planner
  Recent
```

Planner state should eventually be generated from vault context rather than maintained as an isolated `state/plan.json`.

## Development

```bash
npm install
npm run dev -- --port 3002
```

Open [http://localhost:3002](http://localhost:3002).

## Import ChatGPT Export

Use the importer to convert an official ChatGPT data export into a readable Personal Vault structure.

```bash
npm run import:chatgpt -- --source ~/Downloads/chatgpt-export --vault ~/personal-vault --dry-run
npm run import:chatgpt -- --source ~/Downloads/chatgpt-export --vault ~/personal-vault --write
```

The importer writes human-readable Markdown and keeps uploaded/generated files beside each discussion:

```text
raw/YYYY/MM/
  YYYY-MM-DD-conversation-title.md
  YYYY-MM-DD-conversation-title.assets/
    file-id--original-name.ext
indexes/
  chatgpt-conversations.jsonl
  chatgpt-assets.jsonl
  chatgpt-import-manifest.md
```

ChatGPT is recorded in frontmatter and index metadata rather than as a separate `raw/chatgpt` folder. Dry-run is the default unless `--write` is passed.

## Current Source

This project was started from `personal-vault-ui` so the existing UI could remain visible while the architecture is split into:

- `Personal Vault`: headless private memory backend
- `Personal Dashboard`: human-facing daily dashboard
