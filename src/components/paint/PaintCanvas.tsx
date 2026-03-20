"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Pen,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Save,
  X,
  Palette,
} from "lucide-react";

type Tool = "pen" | "eraser" | "rect" | "ellipse" | "line" | "arrow" | "text";

interface Point {
  x: number;
  y: number;
}

interface DrawAction {
  imageData: ImageData;
}

const COLORS = [
  "#ffffff",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
];

const STROKE_SIZES = [
  { label: "S", size: 2 },
  { label: "M", size: 4 },
  { label: "L", size: 8 },
];

const CANVAS_BG = "#111118";

interface PaintCanvasProps {
  onSave: (file: File) => Promise<void>;
  onClose: () => void;
}

export function PaintCanvas({ onSave, onClose }: PaintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ffffff");
  const [strokeSize, setStrokeSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");

  // Undo/redo stacks
  const undoStack = useRef<DrawAction[]>([]);
  const redoStack = useRef<DrawAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Drawing state refs
  const startPoint = useRef<Point>({ x: 0, y: 0 });
  const lastPoint = useRef<Point>({ x: 0, y: 0 });
  const preDrawImage = useRef<ImageData | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    // Use device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Fill with dark background
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Save initial state
    undoStack.current = [{ imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undoStack.current.push({ imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) });
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || undoStack.current.length <= 1) return;

    const current = undoStack.current.pop()!;
    redoStack.current.push(current);

    const prev = undoStack.current[undoStack.current.length - 1];
    ctx.putImageData(prev.imageData, 0, 0);

    setCanUndo(undoStack.current.length > 1);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || redoStack.current.length === 0) return;

    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    ctx.putImageData(next.imageData, 0, 0);

    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const container = containerRef.current;
    if (!canvas || !ctx || !container) return;

    const rect = container.getBoundingClientRect();
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, rect.width, rect.height);
    saveState();
  }, [saveState]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, from: Point, to: Point, currentColor: string, size: number) => {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, []);

  const drawArrowHead = useCallback((ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = Math.max(size * 4, 15);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle - Math.PI / 6),
      to.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle + Math.PI / 6),
      to.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === "text") {
      const point = getCanvasPoint(e);
      setTextInput(point);
      setTextValue("");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(e);
    setIsDrawing(true);
    startPoint.current = point;
    lastPoint.current = point;

    // Save image before shape drawing starts (for preview)
    if (tool !== "pen" && tool !== "eraser") {
      preDrawImage.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    if (tool === "pen" || tool === "eraser") {
      ctx.strokeStyle = tool === "eraser" ? CANVAS_BG : color;
      ctx.lineWidth = tool === "eraser" ? strokeSize * 4 : strokeSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  }, [tool, color, strokeSize, getCanvasPoint]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(e);

    if (tool === "pen" || tool === "eraser") {
      ctx.strokeStyle = tool === "eraser" ? CANVAS_BG : color;
      ctx.lineWidth = tool === "eraser" ? strokeSize * 4 : strokeSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      lastPoint.current = point;
    } else {
      // Shape preview — restore pre-draw image and draw shape
      if (preDrawImage.current) {
        ctx.putImageData(preDrawImage.current, 0, 0);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const start = startPoint.current;
      if (tool === "rect") {
        ctx.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
      } else if (tool === "ellipse") {
        const cx = (start.x + point.x) / 2;
        const cy = (start.y + point.y) / 2;
        const rx = Math.abs(point.x - start.x) / 2;
        const ry = Math.abs(point.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "line") {
        drawLine(ctx, start, point, color, strokeSize);
      } else if (tool === "arrow") {
        drawLine(ctx, start, point, color, strokeSize);
        drawArrowHead(ctx, start, point, strokeSize);
      }
    }
  }, [isDrawing, tool, color, strokeSize, getCanvasPoint, drawLine, drawArrowHead]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    preDrawImage.current = null;
    saveState();
  }, [isDrawing, saveState]);

  const commitText = useCallback(() => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      setTextValue("");
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.font = `${Math.max(strokeSize * 5, 16)}px sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(textValue, textInput.x, textInput.y);
    saveState();
    setTextInput(null);
    setTextValue("");
  }, [textInput, textValue, color, strokeSize, saveState]);

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;

      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const filename = `sketch-${timestamp}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      await onSave(file);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (textInput) return; // Don't capture while typing
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, onClose, textInput]);

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen", icon: <Pen className="h-4 w-4" />, label: "Pen" },
    { id: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Eraser" },
    { id: "line", icon: <Minus className="h-4 w-4" />, label: "Line" },
    { id: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Arrow" },
    { id: "rect", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
    { id: "ellipse", icon: <Circle className="h-4 w-4" />, label: "Ellipse" },
    { id: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
  ];

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-black/40 backdrop-blur-sm flex-wrap">
        {/* Tool buttons */}
        <div className="flex items-center gap-0.5 mr-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTool(t.id);
                if (textInput) commitText();
              }}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                tool === t.id
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/8"
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Color swatches */}
        <div className="flex items-center gap-1 mr-2 relative">
          {COLORS.slice(0, 5).map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                color === c ? "border-white scale-110" : "border-white/20 hover:border-white/50"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-6 h-6 rounded-full border-2 border-white/20 hover:border-white/50 flex items-center justify-center bg-white/5"
            title="More colors"
          >
            <Palette className="h-3 w-3 text-white/60" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-2 p-2 bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl grid grid-cols-5 gap-1.5 z-50">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setShowColorPicker(false); }}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? "border-white scale-110" : "border-white/20 hover:border-white/50"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="col-span-5 mt-1">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-7 rounded cursor-pointer bg-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Stroke sizes */}
        <div className="flex items-center gap-0.5 mr-2">
          {STROKE_SIZES.map((s) => (
            <button
              key={s.label}
              onClick={() => setStrokeSize(s.size)}
              className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                strokeSize === s.size
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/8"
              }`}
              title={`${s.label} (${s.size}px)`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Undo/Redo/Clear */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={clearCanvas}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-red-400/80 hover:bg-red-500/10 transition-colors"
            title="Clear canvas"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Right side — Save & Close */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Sketch"}
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: tool === "text" ? "text" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="absolute inset-0"
        />
        {/* Text input overlay */}
        {textInput && (
          <input
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") { setTextInput(null); setTextValue(""); }
            }}
            onBlur={commitText}
            className="absolute bg-transparent border border-white/30 rounded px-1 text-white focus:outline-none focus:border-white/60"
            style={{
              left: textInput.x,
              top: textInput.y - Math.max(strokeSize * 5, 16),
              fontSize: Math.max(strokeSize * 5, 16),
              fontFamily: "sans-serif",
              minWidth: 100,
            }}
          />
        )}
        {/* Hint when canvas is empty */}
        <div className="absolute bottom-3 right-3 text-white/20 text-xs pointer-events-none select-none">
          Draw your UI ideas here — saved as image context for the agent
        </div>
      </div>
    </div>
  );
}
