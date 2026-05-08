# Meridian

A smart, single-file diagram generator that turns plain-text descriptions of systems into Mermaid.js diagrams — no syntax knowledge required.

**Designed by AK (Aravind Kannan)**

---

## Overview

Meridian lets you describe your architecture, data flows, or system relationships in a simple, readable shorthand and instantly renders a professional diagram. It supports enterprise-grade grouping with business domain ownership, network zone boundaries, and 12 entity types.

## Features

- **12 entity types** — app, db, server, instance, interface, config, batch, watcher, ftp, net, domain, env
- **Auto-detection** — smart type inference from names (e.g. `api_gateway` → interface, `postgres` → db)
- **Business domain groupings** — colour-coded dashed subgraphs for team/org ownership (`domain:`)
- **Network zones** — security boundary subgraphs with distinct colours (`net:`)
- **Environment blocks** — deployment topology groupings (`env:`)
- **Hybrid mode** — entities can appear in both env and domain simultaneously, with fill overrides showing ownership
- **All arrow styles** — normal, labelled, bidirectional, pre-dashed, post-thick, chained (`>>`)
- **4 diagram types** — Flowchart LR, Flowchart TD, Sequence, Class
- **5 themes** — Default, Dark, Forest, Neutral, Base
- **8 templates** — quick-start presets covering microservices, ETL, network architecture, enterprise domains, and more
- **Copy & export** — copy Mermaid code, copy as fenced block, copy as Markdown, download SVG, download PNG
- **Shareable URLs** — encode current diagram state into a URL hash for sharing
- **Help modal** — built-in reference panel (press `?` or `F1`)
- **Keyboard shortcuts** — `Ctrl+Enter` render, `Ctrl+Shift+C` copy, `Ctrl+Shift+S` share, `Ctrl+Shift+F` fullscreen, `Ctrl+±` zoom
- **Auto-save** — state persisted to `localStorage`
- **Single file** — zero build step, zero dependencies beyond CDN

## Quick Start

Open `index.html` in any modern browser — no server required.

```
app:Frontend --> api:Backend --> db:Postgres
```

Renders instantly. Add groupings:

```
env:Production {
  app:Frontend
  app:Backend
  db:Postgres
}

domain:Engineering {
  app:Frontend
  app:Backend
}

domain:Data {
  db:Postgres
}
```

## Syntax Reference

### Entity Types

| Prefix | Type | Shape |
|--------|------|-------|
| `app:` | Application | Rounded rectangle |
| `db:` | Database | Cylinder |
| `server:` | Server | Rectangle |
| `instance:` | Container/Instance | Subroutine |
| `interface:` / `api:` | API / Interface | Parallelogram |
| `config:` | Config/Setting | Trapezoid |
| `batch:` | Batch Job / ETL | Hexagon |
| `watcher:` | File Watcher | Stadium |
| `ftp:` | FTP / SFTP | Rectangle |
| `env:` | Environment | Subgraph |
| `net:` | Network Zone | Subgraph |
| `domain:` | Business Domain | Subgraph |

### Arrow Styles

| Syntax | Style |
|--------|-------|
| `A --> B` | Normal arrow |
| `A --> B : label` | Labelled arrow |
| `A <--> B` | Bidirectional |
| `A --o B` | Pre-dashed |
| `A ==> B` | Post-thick |
| `A >> B >> C` | Chain |

### Grouping Blocks

```
env:Production {
  app:API
  db:Postgres
}

net:DMZ {
  app:Nginx
}

domain:Finance {
  app:Billing
  db:Transactions
}
```

### Natural Language Connectors

The following phrases are recognised as arrows:

`calls`, `sends to`, `reads from`, `writes to`, `connects to`,
`depends on`, `triggers`, `subscribes to`, `publishes to`,
`syncs with`, `authenticates via`, `routes to`

Example:
```
app:Frontend calls app:Backend
app:Backend reads from db:Postgres
```

## Tips

- Use underscores for multi-word names: `app:Payment_Service`
- Nodes are deduplicated automatically — define the same entity in multiple blocks freely
- Comments start with `//`
- Domain subgraphs only render for entities not already inside an `env:` block; those entities receive fill-colour overrides instead

## Templates

Press **Templates** in the toolbar to load any of the built-in presets:

1. Microservices Architecture
2. Data Pipeline (ETL)
3. Authentication Flow (Sequence)
4. Class Hierarchy
5. Enterprise Domain Architecture
6. ETL Pipeline
7. File Processing Pipeline
8. Network Architecture

## Dependencies (CDN)

- [Mermaid.js v10](https://mermaid.js.org/) — diagram rendering
- [Tailwind CSS v3](https://tailwindcss.com/) — utility styling

No npm, no build step.

## License

Copyright 2026 AK (Aravind Kannan)

Licensed under the [Apache License 2.0](LICENSE).
