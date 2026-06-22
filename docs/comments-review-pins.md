# Comments and review pins

Comments can be attached to a node or an arbitrary canvas coordinate. Each comment stores bounded plain text, author, target, coordinates, resolution state, and creation time.

- Open Comments and choose **New pin**, then click a node or canvas position.
- Click a numbered pin or comment-list item to edit, resolve/reopen, or delete it.
- Filter the panel by open, resolved, or all comments.
- Node-attached pins follow their nodes after layout and position changes.

Comments persist locally and do not alter Smart Input or exported Mermaid source. User-authored text is escaped before HTML rendering and inserted into SVG metadata using `textContent`.
