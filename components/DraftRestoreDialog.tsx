"use client"

import type { Dispatch, SetStateAction } from 'react'
import { X, Trash2, FileText } from 'lucide-react'
import { deleteDraft } from '@/lib/draftStorage'
import { setSessionId } from '@/lib/sessionStorage'
import type { DraftListEntry } from '@/lib/types'

interface DraftRestoreDialogProps {
  isOpen: boolean
  drafts: DraftListEntry[]
  setDrafts: Dispatch<SetStateAction<DraftListEntry[]>>
  onClose: () => void
  onRestore: (sessionId: string) => void
}

export function DraftRestoreDialog({ isOpen, drafts, setDrafts, onClose, onRestore }: DraftRestoreDialogProps) {
  const handleRestore = (sessionId: string) => {
    setSessionId(sessionId)
    onRestore(sessionId)
    onClose()
  }

  const handleDelete = (sessionId: string) => {
    deleteDraft(sessionId)
    setDrafts(prev => prev.filter(draft => draft.sessionId !== sessionId))
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'たった今'
    if (diffMins < 60) return `${diffMins}分前`
    if (diffHours < 24) return `${diffHours}時間前`
    if (diffDays < 7) return `${diffDays}日前`

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">履歴</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>保存された履歴はありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map(draft => (
                <div
                  key={draft.sessionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRestore(draft.sessionId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleRestore(draft.sessionId)
                    }
                  }}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {draft.songTitle || '(無題)'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {draft.pageCount}ページ · {formatDate(draft.lastModified)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(draft.sessionId)
                      }}
                      className="p-3 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
