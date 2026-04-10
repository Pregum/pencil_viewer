import { createContext, useContext, type ReactNode } from 'react';
import type { PaintRegistry } from './registry';

const PaintRegistryContext = createContext<PaintRegistry | null>(null);

export function PaintRegistryProvider({
  value,
  children,
}: {
  value: PaintRegistry;
  children: ReactNode;
}) {
  return <PaintRegistryContext.Provider value={value}>{children}</PaintRegistryContext.Provider>;
}

export function usePaintRegistry(): PaintRegistry | null {
  return useContext(PaintRegistryContext);
}
