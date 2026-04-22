import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Short label shown in the sheet header */
  title?: string;
  /** 
   * Height as a CSS value — defaults to "78dvh".
   * Clamps to viewport so nothing is lost behind the safe-area.
   */
  height?: string;
  children: React.ReactNode;
}

/**
 * A slide-up bottom sheet used on mobile viewports.
 * Renders a translucent backdrop that closes the sheet on tap,
 * plus a draggable-looking handle for visual affordance.
 *
 * Z-indices are set above Leaflet's default 1000 so the sheet
 * always appears on top of the map.
 */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  height = "78dvh",
  children,
}: MobileBottomSheetProps) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Simple touch-drag-to-close
  const sheetRef   = useRef<HTMLDivElement>(null);
  const startY     = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.changedTouches[0].clientY - startY.current;
    if (delta > 80) onClose(); // dragged down ≥ 80 px → dismiss
    startY.current = null;
  };

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 1002 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Sheet ────────────────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          height,
          zIndex: 1003,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <span className="text-sm text-gray-700">{title}</span>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}
