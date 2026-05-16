# Meridian

A smart, single-file diagram generator that turns plain-text descriptions of systems into Mermaid.js diagrams — no syntax knowledge required.

**Designed by [AK (Aravind Kannan)](https://github.com/aravindksk7)**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## Overview

Meridian lets you describe your architecture, data flows, or system relationships in a simple, readable shorthand and instantly renders a professional diagram. It supports enterprise-grade grouping with business domain ownership, network zone boundaries, and 12 entity types — all in a zero-dependency single HTML file. A dedicated **AI icon tab** covers the full modern AI stack, and an **AI / RAG App** template gets you started in seconds.

## Features

### Editing
- **12 entity types** — app, db, server, instance, interface, config, batch, watcher, ftp, net, domain, env
- **Auto-detection** — smart type inference from names (e.g. `api_gateway` → interface, `postgres` → db, `ec2_instance` → server)
- **Compound name support** — underscore and hyphen separators handled correctly in auto-detection
- **CodeMirror 6 editor** — line numbers, in-place syntax highlighting, undo/redo history, `Ctrl+/` comment toggle
- **Autocomplete** — type prefixes and known entity names suggested as you type
- **Semantic linting** — warnings for orphan nodes, duplicate labels, unknown prefixes, invalid arrows, empty groups, and relationships to containers
- **Real-time rendering** — diagram updates as you type

### Grouping & Topology
- **Business domain groupings** — colour-coded dashed subgraphs for team/org ownership (`domain:`)
- **Network zones** — security boundary subgraphs with distinct colours (`net:`)
- **Environment blocks** — deployment topology groupings (`env:`)
- **Hybrid mode** — entities can appear in both `env:` and `domain:` simultaneously; domain ownership shown through fill-colour overrides

### Diagrams
- **4 diagram types** — Flowchart LR, Flowchart TD, Sequence, Class
- **5 themes** — Default, Dark, Forest, Neutral, Base
- **All arrow styles** — normal, labelled, bidirectional, pre-dependency, post-dependency, chained (`>>`)
- **Arrow aliases** — `--requires-->` = dashed; `--triggers-->` = thick
- **12 natural language connectors** — `connects to`, `calls`, `queries`, `reads from`, `writes to`, `depends on`, `sends to`, `talks to`, `uses`, `forwards to`, `publishes to`, `subscribes to`

### Cloud Service Icon Picker (☁️ Icons ▾)
- **210+ named services** across five provider tabs — AWS, GCP, Azure, General, and **AI**
- **AI tab** — 70+ icons spanning LLM providers (OpenAI, Anthropic Claude, Google Gemini, Meta LLaMA, Mistral), orchestration frameworks (LangChain, LlamaIndex, AutoGen, CrewAI, LangGraph), ML libraries (PyTorch, TensorFlow, scikit-learn, Hugging Face), vector databases (Pinecone, Qdrant, Weaviate, Milvus, Chroma), MLOps (MLflow, W&B, DVC), AI observability (Langfuse, Arize, Evidently), and LLM serving (vLLM, TGI, Triton, LiteLLM)
- **Emoji-embedded labels** — clicking an icon inserts the entity with the service's icon embedded in the diagram node
- **Search** — filter across all icons in the active tab by service name
- Correct type prefix inserted automatically (e.g. `instance:⚡ Lambda`, `db:🗄️ RDS`, `instance:🤖 OpenAI_GPT`)

### Appearance Settings (⚙️)
- **6 editor colour themes** — Meridian (default), One Dark, Dracula, Nord, Monokai, Solarized Light — hot-swapped without page reload
- **Font size** — 11 / 13 / 15 / 17 px
- **Font family** — System mono, Fira Code, Cascadia Code, JetBrains Mono
- **Per-entity token colours** — override individual type colours (env:, app:, db: …) for the active theme
- **Diagram font size** — override the Mermaid font size via a slider
- **Diagram node / edge colours** — override primary fill, border, edge colour, and canvas background (works best with the Base diagram theme)
- **Persistent** — all settings saved to `localStorage` and restored on next open; Reset All restores defaults

### UI & Theme
- **Dark / light theme** — full CSS design token system, switchable via toolbar
- **Checkerboard canvas** — distinct preview background pattern, theme-aware
- **Pan & zoom** — drag to pan, Ctrl+scroll or Ctrl+±/−, fit-to-window button; click the zoom percentage to open a quick-pick dropdown (25% – 500%)
- **Resizable panels** — drag the divider to adjust input/preview split
- **Fullscreen preview** — expand diagram to full viewport

### Live Preview Interactions
- **Click a node** — scrolls Smart Input to that entity's definition and briefly highlights the editor border; opens the node context panel
- **Double-click a node** — opens node context panel and activates the rename input directly
- **Drag a node** — repositions the node and redraws edges in real time; positions survive re-renders, page reloads, and export/import
- **↗ drag handle** — hover a node and drag the handle to a target node to create a new arrow relationship inserted into Smart Input
- **Node context panel** — Add node (create + connect), Connect to… (connect to any existing entity), Delete (removes entity and all its relationships), jump to arrow lines
- **Click an arrow / edge label** — selects and highlights the corresponding arrow line in Smart Input
- **Drag on empty canvas** — pans the preview

### Productivity
- **9 templates** — quick-start presets covering microservices, 3-tier app, CI/CD pipeline, cloud infra, ETL, file processing, network architecture, enterprise domains, and an AI/RAG application
- **Architecture views** — focused presets for system context, container, deployment, and domain ownership views
- **Diagram library** — save, name, and reload your own diagram snippets (`Ctrl+Shift+L`)
- **Persistent node positions** — drag nodes to rearrange; positions survive re-renders and page reloads
- **Project import/export** — save or restore `.meridian.json` and `.mmd` bundles with input, type, theme, settings, and node positions
- **Copy & export** — copy Mermaid code, copy as fenced block, copy as Markdown, copy as embed `<iframe>`, download SVG, download PNG (2×)
- **Shareable URLs** — encode full diagram state (input, type, theme) into a URL hash
- **Help modal** — built-in reference panel (press `?` or `F1`)
- **Auto-save** — state persisted to `localStorage`

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Render diagram |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+/` | Toggle `//` comment on current line |
| `Tab` / `Shift+Tab` | Indent / un-indent line |
| `Enter` after `{` | Auto-indent + insert closing `}` |
| `Ctrl+Shift+C` | Copy Mermaid code |
| `Ctrl+Shift+S` | Copy share URL |
| `Ctrl+Shift+F` | Toggle fullscreen |
| `Ctrl+Shift+L` | Open diagram library |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |
| `Ctrl+0` | Reset zoom to 100% |
| `Ctrl+Scroll` | Zoom (hover preview panel) |
| `Ctrl+F` | Open node search |
| `?` or `F1` | Open help |
| `Escape` | Close modal |

---

## Quick Start

Open `index.html` in any modern browser — no server, no build step required.

```
app:Frontend --> interface:Backend --> db:Postgres
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

| Prefix | Aliases | Type | Shape | Auto-detected keywords |
|--------|---------|------|-------|------------------------|
| `app:` | — | Application | Rectangle | *(default fallback)* |
| `db:` | `database:` | Database | Cylinder | postgres, mysql, redis, mongo, rds, aurora, dynamodb… |
| `server:` | `srv:` | Server | Subroutine | nginx, apache, haproxy, alb, cloudfront, gateway, proxy… |
| `instance:` | `inst:` | Container / Instance | Rounded rect | ec2, docker, lambda, k8s, fargate, container, runner, pod… |
| `interface:` | `iface:` | API / Interface | Double hexagon | rest, grpc, graphql, kafka, rabbitmq, webhook, websocket, queue… |
| `config:` | `cfg:, conf:` | Config / Setting | Rectangle | port, yaml, ssl, cert, secret, env_var, json, toml… |
| `batch:` | `btch:` | Batch Job / ETL | Parallelogram | etl, cron, job, airflow, spark, dbt, glue, pipeline, scheduler… |
| `watcher:` | `watch:` | File Watcher / Monitor | Diamond | fswatch, inotify, observer, listener, monitor, filewatcher… |
| `ftp:` | `sftp:, ftps:` | FTP / SFTP Server | Stadium | sftp, ftps, vsftpd, filezilla, winscp, ftpd… |
| `env:` | — | Environment | Subgraph | prod, production, staging, dev, qa, uat, sandbox… |
| `net:` | `network:, zone:` | Network Zone | Subgraph | Colour by zone name — External, DMZ, Internal |
| `domain:` | `dom:, team:, biz:, bu:` | Business Domain | Subgraph | Auto-colour per domain from palette |

### Arrow Styles

| Syntax | Style | Best for |
|--------|-------|----------|
| `A --> B` | → Normal | Basic flow or dependency |
| `A --label--> B` | → Labelled | Named relationship |
| `A <--> B` | ↔ Bidirectional | Two-way communication |
| `A --pre--> B` | - - → Dashed | Prerequisite / must run before |
| `A --requires--> B` | - - → Dashed | Alias for `--pre-->` |
| `A --post--> B` | ═══▶ Thick | Triggers on completion |
| `A --triggers--> B` | ═══▶ Thick | Alias for `--post-->` |
| `A >> B >> C` | ═══▶ Chain | Sequential batch pipeline |

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

#### Hybrid mode — env + domain on the same entities

Entities inside an `env:` block that also appear in a `domain:` block stay inside the env subgraph spatially but have their fill colour overridden with the domain's palette colour — showing deployment topology and ownership simultaneously.

```
env:Production {
  app:PaymentService
  app:AuthService
}
domain:Finance {
  app:PaymentService   // tinted with Finance colour, still inside Production
}
```

#### Domain colour palette (cycles every 8 domains)

fuchsia · orange · emerald · blue · red · golden · indigo · sky

### Natural Language Connectors

```
app:Frontend calls app:Backend
app:Backend reads from db:Postgres
batch:ETL writes to db:Warehouse
app:Auth uses config:JWT
```

### Semantic Linting

Meridian warns while you type without blocking preview rendering:

| Warning | Meaning |
|---------|---------|
| `ORPHAN_NODE` | Entity is declared but not connected by any relationship |
| `DUPLICATE_LABEL` | Same label appears under different entity types |
| `UNKNOWN_PREFIX` | Prefix is not one of Meridian's supported entity types |
| `INVALID_ARROW` | Arrow-like text does not match supported arrow syntax |
| `EMPTY_GROUP` | `env:`, `net:`, or `domain:` block contains no valid entities |
| `RELATIONSHIP_TO_CONTAINER` | Relationship targets an `env:`, `net:`, or `domain:` container instead of a concrete entity |

### Comments

Lines beginning with `//` or `#` are ignored:

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
- Custom diagram colours (⚙️ → Diagram tab) work best when the diagram theme is set to **Base**
- Cloud icons (☁️ Icons ▾) insert emoji-embedded labels that appear inside diagram nodes
- The **AI** icon tab covers the full modern AI stack — use it with the **AI / RAG App** template to get started quickly
- Click the zoom percentage (e.g. `100%`) in the preview toolbar to open the zoom preset picker; max zoom is 500%

---

## Project Bundles

Use **Export** to download a complete project as either `.meridian.json` or `.mmd`. Bundles include the Smart Input text, diagram type, Mermaid theme, editor settings, diagram settings, layout, and saved node positions. Use **Import** to restore either format.

Plain `.mmd` files without Meridian metadata can still be imported as Smart Input text.

---

## Architecture Views

Use **Views** in the toolbar to start from a focused architecture preset:

| View | Focus |
|------|-------|
| System Context | People-facing channels, core platform boundary, and external systems |
| Container | UI, API, services, data stores, workers, and observability |
| Deployment | External, DMZ, and internal runtime topology |
| Domain Ownership | Business/domain ownership boundaries with cross-domain flows |

---

## Templates

Press **Templates** in the toolbar to load any built-in preset:

| # | Name | Covers |
|---|------|--------|
| 1 | Microservices Architecture | Service mesh, API gateway, databases |
| 2 | 3-Tier App | Presentation / logic / data tiers |
| 3 | CI/CD Pipeline | Build → test → deploy batch chain |
| 4 | Cloud Infra | VPC with ALB, ECS, RDS, ElastiCache, S3 |
| 5 | ETL Pipeline | Extract → transform → load with batch entities |
| 6 | File Processing Pipeline | FTP / watcher / batch processing |
| 7 | Network Architecture | External, DMZ, and internal net zones |
| 8 | Enterprise Domain Architecture | Multi-domain groupings with colour coding |
| 9 | AI / RAG App | LLM-powered RAG pipeline — client, gateway, orchestration (LangChain), LLM providers (OpenAI, Claude), retrieval, vector DB (Pinecone), and observability (Langfuse) |

---

## Appearance Settings

Click the **⚙️** button in the header toolbar to open the Appearance panel.

### Editor tab

| Setting | Options |
|---------|---------|
| Theme | Meridian · One Dark · Dracula · Nord · Monokai · Solarized |
| Font size | 11px · 13px · 15px · 17px |
| Font family | System mono · Fira Code · Cascadia Code · JetBrains Mono |
| Token colours | Per-entity-type colour pickers (env:, app:, db:, server:, …) |

Switching themes resets any individual token colour overrides back to the new theme's defaults.

### Diagram tab

| Setting | Description |
|---------|-------------|
| Font size | Slider 10–28 px; enable checkbox activates it |
| Node fill | Primary node background colour |
| Node border | Primary node border colour |
| Edge color | Arrow and edge line colour |
| Background | Canvas background colour |

> Custom diagram colours only take full effect when the **diagram theme** (top toolbar) is set to **🎨 Base**.

---

## Export & Sharing

| Control | Action |
|---------|--------|
| ↓ SVG | Download the diagram as a scalable SVG file |
| ↓ PNG | Download at 2× (retina) resolution |
| Copy ▾ | Copy code · copy with ` ```mermaid ` fences · copy as Markdown · copy embed `<iframe>` |
| 🔗 Share | Encode full diagram state into a shareable URL (`Ctrl+Shift+S`) |
| Import | Load a `.meridian.json` project, Meridian `.mmd` bundle, or plain `.mmd` input file |
| Export ▾ | Download a complete project bundle |

---

## Dependencies (CDN)

| Library | Version | Purpose |
|---------|---------|---------|
| [Mermaid.js](https://mermaid.js.org/) | v10 | Diagram rendering |
| [Tailwind CSS](https://tailwindcss.com/) | v3 | Utility styling |
| [CodeMirror](https://codemirror.net/) | v6 | Code editor (syntax, autocomplete, history) |

No npm install. No build step. Open and use.

---

## License

Copyright 2026 AK (Aravind Kannan)

Licensed under the [Apache License 2.0](LICENSE).
