export type KpmTestCase = {
  name: string
  scoreEntries: {
    id: string
    timestamp: number
    lyrics: [string, string, string, string]
  }[]
  totalDuration: number
  expect: {
    line: number
    kanaCharCount: number
    kanaKpm: number
    romaCharCount: number
    romaKpm: number
  }
}

export const kpmTestCases: KpmTestCase[] = [
  {
    name: 'らっ　たっ　た',
    scoreEntries: [
      { id: 'case-1', timestamp: 0, lyrics: ['らっ　たっ　た', '', '', ''] },
    ],
    totalDuration: 60,
    expect: {
      line: 1,
      kanaCharCount: 5,
      kanaKpm: 5,
      romaCharCount: 12,
      romaKpm: 12,
    },
  },
  {
    name: 'ん　ん',
    scoreEntries: [
      { id: 'case-2', timestamp: 0, lyrics: ['ん　ん', '', '', ''] },
    ],
    totalDuration: 60,
    expect: {
      line: 1,
      kanaCharCount: 2,
      kanaKpm: 2,
      romaCharCount: 4,
      romaKpm: 4,
    },
  },
  {
    name: 'ヴ',
    scoreEntries: [
      { id: 'case-3', timestamp: 0, lyrics: ['ヴ', '', '', ''] },
    ],
    totalDuration: 60,
    expect: {
      line: 1,
      kanaCharCount: 2,
      kanaKpm: 2,
      romaCharCount: 2,
      romaKpm: 2,
    },
  },
  {
    name: 'らっ　たっ　た　ん　ん　ヴ',
    scoreEntries: [
      { id: 'case-4', timestamp: 0, lyrics: ['', 'らっ　たっ　た', 'ん　ん', 'ヴ'] },
    ],
    totalDuration: 60,
    expect: {
      line: 2,
      kanaCharCount: 5,
      kanaKpm: 5,
      romaCharCount: 12,
      romaKpm: 12,
    },
  },
]
