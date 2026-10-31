import { SubmissionError } from './validation'

export async function verifyTurnstile(token: unknown, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  const hostname = process.env.TURNSTILE_HOSTNAME
  if (!secret || !hostname) throw new SubmissionError(503, '投稿受付のBot対策が未設定です。')
  if (typeof token !== 'string' || !token || token.length > 2048) throw new SubmissionError(400, 'Bot確認を完了してください。')
  let result
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Unavailable')
    result = await response.json()
  } catch { throw new SubmissionError(503, 'Bot確認に接続できません。再試行してください。') }
  // Official dummy tokens do not carry a real widget's hostname/action.
  // Keep the exception limited to development and the exact official success pair.
  const localTest = process.env.NODE_ENV === 'development'
    && secret === '1x0000000000000000000000000000000AA' && token === 'XXXX.DUMMY.TOKEN.XXXX'
  if (result.success !== true || (!localTest && (result.hostname !== hostname || result.action !== 'chart-submit'))) throw new SubmissionError(400, 'Bot確認が無効です。再度確認してください。')
}
