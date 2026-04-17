/**
 * Comments レイヤー: doc.comments を SVG ピン + popup で描画。
 * activeTool==='comment' 時、canvas クリックで新規ピン作成。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  svgScale: number;
}

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return { x: (clientX - ctm.e) / ctm.a, y: (clientY - ctm.f) / ctm.d };
}

export function CommentsLayer({ svgRef, svgScale }: Props) {
  const { state, addComment, updateComment, removeComment, setActiveTool } = useEditor();
  const comments = state.doc.comments ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftPos, setDraftPos] = useState<{ x: number; y: number } | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Comment tool: クリックで新規ピン
  useEffect(() => {
    if (state.activeTool !== 'comment') return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      const tag = target.tagName.toLowerCase();
      if (tag !== 'svg' && !(tag === 'rect' && target.getAttribute('fill') === 'transparent')) return;
      const svg = svgRef.current;
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();
      if (
        e.clientX < svgRect.left || e.clientX > svgRect.right ||
        e.clientY < svgRect.top || e.clientY > svgRect.bottom
      ) return;
      e.preventDefault();
      const pt = screenToSvg(svg, e.clientX, e.clientY);
      setDraftPos(pt);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [state.activeTool, svgRef]);

  useEffect(() => {
    if (draftPos && draftRef.current) draftRef.current.focus();
  }, [draftPos]);

  const commitDraft = useCallback(() => {
    if (!draftPos || !draftRef.current) return;
    const text = draftRef.current.value.trim();
    if (text) {
      const id = addComment(draftPos.x, draftPos.y, text);
      setOpenId(id);
    }
    setDraftPos(null);
    setActiveTool('select');
  }, [draftPos, addComment, setActiveTool]);

  const cancelDraft = useCallback(() => {
    setDraftPos(null);
    setActiveTool('select');
  }, [setActiveTool]);

  const pinR = 9 / Math.max(svgScale, 0.001);
  const sw = 1.5 / Math.max(svgScale, 0.001);

  return (
    <>
      <g>
        {comments.map((c) => (
          <g key={c.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setOpenId((v) => v === c.id ? null : c.id); }}>
            {/* ピン影 */}
            <circle cx={c.x + 1 / svgScale} cy={c.y + 1 / svgScale} r={pinR} fill="rgba(0,0,0,0.2)" />
            {/* ピン本体 */}
            <circle
              cx={c.x}
              cy={c.y}
              r={pinR}
              fill={c.resolved ? '#9CA3AF' : '#F97316'}
              stroke="#FFFFFF"
              strokeWidth={sw}
            />
            <text
              x={c.x}
              y={c.y + 1 / svgScale}
              fontSize={pinR * 1.1}
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
              fill="#FFFFFF"
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
            >
              💬
            </text>
          </g>
        ))}
        {/* 下書きピン */}
        {draftPos && (
          <circle
            cx={draftPos.x}
            cy={draftPos.y}
            r={pinR}
            fill="#F97316"
            opacity={0.7}
            stroke="#FFFFFF"
            strokeWidth={sw}
          />
        )}
      </g>

      {/* Popup: open または draft */}
      {(openId || draftPos) && (() => {
        const svg = svgRef.current;
        if (!svg) return null;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const pos = draftPos ?? comments.find((c) => c.id === openId);
        if (!pos) return null;
        const clientX = ctm.a * pos.x + ctm.e;
        const clientY = ctm.d * pos.y + ctm.f;
        const c = openId ? comments.find((x) => x.id === openId) : null;
        return (
          <foreignObject x={-99999} y={-99999} width={1} height={1}>
            <div
              // @ts-expect-error xmlns is valid for foreignObject children
              xmlns="http://www.w3.org/1999/xhtml"
            >
              <div
                className="comment-popup"
                style={{
                  position: 'fixed',
                  left: Math.min(window.innerWidth - 280, clientX + 12),
                  top: Math.min(window.innerHeight - 180, clientY + 12),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {draftPos ? (
                  <>
                    <textarea
                      ref={draftRef}
                      className="comment-popup__input"
                      placeholder="Write a comment..."
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); commitDraft(); }
                        if (e.key === 'Escape') { e.preventDefault(); cancelDraft(); }
                      }}
                    />
                    <div className="comment-popup__actions">
                      <button type="button" className="comment-popup__btn" onClick={cancelDraft}>Cancel</button>
                      <button type="button" className="comment-popup__btn comment-popup__btn--primary" onClick={commitDraft}>Post</button>
                    </div>
                  </>
                ) : c ? (
                  <>
                    <div className="comment-popup__meta">
                      <span>🕒 {new Date(c.createdAt).toLocaleString()}</span>
                      {c.resolved && <span className="comment-popup__resolved">Resolved</span>}
                    </div>
                    <textarea
                      className="comment-popup__input"
                      defaultValue={c.text}
                      onBlur={(e) => { if (e.currentTarget.value !== c.text) updateComment(c.id, { text: e.currentTarget.value }); }}
                    />
                    <div className="comment-popup__actions">
                      <button
                        type="button"
                        className="comment-popup__btn"
                        onClick={() => updateComment(c.id, { resolved: !c.resolved })}
                      >
                        {c.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                      <button
                        type="button"
                        className="comment-popup__btn comment-popup__btn--danger"
                        onClick={() => { if (window.confirm('Delete comment?')) { removeComment(c.id); setOpenId(null); } }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="comment-popup__btn"
                        onClick={() => setOpenId(null)}
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </foreignObject>
        );
      })()}
    </>
  );
}
