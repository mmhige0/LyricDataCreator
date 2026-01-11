import { NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/youtubeUtils'

const DEFAULT_GEMINI_MODEL = 'gemma-3-27b-it'

const getGeminiEndpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>
  }
}

type GeminiResponse = {
  candidates?: GeminiCandidate[]
}

const MAX_TITLE_LENGTH = 50

const sanitizeTitle = (value: string) => {
  const withoutInvisibles = value.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  return withoutInvisibles.trim().slice(0, MAX_TITLE_LENGTH)
}

const getYouTubeTitle = async (youtubeUrl: string) => {
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) return ''

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
  const response = await fetch(oembedUrl, { method: 'GET' })
  if (!response.ok) return ''

  const data = (await response.json()) as { title?: string }
  return typeof data?.title === 'string' ? data.title : ''
}

const buildPrompt = (title: string) => `
You extract song metadata from a YouTube title.
Return JSON only with key "title".
If the title includes a featured artist, use the format "Song Title feat. Artist Name".
If you are unsure, return empty strings.

Title: ${title}
`

const parseGeminiJson = (raw: string): { title?: string } | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawYoutubeUrl = typeof body?.youtubeUrl === 'string' ? body.youtubeUrl : ''
    const rawTitle = typeof body?.title === 'string' ? body.title : ''
    const youtubeUrl = rawYoutubeUrl.trim()
    const fetchedTitle = youtubeUrl ? await getYouTubeTitle(youtubeUrl) : ''
    const titleSource = fetchedTitle || rawTitle
    const title = titleSource ? sanitizeTitle(titleSource) : ''
    if (!title) {
      return NextResponse.json({ error: 'title or youtubeUrl is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 })
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    const response = await fetch(`${getGeminiEndpoint(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(title) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const message = `Gemini API request failed: ${response.status}`
      return NextResponse.json(
        {
          error: message,
          errorDetails: errorText.slice(0, 2000),
        },
        { status: 502 },
      )
    }

    const data = (await response.json()) as GeminiResponse
    const rawText =
      data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    const parsed = parseGeminiJson(rawText)

    if (!parsed) {
      return NextResponse.json(
        {
          error: 'Failed to parse Gemini response',
          errorDetails: rawText.slice(0, 2000),
        },
        { status: 502 },
      )
    }

    const result = {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'メタデータ抽出でエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
