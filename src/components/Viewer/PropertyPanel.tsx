/**
 * プロパティパネル: 選択ノードの情報を表示・編集する。
 */

import { useEditor } from '../../pen/state/EditorContext';

/** ノードが属するフレーム名を取得（パンくず風） */
function formatNodePath(node: { name?: string; id: string; type: string }): string {
  return node.name ?? node.id;
}

function formatSize(v: unknown): string {
  if (typeof v === 'number') return `${Math.round(v * 100) / 100}`;
  if (typeof v === 'string') return v;
  return '-';
}

function formatColor(fill: unknown): string | null {
  if (typeof fill === 'string') return fill;
  if (fill && typeof fill === 'object') {
    const f = fill as Record<string, unknown>;
    if (f.type === 'color' && typeof f.color === 'string') return f.color;
    if (f.type === 'gradient') return '(gradient)';
    if (f.type === 'image') return '(image)';
  }
  if (Array.isArray(fill) && fill.length > 0) return formatColor(fill[0]);
  return null;
}

export function PropertyPanel() {
  const { selectedNode, selectNode } = useEditor();

  if (!selectedNode) {
    return (
      <div className="prop-panel prop-panel--empty">
        <p className="prop-panel__hint">Click a node to inspect</p>
      </div>
    );
  }

  const n = selectedNode;
  const fillColor = formatColor((n as { fill?: unknown }).fill);
  const strokeFill = (n as { stroke?: { fill?: unknown } }).stroke?.fill;
  const strokeColor = formatColor(strokeFill);
  const cornerRadius = (n as { cornerRadius?: unknown }).cornerRadius;
  const opacity = (n as { opacity?: number }).opacity;
  const fontFamily = (n as { fontFamily?: string }).fontFamily;
  const fontSize = (n as { fontSize?: number }).fontSize;
  const content = (n as { content?: string }).content;

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <span className="prop-panel__type">{n.type}</span>
        <span className="prop-panel__name">{formatNodePath(n)}</span>
        <button
          className="prop-panel__close"
          onClick={() => selectNode(null)}
          title="Deselect"
        >
          &times;
        </button>
      </div>

      <div className="prop-panel__section">
        <div className="prop-panel__title">Position & Size</div>
        <div className="prop-panel__grid">
          <label>X</label><span>{Math.round(n.x ?? 0)}</span>
          <label>Y</label><span>{Math.round(n.y ?? 0)}</span>
          <label>W</label><span>{formatSize((n as { width?: unknown }).width)}</span>
          <label>H</label><span>{formatSize((n as { height?: unknown }).height)}</span>
        </div>
      </div>

      {fillColor && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Fill</div>
          <div className="prop-panel__color-row">
            {fillColor.startsWith('#') && (
              <span
                className="prop-panel__swatch"
                style={{ background: fillColor }}
              />
            )}
            <span>{fillColor}</span>
          </div>
        </div>
      )}

      {strokeColor && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Stroke</div>
          <div className="prop-panel__color-row">
            {strokeColor.startsWith('#') && (
              <span
                className="prop-panel__swatch"
                style={{ background: strokeColor }}
              />
            )}
            <span>{strokeColor}</span>
          </div>
        </div>
      )}

      {cornerRadius != null && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Corner Radius</div>
          <span>{JSON.stringify(cornerRadius)}</span>
        </div>
      )}

      {opacity != null && opacity !== 1 && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Opacity</div>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
      )}

      {fontFamily && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Font</div>
          <span>{fontFamily} {fontSize}px</span>
        </div>
      )}

      {content != null && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Content</div>
          <div className="prop-panel__content">{content}</div>
        </div>
      )}

      {n.type === 'frame' && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Layout</div>
          <span>{(n as { layout?: string }).layout ?? 'horizontal'}</span>
        </div>
      )}
    </div>
  );
}
