import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Pencil, 
  Eraser, 
  Palette,
  Undo,
  Redo,
  Download,
  X
} from 'lucide-react';

interface DrawingCanvasProps {
  onSave: (drawing: string) => void;
  onCancel: () => void;
  initialDrawing?: string;
}

interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

const COLORS = [
  '#000000', // Black
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#6B7280', // Gray
];

const PEN_SIZES = [2, 4, 8, 16];

export default function DrawingCanvas({ onSave, onCancel, initialDrawing }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const [undoStack, setUndoStack] = useState<DrawingStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[][]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Load initial drawing if provided
    if (initialDrawing && ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = initialDrawing;
    }
  }, [initialDrawing]);

  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw all strokes
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        const prevPoint = stroke.points[i - 1];
        
        // Smooth line using quadratic curves
        const cpx = (prevPoint.x + point.x) / 2;
        const cpy = (prevPoint.y + point.y) / 2;
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpx, cpy);
      }

      ctx.stroke();
    });

    // Draw current stroke
    if (currentStroke.length > 1) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentWidth;
      ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      for (let i = 1; i < currentStroke.length; i++) {
        const point = currentStroke[i];
        const prevPoint = currentStroke[i - 1];
        
        const cpx = (prevPoint.x + point.x) / 2;
        const cpy = (prevPoint.y + point.y) / 2;
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpx, cpy);
      }

      ctx.stroke();
    }
  };

  const getEventPoint = (event: React.PointerEvent<HTMLCanvasElement>): DrawingPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure || 0.5, // Apple Pencil pressure sensitivity
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setIsDrawing(true);
    
    const point = getEventPoint(event);
    setCurrentStroke([point]);
    
    // Save state for undo
    setUndoStack(prev => [...prev, [...strokes]]);
    setRedoStack([]);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    event.preventDefault();
    const point = getEventPoint(event);
    
    setCurrentStroke(prev => [...prev, point]);
    redrawCanvas();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    event.preventDefault();
    setIsDrawing(false);
    
    // Add current stroke to strokes
    if (currentStroke.length > 1) {
      const newStroke: DrawingStroke = {
        points: [...currentStroke],
        color: currentColor,
        width: currentWidth,
        tool: currentTool,
      };
      setStrokes(prev => [...prev, newStroke]);
    }
    
    setCurrentStroke([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, [...strokes]]);
    setStrokes(previousState);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, [...strokes]]);
    setStrokes(nextState);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setUndoStack(prev => [...prev, [...strokes]]);
    setRedoStack([]);
    setStrokes([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Drawing Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center space-x-4">
          {/* Tool Selection */}
          <div className="flex items-center space-x-1">
            <Button
              variant={currentTool === 'pen' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('pen')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant={currentTool === 'eraser' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('eraser')}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>

          {/* Color Palette */}
          {currentTool === 'pen' && (
            <div className="flex items-center space-x-1">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <div className="flex space-x-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCurrentColor(color)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      currentColor === color ? 'border-primary' : 'border-border'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pen Size */}
          <div className="flex items-center space-x-1">
            {PEN_SIZES.map((size) => (
              <Button
                key={size}
                variant={currentWidth === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentWidth(size)}
                className="w-8 h-8 p-0"
              >
                <div
                  className="rounded-full bg-current"
                  style={{
                    width: Math.min(size, 16),
                    height: Math.min(size, 16),
                  }}
                />
              </Button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Redo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
          >
            Save Drawing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Drawing Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full drawing-canvas active cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        />
        
        {/* Drawing Instructions */}
        {strokes.length === 0 && currentStroke.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Pencil className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Start Drawing
              </h3>
              <p className="text-muted-foreground">
                Use Apple Pencil or touch to draw. Pressure sensitivity supported.
              </p>
              <Badge variant="outline" className="mt-2">
                Optimized for iPad & Apple Pencil
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
