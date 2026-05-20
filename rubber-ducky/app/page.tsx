'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  OS, Payload, TagType,
  PAYLOADS, SNIPPETS, VALID_COMMANDS, TAG_LABELS,
} from '@/lib/payloads'

// ─── Types ────────────────────────────────────────────────────
type PanelTab = 'connect' | 'snippets' | 'reference'
type LogType = 'info' | 'ok' | 'err' | 'tx' | 'done' | 'warn'
interface LogEntry { id: number; time: string; msg: string; type: LogType }
type DeployStatus = 'idle' | 'sending' | 'sent' | 'fetched' | 'error'

// ─── Constants ────────────────────────────────────────────────
const OS_OPTIONS: { id: OS; icon: string; label: string }[] = [
  { id: 'linux',   icon: '🐧', label: 'Linux'   },
  { id: 'windows', icon: '🪟', label: 'Windows' },
  { id: 'macos',   icon: '🍎', label: 'macOS'   },
  { id: 'android', icon: '🤖', label: 'Android' },
]

const TAG_COLORS: Record<TagType, string> = {
  recon:   'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  persist: 'bg-red-500/10 text-red-400 border border-red-500/20',
  util:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  exfil:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
}

let logIdCounter = 0

// ─── Helpers ──────────────────────────────────────────────────
function makeLog(msg: string, type: LogType): LogEntry {
  const now = new Date()
  const time = now.toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  return { id: ++logIdCounter, time, msg, type }
}

function now(): string {
  return new Date().toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function generateDeviceId(): string {
  // Readable 8-char hex ID — stored in localStorage so the ESP config persists
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

// ─── Main Page ────────────────────────────────────────────────
export default function DuckPadPage() {
  // OS & payload selection
  const [selectedOS, setSelectedOS]           = useState<OS>('linux')
  const [activePayloadId, setActivePayloadId] = useState<string | null>(null)
  const [payloadName, setPayloadName]         = useState('Select a payload →')
  const [payloadDesc, setPayloadDesc]         = useState('')

  // Editor
  const [script, setScript]       = useState('')
  const [lineCount, setLineCount] = useState(0)
  const editorRef                 = useRef<HTMLTextAreaElement>(null)
  const lineNumRef                = useRef<HTMLDivElement>(null)

  // Panel tab
  const [activeTab, setActiveTab] = useState<PanelTab>('connect')

  // Mobile UI
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  // Device ID (the ESP32 identifier)
  const [deviceId, setDeviceId]           = useState('')
  const [customDeviceId, setCustomDeviceId] = useState('')

  // Deploy state
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle')
  const [logs, setLogs]                 = useState<LogEntry[]>([])
  const logEndRef                       = useRef<HTMLDivElement>(null)

  // Poll interval ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Init ───────────────────────────────────────────────────
  useEffect(() => {
    let id = localStorage.getItem('duckpad_device_id')
    if (!id) {
      id = generateDeviceId()
      localStorage.setItem('duckpad_device_id', id)
    }
    setDeviceId(id)
    setCustomDeviceId(id)
    addLog(`Device ID: ${id}`, 'info')
    addLog('Configure ESP32 with this device ID and your Vercel URL', 'info')
  }, [])

  // ─── Auto-scroll logs ───────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ─── Line numbers ───────────────────────────────────────────
  useEffect(() => {
    const lines = script.split('\n')
    setLineCount(lines.length)
    if (lineNumRef.current) {
      lineNumRef.current.textContent = lines.map((_, i) => i + 1).join('\n')
    }
  }, [script])

  // ─── Helpers ────────────────────────────────────────────────
  const addLog = useCallback((msg: string, type: LogType) => {
    setLogs(prev => [...prev.slice(-199), makeLog(msg, type)])
  }, [])

  // ─── OS filter ──────────────────────────────────────────────
  const filteredPayloads = PAYLOADS.filter(p => p.os.includes(selectedOS))

  // ─── Load a predefined payload ──────────────────────────────
  function loadPayload(p: Payload) {
    setActivePayloadId(p.id)
    setScript(p.script)
    setPayloadName(p.name)
    setPayloadDesc(p.desc)
    setDeployStatus('idle')
  }

  function newPayload() {
    setActivePayloadId(null)
    setScript('REM New Payload\nDELAY 500\n')
    setPayloadName('Custom Payload')
    setPayloadDesc(selectedOS.charAt(0).toUpperCase() + selectedOS.slice(1))
    setDeployStatus('idle')
    setTimeout(() => editorRef.current?.focus(), 50)
  }

  // ─── Editor sync scroll ─────────────────────────────────────
  function handleEditorScroll() {
    if (lineNumRef.current && editorRef.current) {
      lineNumRef.current.scrollTop = editorRef.current.scrollTop
    }
  }

  // ─── Tab key in textarea ────────────────────────────────────
  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = editorRef.current!
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = script.substring(0, start) + '  ' + script.substring(end)
      setScript(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  // ─── Validate ───────────────────────────────────────────────
  function validateScript() {
    const lines = script.split('\n')
    const errors: string[] = []
    lines.forEach((raw, i) => {
      const line = raw.trim()
      if (!line) return
      const cmd = line.split(' ')[0].toUpperCase()
      if (!VALID_COMMANDS.includes(cmd)) {
        errors.push(`Line ${i + 1}: Unknown command "${cmd}"`)
      }
    })
    if (errors.length === 0) {
      addLog(`✓ Valid — ${lines.filter(l => l.trim()).length} commands`, 'ok')
    } else {
      errors.forEach(e => addLog(e, 'err'))
    }
    setActiveTab('connect')
  }

  // ─── Insert snippet ─────────────────────────────────────────
  function insertSnippet(code: string) {
    const el = editorRef.current
    if (!el) return
    const start = el.selectionStart
    const before = script.substring(0, start)
    const after = script.substring(el.selectionEnd)
    const needsNl = before.length > 0 && !before.endsWith('\n')
    const insert = (needsNl ? '\n' : '') + code
    const next = before + insert + after
    setScript(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + insert.length
      el.focus()
    })
  }

  // ─── Apply device ID ────────────────────────────────────────
  function applyDeviceId() {
    const id = customDeviceId.trim().toUpperCase()
    if (!id) return
    setDeviceId(id)
    localStorage.setItem('duckpad_device_id', id)
    addLog(`Device ID set: ${id}`, 'info')
  }

  function regenerateId() {
    const id = generateDeviceId()
    setCustomDeviceId(id)
    setDeviceId(id)
    localStorage.setItem('duckpad_device_id', id)
    addLog(`New Device ID: ${id}`, 'info')
  }

  // ─── Stop polling ───────────────────────────────────────────
  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // ─── Deploy payload to ESP32 via API ────────────────────────
  async function deployPayload() {
    if (!script.trim()) { addLog('Empty script', 'err'); return }
    if (!deviceId) { addLog('No device ID set', 'err'); return }

    setDeployStatus('sending')
    addLog(`Queueing payload for device ${deviceId}...`, 'tx')

    try {
      const res = await fetch('/api/payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, script: script.trim() }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Server error')
      }

      setDeployStatus('sent')
      addLog('✓ Payload queued — waiting for ESP32 to fetch...', 'ok')

      // Poll for fetch confirmation
      stopPoll()
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        if (attempts > 60) { // ~2 min timeout
          stopPoll()
          addLog('Timeout — ESP32 did not fetch within 2 minutes', 'warn')
          setDeployStatus('error')
          return
        }
        try {
          const sr = await fetch(`/api/status?deviceId=${deviceId}`)
          const sd = await sr.json() as { status: string }
          if (sd.status === 'fetched') {
            stopPoll()
            setDeployStatus('fetched')
            addLog(`✓ ESP32 fetched payload at ${now()} — executing!`, 'done')
          }
        } catch { /* network blip, keep polling */ }
      }, 2000)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addLog(`ERR: ${msg}`, 'err')
      setDeployStatus('error')
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────
  useEffect(() => () => stopPoll(), [])

  // ─── Derived ────────────────────────────────────────────────
  const statusColor: Record<DeployStatus, string> = {
    idle:    'text-[var(--muted)]',
    sending: 'text-[var(--warn)]',
    sent:    'text-[var(--accent)]',
    fetched: 'text-[var(--success)]',
    error:   'text-[var(--danger)]',
  }
  const statusLabel: Record<DeployStatus, string> = {
    idle:    'Ready',
    sending: 'Sending…',
    sent:    'Waiting for ESP32…',
    fetched: 'Executed ✓',
    error:   'Error',
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-3 md:px-5 shrink-0 border-b"
        style={{ height: 50, background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-base -ml-1"
            style={{ color: 'var(--muted)' }}
            aria-label="Open payloads sidebar"
          >
            ☰
          </button>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
               style={{ background: 'var(--accent)' }}>
            🦆
          </div>
          <span className="font-bold text-[15px] tracking-tight hidden sm:inline">DuckPad</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded hidden sm:inline"
                style={{ background: 'rgba(79,156,249,0.12)', color: 'var(--accent)', border: '1px solid rgba(79,156,249,0.2)' }}>
            MVP
          </span>
          <span className="text-[12px] font-medium truncate max-w-[120px] sm:hidden" style={{ color: 'var(--muted)' }}>
            {payloadName}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3 text-xs" style={{ color: 'var(--muted)' }}>
          <span className="hidden sm:inline">Device: <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{deviceId || '—'}</span></span>
          <span className={`font-semibold text-[11px] ${statusColor[deployStatus]}`}>
            {deployStatus === 'sent' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle dot-polling"
                    style={{ background: 'var(--warn)' }} />
            )}
            {deployStatus === 'fetched' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle dot-connected"
                    style={{ background: 'var(--success)' }} />
            )}
            <span className="hidden xs:inline">{statusLabel[deployStatus]}</span>
          </span>
        </div>
      </header>

      {/* ── Responsive layout ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative" style={{ height: 'calc(100vh - 50px)' }}>

        {/* ── LEFT SIDEBAR (Drawer on mobile) ──────────────── */}
        <aside
          className={`
            flex flex-col shrink-0 overflow-y-auto border-r z-30
            fixed md:relative inset-y-0 left-0
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          style={{ width: 260, background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          {/* Drawer header on mobile */}
          <div className="flex items-center justify-between p-3 border-b md:hidden" style={{ borderColor: 'var(--border)' }}>
            <span className="font-bold text-[13px]">Payloads</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 rounded flex items-center justify-center text-sm"
              style={{ color: 'var(--muted)' }}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* OS selector */}
          <div className="p-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              Target OS / Device
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {OS_OPTIONS.map(os => (
                <button
                  key={os.id}
                  onClick={() => { setSelectedOS(os.id); setActivePayloadId(null); setSidebarOpen(false) }}
                  className="rounded-lg py-2.5 px-1.5 flex flex-col items-center transition-all text-center"
                  style={{
                    background: selectedOS === os.id ? 'rgba(79,156,249,0.1)' : 'var(--bg3)',
                    border: `1px solid ${selectedOS === os.id ? 'var(--accent)' : 'var(--border)'}`,
                    color: selectedOS === os.id ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  <span className="text-lg leading-none mb-1">{os.icon}</span>
                  <span className="text-[11px] font-medium">{os.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payload list */}
          <div className="p-3 pt-2 flex-1 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              Predefined Payloads
            </p>
            <div className="space-y-0.5">
              {filteredPayloads.map(p => (
                <button
                  key={p.id}
                  onClick={() => { loadPayload(p); setSidebarOpen(false) }}
                  className="w-full flex items-start gap-2 p-2 rounded-lg text-left transition-all"
                  style={{
                    background: activePayloadId === p.id ? 'rgba(79,156,249,0.1)' : 'transparent',
                    border: `1px solid ${activePayloadId === p.id ? 'rgba(79,156,249,0.3)' : 'transparent'}`,
                  }}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs shrink-0 mt-0.5"
                       style={{ background: 'rgba(79,156,249,0.08)' }}>
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[12px] font-medium truncate">{p.name}</span>
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${TAG_COLORS[p.tag]}`}>
                        {TAG_LABELS[p.tag]}
                      </span>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{p.desc}</p>
                  </div>
                </button>
              ))}

              {filteredPayloads.length === 0 && (
                <p className="text-[12px] py-4 text-center" style={{ color: 'var(--muted)' }}>
                  No payloads for {selectedOS}
                </p>
              )}
            </div>
          </div>

          {/* New custom payload */}
          <div className="p-3 pt-0 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              Custom
            </p>
            <button
              onClick={() => { newPayload(); setSidebarOpen(false) }}
              className="w-full flex items-center gap-2 p-2.5 rounded-lg transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
                   style={{ background: 'rgba(60,202,122,0.1)', color: 'var(--success)' }}>
                +
              </div>
              <div>
                <div className="text-[12px] font-medium">New blank payload</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Start from scratch</div>
              </div>
            </button>
          </div>
        </aside>

        {/* ── Overlay for mobile sidebar ───────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── CENTER: Editor ───────────────────────────────── */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div
            className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-4 py-2 shrink-0 border-b overflow-x-auto"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <div className="flex-1 min-w-0 hidden sm:block">
              <div className="font-semibold text-[13px] truncate">{payloadName}</div>
              {payloadDesc && (
                <div className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{payloadDesc}</div>
              )}
            </div>
            <button
              onClick={validateScript}
              className="whitespace-nowrap flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] sm:text-[12px] font-medium transition-all"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }}
            >
              ✓ <span className="hidden xs:inline">Validate</span>
            </button>
            <button
              onClick={deployPayload}
              disabled={deployStatus === 'sending' || deployStatus === 'sent'}
              className="whitespace-nowrap flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] sm:text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(60,202,122,0.12)', border: '1px solid rgba(60,202,122,0.3)', color: 'var(--success)' }}
            >
              {deployStatus === 'sending' ? '⏳ Sending…'
                : deployStatus === 'sent' ? '⏳ Waiting…'
                : '▶ Deploy'}
            </button>
            <button
              onClick={() => { setScript(''); setDeployStatus('idle') }}
              className="whitespace-nowrap flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] sm:text-[12px] font-medium transition-all"
              style={{ background: 'rgba(240,80,96,0.08)', border: '1px solid rgba(240,80,96,0.25)', color: 'var(--danger)' }}
            >
              ✕ <span className="hidden xs:inline">Clear</span>
            </button>
          </div>

          {/* Code editor */}
          <div className="flex flex-1 overflow-hidden relative" style={{ background: 'var(--bg)' }}>
            {/* Line numbers — hidden on small screens */}
            <div
              ref={lineNumRef}
              className="hidden sm:block shrink-0 overflow-hidden select-none text-right font-mono text-[12.5px] leading-relaxed pt-4 pb-4 pr-2 pl-4 border-r whitespace-pre"
              style={{
                minWidth: 44,
                color: 'var(--muted)',
                background: 'var(--bg2)',
                borderColor: 'var(--border)',
                lineHeight: '1.625rem',
              }}
            >
              1
            </div>
            {/* Textarea */}
            <textarea
              ref={editorRef}
              value={script}
              onChange={e => setScript(e.target.value)}
              onScroll={handleEditorScroll}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              className="flex-1 resize-none outline-none font-mono text-[13px] sm:text-[12.5px] leading-relaxed px-3 sm:px-4 pt-4 pb-4 whitespace-pre overflow-auto"
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                lineHeight: '1.625rem',
                tabSize: 2,
                fontSize: 'clamp(12px, 3.5vw, 13px)',
              }}
              placeholder={'REM DuckPad Script\nREM Select a payload or write your own\n\nDELAY 500\nTYPE hello world'}
            />
            {/* Size badge */}
            <div
              className="absolute bottom-3 right-3 text-[11px] font-mono px-2 py-0.5 rounded pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--muted)' }}
            >
              {lineCount} lines
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL (desktop) ────────────────────────── */}
        <aside
          className="hidden md:flex flex-col shrink-0 overflow-hidden border-l"
          style={{ width: 290, background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          {/* Tabs */}
          <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            {(['connect', 'snippets', 'reference'] as PanelTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-[12px] font-medium capitalize transition-all border-b-2"
                style={{
                  borderBottomColor: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {tab === 'connect' ? 'Deploy' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── DEPLOY TAB ─────────────────────────────────── */}
          {activeTab === 'connect' && (
            <div className="flex flex-col flex-1 overflow-y-auto p-3 gap-3">

              {/* Device ID card */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                  Device ID
                </p>
                <div className="flex gap-1.5 mb-2">
                  <input
                    value={customDeviceId}
                    onChange={e => setCustomDeviceId(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && applyDeviceId()}
                    placeholder="e.g. A3F2B1C0"
                    className="flex-1 text-[12px] font-mono rounded-md px-2.5 py-1.5 outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                    maxLength={16}
                  />
                  <button
                    onClick={applyDeviceId}
                    className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: 'var(--accent-dim)', color: '#fff' }}
                  >
                    Set
                  </button>
                  <button
                    onClick={regenerateId}
                    title="Generate new ID"
                    className="px-2 py-1.5 rounded-md text-[13px]"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border2)' }}
                  >
                    ↺
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Program this ID into your ESP32 firmware. The ESP polls <code className="font-mono" style={{ color: 'var(--accent)' }}>/api/payload?deviceId=ID</code>
                </p>
              </div>

              {/* How-to card */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                  ESP32 Setup
                </p>
                <ol className="text-[11px] space-y-1.5 list-decimal list-inside" style={{ color: 'var(--muted)' }}>
                  <li>Flash <code className="font-mono" style={{ color: 'var(--text)' }}>esp32s2_duckpad.ino</code></li>
                  <li>Set <code className="font-mono" style={{ color: 'var(--text)' }}>DEVICE_ID</code> = <code className="font-mono" style={{ color: 'var(--warn)' }}>{deviceId || 'XXXXXXXX'}</code></li>
                  <li>Set <code className="font-mono" style={{ color: 'var(--text)' }}>SERVER_URL</code> = your Vercel URL</li>
                  <li>ESP polls every 2s via WiFi</li>
                  <li>Plug ESP into target via USB</li>
                  <li>Click <span style={{ color: 'var(--success)' }}>▶ Deploy</span> from any device</li>
                </ol>
              </div>

              {/* Status */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Status
                  </p>
                  <span className={`text-[11px] font-semibold ${statusColor[deployStatus]}`}>
                    {statusLabel[deployStatus]}
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: deployStatus === 'idle' ? '0%'
                        : deployStatus === 'sending' ? '25%'
                        : deployStatus === 'sent' ? '60%'
                        : deployStatus === 'fetched' ? '100%'
                        : '100%',
                      background: deployStatus === 'error' ? 'var(--danger)'
                        : deployStatus === 'fetched' ? 'var(--success)'
                        : 'var(--accent)',
                    }}
                  />
                </div>
              </div>

              {/* Console log */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Console
                  </p>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--muted)', background: 'var(--bg4)' }}
                  >
                    clear
                  </button>
                </div>
                <div
                  className="flex-1 overflow-y-auto rounded-lg p-2.5 font-mono text-[11px] leading-relaxed min-h-[120px] max-h-[240px]"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  {logs.length === 0 && (
                    <span style={{ color: 'var(--muted)' }}>No logs yet…</span>
                  )}
                  {logs.map(l => (
                    <div key={l.id} className="flex gap-1.5">
                      <span style={{ color: 'var(--muted)' }}>{l.time}</span>
                      <span style={{
                        color: l.type === 'ok' ? 'var(--success)'
                          : l.type === 'err' ? 'var(--danger)'
                          : l.type === 'done' ? 'var(--warn)'
                          : l.type === 'tx' ? 'var(--muted)'
                          : l.type === 'warn' ? 'var(--warn)'
                          : 'var(--accent)',
                      }}>
                        {l.msg}
                      </span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* ── SNIPPETS TAB ───────────────────────────────── */}
          {activeTab === 'snippets' && (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                Quick Insert
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {SNIPPETS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => insertSnippet(s.code)}
                    className="text-left px-2.5 py-2 rounded-md font-mono text-[11px] truncate transition-all"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── REFERENCE TAB ──────────────────────────────── */}
          {activeTab === 'reference' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-[11px] font-mono">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                  Commands
                </p>
                {[
                  ['DELAY', '<ms>'],
                  ['TYPE', '<text>'],
                  ['STRING_LN', '<text>  →  text + ENTER'],
                  ['KEY', '<keyname>'],
                  ['COMBO', '<MOD+key>'],
                  ['MOUSE_MOVE', '<x> <y>'],
                  ['MOUSE_CLICK', 'LEFT | RIGHT | MIDDLE'],
                  ['MOUSE_DCLICK', 'LEFT | RIGHT'],
                  ['MOUSE_SCROLL', '<amount>'],
                  ['WAIT_FOR_BOOT', '(3000ms delay)'],
                  ['REM', '<comment>'],
                ].map(([cmd, arg]) => (
                  <div key={cmd} className="flex gap-2 mb-1">
                    <span style={{ color: 'var(--accent)', minWidth: 110 }}>{cmd}</span>
                    <span style={{ color: 'var(--muted)' }}>{arg}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                  Key Names
                </p>
                <div className="leading-relaxed" style={{ color: 'var(--muted)' }}>
                  ENTER, ESC, TAB, SPACE, DELETE<br />
                  HOME, END, PAGEUP, PAGEDOWN<br />
                  UP, DOWN, LEFT, RIGHT<br />
                  F1–F12, BACKSPACE, INSERT<br />
                  CTRL, SHIFT, ALT, GUI / WIN / CMD<br />
                  CAPS, PAUSE, PRINTSCREEN
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                  COMBO Examples
                </p>
                {[
                  'COMBO GUI+R',
                  'COMBO CTRL+ALT+T',
                  'COMBO CTRL+SHIFT+ESC',
                  'COMBO ALT+F4',
                  'COMBO GUI+L',
                  'COMBO CTRL+C',
                  'COMBO CTRL+SHIFT+ENTER',
                ].map(ex => (
                  <div key={ex} style={{ color: 'var(--warn)' }} className="mb-0.5">{ex}</div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── MOBILE BOTTOM BAR & PANEL ────────────────────── */}
        <div className="md:hidden flex flex-col absolute bottom-0 left-0 right-0 z-10">
          {/* Panel content (slides up when a tab is active) */}
          {mobilePanelOpen && (
            <div
              className="border-t overflow-y-auto"
              style={{
                maxHeight: '50vh',
                background: 'var(--bg2)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-3 py-2 border-b sticky top-0 z-10"
                   style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                <span className="text-[12px] font-semibold capitalize">
                  {activeTab === 'connect' ? 'Deploy' : activeTab}
                </span>
                <button
                  onClick={() => setMobilePanelOpen(false)}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  ▼
                </button>
              </div>

              {/* Panel body */}
              <div className="p-3 space-y-3">
                {activeTab === 'connect' && (
                  <>
                    {/* Device ID */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                        Device ID
                      </p>
                      <div className="flex gap-1.5 mb-2">
                        <input
                          value={customDeviceId}
                          onChange={e => setCustomDeviceId(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && applyDeviceId()}
                          placeholder="e.g. A3F2B1C0"
                          className="flex-1 text-[14px] font-mono rounded-md px-2.5 py-2 outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                          maxLength={16}
                        />
                        <button
                          onClick={applyDeviceId}
                          className="px-3 py-2 rounded-md text-[12px] font-semibold"
                          style={{ background: 'var(--accent-dim)', color: '#fff' }}
                        >
                          Set
                        </button>
                        <button
                          onClick={regenerateId}
                          title="Generate new ID"
                          className="px-2.5 py-2 rounded-md text-[15px]"
                          style={{ background: 'var(--bg4)', border: '1px solid var(--border2)' }}
                        >
                          ↺
                        </button>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        Program this ID into your ESP32 firmware
                      </p>
                    </div>

                    {/* ESP32 Setup */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                        ESP32 Setup
                      </p>
                      <ol className="text-[11px] space-y-1.5 list-decimal list-inside" style={{ color: 'var(--muted)' }}>
                        <li>Flash <code className="font-mono" style={{ color: 'var(--text)' }}>esp32s2_duckpad.ino</code></li>
                        <li>Set <code className="font-mono" style={{ color: 'var(--text)' }}>DEVICE_ID</code> = <code className="font-mono" style={{ color: 'var(--warn)' }}>{deviceId || 'XXXXXXXX'}</code></li>
                        <li>Set <code className="font-mono" style={{ color: 'var(--text)' }}>SERVER_URL</code> = your Vercel URL</li>
                        <li>ESP polls every 2s via WiFi</li>
                        <li>Plug ESP into target via USB</li>
                        <li>Tap <span style={{ color: 'var(--success)' }}>▶ Deploy</span></li>
                      </ol>
                    </div>

                    {/* Status */}
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                          Status
                        </p>
                        <span className={`text-[11px] font-semibold ${statusColor[deployStatus]}`}>
                          {statusLabel[deployStatus]}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: deployStatus === 'idle' ? '0%'
                              : deployStatus === 'sending' ? '25%'
                              : deployStatus === 'sent' ? '60%'
                              : deployStatus === 'fetched' ? '100%'
                              : '100%',
                            background: deployStatus === 'error' ? 'var(--danger)'
                              : deployStatus === 'fetched' ? 'var(--success)'
                              : 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Console */}
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                          Console
                        </p>
                        <button
                          onClick={() => setLogs([])}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: 'var(--muted)', background: 'var(--bg4)' }}
                        >
                          clear
                        </button>
                      </div>
                      <div
                        className="overflow-y-auto rounded-lg p-2.5 font-mono text-[11px] leading-relaxed min-h-[100px] max-h-[180px]"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                      >
                        {logs.length === 0 && (
                          <span style={{ color: 'var(--muted)' }}>No logs yet…</span>
                        )}
                        {logs.map(l => (
                          <div key={l.id} className="flex gap-1.5">
                            <span style={{ color: 'var(--muted)' }}>{l.time}</span>
                            <span style={{
                              color: l.type === 'ok' ? 'var(--success)'
                                : l.type === 'err' ? 'var(--danger)'
                                : l.type === 'done' ? 'var(--warn)'
                                : l.type === 'tx' ? 'var(--muted)'
                                : l.type === 'warn' ? 'var(--warn)'
                                : 'var(--accent)',
                            }}>
                              {l.msg}
                            </span>
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'snippets' && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                      Quick Insert
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SNIPPETS.map(s => (
                        <button
                          key={s.label}
                          onClick={() => insertSnippet(s.code)}
                          className="text-left px-3 py-2.5 rounded-md font-mono text-[12px] truncate transition-all"
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        >
                          <span style={{ color: 'var(--accent)' }}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'reference' && (
                  <div className="space-y-4 text-[11px] font-mono">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                        Commands
                      </p>
                      {[
                        ['DELAY', '<ms>'],
                        ['TYPE', '<text>'],
                        ['STRING_LN', '<text>  →  text + ENTER'],
                        ['KEY', '<keyname>'],
                        ['COMBO', '<MOD+key>'],
                        ['MOUSE_MOVE', '<x> <y>'],
                        ['MOUSE_CLICK', 'LEFT | RIGHT | MIDDLE'],
                        ['MOUSE_DCLICK', 'LEFT | RIGHT'],
                        ['MOUSE_SCROLL', '<amount>'],
                        ['WAIT_FOR_BOOT', '(3000ms delay)'],
                        ['REM', '<comment>'],
                      ].map(([cmd, arg]) => (
                        <div key={cmd} className="flex gap-2 mb-1">
                          <span style={{ color: 'var(--accent)', minWidth: 100 }}>{cmd}</span>
                          <span style={{ color: 'var(--muted)' }}>{arg}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                        Key Names
                      </p>
                      <div className="leading-relaxed" style={{ color: 'var(--muted)' }}>
                        ENTER, ESC, TAB, SPACE, DELETE<br />
                        HOME, END, PAGEUP, PAGEDOWN<br />
                        UP, DOWN, LEFT, RIGHT<br />
                        F1–F12, BACKSPACE, INSERT<br />
                        CTRL, SHIFT, ALT, GUI / WIN / CMD<br />
                        CAPS, PAUSE, PRINTSCREEN
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                        COMBO Examples
                      </p>
                      {[
                        'COMBO GUI+R',
                        'COMBO CTRL+ALT+T',
                        'COMBO CTRL+SHIFT+ESC',
                        'COMBO ALT+F4',
                        'COMBO GUI+L',
                        'COMBO CTRL+C',
                        'COMBO CTRL+SHIFT+ENTER',
                      ].map(ex => (
                        <div key={ex} style={{ color: 'var(--warn)' }} className="mb-0.5">{ex}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom tab bar */}
          <div
            className="flex border-t shrink-0"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            {([
              { id: 'connect' as PanelTab, label: 'Deploy', icon: '📡' },
              { id: 'snippets' as PanelTab, label: 'Snippets', icon: '📋' },
              { id: 'reference' as PanelTab, label: 'Ref', icon: '📖' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (activeTab === tab.id && mobilePanelOpen) {
                    setMobilePanelOpen(false)
                  } else {
                    setActiveTab(tab.id)
                    setMobilePanelOpen(true)
                  }
                }}
                className="flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-all"
                style={{
                  color: activeTab === tab.id && mobilePanelOpen ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
