# Design tokens panel

The Design Tokens panel is the diagram-level source of truth for:

- canvas, surface, node, border, text, accent, and relationship colors;
- font family, size, and weight;
- base spacing, node padding, and group gaps;
- node and panel radii;
- node shadow strength;
- relationship style, width, and motion.

Token values are validated before use and persisted under `diagram.designTokens`. Per-node fill overrides remain authoritative over the default node-fill token. Shared border and edge values stay synchronized with Component Properties.
