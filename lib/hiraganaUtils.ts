import Kuroshiro from 'kuroshiro'
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji'

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
      await this.kuroshiro.init(new KuromojiAnalyzer())
    } catch (error) {
      console.error('Kuroshiro initialization error:', error)
      throw new Error('漢字変換エンジンの初期化に失敗しました')
    }
  }

  async convertToHiragana(text: string): Promise<string> {
    if (!text || text.trim() === '') return text

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
 * 漢字を含むテキストをひらがなに変換する
 * @param text 変換対象のテキスト
 * @returns ひらがなに変換されたテキスト
 */
export const convertToHiragana = async (text: string): Promise<string> => {
  return converter.convertToHiragana(text)
}

/**
 * 漢字変換エンジンを事前初期化する
 * アプリ起動時に呼び出すことで、初回変換の遅延を回避
 */
export const initializeHiraganaConverter = async (): Promise<void> => {
  return converter.initialize()
}

/**
 * 変換エンジンの初期化状態を取得
 */
export const getHiraganaConverterStatus = () => {
  return converter.getInitializationStatus()
}

/**
 * 歌詞配列の各行を一括でひらがなに変換
 */
export const convertLyricsArrayToHiragana = async (
  lyrics: [string, string, string, string]
): Promise<[string, string, string, string]> => {
  const convertedLyrics = await Promise.all(
    lyrics.map(line => line.trim() === '' ? '' : convertToHiragana(line))
  )
  return convertedLyrics as [string, string, string, string]
}