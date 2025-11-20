// YTypingのタイピング判定ロジック（移植版）

import { useCallback } from 'react'
import type { LineWord, TypeChunk, NextTypeChunk, InputMode } from '@/lib/typingUtils'
import { generateTypingWord, tokenizeKanaBySentenceRomaPatterns } from '@/lib/typingUtils'

// かな入力用マップ
const KEY_TO_KANA = new Map([
  ['0', ['わ']],
  ['1', ['ぬ']],
  ['2', ['ふ']],
  ['3', ['あ']],
  ['4', ['う', 'ウ']],
  ['5', ['え']],
  ['6', ['お']],
  ['7', ['や']],
  ['8', ['ゆ']],
  ['9', ['よ']],
  ['!', ['ぬ']],
  ['-', ['ほ', '-']],
  ['q', ['た']],
  ['Q', ['た']],
  ['w', ['て']],
  ['W', ['て']],
  ['e', ['い']],
  ['E', ['い']],
  ['r', ['す']],
  ['R', ['す']],
  ['t', ['か']],
  ['T', ['か']],
  ['y', ['ん']],
  ['Y', ['ん']],
  ['u', ['な']],
  ['U', ['な']],
  ['i', ['に']],
  ['I', ['に']],
  ['o', ['ら']],
  ['O', ['ら']],
  ['p', ['せ']],
  ['P', ['せ']],
  ['a', ['ち']],
  ['A', ['ち']],
  ['s', ['と']],
  ['S', ['と']],
  ['d', ['し']],
  ['D', ['し']],
  ['f', ['は']],
  ['F', ['は']],
  ['g', ['き']],
  ['G', ['き']],
  ['h', ['く']],
  ['H', ['く']],
  ['j', ['ま']],
  ['J', ['ま']],
  ['k', ['の']],
  ['K', ['の']],
  ['l', ['り']],
  ['L', ['り']],
  ['z', ['つ']],
  ['Z', ['つ']],
  ['x', ['さ']],
  ['X', ['さ']],
  ['c', ['そ']],
  ['C', ['そ']],
  ['v', ['ひ']],
  ['V', ['ひ']],
  ['b', ['こ']],
  ['B', ['こ']],
  ['n', ['み']],
  ['N', ['み']],
  ['m', ['も']],
  ['M', ['も']],
  [',', ['ね', ',']],
  ['<', ['、']],
  ['.', ['る', '.']],
  ['>', ['。']],
  ['/', ['め', '/']],
  ['?', ['・']],
  ['#', ['ぁ']],
  ['$', ['ぅ']],
  ['%', ['ぇ']],
  ["'", ['ゃ', "'", "'"]],
  ['^', ['へ']],
  ['~', ['へ']],
  ['&', ['ぉ']],
  ['(', ['ゅ']],
  [')', ['ょ']],
  ['|', ['ー']],
  ['_', ['ろ']],
  ['=', ['ほ']],
  ['+', ['れ']],
  [';', ['れ']],
  ['"', ['ふ', '"', '"', '"']],
  ['@', ['゛']],
  ['`', ['゛']],
  ['[', ['゜']],
  [']', ['む']],
  ['{', ['「']],
  ['}', ['」']],
  [':', ['け']],
  ['*', ['け']],
])

const CODE_TO_KANA = new Map([
  ['IntlYen', ['ー', '￥', '\\']],
  ['IntlRo', ['ろ', '￥', '\\']],
  ['Space', [' ']],
  ['Numpad1', []],
  ['Numpad2', []],
  ['Numpad3', []],
  ['Numpad4', []],
  ['Numpad5', []],
  ['Numpad6', []],
  ['Numpad7', []],
  ['Numpad8', []],
  ['Numpad9', []],
  ['Numpad0', []],
  ['NumpadDivide', []],
  ['NumpadMultiply', []],
  ['NumpadSubtract', []],
  ['NumpadAdd', []],
  ['NumpadDecimal', []],
])

const KEYBOARD_CHARS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '~',
  '&',
  '%',
  '!',
  '?',
  '@',
  '#',
  '$',
  '(',
  ')',
  '|',
  '{',
  '}',
  '`',
  '*',
  '+',
  ':',
  ';',
  '_',
  '<',
  '>',
  '=',
  '^',
]

const DAKU_LIST = [
  'ヴ',
  'が',
  'ぎ',
  'ぐ',
  'げ',
  'ご',
  'ざ',
  'じ',
  'ず',
  'ぜ',
  'ぞ',
  'だ',
  'ぢ',
  'づ',
  'で',
  'ど',
  'ば',
  'び',
  'ぶ',
  'べ',
  'ぼ',
]

const HANDAKU_KANA_LIST = ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']
const DAKU_HANDAKU_LIST = DAKU_LIST.concat(HANDAKU_KANA_LIST)

export interface TypingKeys {
  keys: string[]
  key: string
  code: string
  shift?: boolean
}

interface JudgeType {
  typingKeys: TypingKeys
  lineWord: LineWord
}

interface JudgeResult {
  newLineWord: LineWord
  successKey: string
  failKey: string
  isCompleted: boolean
}

// Zコマンドマップ
const Z_COMMAND_MAP = {
  '...': { k: '...', r: ['z.', 'z,.'], t: 'symbol' as const },
  '..': { k: '..', r: ['z,'], t: 'symbol' as const },
}

class ProcessedLineWord {
  newLineWord: LineWord
  updatePoint: number

  constructor({ typingKeys, lineWord }: JudgeType) {
    this.newLineWord = lineWord
    this.updatePoint = 0
    this.newLineWord = this.zCommand({ typingKeys, lineWord: this.newLineWord })
    this.newLineWord = this.processNNRouteKey({ typingKeys, lineWord: this.newLineWord })
  }

  private processNNRouteKey({ typingKeys, lineWord }: JudgeType): LineWord {
    let newLineWord = { ...lineWord }
    if (typingKeys.code === 'KeyX' || typingKeys.code === 'KeyW') {
      const expectedNextKey = typingKeys.code === 'KeyX' ? 'ん' : 'う'
      const isNNRoute =
        newLineWord.nextChar.k === 'ん' &&
        newLineWord.correct.r.slice(-1) === 'n' &&
        newLineWord.nextChar.r[0] === 'n'
      const isNext = newLineWord.word[0]?.k === expectedNextKey

      if (isNNRoute && isNext) {
        newLineWord.correct.k += 'ん'
        this.updatePoint = 1
        newLineWord.nextChar = newLineWord.word[0]
        newLineWord.word.splice(0, 1)
        return newLineWord
      }
    }
    return newLineWord
  }

  private zCommand({ typingKeys, lineWord }: JudgeType): LineWord {
    let newLineWord = { ...lineWord }
    if (typingKeys.code === 'KeyZ' && !typingKeys.shift) {
      const doublePeriod = newLineWord.nextChar.k === '.' && newLineWord.word[0]?.k === '.'
      if (doublePeriod) {
        const triplePeriod = doublePeriod && newLineWord.word[1]?.k === '.'
        if (triplePeriod) {
          newLineWord.nextChar = structuredClone(Z_COMMAND_MAP['...'])
          newLineWord.word.splice(0, 2)
        } else {
          newLineWord.nextChar = structuredClone(Z_COMMAND_MAP['..'])
          newLineWord.word.splice(0, 1)
        }
      }
    }
    return newLineWord
  }
}

class RomaInput {
  newLineWord: LineWord
  updatePoint: number
  successKey: string
  failKey: string

  constructor({ typingKeys, lineWord }: JudgeType) {
    const processed = new ProcessedLineWord({ typingKeys, lineWord })
    this.updatePoint = processed.updatePoint
    const result = this.hasRomaPattern(typingKeys, processed.newLineWord)
    this.newLineWord = result.newLineWord as LineWord
    this.successKey = result.successKey
    this.failKey = result.failKey ?? ''
  }

  private hasRomaPattern(typingKeys: TypingKeys, lineWord: LineWord) {
    let newLineWord = { ...lineWord } as LineWord
    const nextRomaPattern: string[] = newLineWord.nextChar.r
    const kana = lineWord.nextChar.k
    const isSuccess = nextRomaPattern.some(
      (pattern) => pattern[0] && pattern[0].toLowerCase() === typingKeys.keys[0]
    )

    if (!isSuccess) {
      return { newLineWord, successKey: '', failKey: typingKeys.key }
    }

    if (kana === 'ん' && newLineWord.word[0]) {
      newLineWord.word[0].r = this.nextNNFilter(typingKeys.keys[0], newLineWord)
    }

    newLineWord.nextChar.r = this.updateNextRomaPattern(typingKeys, nextRomaPattern)
    newLineWord = this.kanaFilter(kana, typingKeys.keys[0], newLineWord)
    newLineWord = this.wordUpdate(typingKeys, newLineWord)

    return { newLineWord, successKey: typingKeys.keys[0] }
  }

  private updateNextRomaPattern(typingKeys: TypingKeys, nextRomaPattern: string[]) {
    const key = typingKeys.keys[0]
    return nextRomaPattern
      .map((pattern) => (pattern.startsWith(key) ? pattern.slice(1) : ''))
      .filter((pattern) => pattern !== '')
  }

  private kanaFilter(kana: string, typingKey: string, newLineWord: LineWord): LineWord {
    const romaPattern = newLineWord.nextChar.r
    if (kana.length >= 2 && romaPattern.length) {
      const isSokuon = kana[0] === 'っ' && (typingKey === 'u' || romaPattern[0][0] === typingKey)
      const isYoon = kana[0] !== 'っ' && (romaPattern[0][0] === 'x' || romaPattern[0][0] === 'l')

      const isTriplePeriod = kana === '...' && typingKey === ','
      if (isSokuon || isYoon) {
        newLineWord.correct.k += newLineWord.nextChar.k.slice(0, 1)
        newLineWord.nextChar.k = newLineWord.nextChar.k.slice(1)
      } else if (isTriplePeriod) {
        newLineWord.correct.k += newLineWord.nextChar.k.slice(0, 2)
        newLineWord.nextChar.k = newLineWord.nextChar.k.slice(2)
        this.updatePoint = 2
      }
    }

    return newLineWord
  }

  private nextNNFilter(typingKey: string, newLineWord: LineWord): string[] {
    const nextToNextChar = newLineWord.word[0].r
    const isXN =
      typingKey === 'x' && nextToNextChar[0] && nextToNextChar[0][0] !== 'n' && nextToNextChar[0][0] !== 'N'

    if (isXN) {
      return nextToNextChar.filter((value: string) => {
        return value.match(/^(?!(n|')).*$/)
      })
    } else {
      return nextToNextChar
    }
  }

  private wordUpdate(typingKeys: TypingKeys, newLineWord: LineWord): LineWord {
    const kana = newLineWord.nextChar.k
    const romaPattern = newLineWord.nextChar.r

    if (!romaPattern.length) {
      newLineWord.correct.k += kana
      this.updatePoint = 1
      newLineWord.nextChar = newLineWord.word.shift() || { k: '', r: [''], t: undefined }
    }

    newLineWord.correct.r += typingKeys.keys[0]

    return newLineWord
  }
}

class KanaInput {
  newLineWord: LineWord
  updatePoint: number
  successKey: string
  failKey: string

  constructor({ typingKeys, lineWord }: JudgeType) {
    this.updatePoint = 0
    const result = this.hasKana({ typingKeys, lineWord })
    this.newLineWord = result.newLineWord
    this.successKey = result.successKey
    this.failKey = result.failKey ?? ''
  }

  private hasKana({ typingKeys, lineWord }: JudgeType) {
    let newLineWord = { ...lineWord }

    const nextKana = lineWord.nextChar.k
    const keys = typingKeys.keys
    const isDakuHandaku = DAKU_HANDAKU_LIST.includes(nextKana[0])

    const dakuHanDakuData = isDakuHandaku ? this.parseDakuHandaku(nextKana[0]) : { type: '', normalizedKana: '', originalKana: '' }

    const successIndex: number = nextKana[0]
      ? keys.indexOf(dakuHanDakuData.normalizedKana ? dakuHanDakuData.normalizedKana : nextKana[0].toLowerCase())
      : -1

    const typingKey =
      keys[successIndex] === '゛' || keys[successIndex] === '゜'
        ? newLineWord.nextChar.orginalDakuChar
        : keys[successIndex]

    if (!typingKey) {
      const isKanaInArray = !KEYBOARD_CHARS.includes(nextKana[0])
      return {
        newLineWord,
        successKey: '',
        failKey: isKanaInArray ? typingKeys.keys[0] : typingKeys.key,
      }
    }

    if (dakuHanDakuData.type) {
      const yoon = nextKana.length >= 2 && dakuHanDakuData.type ? nextKana[1] : ''
      newLineWord.nextChar.k = dakuHanDakuData.type + yoon
      newLineWord.nextChar.orginalDakuChar = dakuHanDakuData.originalKana
    } else {
      if (nextKana.length >= 2) {
        newLineWord.correct.k += typingKey
        newLineWord.nextChar.k = newLineWord.nextChar.k.slice(1)
      } else {
        newLineWord = this.wordUpdate(typingKey, newLineWord)
      }
    }

    return {
      newLineWord,
      successKey: keys[successIndex],
    }
  }

  private parseDakuHandaku(originalKana: string): { type: string; normalizedKana: string; originalKana: string } {
    const type = DAKU_LIST.includes(originalKana) ? '゛' : '゜'
    const normalizedKana = originalKana.normalize('NFD')[0]
    return { type, normalizedKana, originalKana }
  }

  private wordUpdate(typingKey: string, newLineWord: LineWord): LineWord {
    const romaPattern = newLineWord.nextChar.r

    newLineWord.correct.k += typingKey
    newLineWord.correct.r += romaPattern[0]

    this.updatePoint = 1
    newLineWord.nextChar = newLineWord.word.shift() || { k: '', r: [''], t: undefined }

    return newLineWord
  }
}

export const useInputJudge = () => {
  const romaMakeInput = useCallback((event: KeyboardEvent): TypingKeys => {
    return {
      keys: [event.key.toLowerCase()],
      key: event.key.toLowerCase(),
      code: event.code,
      shift: event.shiftKey,
    }
  }, [])

  const kanaMakeInput = useCallback((event: KeyboardEvent): TypingKeys => {
    const codeKanaKey = CODE_TO_KANA.get(event.code)
    const keyToKanaResult = KEY_TO_KANA.get(event.key) ?? []
    const input: TypingKeys = {
      keys: codeKanaKey ? [...codeKanaKey] : [...keyToKanaResult],
      key: event.key.toLowerCase(),
      code: event.code,
      shift: event.shiftKey,
    }

    if (event.keyCode === 0) {
      input.keys = ['ー', '￥', '\\']
    } else if (event.shiftKey) {
      if (event.code === 'KeyE') input.keys[0] = 'ぃ'
      if (event.code === 'KeyZ') input.keys[0] = 'っ'

      if (event.code === 'KeyV') input.keys.push('ゐ', 'ヰ')
      if (event.code === 'Equal') input.keys.push('ゑ', 'ヱ')
      if (event.code === 'KeyT') input.keys.push('ヵ')
      if (event.code === 'Quote') input.keys.push('ヶ')
      if (event.code === 'KeyF') input.keys.push('ゎ')
      if (event.code === 'Digit0') input.keys = ['を']
    }

    if (KEYBOARD_CHARS.includes(event.key)) {
      input.keys.push(
        event.key.toLowerCase(),
        event.key.toLowerCase().replace(event.key.toLowerCase(), function (s) {
          return String.fromCharCode(s.charCodeAt(0) + 0xfee0)
        })
      )
    }

    return input
  }, [])

  const judgeInput = useCallback(
    (event: KeyboardEvent, lineWord: LineWord, inputMode: InputMode): JudgeResult => {
      const typingKeys: TypingKeys = inputMode === 'roma' ? romaMakeInput(event) : kanaMakeInput(event)
      const inputResult =
        inputMode === 'roma' ? new RomaInput({ typingKeys, lineWord }) : new KanaInput({ typingKeys, lineWord })

      const isCompleted = inputResult.newLineWord.nextChar.k === ''
      const isSuccess = !!inputResult.successKey
      const isFailed =
        !isSuccess && (!!inputResult.newLineWord.correct.r || !!inputResult.newLineWord.correct.k)

      return {
        newLineWord: inputResult.newLineWord,
        successKey: inputResult.successKey,
        failKey: inputResult.failKey,
        isCompleted,
      }
    },
    [romaMakeInput, kanaMakeInput]
  )

  return { judgeInput }
}
