import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';

type ExportFormat = 'pen' | 'svg' | 'png' | 'svg-selection' | 'png-selection';

export function ExportButton() {
  const { exportPen, selectedNode } = useEditor();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Cmd+S = quick .pen export
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        exportPen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportPen]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      setOpen(false);
      if (format === 'pen') {
        exportPen();
        return;
      }

      const svg = document.querySelector('.viewer__svg') as SVGSVGElement | null;
      if (!svg) return;

      if (format === 'svg') {
        exportSvg(svg);
      } else if (format === 'png') {
        exportPng(svg);
      } else if ((format === 'svg-selection' || format === 'png-selection') && selectedNode) {
        const nx = (selectedNode as { x?: number }).x ?? 0;
        const ny = (selectedNode as { y?: number }).y ?? 0;
        const nw = typeof (selectedNode as { width?: unknown }).width === 'number' ? (selectedNode as { width: number }).width : 0;
        const nh = typeof (selectedNode as { height?: unknown }).height === 'number' ? (selectedNode as { height: number }).height : 0;
        if (nw <= 0 || nh <= 0) {
          alert('Selected node has no size.');
          return;
        }
        const bbox = { x: nx, y: ny, width: nw, height: nh };
        const name = (selectedNode as { name?: string }).name ?? selectedNode.id;
        if (format === 'svg-selection') {
          exportSvg(svg, bbox, `${name}.svg`);
        } else {
          exportPng(svg, bbox, `${name}.png`);
        }
      }
    },
    [exportPen, selectedNode],
  );

  const canExportSelection = !!selectedNode &&
    typeof (selectedNode as { width?: unknown }).width === 'number' &&
    typeof (selectedNode as { height?: unknown }).height === 'number';

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="viewer__zoom-btn"
        title="Export"
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 12, width: 'auto', padding: '0 8px' }}
      >
        Export ▾
      </button>
      {open && (
        <div className="export-menu">
          <button className="export-menu__item" onClick={() => handleExport('svg')}>
            <span className="export-menu__icon">🖼</span>
            <span>
              <strong>SVG</strong>
              <small>Vector — lossless, editable</small>
            </span>
          </button>
          <button className="export-menu__item" onClick={() => handleExport('png')}>
            <span className="export-menu__icon">📷</span>
            <span>
              <strong>PNG</strong>
              <small>Raster — 2x for Retina</small>
            </span>
          </button>
          {canExportSelection && (
            <>
              <div className="export-menu__divider" />
              <button className="export-menu__item" onClick={() => handleExport('svg-selection')}>
                <span className="export-menu__icon">✂️</span>
                <span>
                  <strong>SVG (Selection)</strong>
                  <small>Clipped to selected node</small>
                </span>
              </button>
              <button className="export-menu__item" onClick={() => handleExport('png-selection')}>
                <span className="export-menu__icon">📸</span>
                <span>
                  <strong>PNG (Selection)</strong>
                  <small>Clipped, 2x for Retina</small>
                </span>
              </button>
            </>
          )}
          <div className="export-menu__divider" />
          <button className="export-menu__item" onClick={() => handleExport('pen')}>
            <span className="export-menu__icon">📄</span>
            <span>
              <strong>.pen JSON</strong>
              <small>Source file (Cmd+S)</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

interface BBox { x: number; y: number; width: number; height: number }

function exportSvg(svg: SVGSVGElement, bbox?: BBox, filename?: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Remove selection highlights and UI overlays
  clone.querySelectorAll('[data-ui]').forEach((el) => el.remove());
  // Set explicit xmlns for standalone SVG
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (bbox) {
    clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    clone.setAttribute('width', `${bbox.width}`);
    clone.setAttribute('height', `${bbox.height}`);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename ?? 'pencil-viewer-export.svg');
}

function exportPng(svg: SVGSVGElement, bbox?: BBox, filename?: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-ui]').forEach((el) => el.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (bbox) {
    clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    clone.setAttribute('width', `${bbox.width}`);
    clone.setAttribute('height', `${bbox.height}`);
  }

  const viewBox = bbox
    ? [bbox.x, bbox.y, bbox.width, bbox.height]
    : (svg.getAttribute('viewBox')?.split(' ').map(Number) ?? [0, 0, 800, 600]);
  const [, , vbW, vbH] = viewBox;
  const scale = 2; // Retina
  const width = vbW * scale;
  const height = vbH * scale;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename ?? 'pencil-viewer-export.png');
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('PNG export failed. Try SVG export instead.');
  };
  img.src = url;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
