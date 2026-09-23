import React from 'react'

export function EditorShortcuts() {
  return (
      <div className="rounded-lg border bg-card p-4">
        <div className="text-base font-semibold text-foreground mb-3 border-b border-border pb-2">ショートカットキー</div>

        {[
          { title: '動画再生', shortcuts: [
            { keys: ['Ctrl', 'Space'], description: '再生/一時停止' },
            { keys: ['Ctrl', 'Shift', 'Space'], description: '選択・編集中のページを頭出し再生' },
            { keys: ['Ctrl', '←'], description: '1秒巻き戻し' },
            { keys: ['Ctrl', '→'], description: '1秒早送り' },
          ] },
          { title: 'ページ操作', shortcuts: [
            { keys: ['Ctrl', '↑'], description: '最初のページの1行目へ移動' },
            { keys: ['Ctrl', '↓'], description: '最後のページの4行目へ移動' },
            { keys: ['Alt', '↑'], description: '前のページへ移動' },
            { keys: ['Alt', '↓'], description: '次のページへ移動' },
            { keys: ['F2'], description: 'タイムスタンプ入力・更新' },
            { keys: ['Delete'], description: '選択ページを削除' },
            { keys: ['Ctrl', 'Shift', 'V'], description: '歌詞貼り付け' },
            { keys: ['Ctrl', 'Z'], description: '元に戻す' },
            { keys: ['Ctrl', 'Y'], description: 'やり直す' },
          ] },
        ].map(group => (
          <div key={group.title} className="mb-3">
            <div className="text-sm font-medium text-foreground mb-3">{group.title}</div>
            <div className="grid grid-cols-1 gap-1">
              {group.shortcuts.map(({ keys, description }) => (
                <div key={keys.join('+')} className="flex flex-wrap items-center gap-2 py-1 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-1 w-[190px] shrink-0">
                    {keys.map((key, index) => (
                      <React.Fragment key={key}>
                        {index > 0 && <span className="text-sm text-muted-foreground">+</span>}
                        <kbd className="px-2 py-0.5 text-xs bg-muted border border-border rounded font-mono text-center text-foreground">{key}</kbd>
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 text-xs text-foreground">{description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

  )
}
