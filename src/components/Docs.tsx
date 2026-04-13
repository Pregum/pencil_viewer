import { useState, useEffect } from 'react';

interface DocsProps {
  onBack: () => void;
}

const sections = [
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'canvas-navigation', title: 'Canvas Navigation' },
  { id: 'vim-mode', title: 'Vim Mode' },
  { id: 'command-palette', title: 'Command Palette' },
  { id: 'node-editing', title: 'Node Editing' },
  { id: 'export', title: 'Export' },
  { id: 'shortcuts', title: 'Keyboard Shortcuts' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="docs-kbd">{children}</kbd>;
}

export function Docs({ onBack }: DocsProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs">
      <nav className="docs__sidebar">
        <button
          type="button"
          className="button button--ghost docs__back-btn"
          onClick={onBack}
        >
          <span className="button__icon">&larr;</span>
          <span className="button__label">Back</span>
        </button>
        <ul className="docs__toc">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`docs__toc-link${activeSection === s.id ? ' docs__toc-link--active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="docs__content">
        {/* Getting Started */}
        <section id="getting-started">
          <h2>Getting Started</h2>
          <p>
            Pencil Viewer lets you view and edit <code>.pen</code> design files directly in
            the browser. There are three ways to load a file:
          </p>

          <h3>Drag &amp; Drop</h3>
          <p>
            Drag any <code>.pen</code> file onto the landing page drop zone. The file is
            parsed entirely on the client &mdash; nothing is uploaded to a server.
          </p>

          <h3>URL Parameter</h3>
          <p>
            Append <code>?src=https://example.com/design.pen</code> to the page URL. The
            viewer will fetch the file on load. This is useful for sharing links to hosted
            design files.
          </p>

          <h3>Sample Files</h3>
          <p>
            Click any sample card on the landing page to explore built-in example files
            without needing your own <code>.pen</code> document.
          </p>

          <h3>Supported Node Types</h3>
          <p>The viewer supports the following node types defined in the <code>.pen</code> format:</p>
          <ul>
            <li><strong>Frame</strong> &mdash; top-level artboard container</li>
            <li><strong>Group</strong> &mdash; logical grouping of child nodes</li>
            <li><strong>Rectangle</strong> &mdash; basic rectangular shape</li>
            <li><strong>Ellipse</strong> &mdash; circular / oval shape</li>
            <li><strong>Text</strong> &mdash; text layer with font, size, and color</li>
            <li><strong>Icon Font</strong> &mdash; icon rendered from an icon font</li>
            <li><strong>Image</strong> &mdash; embedded or referenced bitmap</li>
            <li><strong>Vector</strong> &mdash; custom vector path</li>
          </ul>
        </section>

        {/* Canvas Navigation */}
        <section id="canvas-navigation">
          <h2>Canvas Navigation</h2>

          <h3>Zoom</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Action</th><th>Shortcut</th></tr>
            </thead>
            <tbody>
              <tr><td>Zoom in / out</td><td><Kbd>Cmd</Kbd> + scroll wheel</td></tr>
              <tr><td>Zoom in</td><td><Kbd>Cmd</Kbd> + <Kbd>+</Kbd></td></tr>
              <tr><td>Zoom out</td><td><Kbd>Cmd</Kbd> + <Kbd>-</Kbd></td></tr>
              <tr><td>Zoom to fit</td><td><Kbd>Cmd</Kbd> + <Kbd>0</Kbd></td></tr>
              <tr><td>Zoom to 100%</td><td><Kbd>Cmd</Kbd> + <Kbd>1</Kbd></td></tr>
            </tbody>
          </table>

          <h3>Pan</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Action</th><th>Shortcut</th></tr>
            </thead>
            <tbody>
              <tr><td>Pan canvas</td><td>Scroll (trackpad or mouse wheel)</td></tr>
              <tr><td>Pan (drag)</td><td><Kbd>Space</Kbd> + drag</td></tr>
              <tr><td>Pan (alt drag)</td><td><Kbd>Alt</Kbd> + drag</td></tr>
              <tr><td>Pan (middle button)</td><td>Middle mouse button + drag</td></tr>
            </tbody>
          </table>

          <h3>Frame Search</h3>
          <p>
            Press <Kbd>Cmd</Kbd> + <Kbd>P</Kbd> to open frame search. Type to filter
            frames by name. Results include a minimap preview, category labels, and are
            sorted by distance from the current viewport.
          </p>

          <h3>Frame Navigation History</h3>
          <p>
            Navigate between previously visited frames using{' '}
            <Kbd>Cmd</Kbd> + <Kbd>[</Kbd> (back) and{' '}
            <Kbd>Cmd</Kbd> + <Kbd>]</Kbd> (forward), similar to browser history.
          </p>
        </section>

        {/* Vim Mode */}
        <section id="vim-mode">
          <h2>Vim Mode</h2>
          <p>
            Enable Vim mode via the Command Palette (<Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>P</Kbd>)
            and search for <strong>&quot;Vim Mode&quot;</strong>. When active, the canvas
            responds to Vim-style keybindings.
          </p>

          <h3>Normal Mode</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Key</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>h</Kbd> <Kbd>j</Kbd> <Kbd>k</Kbd> <Kbd>l</Kbd></td><td>Nudge selected node (or pan camera if nothing selected)</td></tr>
              <tr><td><Kbd>H</Kbd> <Kbd>J</Kbd> <Kbd>K</Kbd> <Kbd>L</Kbd></td><td>Half-page scroll in the corresponding direction</td></tr>
              <tr><td><Kbd>g</Kbd> + <Kbd>h</Kbd>/<Kbd>j</Kbd>/<Kbd>k</Kbd>/<Kbd>l</Kbd></td><td>Jump to adjacent frame in that direction</td></tr>
            </tbody>
          </table>

          <h3>Hints &amp; Focus</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Key</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>f</Kbd></td><td>Show hint labels for frames (EasyMotion style) &mdash; type label to jump</td></tr>
              <tr><td><Kbd>t</Kbd></td><td>Show hint labels for all nodes</td></tr>
              <tr><td><Kbd>F</Kbd></td><td>Zoom-focus on the currently selected node</td></tr>
            </tbody>
          </table>

          <h3>Insert Mode</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Key</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>i</Kbd> / <Kbd>I</Kbd></td><td>Enter insert mode (edit text content of selected node)</td></tr>
              <tr><td><Kbd>Esc</Kbd></td><td>Exit insert mode, return to normal mode</td></tr>
            </tbody>
          </table>

          <h3>Text Object Selection</h3>
          <p>Select text regions using Vim-style text objects:</p>
          <table className="docs__table">
            <thead>
              <tr><th>Command</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>v</Kbd><Kbd>i</Kbd><Kbd>f</Kbd></td><td>Select inner frame</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>a</Kbd><Kbd>f</Kbd></td><td>Select around frame (including frame itself)</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>i</Kbd><Kbd>r</Kbd></td><td>Select inner row</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>i</Kbd><Kbd>c</Kbd></td><td>Select inner column</td></tr>
            </tbody>
          </table>

          <h3>Number Prefix</h3>
          <p>
            Prepend a count to repeat a motion. For example, <Kbd>3</Kbd><Kbd>l</Kbd> moves
            the node 3 px to the right, and <Kbd>5</Kbd><Kbd>g</Kbd><Kbd>j</Kbd> jumps 5
            frames down.
          </p>
        </section>

        {/* Command Palette */}
        <section id="command-palette">
          <h2>Command Palette</h2>
          <p>
            Open the command palette with <Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>P</Kbd>.
            Start typing to search for commands, then press <Kbd>Enter</Kbd> to execute.
          </p>

          <h3>Available Commands</h3>
          <ul>
            <li><strong>Align Left / Right / Top / Bottom</strong> &mdash; Align selected nodes to an edge</li>
            <li><strong>Align Center Horizontal / Vertical</strong> &mdash; Center-align selected nodes</li>
            <li><strong>Distribute Horizontal / Vertical</strong> &mdash; Evenly space selected nodes</li>
            <li><strong>Vim Mode</strong> &mdash; Toggle Vim keybindings on or off</li>
            <li><strong>Zoom to Fit</strong> &mdash; Fit all content in the viewport</li>
            <li><strong>Zoom to 100%</strong> &mdash; Reset zoom to actual size</li>
            <li><strong>Export .pen</strong> &mdash; Save the current document</li>
          </ul>
        </section>

        {/* Node Editing */}
        <section id="node-editing">
          <h2>Node Editing</h2>

          <h3>Selecting Nodes</h3>
          <p>
            Click on any node to select it. When nodes overlap, the innermost (deepest)
            node wins. Hold <Kbd>Shift</Kbd> to add to the selection.
          </p>

          <h3>Property Panel</h3>
          <p>
            The right-side property panel lets you edit attributes of the selected node:
          </p>
          <ul>
            <li><strong>Position</strong> &mdash; X and Y coordinates</li>
            <li><strong>Size</strong> &mdash; Width and Height</li>
            <li><strong>Fill</strong> &mdash; Background color</li>
            <li><strong>Stroke</strong> &mdash; Border color and width</li>
            <li><strong>Opacity</strong> &mdash; Transparency (0&ndash;100%)</li>
            <li><strong>Font</strong> &mdash; Family, size, weight (for text nodes)</li>
            <li><strong>Content</strong> &mdash; Text content (for text nodes)</li>
          </ul>

          <h3>Transform</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Action</th><th>How</th></tr>
            </thead>
            <tbody>
              <tr><td>Move node</td><td>Drag the selected node</td></tr>
              <tr><td>Resize node</td><td>Drag a corner or edge handle</td></tr>
              <tr><td>Delete node</td><td><Kbd>Backspace</Kbd> or <Kbd>Delete</Kbd></td></tr>
            </tbody>
          </table>

          <h3>Undo / Redo</h3>
          <p>
            <Kbd>Cmd</Kbd> + <Kbd>Z</Kbd> to undo, <Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd> to
            redo. The history stack tracks all property changes, moves, resizes, and deletions.
          </p>
        </section>

        {/* Export */}
        <section id="export">
          <h2>Export</h2>
          <table className="docs__table">
            <thead>
              <tr><th>Action</th><th>Shortcut</th></tr>
            </thead>
            <tbody>
              <tr><td>Quick export (default filename)</td><td><Kbd>Cmd</Kbd> + <Kbd>S</Kbd></td></tr>
              <tr><td>Save as (custom filename)</td><td><Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>S</Kbd></td></tr>
            </tbody>
          </table>
          <p>
            Both options export the raw <code>.pen</code> JSON format with all your edits
            applied. The file is downloaded directly to your machine &mdash; nothing is sent
            to a server.
          </p>
        </section>

        {/* Keyboard Shortcuts Reference */}
        <section id="shortcuts">
          <h2>Keyboard Shortcuts Reference</h2>

          <h3>General</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Shortcut</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>P</Kbd></td><td>Open command palette</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>P</Kbd></td><td>Frame search</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>S</Kbd></td><td>Quick export</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>S</Kbd></td><td>Save as</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>Z</Kbd></td><td>Undo</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd></td><td>Redo</td></tr>
              <tr><td><Kbd>Backspace</Kbd></td><td>Delete selected node</td></tr>
            </tbody>
          </table>

          <h3>Zoom</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Shortcut</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>Cmd</Kbd> + scroll</td><td>Zoom in / out</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>+</Kbd></td><td>Zoom in</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>-</Kbd></td><td>Zoom out</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>0</Kbd></td><td>Zoom to fit</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>1</Kbd></td><td>Zoom to 100%</td></tr>
            </tbody>
          </table>

          <h3>Pan</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Shortcut</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td>Scroll</td><td>Pan canvas</td></tr>
              <tr><td><Kbd>Space</Kbd> + drag</td><td>Pan (hand tool)</td></tr>
              <tr><td><Kbd>Alt</Kbd> + drag</td><td>Pan</td></tr>
              <tr><td>Middle mouse + drag</td><td>Pan</td></tr>
            </tbody>
          </table>

          <h3>Navigation</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Shortcut</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>[</Kbd></td><td>Navigate back (frame history)</td></tr>
              <tr><td><Kbd>Cmd</Kbd> + <Kbd>]</Kbd></td><td>Navigate forward (frame history)</td></tr>
            </tbody>
          </table>

          <h3>Vim Mode</h3>
          <table className="docs__table">
            <thead>
              <tr><th>Key</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd>h</Kbd> <Kbd>j</Kbd> <Kbd>k</Kbd> <Kbd>l</Kbd></td><td>Nudge / pan</td></tr>
              <tr><td><Kbd>H</Kbd> <Kbd>J</Kbd> <Kbd>K</Kbd> <Kbd>L</Kbd></td><td>Half-page scroll</td></tr>
              <tr><td><Kbd>g</Kbd> + <Kbd>h</Kbd>/<Kbd>j</Kbd>/<Kbd>k</Kbd>/<Kbd>l</Kbd></td><td>Jump to adjacent frame</td></tr>
              <tr><td><Kbd>f</Kbd></td><td>Frame hint labels</td></tr>
              <tr><td><Kbd>t</Kbd></td><td>All-node hint labels</td></tr>
              <tr><td><Kbd>F</Kbd></td><td>Zoom-focus selected</td></tr>
              <tr><td><Kbd>i</Kbd> / <Kbd>I</Kbd></td><td>Enter insert mode</td></tr>
              <tr><td><Kbd>Esc</Kbd></td><td>Exit insert mode</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>i</Kbd><Kbd>f</Kbd></td><td>Select inner frame</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>a</Kbd><Kbd>f</Kbd></td><td>Select around frame</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>i</Kbd><Kbd>r</Kbd></td><td>Select inner row</td></tr>
              <tr><td><Kbd>v</Kbd><Kbd>i</Kbd><Kbd>c</Kbd></td><td>Select inner column</td></tr>
              <tr><td><em>N</em> + motion</td><td>Repeat motion N times</td></tr>
            </tbody>
          </table>
        </section>
      </article>
    </div>
  );
}
