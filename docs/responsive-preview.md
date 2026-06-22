# Responsive preview

Responsive Preview adds exact saved viewport sizes on top of Meridian's device frames.

Built-in presets include desktop, laptop, tablet, and mobile. Up to 12 named custom presets can be saved from the current custom width and height. Names are bounded, control characters are removed, dimensions are clamped to 240–2560 pixels, and options are created through the DOM rather than HTML strings.

Density modes adjust Mermaid node padding and spacing:

- **Compact** for dense mobile diagrams;
- **Comfortable** for tablet-sized views;
- **Spacious** for large canvases;
- **Auto** selects a density from the effective viewport width.

Viewport presets and density preferences persist under the existing Live Preview settings model.
