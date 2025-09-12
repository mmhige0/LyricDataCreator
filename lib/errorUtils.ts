/**
 * エラーハンドリング関連のユーティリティ
 */

interface ErrorNotification {
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
}

/**
 * ユーザーフレンドリーなエラー通知を表示
 * 将来的にtoastライブラリに置き換え可能
 */
export const showNotification = ({ type, title, message }: ErrorNotification) => {
  // 現在はalertを使用、将来的にtoastに置き換え予定
  const icon = {
    error: '❌',
    warning: '⚠️', 
    info: 'ℹ️',
    success: '✅'
  }[type]
  
  alert(`${icon} ${title}\n\n${message}`)
}

/**
 * YouTube関連のエラーメッセージ
 */
export const youtubeErrors = {
  invalidUrl: () => showNotification({
    type: 'error',
    title: 'URLエラー',
    message: '有効なYouTube URLを入力してください。\n例: https://www.youtube.com/watch?v=...'
  }),
  
  apiLoading: () => showNotification({
    type: 'warning', 
    title: 'API読み込み中',
    message: 'YouTube APIの読み込み中です。\nしばらく待ってから再試行してください。'
  }),
  
  playerNotReady: () => showNotification({
    type: 'error',
    title: 'プレイヤーエラー',
    message: 'プレイヤーの準備ができていません。\nもう一度お試しください。'
  }),
  
  videoLoadError: () => showNotification({
    type: 'error',
    title: '動画読み込みエラー',
    message: '動画の読み込みでエラーが発生しました。\nURLを確認してください。'
  }),
  
  playerCreationError: () => showNotification({
    type: 'error',
    title: 'プレイヤー作成エラー',
    message: 'プレイヤーの作成でエラーが発生しました。\nページを再読み込みしてください。'
  })
}

/**
 * 汎用的なエラーハンドリング
 */
export const handleError = (error: unknown, context: string) => {
  console.error(`[${context}]`, error)
  
  showNotification({
    type: 'error',
    title: 'エラーが発生しました',
    message: `処理中にエラーが発生しました。\nコンソールで詳細を確認してください。`
  })
}