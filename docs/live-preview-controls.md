# Live Preview control architecture

## Scope boundary

Live Preview properties are presentation preferences. They must not rewrite Smart Input, mutate parsed entities, change exported Mermaid source, or alter project layout unless a control explicitly represents a layout operation.

## State model

Preview preferences are stored under `diagram.preview` in `meridian_settings` and use validated string/boolean values. Defaults must preserve existing behaviour.

| Property | Values | Default | Effect |
| --- | --- | --- | --- |
| `canvas` | `grid`, `dots`, `plain`, `transparent` | `grid` | Preview canvas treatment |
| `viewMode` | `edit`, `present`, `inspect` | `edit` | Canvas interaction affordances |
| `zoomMode` | `fit`, `selection`, `50`, `100`, `150`, `200`, `custom` | `fit` | Preview magnification strategy |
| `device` | `desktop`, `tablet`, `mobile`, `custom` | `desktop` | Saved viewport frame |
| `backgroundMode` | `theme`, `custom`, `transparent` | `theme` | Theme token, user-selected colour, or transparency |
| `backgroundToken` | `canvas`, `surface`, `elevated` | `canvas` | Theme background token |
| `backgroundColor` | CSS hex colour | `#0b1020` | Custom canvas colour |
| `snapToGrid` | boolean | `false` | Quantize manual drag positions |
| `snapToNodes` | boolean | `false` | Enable node proximity snapping |
| `alignmentGuides` | boolean | `true` | Enable alignment guide snapping |
| `connections` | `all`, `selected`, `hidden` | `all` | Edge and edge-label visibility |
| `minimap` | `expanded`, `collapsed`, `hidden` | `expanded` | Navigator state |
| `quality` | `high`, `performance` | `high` | Decorative rendering level |
| `direction` | `auto`, `LR`, `TD` | `auto` | Flowchart direction override |

## Application lifecycle

1. Validate stored settings while loading.
2. Render the existing UI with safe defaults when storage is absent or malformed.
3. Apply canvas-only properties immediately without rerendering Mermaid.
4. Reapply SVG-dependent properties after every successful render.
5. Persist changes through the existing settings storage path.
6. Keep controls keyboard accessible and expose current state through native form controls.

## Completion gate

- Existing interaction suite remains green.
- Each property has a focused Playwright assertion.
- Settings survive reload.
- Dark and light themes remain readable.
- Menus overflow above Smart Input and Live Preview without clipping.
