import { NextRequest, NextResponse } from 'next/server'
import { queuePayload, fetchPayload, getStatus } from '@/lib/store'

// GET /api/payload?deviceId=XXXX
// Called by ESP32 every ~2 seconds to check for a pending payload.
// Returns { script: "..." } if a payload is waiting, or { script: null }.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId')
  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }

  const item = fetchPayload(deviceId)
  if (!item) {
    return new NextResponse(JSON.stringify({
      script: null,
      status: 'idle'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
    })
  }

  return new NextResponse(JSON.stringify({
    script: item.script,
    status: 'ok',
    pushedAt: item.pushedAt,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'close',   // ⭐ IMPORTANT
    },
  })
}

// POST /api/payload
// Called by the web UI to push a payload to a specific device.
// Body: { deviceId: string, script: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { deviceId?: string; script?: string }
    const { deviceId, script } = body

    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
    }
    if (!script || typeof script !== 'string') {
      return NextResponse.json({ error: 'Missing script' }, { status: 400 })
    }
    if (script.length > 50_000) {
      return NextResponse.json({ error: 'Script too large' }, { status: 413 })
    }

    queuePayload(deviceId, script.trim())
    return NextResponse.json({ ok: true, deviceId, queued: true })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

// GET /api/payload/status?deviceId=XXXX
// Web UI polls this to know if ESP has fetched the payload yet.
export async function HEAD(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId')
  if (!deviceId) return new NextResponse(null, { status: 400 })
  const item = getStatus(deviceId)
  const headers = new Headers()
  headers.set('x-status', item?.status ?? 'idle')
  headers.set('x-pushed-at', String(item?.pushedAt ?? 0))
  return new NextResponse(null, { status: 200, headers })
}
