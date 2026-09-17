import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/AppStateContext.jsx';
import { StagePicker, DeadlinePicker } from './UiBits.jsx';
import { LinkInsertButton, LinkedText } from './LinkPicker.jsx';
import { DEPTH_ACCENTS, WBS_VIEWS } from '../lib/constants.js';
import { computeTreeLayout } from '../lib/layout.js';

export default function WbsEditor({ doc }) {
  const { setWbsView, transformWbsToNote } = useAppState();
  // Falls back to List for any legacy doc that still has the removed
  // "Мережа" view saved, instead of rendering nothing.
  const view = doc.wbsView === WBS_VIEWS.DIAGRAM ? WBS_VIEWS.DIAGRAM : WBS_VIEWS.LIST;

  return (
    <div className="wbs-outer">
      <div className="note-toolbar wbs-toolbar">
        <span className="note-toolbar-label">Перетворити на:</span>
        <button type="button" className="btn-transform-subtle" onClick={() => transformWbsToNote(doc.id)}>
          📝 Нотатка
        </button>
        <div className="wbs-view-switch">
          <button type="button" className={view === WBS_VIEWS.LIST ? 'active' : ''} onClick={() => setWbsView(doc.id, WBS_VIEWS.LIST)}>
            ☰ Список
          </button>
          <button type="button" className={view === WBS_VIEWS.DIAGRAM ? 'active' : ''} onClick={() => setWbsView(doc.id, WBS_VIEWS.DIAGRAM)}>
            🗂️ Схема
          </button>
        </div>
      </div>
      {view === WBS_VIEWS.LIST && <WbsListView doc={doc} />}
      {view === WBS_VIEWS.DIAGRAM && <WbsDiagramView doc={doc} />}
    </div>
  );
}

/* ===================== List view (editable, hierarchical) ===================== */

function WbsListView({ doc }) {
  const { addWbsRootBlock } = useAppState();
  return (
    <div className="wbs-editor-wrap">
      <div className="wbs-tree">
        {doc.blocks.length === 0 ? (
          <div className="wbs-empty-state">План поки що порожній. Додайте перший блок нижче.</div>
        ) : (
          doc.blocks.map((b, idx, arr) => (
            <WbsBlockNode key={b.id} block={b} depth={0} docId={doc.id} isFirst={idx === 0} isLast={idx === arr.length - 1} />
          ))
        )}
      </div>
      <button type="button" className="btn-add-root" onClick={() => addWbsRootBlock(doc.id)}>
        + Додати блок
      </button>
    </div>
  );
}

function WbsBlockNode({ block, depth, docId, isFirst, isLast }) {
  const {
    updateWbsBlock,
    deleteWbsBlockToTrash,
    addWbsChildBlock,
    addWbsSiblingBlock,
    moveWbsBlock,
    focusBlockId,
    clearFocusBlockId,
  } = useAppState();
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusBlockId === block.id && inputRef.current) {
      inputRef.current.focus();
      clearFocusBlockId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBlockId, block.id]);

  const accent = DEPTH_ACCENTS[depth % DEPTH_ACCENTS.length];

  return (
    <div className="wbs-block" data-depth={depth}>
      <div className="wbs-block-row" style={{ '--block-accent': accent }}>
        <input
          ref={inputRef}
          type="text"
          className="wbs-block-input"
          value={block.text}
          placeholder="Назва блоку..."
          aria-label="Назва блоку WBS"
          onChange={(e) => updateWbsBlock(docId, block.id, { text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addWbsSiblingBlock(docId, block.id);
            }
          }}
        />
        <div className="row-controls">
          <LinkInsertButton
            inputRef={inputRef}
            value={block.text}
            onChange={(v) => updateWbsBlock(docId, block.id, { text: v })}
            className="link-insert-btn small"
          />
          <DeadlinePicker value={block.deadline} onChange={(deadline) => updateWbsBlock(docId, block.id, { deadline })} compact />
          <StagePicker value={block.stageId} onChange={(stageId) => updateWbsBlock(docId, block.id, { stageId })} />
          <div className="wbs-block-actions">
            <button
              type="button"
              className="wbs-icon-btn move"
              title="Перемістити вище"
              aria-label="Перемістити блок вище"
              disabled={isFirst}
              onClick={() => moveWbsBlock(docId, block.id, -1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="wbs-icon-btn move"
              title="Перемістити нижче"
              aria-label="Перемістити блок нижче"
              disabled={isLast}
              onClick={() => moveWbsBlock(docId, block.id, 1)}
            >
              ▼
            </button>
            <button
              type="button"
              className="wbs-icon-btn add"
              title="Додати підблок"
              aria-label="Додати підблок"
              onClick={() => addWbsChildBlock(docId, block.id)}
            >
              +
            </button>
            <button
              type="button"
              className="wbs-icon-btn delete"
              title="Видалити блок"
              aria-label="Видалити блок"
              onClick={() => deleteWbsBlockToTrash(docId, block.id)}
            >
              ×
            </button>
          </div>
        </div>
      </div>
      <LinkedText text={block.text} className="row-link-preview" />
      {block.children.length > 0 && (
        <div className="wbs-children">
          {block.children.map((c, idx, arr) => (
            <WbsBlockNode
              key={c.id}
              block={c}
              depth={depth + 1}
              docId={docId}
              isFirst={idx === 0}
              isLast={idx === arr.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Diagram view (read-only org chart) ===================== */

function WbsDiagramView({ doc }) {
  const { state } = useAppState();
  if (!doc.blocks.length) {
    return <div className="wbs-editor-wrap"><div className="wbs-empty-state">Немає блоків для показу. Додайте їх у вигляді «Список».</div></div>;
  }
  const layout = computeTreeLayout(doc.blocks);
  return <DiagramCanvas layout={layout} stages={state.stages} />;
}

function DiagramCanvas({ layout, stages }) {
  const { nodes, edges, nodeW, nodeH, width, height } = layout;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="diagram-scroll">
      <div className="diagram-canvas" style={{ width: width + 40, height: height + 40 }}>
        <svg className="diagram-edges" width={width + 40} height={height + 40}>
          {edges.map((e) => {
            const from = nodeById.get(e.fromId);
            const to = nodeById.get(e.toId);
            if (!from || !to) return null;
            const x1 = from.x + nodeW / 2 + 20;
            const y1 = from.y + nodeH + 20;
            const x2 = to.x + nodeW / 2 + 20;
            const y2 = to.y + 20;
            const midY = (y1 + y2) / 2;
            return (
              <path
                key={e.id}
                d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        {nodes.map((n) => {
          const stage = stages.find((s) => s.id === n.stageId);
          return (
            <div
              key={n.id}
              className="diagram-node"
              style={{ left: n.x + 20, top: n.y + 20, width: nodeW, height: nodeH, borderColor: stage ? stage.color : undefined }}
            >
              <div className="diagram-node-text">{n.text || 'Без назви'}</div>
              {stage && <div className="diagram-node-stage" style={{ color: stage.color }}>{stage.name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
