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

## Current Source

This project was started from `personal-vault-ui` so the existing UI could remain visible while the architecture is split into:

- `Personal Vault`: headless private memory backend
- `Personal Dashboard`: human-facing daily dashboard
