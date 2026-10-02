import { useRef } from 'react'
import { toast } from 'sonner'
import type { ScoreEntry, CentralPop } from '@/lib/types'
import { createScoreTxt, parseScoreTxt } from '@/lib/scoreFormat'
import { createLrcFromScoreEntries, parseLrcToScoreEntries } from '@/lib/lrcUtils'

interface FileOperationsProps {
  scoreEntries: ScoreEntry[]
  setScoreEntries: React.Dispatch<React.SetStateAction<ScoreEntry[]>>
  centralPops: CentralPop[]
  setCentralPops: React.Dispatch<React.SetStateAction<CentralPop[]>>
  onBeforeImport: () => void
  duration: number
  setDuration: React.Dispatch<React.SetStateAction<number>>
  songTitle: string
  setSongTitle: React.Dispatch<React.SetStateAction<string>>
}

export const useFileOperations = ({
  scoreEntries,
  setScoreEntries,
  centralPops,
  setCentralPops,
  onBeforeImport,
  duration,
  setDuration,
  songTitle,
  setSongTitle
}: FileOperationsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const triggerDownload = (content: string, filename: string, onComplete?: () => void) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // Call callback after a short delay to ensure download has started
    // This reduces the risk of data loss if download fails
    if (onComplete) {
      setTimeout(onComplete, 500)
    }
  }

  const exportScoreData = (format: 'txt' | 'lrc' = 'txt', onComplete?: () => void) => {
    if (scoreEntries.length === 0 && centralPops.length === 0) {
      toast.error("ページがありません。")
      return
    }

    let txtContent: string
    try {
      if (format === 'lrc' && (centralPops.length || scoreEntries.some(entry => entry.decorations?.some(Boolean)))) {
        throw new Error('装飾行・中央ポップはLRCに保存できません。TXTで出力してください。')
      }
      txtContent = createScoreTxt(duration, scoreEntries, centralPops)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '出力できませんでした。')
      return
    }

    const titleInput = prompt("曲名を入力してください:", songTitle || "")
    if (titleInput === null) return

    const trimmedTitle = titleInput.trim()
    setSongTitle(trimmedTitle)

    const now = new Date()
    const timestamp = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0") + "_" +
      String(now.getHours()).padStart(2, "0") + "-" +
      String(now.getMinutes()).padStart(2, "0") + "-" +
      String(now.getSeconds()).padStart(2, "0")

    if (format === 'lrc') {
      const lrcContent = createLrcFromScoreEntries(scoreEntries, {
        title: trimmedTitle,
        duration
      })
      const filename = trimmedTitle ? `${trimmedTitle}_${timestamp}.lrc` : `譜面_${timestamp}.lrc`
      triggerDownload(lrcContent, filename, onComplete)
      return
    }

    const filename = trimmedTitle ? `${trimmedTitle}_${timestamp}.txt` : `譜面_${timestamp}.txt`
    triggerDownload(txtContent, filename, onComplete)
  }

  const importScoreData = () => {
    fileInputRef.current?.click()
  }

  // ファイルアップロードセキュリティ設定
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const ALLOWED_TYPES = ['text/plain']
  const ALLOWED_EXTENSIONS = ['.txt', '.lrc']
  const MAX_LINES = 1000
  const MAX_CONTENT_LENGTH = 100 * 1024 // 100KB

  const validateFile = (file: File): boolean => {
    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      toast.error('ファイルサイズが大きすぎます（5MB以下にしてください）')
      return false
    }

    // ファイル拡張子チェック
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error('対応していないファイル形式です（.txt, .lrc のみサポート）')
      return false
    }

    // MIMEタイプチェック（一部のブラウザでは空の場合があるため、警告のみ）
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      console.warn('Unexpected MIME type:', file.type)
    }

    return true
  }

  const validateFileContent = (content: string): boolean => {
    // 行数制限
    const lines = content.split('\n')
    if (lines.length > MAX_LINES) {
      toast.error(`ファイルの行数が多すぎます（${MAX_LINES}行以下にしてください）`)
      return false
    }

    // 文字数制限
    if (content.length > MAX_CONTENT_LENGTH) {
      toast.error('ファイルの内容が大きすぎます（100KB以下にしてください）')
      return false
    }

    // Content is plain text, never HTML. Validate the score grammar during parsing,
    // rather than rejecting legitimate decoration strings such as "data:".
    return true
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // ファイルバリデーション
    if (!validateFile(file)) {
      // ファイル入力をリセット
      if (event.target) {
        event.target.value = ''
      }
      return
    }

    const filename = file.name
    const fileExtension = filename.split('.').pop()?.toLowerCase()

    const match = filename.match(/^(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/)
    const importedTitle = fileExtension === 'lrc' ? filename.replace(/\.lrc$/i, '') : match?.[1]

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string

        // ファイル内容のバリデーション
        if (!validateFileContent(content)) {
          return
        }

        // LRCファイルの場合
        if (fileExtension === 'lrc') {
          const newEntries = parseLrcToScoreEntries(content)

          if (newEntries.length === 0) {
            toast.error("有効な歌詞データが見つかりませんでした。")
            return
          }

          if (scoreEntries.length > 0 || centralPops.length > 0) {
            const replace = confirm("既存のページを置き換えますか？")
            if (!replace) return
          }

          onBeforeImport()
          setScoreEntries(newEntries)
          setCentralPops([])
          if (importedTitle !== undefined) setSongTitle(importedTitle)
          toast.success(`${newEntries.length}件のページをインポートしました。`)
          return
        }

        const parsed = parseScoreTxt(content)
        const fileDuration = parsed.duration

        if (Math.abs(fileDuration - duration) > 0.1) {
          const proceed = confirm(
            `ファイルの総時間（${fileDuration.toFixed(1)}秒）と現在の動画の総時間（${duration.toFixed(1)}秒）が異なります。続行しますか？`,
          )
          if (!proceed) return
        }

        if (scoreEntries.length > 0 || centralPops.length > 0) {
          const replace = confirm("既存のページを置き換えますか？")
          if (!replace) return
        }

        onBeforeImport()
        setScoreEntries(parsed.scoreEntries)
        setCentralPops(parsed.centralPops)
        setDuration(fileDuration)
        if (importedTitle !== undefined) setSongTitle(importedTitle)
        for (const warning of parsed.warnings) toast.info(warning)
        toast.success(`${parsed.scoreEntries.length}ページ・${parsed.centralPops.length}件の中央ポップをインポートしました。`)
      } catch (error) {
        console.error('File import error:', error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        toast.error(`ファイルの読み込みに失敗しました: ${errorMessage}`)
      } finally {
        // ファイル入力をリセット（同じファイルを再選択可能にする）
        if (event.target) {
          event.target.value = ''
        }
      }
    }

    reader.onerror = () => {
      toast.error("ファイルの読み込み中にエラーが発生しました")
      if (event.target) {
        event.target.value = ''
      }
    }

    reader.readAsText(file, "utf-8")
  }

  return {
    fileInputRef,
    exportScoreData,
    importScoreData,
    handleFileImport,
  }
}
