import { useState, useRef, useEffect } from 'react';
import { X, MessageCircle, ChevronDown } from 'lucide-react';
import MedicationQuery from './MedicationQuery';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 400, height: 600 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }

    if (isResizing) {
      const newWidth = Math.max(320, e.clientX - position.x);
      const newHeight = Math.max(400, e.clientY - position.y);
      setSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position, dragOffset]);

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 z-50 flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-xl hover:shadow-2xl transition transform hover:scale-110"
          aria-label="Open MediBot chat"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Chat Widget Window */}
      {isOpen && (
        <div
          ref={widgetRef}
          className="fixed z-50 rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden flex flex-col"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            cursor: isDragging ? 'grabbing' : 'default',
          }}
        >
          {/* Draggable Header */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold border border-white">👨</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500 text-white text-xs font-bold border border-white">👩</div>
              </div>
              <span className="text-sm font-semibold text-white">Chat with us</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 text-white/90 hover:bg-white/10 rounded-full transition"
                data-no-drag="true"
              >
                <ChevronDown size={18} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/90 hover:bg-white/10 rounded-full transition"
                data-no-drag="true"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-1 flex-shrink-0">
            <p className="text-xs font-medium text-white/90">We're online</p>
          </div>

          {/* Chat Component - Scrollable */}
          <div className="flex-1 overflow-hidden">
            <MedicationQuery />
          </div>

          {/* Resize Handle */}
          <div
            ref={resizeHandleRef}
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 bg-blue-600 cursor-se-resize hover:bg-blue-700 rounded-tl"
            style={{ cursor: 'nwse-resize' }}
          />
        </div>
      )}
    </>
  );
}