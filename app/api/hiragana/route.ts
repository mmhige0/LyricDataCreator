import { NextResponse } from 'next/server'

const YAHOO_FURIGANA_ENDPOINT = 'https://jlp.yahooapis.jp/FuriganaService/V2/furigana'

type YahooWord = {
  surface?: string
  furigana?: string
  subword?: YahooWord[]
}

const containsKanji = (text: string): boolean => /[\u4e00-\u9faf]/.test(text)

const buildHiraganaFromWords = (words: YahooWord[]): string => {
  return words.map((word) => {
    if (Array.isArray(word.subword) && word.subword.length > 0) {
      return buildHiraganaFromWords(word.subword)
    }
    return word.furigana ?? word.surface ?? ''
  }).join('')
}

const fetchHiragana = async (text: string, appId: string): Promise<string> => {
  const url = new URL(YAHOO_FURIGANA_ENDPOINT)
  url.searchParams.set('appid', appId)

  const payload = {
    id: 'lyric-data-creator',
    jsonrpc: '2.0',
    method: 'jlp.furiganaservice.furigana',
    params: {
      q: text,
      grade: 1,
    },
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = `Yahoo API request failed: ${response.status}`
    throw new Error(message)
  }

  const data = await response.json()
  if (data?.error?.message) {
    throw new Error(data.error.message)
  }

  const words = data?.result?.word
  if (!Array.isArray(words)) {
    return text
  }

  return buildHiraganaFromWords(words)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawLines = Array.isArray(body?.lines) ? (body.lines as unknown[]) : null
    if (!rawLines) {
      return NextResponse.json({ error: 'lines must be an array' }, { status: 400 })
    }

    const lines: string[] = rawLines.map((line) => typeof line === 'string' ? line : '')
    const shouldConvert = lines.some((line) => line.trim() !== '' && containsKanji(line))
    if (!shouldConvert) {
      return NextResponse.json({ lines })
    }

    const appId = process.env.YAHOO_APP_ID
    if (!appId) {
      return NextResponse.json({ error: 'YAHOO_APP_ID is not configured' }, { status: 500 })
    }

    const converted = await Promise.all(
      lines.map(async (line: string) => {
        if (line.trim() === '' || !containsKanji(line)) return line
        return fetchHiragana(line, appId)
      })
    )

    return NextResponse.json({ lines: converted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ひらがな変換中にエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
