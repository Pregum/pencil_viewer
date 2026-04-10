/**
 * CommandPalette を EditorProvider 内で使うラッパー。
 * useAlignCommands 等、EditorContext 依存のコマンドを統合する。
 */

import { CommandPalette, type Command } from './CommandPalette';
import { useAlignCommands } from './AlignCommands';

interface Props {
  baseCommands: Command[];
  onClose: () => void;
}

export function CommandPaletteWrapper({ baseCommands, onClose }: Props) {
  const alignCommands = useAlignCommands();
  const allCommands = [...baseCommands, ...alignCommands];

  return <CommandPalette commands={allCommands} onClose={onClose} />;
}
