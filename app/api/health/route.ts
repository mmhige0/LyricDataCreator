import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// Simple DB liveness check used by Vercel Cron to keep the pool warm.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('health check failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
