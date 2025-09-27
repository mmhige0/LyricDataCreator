declare module 'kuroshiro' {
  interface ConvertOptions {
    to?: 'hiragana' | 'katakana' | 'romaji'
    mode?: 'normal' | 'spaced' | 'okurigana' | 'furigana'
    romajiSystem?: 'nippon' | 'passport' | 'hepburn'
  }

  export default class Kuroshiro {
    constructor()
    init(analyzer: any): Promise<void>
    convert(text: string, options?: ConvertOptions): Promise<string>
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
  interface KuromojiAnalyzerOptions {
    dictPath?: string
  }

  export default class KuromojiAnalyzer {
    constructor(options?: KuromojiAnalyzerOptions)
  }
}