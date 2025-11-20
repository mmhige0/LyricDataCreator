// YTypingのタイピング変換ロジック（移植版）

import { ROMA_MAP, SYMBOL_TO_ROMA_MAP, ALPHABET_LIST, NUM_LIST, convertZenkakuToHankaku, NN_LIST, SOKUON_JOIN_LIST } from './typingRomaMap'

export type InputMode = 'roma' | 'kana'

export interface TypeChunk {
  k: string
  r: string[]
  t: 'kana' | 'alphabet' | 'num' | 'symbol' | 'space' | undefined
}

export interface NextTypeChunk extends TypeChunk {
  orginalDakuChar?: string
}

export interface LineWord {
  correct: { k: string; r: string }
  nextChar: NextTypeChunk
  word: TypeChunk[]
}

/**
 * かな文字列をTypeChunk配列に変換
 */
export const generateTypingWord = (tokenizedKanaWord: string[]): TypeChunk[] => {
  const hasWord = tokenizedKanaWord.length

  if (hasWord) {
    return generateTypeChunks(tokenizedKanaWord)
  } else {
    return [{ k: '', r: [''], t: undefined }]
  }
}

const generateTypeChunks = (tokenizedKanaWord: string[]): TypeChunk[] => {
  let typeChunks: TypeChunk[] = []

  for (let i = 0; i < tokenizedKanaWord.length; i++) {
    const kanaChar = tokenizedKanaWord[i]
    const romaPatterns = [
      ...(ROMA_MAP.get(kanaChar) || SYMBOL_TO_ROMA_MAP.get(kanaChar) || [convertZenkakuToHankaku(kanaChar)]),
    ]

    typeChunks.push({
      k: kanaChar,
      r: romaPatterns,
      t: determineCharacterType({ kanaChar: kanaChar, romaChar: romaPatterns[0] }),
    })

    // 打鍵パターンを正規化 (促音結合 / n → nn)
    if (typeChunks.length >= 2) {
      const prevKanaChar = typeChunks[typeChunks.length - 2]?.k

      if (prevKanaChar?.[prevKanaChar.length - 1] === 'っ') {
        const currentKanaChar = typeChunks[typeChunks.length - 1].k[0]

        if (SOKUON_JOIN_LIST.includes(currentKanaChar)) {
          typeChunks = joinSokuonPattern({ typeChunks: typeChunks, joinType: 'normal' })
        } else if (['い', 'う', 'ん'].includes(currentKanaChar)) {
          typeChunks = joinSokuonPattern({ typeChunks: typeChunks, joinType: 'iun' })
        }
      }
    }

    const prevKanaChar = typeChunks[typeChunks.length - 2]?.k ?? ''
    const currentKanaChar = typeChunks[typeChunks.length - 1].k

    if (prevKanaChar[prevKanaChar.length - 1] === 'ん') {
      if (NN_LIST.includes(currentKanaChar[0])) {
        typeChunks = replaceNWithNN(typeChunks)
      } else {
        typeChunks = applyDoubleNTypePattern(typeChunks)
      }
    }

    // 空白前の「ん」も行末と同じ処理（nn または n'）
    if (currentKanaChar === 'ん' && i + 1 < tokenizedKanaWord.length) {
      const nextKanaChar = tokenizedKanaWord[i + 1]
      if (nextKanaChar === ' ' || nextKanaChar === '　') {
        typeChunks[typeChunks.length - 1].r[0] = 'nn'
        typeChunks[typeChunks.length - 1].r.push("n'")
      }
    }
  }

  // 最後の文字が「ん」だった場合も[nn]に置き換え
  if (typeChunks[typeChunks.length - 1]?.k === 'ん') {
    typeChunks[typeChunks.length - 1].r[0] = 'nn'
    typeChunks[typeChunks.length - 1].r.push("n'")
  }

  return typeChunks
}

const applyDoubleNTypePattern = (typeChunks: TypeChunk[]): TypeChunk[] => {
  const currentKanaChar = typeChunks[typeChunks.length - 1].k

  if (currentKanaChar) {
    const currentRomaPatterns = typeChunks[typeChunks.length - 1].r
    const currentRomaPatternsLength = currentRomaPatterns.length

    for (let i = 0; i < currentRomaPatternsLength; i++) {
      typeChunks[typeChunks.length - 1].r.push('n' + currentRomaPatterns[i])
      typeChunks[typeChunks.length - 1].r.push("'" + currentRomaPatterns[i])
    }
  }

  return typeChunks
}

const replaceNWithNN = (typeChunks: TypeChunk[]): TypeChunk[] => {
  const prevRomaPatterns = typeChunks[typeChunks.length - 2].r
  const prevRomaPatternsLength = typeChunks[typeChunks.length - 2].r.length

  for (let i = 0; i < prevRomaPatternsLength; i++) {
    const romaPattern = prevRomaPatterns[i]
    const isNnPattern =
      (romaPattern.length >= 2 &&
        romaPattern[romaPattern.length - 2] !== 'x' &&
        romaPattern[romaPattern.length - 1] === 'n') ||
      romaPattern === 'n'

    if (isNnPattern) {
      typeChunks[typeChunks.length - 2].r[i] = prevRomaPatterns[i] + 'n'
      typeChunks[typeChunks.length - 2].r.push("n'")
    }
  }

  return typeChunks
}

const joinSokuonPattern = ({
  joinType,
  typeChunks,
}: {
  joinType: 'normal' | 'iun'
  typeChunks: TypeChunk[]
}): TypeChunk[] => {
  const continuous: string[] = []
  const xtu: string[] = []
  const ltu: string[] = []
  const xtsu: string[] = []
  const ltsu: string[] = []

  const prevKanaChar = typeChunks[typeChunks.length - 2].k
  const currentKanaChar = typeChunks[typeChunks.length - 1].k

  typeChunks[typeChunks.length - 1].k = prevKanaChar + currentKanaChar
  typeChunks.splice(-2, 1)

  const sokuonLength = (prevKanaChar.match(/っ/g) || []).length
  const romaPatterns = typeChunks[typeChunks.length - 1].r
  const romaPatternsLength = romaPatterns.length

  for (let i = 0; i < romaPatternsLength; i++) {
    if (joinType === 'normal' || !['i', 'u', 'n'].includes(romaPatterns[i][0])) {
      continuous.push(romaPatterns[i][0].repeat(sokuonLength) + romaPatterns[i])
    }

    xtu.push('x'.repeat(sokuonLength) + 'tu' + romaPatterns[i])
    ltu.push('l'.repeat(sokuonLength) + 'tu' + romaPatterns[i])
    xtsu.push('x'.repeat(sokuonLength) + 'tsu' + romaPatterns[i])
    ltsu.push('l'.repeat(sokuonLength) + 'tsu' + romaPatterns[i])
  }

  typeChunks[typeChunks.length - 1].r = [...continuous, ...xtu, ...ltu, ...xtsu, ...ltsu]

  return typeChunks
}

const determineCharacterType = ({
  kanaChar,
  romaChar,
}: {
  kanaChar: string
  romaChar: string
}): TypeChunk['t'] => {
  if (ROMA_MAP.has(kanaChar)) {
    return 'kana'
  } else if (ALPHABET_LIST.includes(romaChar)) {
    return 'alphabet'
  } else if (NUM_LIST.includes(romaChar)) {
    return 'num'
  } else if (romaChar === ' ') {
    return 'space'
  } else {
    return 'symbol'
  }
}

/**
 * かな文字列をトークン化（ROMA_MAPに基づく）
 */
export const tokenizeKanaBySentenceRomaPatterns = (kanaSentence: string): string[][] => {
  const pattern = Array.from(ROMA_MAP.keys()).concat(Array.from(SYMBOL_TO_ROMA_MAP.keys())).join('|')
  const regex = new RegExp(`(${pattern})`, 'g')
  const processed = kanaSentence.replace(regex, '\t$1\t')

  return processed.split('\n').map((line) => {
    const splitLine = line.split('\t').filter((word) => word !== '')

    const result: string[] = []

    for (const word of splitLine) {
      if (ROMA_MAP.has(word) || SYMBOL_TO_ROMA_MAP.has(word)) {
        result.push(word)
      } else {
        for (let i = 0; i < word.length; i++) {
          result.push(word[i])
        }
      }
    }

    return result
  })
}

/**
 * LineWordを初期化
 */
export const initializeLineWord = (lyrics: string): LineWord => {
  const tokenized = tokenizeKanaBySentenceRomaPatterns(lyrics)
  const typeChunks = generateTypingWord(tokenized[0] || [])

  return {
    correct: { k: '', r: '' },
    nextChar: typeChunks[0] || { k: '', r: [''], t: undefined },
    word: typeChunks.slice(1),
  }
}

/**
 * 現在の入力位置が単語の区切りかどうかを判定
 * 単語の区切り: スペース文字、または行の最後
 */
export const isWordBoundary = (lineWord: LineWord): boolean => {
  // 行の最後（次の文字がない、かつ残りの文字もない）
  if (!lineWord.nextChar.k && lineWord.word.length === 0) {
    return true
  }

  // スペース文字を入力完了した直後
  if (lineWord.nextChar.t === 'space') {
    return false // スペースの前はまだ単語の途中
  }

  // 1つ前がスペースだった場合（correct の最後の文字がスペース）
  const lastCorrectChar = lineWord.correct.k[lineWord.correct.k.length - 1]
  if (lastCorrectChar === ' ' || lastCorrectChar === '　') {
    return true
  }

  return false
}

/**
 * 単語の入力が完了したかどうかを判定
 * 次の文字がスペースまたは行末の場合、現在の単語は完了
 */
export const isWordCompleted = (lineWord: LineWord): boolean => {
  // 次の文字がスペース
  if (lineWord.nextChar.t === 'space') {
    return true
  }

  // 行の最後（次の文字がない、かつ残りの文字もない）
  if (!lineWord.nextChar.k && lineWord.word.length === 0) {
    return true
  }

  return false
}
