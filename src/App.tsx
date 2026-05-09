import React, { useState, useRef, useEffect } from 'react'
import { 
  Square, 
  Eraser, 
  PaintBucket, 
  Download, 
  Plus, 
  Undo, 
  Redo,
  Trash2,
  RefreshCw,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Maximize,
  Library,
  Pencil
} from 'lucide-react'

type Tool = 'pen' | 'eraser' | 'fill'

const DEFAULT_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'
]

function App() {
  const [resolution, setResolution] = useState(32)
  const [color, setColor] = useState('#000000')
  const [tool, setTool] = useState<Tool>('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [exportBackground, setExportBackground] = useState<'transparent' | string>('transparent')
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showGalleryModal, setShowGalleryModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [currentProjectName, setCurrentProjectName] = useState('Untitled')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    initCanvas()
    
    if (window.ipcRenderer) {
      window.ipcRenderer.on('update-available', () => setUpdateAvailable(true))
      window.ipcRenderer.on('update-downloaded', () => {
        setUpdateAvailable(false)
        setUpdateDownloaded(true)
      })
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault()
          undo()
        } else if (e.key === 'y') {
          e.preventDefault()
          redo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentProjectId && ctxRef.current && historyIndex > 0) {
        saveToLocalStorage()
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [historyIndex, currentProjectId])

  const initCanvas = (res = resolution) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width = res
    canvas.height = res
    
    ctx.clearRect(0, 0, res, res)
    ctxRef.current = ctx
    
    const initialData = ctx.getImageData(0, 0, res, res)
    setHistory([initialData])
    setHistoryIndex(0)
  }

  const saveHistory = () => {
    if (!ctxRef.current) return
    const currentData = ctxRef.current.getImageData(0, 0, resolution, resolution)
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(currentData)
    
    // Limit history size to 50 steps
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(newHistory.length - 1)
    }
    setHistory(newHistory)
    if (newHistory.length > 50) setHistoryIndex(49)
  }

  const undo = () => {
    if (historyIndex > 0 && ctxRef.current) {
      const prevIndex = historyIndex - 1
      ctxRef.current.putImageData(history[prevIndex], 0, 0)
      setHistoryIndex(prevIndex)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1 && ctxRef.current) {
      const nextIndex = historyIndex + 1
      ctxRef.current.putImageData(history[nextIndex], 0, 0)
      setHistoryIndex(nextIndex)
    }
  }

  const saveToLocalStorage = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const projectData = {
      id: currentProjectId || Date.now().toString(),
      name: currentProjectName,
      resolution,
      data: canvas.toDataURL(),
      lastModified: Date.now()
    }

    const savedProjects = await window.ipcRenderer.invoke('load-projects')
    const index = savedProjects.findIndex((p: any) => p.id === projectData.id)
    
    if (index >= 0) {
      savedProjects[index] = projectData
    } else {
      savedProjects.push(projectData)
    }

    await window.ipcRenderer.invoke('save-projects', savedProjects)
    setCurrentProjectId(projectData.id)
    setLastSaved(Date.now())
    loadProjects()
  }

  const loadProjects = async () => {
    const saved = await window.ipcRenderer.invoke('load-projects')
    setProjects(saved.sort((a: any, b: any) => b.lastModified - a.lastModified))
  }

  const loadProject = (project: any) => {
    setResolution(project.resolution)
    setCurrentProjectName(project.name)
    setCurrentProjectId(project.id)
    
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = project.resolution
      canvas.height = project.resolution
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      ctxRef.current = ctx
      
      const initialData = ctx.getImageData(0, 0, project.resolution, project.resolution)
      setHistory([initialData])
      setHistoryIndex(0)
    }
    img.src = project.data
    setShowGalleryModal(false)
  }

  const deleteProject = async (id: string) => {
    const saved = await window.ipcRenderer.invoke('load-projects')
    const filtered = saved.filter((p: any) => p.id !== id)
    await window.ipcRenderer.invoke('save-projects', filtered)
    loadProjects()
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the canvas?')) {
      initCanvas()
    }
  }

  const handleNewProject = (e: React.FormEvent) => {
    e.preventDefault()
    const newId = Date.now().toString()
    setCurrentProjectId(newId)
    initCanvas(resolution)
    setShowNewModal(false)
  }

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent, force = false) => {
    const { x, y } = getCoordinates(e)
    setHoverPos({ x, y })

    if (!force && (!isDrawing || !ctxRef.current)) return
    const isRightClick = 'buttons' in e && (e.buttons === 2 || e.buttons === 3)
    
    if (isRightClick || tool === 'eraser') {
      ctxRef.current!.clearRect(x, y, 1, 1)
    } else if (tool === 'pen') {
      ctxRef.current!.fillStyle = color
      ctxRef.current!.fillRect(x, y, 1, 1)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true)
    const { x, y } = getCoordinates(e)

    if (e.button === 2) {
      ctxRef.current!.clearRect(x, y, 1, 1)
      return
    }

    if (tool === 'fill') {
      floodFill(x, y, color)
      saveHistory()
    } else {
      draw(e, true)
    }
  }

  const handleMouseUp = () => {
    if (isDrawing) {
      saveHistory()
    }
    setIsDrawing(false)
  }

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const ctx = ctxRef.current
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, resolution, resolution)
    const data = imageData.data
    const targetColor = getPixel(startX, startY, data)
    const fillRGB = hexToRgb(fillColor)

    if (colorsMatch(targetColor, fillRGB)) return

    const stack = [[startX, startY]]
    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      const currentColor = getPixel(x, y, data)

      if (colorsMatch(currentColor, targetColor)) {
        setPixel(x, y, fillRGB, data)
        if (x > 0) stack.push([x - 1, y])
        if (x < resolution - 1) stack.push([x + 1, y])
        if (y > 0) stack.push([x, y - 1])
        if (y < resolution - 1) stack.push([x, y + 1])
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }

  const getPixel = (x: number, y: number, data: Uint8ClampedArray) => {
    const i = (y * resolution + x) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }

  const setPixel = (x: number, y: number, color: number[], data: Uint8ClampedArray) => {
    const i = (y * resolution + x) * 4
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
    data[i + 3] = 255
  }

  const colorsMatch = (c1: number[], c2: number[]) => {
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2]
  }

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0]
  }

  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const exportCanvas = document.createElement('canvas')
    const size = 1024
    exportCanvas.width = size
    exportCanvas.height = size
    const exportCtx = exportCanvas.getContext('2d')
    if (!exportCtx) return

    if (exportBackground !== 'transparent') {
      exportCtx.fillStyle = exportBackground
      exportCtx.fillRect(0, 0, size, size)
    }

    exportCtx.imageSmoothingEnabled = false
    exportCtx.drawImage(canvas, 0, 0, size, size)
    
    const link = document.createElement('a')
    link.download = `pixel-art-${Date.now()}.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
    setShowExportModal(false)
  }

  const handleRestart = () => {
    window.ipcRenderer.send('restart-app')
  }

  return (
    <div className="app-container">
      <div className="title-bar-spacer">
        <span>pixel-art</span>
      </div>
      
      <div className="main-layout">
        <aside className="sidebar">
          <div>
            <h2>Tools</h2>
            <div className="tool-grid">
              <button 
                className={`tool-button ${tool === 'pen' ? 'active' : ''}`}
                onClick={() => setTool('pen')}
                title="Pencil (P)"
              >
                <Pencil size={20} />
              </button>
              <button 
                className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
                onClick={() => setTool('eraser')}
                title="Eraser"
              >
                <Eraser size={20} />
              </button>
              <button 
                className={`tool-button ${tool === 'fill' ? 'active' : ''}`}
                onClick={() => setTool('fill')}
                title="Fill Bucket"
              >
                <PaintBucket size={20} />
              </button>
              <button 
                className="tool-button"
                onClick={handleClear}
                title="Clear Canvas"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          <div className="color-section">
            <h2>Colors</h2>
            <div className="color-palette">
              {DEFAULT_COLORS.map(c => (
                <div 
                  key={c}
                  className="palette-color"
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)}
              style={{ width: '100%', height: '40px', cursor: 'pointer', border: 'none', background: 'none' }}
            />
          </div>

          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={() => setShowGalleryModal(true)}>
              <Library size={18} /> My Gallery
            </button>
            <button className="btn btn-secondary" onClick={() => setShowNewModal(true)}>
              <Plus size={18} /> New Project
            </button>
            <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
              <Download size={18} /> Export PNG
            </button>
          </div>

          {lastSaved && (
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </div>
          )}
        </aside>

        <main className="canvas-area">
          <div className="canvas-controls-left">
            <button 
              className="control-btn" 
              onClick={undo} 
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={18} />
            </button>
            <button 
              className="control-btn" 
              onClick={redo} 
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <Redo size={18} />
            </button>
          </div>

          <div className="canvas-controls-right">
            <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
              <button 
                className="control-btn" 
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                fontSize: '0.6rem', 
                fontFamily: "'Press Start 2P', cursive",
                minWidth: '60px', 
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}>
                {Math.round(zoom * 100)}%
              </span>
              <button 
                className="control-btn" 
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button 
                className="control-btn" 
                onClick={() => setZoom(1)}
                title="Reset Zoom"
              >
                <Maximize size={18} />
              </button>
            </div>
            <button 
              className={`control-btn ${showGrid ? 'active' : ''}`}
              onClick={() => setShowGrid(!showGrid)}
              title={showGrid ? 'Hide Grid' : 'Show Grid'}
            >
              <Grid3X3 size={18} />
            </button>
          </div>

          <div 
            className="canvas-container" 
            style={{ 
              width: `${600 * zoom}px`, 
              height: `${600 * zoom}px`,
              '--grid-size': `${(600 * zoom) / resolution}px`
            } as React.CSSProperties}
          >
            <canvas
              ref={canvasRef}
              className="pixel-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={draw}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              style={{ width: '100%', height: '100%' }}
            />
            {showGrid && <div className="grid-overlay" />}
            {hoverPos && (
              <div 
                className="pixel-cursor"
                style={{
                  left: `${hoverPos.x * (600 * zoom / resolution)}px`,
                  top: `${hoverPos.y * (600 * zoom / resolution)}px`,
                  width: `var(--grid-size)`,
                  height: `var(--grid-size)`,
                  position: 'absolute',
                  border: '2px solid var(--accent-primary)',
                  pointerEvents: 'none',
                  zIndex: 10,
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>
        </main>
      </div>

      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>New Project</h2>
            <form onSubmit={handleNewProject}>
              <div className="form-group">
                <label>Resolution (px)</label>
                <input 
                  type="number" 
                  value={resolution} 
                  onChange={(e) => setResolution(parseInt(e.target.value))}
                  min="8"
                  max="128"
                />
              </div>
              <div className="form-group">
                <label>Project Name</label>
                <input 
                  type="text" 
                  value={currentProjectName} 
                  onChange={(e) => setCurrentProjectName(e.target.value)}
                  placeholder="Untitled"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {updateAvailable && (
        <div className="update-banner">
          <RefreshCw size={20} className="animate-spin" />
          <span>New update available! Downloading...</span>
        </div>
      )}

      {updateDownloaded && (
        <div className="update-banner">
          <RefreshCw size={20} />
          <span>Update ready!</span>
          <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem' }} onClick={handleRestart}>
            Restart to Update
          </button>
        </div>
      )}
      {showGalleryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2>My Gallery</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
              {projects.length === 0 ? (
                <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>No saved projects yet.</p>
              ) : (
                projects.map(p => (
                  <div key={p.id} className="gallery-item" style={{ background: 'var(--bg-tertiary)', borderRadius: '0.5rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div 
                      style={{ aspectRatio: '1', background: 'white', borderRadius: '0.25rem', cursor: 'pointer', backgroundImage: `url(${p.data})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', imageRendering: 'pixelated' }}
                      onClick={() => loadProject(p)}
                    />
                    <div style={{ fontSize: '0.875rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.resolution}x{p.resolution}</div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => setShowGalleryModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Export Settings</h2>
            <div className="form-group">
              <label>Choose Background</label>
              <select 
                className="control-btn" 
                style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem' }}
                value={exportBackground === 'transparent' ? 'transparent' : (['#ffffff', '#000000'].includes(exportBackground) ? exportBackground : 'custom')}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === 'transparent') setExportBackground('transparent')
                  else if (val === 'custom') setExportBackground('#6366f1') // Default custom color
                  else setExportBackground(val)
                }}
              >
                <option value="transparent">Transparent</option>
                <option value="#ffffff">White</option>
                <option value="#000000">Black</option>
                <option value="custom">Custom Color</option>
              </select>

              {exportBackground !== 'transparent' && !['#ffffff', '#000000'].includes(exportBackground) && (
                <input 
                  type="color" 
                  value={exportBackground} 
                  onChange={(e) => setExportBackground(e.target.value)}
                  style={{ width: '100%', height: '40px', cursor: 'pointer', border: 'none', background: 'none' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={exportPng}>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
