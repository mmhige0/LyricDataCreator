import type { ChartSubmission } from '@prisma/client'
import { SITE_ORIGIN } from '@/lib/site'

export type DiscordNotification = 'sent' | 'skipped' | 'failed' | 'unchanged'

// Notification failure must never roll back an accepted submission.
export async function notifySubmission(row: ChartSubmission, event: 'new' | 'updated' | 'resend'): Promise<DiscordNotification> {
  const configured = process.env.DISCORD_SUBMISSION_WEBHOOK_URL
  if (!configured) return 'skipped'
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || url.port || url.username || url.password
      || !/^\/api(?:\/v10)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)) return 'failed'
    url.searchParams.set('wait', 'true')
    const filename = `chart-${row.id}-v${row.revision}.txt`
    const form = new FormData()
    form.set('payload_json', JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: event === 'new' ? '譜面の新規申請' : event === 'updated' ? '譜面の再申請' : '譜面申請の再通知',
        url: `${SITE_ORIGIN}/admin/submissions/?submission=${row.id}`,
        description: row.notes || '補足情報はありません。',
        fields: [
          { name: '曲名', value: row.title },
          { name: 'アーティスト', value: row.artist || '未指定' },
          { name: '制作者', value: row.creatorName },
          { name: '曲番号', value: row.gameSongId || '新曲・承認時に指定' },
          { name: 'YouTube', value: row.youtubeUrl },
        ],
        footer: { text: `申請 ${row.id} / 第${row.revision}版 / ${row.status}` },
      }],
      attachments: [{ id: 0, filename }],
    }))
    form.set('files[0]', new Blob([row.txtContent], { type: 'text/plain;charset=utf-8' }), filename)
    const response = await fetch(url, { method: 'POST', body: form, redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return 'failed'
    // wait=true confirms the message was actually saved by Discord.
    const result = await response.json()
    return typeof result.id === 'string' && result.id ? 'sent' : 'failed'
  } catch { return 'failed' }
}
