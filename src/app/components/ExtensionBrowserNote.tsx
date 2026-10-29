import { Info } from 'lucide-react';
import type { VisitorExtensionStore } from '../hooks/useExtensionStore';

/**
 * Shown next to an install button on browsers that can't install the extension (Firefox, Safari,
 * phones). Renders nothing on Chrome and Edge.
 */
export function ExtensionBrowserNote({ store, tone = 'light', className = '' }: { store: VisitorExtensionStore; tone?: 'light' | 'dark'; className?: string }) {
  if (store.supported) return null;
  const colors =
    tone === 'dark' ? 'border-amber-300/40 bg-amber-300/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <p className={`inline-flex items-start gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${colors} ${className}`}>
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        The extension works on <b>Google Chrome</b> and <b>Microsoft Edge</b> on a computer. Open this page in Chrome or Edge to
        install it.
      </span>
    </p>
  );
}
