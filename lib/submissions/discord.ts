import type { ChartSubmission } from '@prisma/client'

export type DiscordNotification = 'sent' | 'skipped' | 'failed' | 'unchanged'

// Discord limits each field value to 1024 UTF-16 units. Keep long notes in order.
function noteFields(notes: string) {
  const parts: string[] = []
  for (const char of notes) {
    if (!parts.length || parts[parts.length - 1].length + char.length > 1024) parts.push('')
    parts[parts.length - 1] += char
  }
  return parts.map((value, i) => ({ name: i ? '補足情報 続き' : '補足情報', value }))
}

// Notification failure must never roll back an accepted submission.
export async function notifySubmission(row: ChartSubmission, event: 'new' | 'updated'): Promise<DiscordNotification> {
  const configured = process.env.DISCORD_SUBMISSION_WEBHOOK_URL
  if (!configured) return 'skipped'
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || url.port || url.username || url.password
      || !/^\/api(?:\/v10)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)) return 'failed'
    url.searchParams.set('wait', 'true')
    const filename = 'chart.txt'
    const form = new FormData()
    form.set('payload_json', JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: event === 'new' ? '歌詞データが投稿されました' : '歌詞データが更新されました',
        fields: [
          { name: '曲名', value: row.title },
          { name: 'アーティスト', value: row.artist || '未入力' },
          { name: 'YouTube URL', value: row.youtubeUrl },
          ...noteFields(row.notes),
          { name: '投稿者名', value: row.creatorName },
        ],
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
