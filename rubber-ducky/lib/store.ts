// Simple in-memory store for Vercel serverless.
// Each ESP32 device is identified by its deviceId.
// The ESP polls GET /api/payload?deviceId=xxx
// The web UI pushes via POST /api/payload { deviceId, script }
// After ESP fetches, it's cleared (one-shot execution).

export interface QueuedPayload {
  script: string
  pushedAt: number
  status: 'pending' | 'fetched'
}

// Global map persists across requests within a single serverless instance.
// For multi-instance Vercel deployments, use KV/Redis — but for MVP this is fine.
declare global {
  // eslint-disable-next-line no-var
  var __duckpadQueue: Map<string, QueuedPayload> | undefined
}

function getQueue(): Map<string, QueuedPayload> {
  if (!global.__duckpadQueue) {
    global.__duckpadQueue = new Map()
  }
  return global.__duckpadQueue
}

export function queuePayload(deviceId: string, script: string): void {
  getQueue().set(deviceId, {
    script,
    pushedAt: Date.now(),
    status: 'pending',
  })
}

export function fetchPayload(deviceId: string): QueuedPayload | null {
  const queue = getQueue()
  const item = queue.get(deviceId)
  if (!item || item.status === 'fetched') return null
  item.status = 'fetched'
  // Clear after 30 seconds
  setTimeout(() => queue.delete(deviceId), 30_000)
  return item
}

export function getStatus(deviceId: string): QueuedPayload | null {
  return getQueue().get(deviceId) ?? null
}

export function listDevices(): string[] {
  return Array.from(getQueue().keys())
}
