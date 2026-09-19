import { useRef, useState } from 'react'

interface SignaturePadProps {
  onSign: (dataUrl: string) => void
}

export default function SignaturePad({ onSign }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1C2B4A'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasStroke(true)
  }

  const end = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
  }

  const submit = () => {
    if (!hasStroke) return
    onSign(canvasRef.current!.toDataURL())
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={460}
        height={150}
        className="w-full rounded-lg border border-border cursor-crosshair touch-none"
        style={{ backgroundColor: '#fff' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <p className="text-xs text-muted-foreground mt-1.5">Draw your signature above using your mouse or finger</p>
      <div className="flex gap-3 pt-3">
        <button onClick={clear} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          Clear
        </button>
        <button
          onClick={submit}
          disabled={!hasStroke}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
          style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: hasStroke ? 1 : 0.4 }}
        >
          Submit Signature
        </button>
      </div>
    </div>
  )
}
