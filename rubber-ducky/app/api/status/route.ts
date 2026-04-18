import { NextRequest, NextResponse } from 'next/server'
import { getStatus } from '@/lib/store'

// GET /api/status?deviceId=XXXX
// Web UI polls this to track if ESP32 has fetched the payload.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId')
  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }
  const item = getStatus(deviceId)
  return NextResponse.json({
    deviceId,
    status: item?.status ?? 'idle',
    pushedAt: item?.pushedAt ?? null,
  })
}
