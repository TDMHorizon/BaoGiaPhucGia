import React, { useState, useRef } from 'react';
import { X, Move, Trash2, Image as ImageIcon } from 'lucide-react';

export interface FloatingImage {
  id: string;
  sheetName: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageOverlayProps {
  images: FloatingImage[];
  activeSheet: string;
  onUpdateImage: (updated: FloatingImage) => void;
  onRemoveImage: (id: string) => void;
  disabled?: boolean;
}

export function ImageOverlay({
  images,
  activeSheet,
  onUpdateImage,
  onRemoveImage,
  disabled = false,
}: ImageOverlayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; imgX: number; imgY: number }>({ x: 0, y: 0, imgX: 0, imgY: 0 });

  const currentSheetImages = images.filter((img) => img.sheetName === activeSheet);

  if (currentSheetImages.length === 0) return null;

  const handleMouseDown = (e: React.MouseEvent, img: FloatingImage) => {
    if (disabled) return;
    e.stopPropagation();
    setSelectedId(img.id);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      imgX: img.x,
      imgY: img.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      onUpdateImage({
        ...img,
        x: Math.max(0, dragStartRef.current.imgX + dx),
        y: Math.max(0, dragStartRef.current.imgY + dy),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {currentSheetImages.map((img) => {
        const isSelected = selectedId === img.id;
        return (
          <div
            key={img.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(img.id);
            }}
            onMouseDown={(e) => handleMouseDown(e, img)}
            style={{
              left: `${img.x}px`,
              top: `${img.y}px`,
              width: `${img.width}px`,
              height: `${img.height}px`,
            }}
            className={`pointer-events-auto absolute select-none cursor-move rounded transition-shadow ${
              isSelected ? 'ring-2 ring-[#107c41] shadow-lg' : 'hover:ring-1 hover:ring-slate-400'
            }`}
          >
            <img
              src={img.src}
              alt="Spreadsheet Graphic"
              className="h-full w-full object-contain pointer-events-none"
              draggable={false}
            />

            {isSelected && !disabled && (
              <div className="absolute -top-3 -right-3 flex items-center gap-1 bg-white border border-slate-300 rounded shadow p-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(img.id);
                  }}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Xóa hình ảnh"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
