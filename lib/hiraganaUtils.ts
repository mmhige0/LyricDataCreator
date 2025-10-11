import Kuroshiro from 'kuroshiro'
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji'
import { preprocessAndConvertLyrics } from './textUtils'

// Kuroshiroのインスタンスを管理するクラス
class HiraganaConverter {
  private static instance: HiraganaConverter
  private kuroshiro: Kuroshiro | null = null
  private isInitialized: boolean = false
  private isInitializing: boolean = false
  private initPromise: Promise<void> | null = null

  private constructor() {}

  static getInstance(): HiraganaConverter {
    if (!HiraganaConverter.instance) {
      HiraganaConverter.instance = new HiraganaConverter()
    }
    return HiraganaConverter.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.isInitializing) return this.initPromise!

    this.isInitializing = true
    this.initPromise = this._doInitialize()

    try {
      await this.initPromise
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize kuroshiro:', error)
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  private async _doInitialize(): Promise<void> {
    if (typeof window === 'undefined') {
      // サーバーサイドでは何もしない
      return
    }

    try {
      this.kuroshiro = new Kuroshiro()

      // ベースパスを動的に判定
      const isGitHubPages = window.location.hostname.includes('github.io')
      const basePath = isGitHubPages ? '/LyricDataCreator' : ''
      const dictPath = `${basePath}/dict/`

      await this.kuroshiro.init(new KuromojiAnalyzer({
        dictPath: dictPath
      }))
    } catch (error) {
      console.error('Kuroshiro initialization error:', error)
      throw new Error('漢字変換エンジンの初期化に失敗しました')
    }
  }

  async convertKanjiToHiragana(text: string): Promise<string> {
    if (!text || text.trim() === '') return text

    // 漢字が含まれている場合のみKuroshiroを使用（前処理は呼び出し側で実行済み）
    if (this.containsKanji(text)) {
      if (!this.isInitialized) {
        await this.initialize()
      }

      if (!this.kuroshiro) {
        throw new Error('変換エンジンが初期化されていません')
      }

      try {
        const result = await this.kuroshiro.convert(text, { to: 'hiragana' })
        return result
      } catch (error) {
        console.error('Conversion error:', error)
        throw new Error('テキストの変換中にエラーが発生しました')
      }
    }

    // 漢字が含まれていない場合はそのまま返す
    return text
  }

  async convertToRomaji(text: string): Promise<string> {
    if (!text || text.trim() === '') return text

    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.kuroshiro) {
      throw new Error('変換エンジンが初期化されていません')
    }

    try {
      // 日本式ローマ字で変換
      const result = await this.kuroshiro.convert(text, {
        to: 'romaji',
        mode: 'spaced',
        romajiSystem: 'nippon'
      })
      return result
    } catch (error) {
      console.error('Romaji conversion error:', error)
      throw new Error('ローマ字変換中にエラーが発生しました')
    }
  }

  /**
   * テキストに漢字が含まれているかチェック
   */
  private containsKanji(text: string): boolean {
    return /[\u4e00-\u9faf]/.test(text)
  }

  getInitializationStatus(): {
    isInitialized: boolean
    isInitializing: boolean
  } {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing
    }
  }
}

// 公開API
const converter = HiraganaConverter.getInstance()

/**
 * 漢字を含むテキストをひらがなに変換する（漢字変換のみ）
 * 注意: カタカナ変換や記号削除などの前処理は呼び出し側で行う
 * @param text 変換対象のテキスト（前処理済み）
 * @returns ひらがなに変換されたテキスト
 */
export const convertKanjiToHiragana = async (text: string): Promise<string> => {
  return converter.convertKanjiToHiragana(text)
}

/**
 * テキストをローマ字に変換する（日本式）
 * @param text 変換対象のテキスト
 * @returns ローマ字に変換されたテキスト
 */
const convertToRomaji = async (text: string): Promise<string> => {
  return converter.convertToRomaji(text)
}

/**
 * 歌詞配列の各行を一括でひらがなに変換（前処理付き）
 */
export const convertLyricsArrayToHiragana = async (
  lyrics: [string, string, string, string]
): Promise<[string, string, string, string]> => {
  const convertedLyrics = await Promise.all(
    lyrics.map(async line => {
      if (line.trim() === '') return ''
      // まず基本的な変換処理（記号削除、全角変換、カタカナ→ひらがな）
      const preprocessed = preprocessAndConvertLyrics(line)
      // 漢字が含まれている場合はKuroshiroで変換
      return await convertKanjiToHiragana(preprocessed)
    })
  )
  return convertedLyrics as [string, string, string, string]
}

/**
 * 歌詞配列の各行を一括でローマ字に変換（日本式）
 * 注意: 保存時に既に前処理済みのデータを想定（重複前処理を回避）
 */
export const convertLyricsArrayToRomaji = async (
  lyrics: [string, string, string, string]
): Promise<[string, string, string, string]> => {
  const convertedLyrics = await Promise.all(
    lyrics.map(async line => {
      if (line.trim() === '') return ''
      // 保存時に既に前処理済みのため、ひらがな変換とローマ字変換のみ実行
      const hiragana = await convertKanjiToHiragana(line)
      return await convertToRomaji(hiragana)
    })
  )
  return convertedLyrics as [string, string, string, string]
}