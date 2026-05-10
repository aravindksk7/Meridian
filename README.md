# Meridian

A smart, single-file diagram generator that turns plain-text descriptions of systems into Mermaid.js diagrams — no syntax knowledge required.

**Designed by AK (Aravind Kannan)**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## Overview

Meridian lets you describe your architecture, data flows, or system relationships in a simple, readable shorthand and instantly renders a professional diagram. It supports enterprise-grade grouping with business domain ownership, network zone boundaries, and 12 entity types — all in a zero-dependency single HTML file.

## Features

### Editing
- **12 entity types** — app, db, server, instance, interface, config, batch, watcher, ftp, net, domain, env
- **Auto-detection** — smart type inference from names (e.g. `api_gateway` → interface, `postgres` → db, `ec2_instance` → server)
- **Compound name support** — underscore and hyphen separators handled correctly in auto-detection
- **Syntax highlighting** — token-coloured input panel with entity types, arrows, labels, and comments in distinct colours
- **Real-time rendering** — diagram updates as you type

### Grouping & Topology
- **Business domain groupings** — colour-coded dashed subgraphs for team/org ownership (`domain:`)
- **Network zones** — security boundary subgraphs with distinct colours (`net:`)
- **Environment blocks** — deployment topology groupings (`env:`)
- **Hybrid mode** — entities can appear in both `env:` and `domain:` simultaneously; domain ownership shown through fill-colour overrides

### Diagrams
- **4 diagram types** — Flowchart LR, Flowchart TD, Sequence, Class
- **5 themes** — Default, Dark, Forest, Neutral, Base
- **All arrow styles** — normal, labelled, bidirectional, pre-dashed, post-thick, chained (`>>`)
- **12 natural language connectors** — `calls`, `sends to`, `reads from`, `writes to`, `connects to`, `depends on`, `triggers`, `subscribes to`, `publishes to`, `syncs with`, `authenticates via`, `routes to`

### UI & Theme
- **Dark / light theme** — full CSS design token system, switchable via toolbar
- **Checkerboard canvas** — distinct preview background pattern, theme-aware
- **Pan & zoom** — drag to pan, Ctrl+scroll or Ctrl+±/−, fit-to-window button
- **Resizable panels** — drag the divider to adjust input/preview split
- **Fullscreen preview** — expand diagram to full viewport

### Productivity
- **8 templates** — quick-start presets covering microservices, ETL, network architecture, enterprise domains, authentication flow, file processing, class hierarchy, and more
- **Snippet library** — save, name, and reload your own diagram snippets
- **Copy & export** — copy Mermaid code, copy as fenced block, copy as Markdown, download SVG, download PNG (2×)
- **Shareable URLs** — encode full diagram state (input, type, theme) into a URL hash
- **Help modal** — built-in reference panel (press `?` or `F1`)
- **Auto-save** — state persisted to `localStorage`

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Render diagram |
| `Ctrl+Shift+C` | Copy Mermaid code |
| `Ctrl+Shift+S` | Copy share URL |
| `Ctrl+Shift+F` | Toggle fullscreen |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |
| `?` or `F1` | Open help |
| `Escape` | Close modal |

---

## Quick Start

Open `index.html` in any modern browser — no server, no build step required.

```
app:Frontend --> api:Backend --> db:Postgres
```

Add groupings:

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

---

## Syntax Reference

### Entity Types

| Prefix | Type | Shape |
|--------|------|-------|
| `app:` | Application | Rounded rectangle |
| `db:` | Database | Cylinder |
| `server:` | Server | Rectangle |
| `instance:` | Container / Instance | Subroutine |
| `interface:` / `api:` | API / Interface | Parallelogram |
| `config:` | Config / Setting | Trapezoid |
| `batch:` | Batch Job / ETL | Hexagon |
| `watcher:` | File Watcher / Monitor | Stadium |
| `ftp:` | FTP / SFTP Server | Rectangle |
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
| `A >> B >> C` | Chained arrows |

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

```
app:Frontend calls app:Backend
app:Backend reads from db:Postgres
batch:ETL writes to db:Warehouse
app:Auth authenticates via config:JWT
```

### Comments

Lines beginning with `//` are ignored:

```
// This is a comment
app:Frontend --> app:Backend
```

---

## Tips

- Use underscores for multi-word names: `app:Payment_Service`
- Nodes are deduplicated — the same entity can appear in multiple blocks
- Domain subgraphs only render for entities not inside an `env:` block; those entities receive colour overrides instead
- Auto-detection works on compound names: `ec2_instance` → server, `rest_api` → interface

---

## Templates

Press **Templates** in the toolbar to load any built-in preset:

| # | Name | Covers |
|---|------|--------|
| 1 | Microservices Architecture | Service mesh, API gateway, databases |
| 2 | Data Pipeline (ETL) | Batch jobs, data warehouse, orchestration |
| 3 | Authentication Flow | Sequence diagram, OAuth/JWT |
| 4 | Class Hierarchy | Class diagram with inheritance |
| 5 | Enterprise Domain Architecture | Multi-domain groupings with colour coding |
| 6 | ETL Pipeline | File watchers, FTP, batch processing |
| 7 | File Processing Pipeline | Ingestion, transformation, storage |
| 8 | Network Architecture | DMZ, internal, external zones |

---

## Dependencies (CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| [Mermaid.js](https://mermaid.js.org/) | v10 | Diagram rendering |
| [Tailwind CSS](https://tailwindcss.com/) | v3 | Utility styling |

No npm install. No build step. Open and use.

---

## License

Copyright 2026 AK (Aravind Kannan)

Licensed under the [Apache License 2.0](LICENSE).
