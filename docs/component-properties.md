# Component properties

The Component Properties panel uses the same persisted diagram settings and source model as the rest of Meridian. Global properties apply to the current diagram; node properties require a selected node.

| Type | Properties | Behavior |
| --- | --- | --- |
| Boolean | labels, minimap, grid, inspector, warnings | Toggles existing editor and canvas features |
| Variant | theme, node type, connection style, canvas mode | Updates the renderer, source type, or preview preference |
| Instance swap | provider, icon | Replaces the selected node's icon metadata |
| Text | node label, annotation, relationship label | Updates Smart Input or the annotation layer |
| Number | spacing, radius, stroke width, zoom | Validated and clamped numeric styling |
| Color token | node fill, canvas, border, relationship | Token presets with custom colour overrides |
| Interaction | default, hover, selected, error, disabled | Persisted per-node preview state |

All public form controls use native inputs and selects. Values loaded from storage are validated before application.
