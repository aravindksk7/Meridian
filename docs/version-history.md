# Version history

Version History stores up to 50 named snapshots. Each snapshot includes Smart Input, diagram type and theme, validated diagram settings, manual layout, colors, annotations, comments, and a sanitized visual preview.

- **Compare** opens two sanitized SVG previews as image blobs. Either side can show a named snapshot or the current canvas.
- **Restore** first creates a `Before restoring …` checkpoint, making the operation reversible.
- **Delete** removes an individual snapshot.

Snapshot names and metadata are escaped before list rendering. Stored SVG previews have active content, event attributes, remote images, and JavaScript URLs removed and are never injected with `innerHTML`.
