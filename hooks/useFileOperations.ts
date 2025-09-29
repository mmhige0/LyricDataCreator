import { useRef } from 'react'
import { toast } from 'sonner'
import type { ScoreEntry } from '@/lib/types'
import { parseLrcToScoreEntries } from '@/lib/lrcUtils'

interface FileOperationsProps {
  scoreEntries: ScoreEntry[]
  setScoreEntries: React.Dispatch<React.SetStateAction<ScoreEntry[]>>
  duration: number
  setDuration: React.Dispatch<React.SetStateAction<number>>
  songTitle: string
  setSongTitle: React.Dispatch<React.SetStateAction<string>>
}

export const useFileOperations = ({
  scoreEntries,
  setScoreEntries,
  duration,
  setDuration,
  songTitle,
  setSongTitle
}: FileOperationsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportScoreData = () => {
    if (scoreEntries.length === 0) {
      toast.error("ページがありません。")
      return
    }

    const title = prompt("曲名を入力してください:", songTitle || "")
    if (title === null) return

    setSongTitle(title)

    let exportData = `${duration.toFixed(1)}\n`

    scoreEntries.forEach((entry) => {
      const lyricsLine = entry.lyrics.map((line) => line || "!").join("/")
      exportData += `${lyricsLine}/${entry.timestamp.toFixed(2)}\n`
    })

    exportData += `!/!/!/!/${999.9}\n`

    const blob = new Blob([exportData], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const now = new Date()
    const timestamp = now.getFullYear() + "-" + 
      String(now.getMonth() + 1).padStart(2, "0") + "-" + 
      String(now.getDate()).padStart(2, "0") + "_" + 
      String(now.getHours()).padStart(2, "0") + "-" + 
      String(now.getMinutes()).padStart(2, "0") + "-" + 
      String(now.getSeconds()).padStart(2, "0")
    const filename = title ? `${title}_${timestamp}.txt` : `譜面_${timestamp}.txt`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

    // 不正な文字パターンの検出
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        toast.error('不正な内容が検出されました')
        return false
      }
    }

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

    // ファイル名から曲名を抽出（txtファイルの場合）
    if (fileExtension === 'txt') {
      const match = filename.match(/^(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/)
      if (match) {
        setSongTitle(match[1])
      }
    } else if (fileExtension === 'lrc') {
      // LRCファイルの場合、拡張子を除いたファイル名を曲名に設定
      const titleFromFilename = filename.replace(/\.lrc$/i, '')
      setSongTitle(titleFromFilename)
    }

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

          if (scoreEntries.length > 0) {
            const replace = confirm("既存のページを置き換えますか？")
            if (!replace) return
          }

          setScoreEntries(newEntries)
          toast.success(`${newEntries.length}件のページをインポートしました。`)
          return
        }

        // 既存のTXTファイル処理
        const lines = content.trim().split("\n")

        if (lines.length < 1) {
          toast.error("ファイルが空です。")
          return
        }

        const fileDuration = Number.parseFloat(lines[0])
        if (isNaN(fileDuration)) {
          toast.error("1行目の総時間が正しくありません。")
          return
        }

        if (Math.abs(fileDuration - duration) > 0.1) {
          const proceed = confirm(
            `ファイルの総時間（${fileDuration.toFixed(1)}秒）と現在の動画の総時間（${duration.toFixed(1)}秒）が異なります。続行しますか？`,
          )
          if (!proceed) return
        }

        const newEntries: ScoreEntry[] = []
        const errors: string[] = []

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const parts = line.split("/")
          if (parts.length !== 5) {
            errors.push(`${i + 1}行目: フォーマットが正しくありません`)
            continue
          }

          const timestamp = Number.parseFloat(parts[4])
          if (isNaN(timestamp)) {
            errors.push(`${i + 1}行目: タイムスタンプが正しくありません`)
            continue
          }

          if (timestamp === 999.9) continue

          const lyrics: [string, string, string, string] = [
            parts[0] === "!" ? "" : parts[0],
            parts[1] === "!" ? "" : parts[1],
            parts[2] === "!" ? "" : parts[2],
            parts[3] === "!" ? "" : parts[3],
          ]

          newEntries.push({
            id: `import_${i}_${Date.now()}`,
            timestamp,
            lyrics,
          })
        }

        if (errors.length > 0) {
          toast.error(`以下のエラーがありました:\n${errors.join("\n")}`)
          return
        }

        newEntries.sort((a, b) => a.timestamp - b.timestamp)

        if (scoreEntries.length > 0) {
          const replace = confirm("既存のページを置き換えますか？")
          if (!replace) return
        }

        setScoreEntries(newEntries)
        setDuration(fileDuration)
        toast.success(`${newEntries.length}件のページをインポートしました。`)
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