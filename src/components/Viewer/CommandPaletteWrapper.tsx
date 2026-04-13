/**
 * CommandPalette を EditorProvider 内で使うラッパー。
 * useAlignCommands 等、EditorContext 依存のコマンドを統合する。
 */

import { useCallback } from 'react';
import { CommandPalette, type Command } from './CommandPalette';
import { useAlignCommands } from './AlignCommands';
import { useEditor } from '../../pen/state/EditorContext';
import { generateDesignDoc, downloadMarkdown } from '../../analysis/designDocExport';

interface Props {
  baseCommands: Command[];
  onClose: () => void;
}

export function CommandPaletteWrapper({ baseCommands, onClose }: Props) {
  const alignCommands = useAlignCommands();
  const { state } = useEditor();

  const exportDesignDoc = useCallback(() => {
    const md = generateDesignDoc(state.rawDoc, { projectName: 'Design Document', locale: 'ja' });
    downloadMarkdown(md, 'design-doc.md');
  }, [state.rawDoc]);

  const exportDesignDocEn = useCallback(() => {
    const md = generateDesignDoc(state.rawDoc, { projectName: 'Design Document', locale: 'en' });
    downloadMarkdown(md, 'design-doc.md');
  }, [state.rawDoc]);

  const docCommands: Command[] = [
    { id: 'export-design-doc-ja', label: 'Export Design Doc (Markdown / JA)', action: exportDesignDoc },
    { id: 'export-design-doc-en', label: 'Export Design Doc (Markdown / EN)', action: exportDesignDocEn },
  ];

  const allCommands = [...baseCommands, ...alignCommands, ...docCommands];

  return <CommandPalette commands={allCommands} onClose={onClose} />;
}
