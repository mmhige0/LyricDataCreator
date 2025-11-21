import { toast } from 'sonner'
import type { ScoreEntry } from '@/lib/types'

const TYPING_GAME_DATA_KEY = 'typingGameData'
const EDITOR_RETURN_STATE_KEY = 'editorReturnState'

interface PlayData {
  scoreEntries: ScoreEntry[]
  songTitle: string
  youtubeUrl: string
}

/**
 * プレイ用のデータを SessionStorage に保存する
 * - /typing ルートへの遷移用
 * - 埋め込み表示用のタブ表示など
 */
export const savePlayData = (params: PlayData): boolean => {
  const { scoreEntries, songTitle, youtubeUrl } = params

  // バリデーション
  if (scoreEntries.length === 0) {
    toast.error('ページが登録されていません')
    return false
  }
  if (!youtubeUrl) {
    toast.error('YouTube URLが設定されていません')
    return false
  }

  const data: PlayData = {
    scoreEntries,
    songTitle,
    youtubeUrl,
  }

  try {
    // プレイ画面用データ
    sessionStorage.setItem(TYPING_GAME_DATA_KEY, JSON.stringify(data))

    // 編集画面に戻ってきたときに自動復元できるようにスナップショットも保存
    sessionStorage.setItem(EDITOR_RETURN_STATE_KEY, JSON.stringify(data))

    return true
  } catch (e) {
    console.error('Failed to save to session storage:', e)
    toast.error('データの保存に失敗しました')
    return false
  }
}
