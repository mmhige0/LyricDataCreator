import React from 'react'
import { HelpCircle } from 'lucide-react'

export const HelpSection: React.FC = () => {
  return (
    <div className="mt-8 max-w-[1600px] mx-auto px-8">
      <div className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-3">
        <HelpCircle className="h-7 w-7 text-primary" />
        操作ガイド
      </div>

      {/* 1. Basic Usage */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">データ作成の流れ</div>
        <div className="text-lg text-muted-foreground">
          <ol className="list-decimal ml-4 space-y-1">
            <li>作成する曲のYouTubeのURLを入力し、「読み込み」をクリック</li>
            <li>動画を再生し、ページを表示したいタイミングで<kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded font-mono text-foreground">F2</kbd>キーでタイムスタンプを入力<br />
              💡 入力されるタイミングは「補正」で微調整できます（-0.2〜-0.1秒がおすすめ）</li>
            <li>歌詞（最大4行）を入力し、「ページ追加」をクリック（歌詞のないページを追加する場合は、4行とも空行にして追加）</li>
            <li>2,3を繰り返して、すべてのページを追加し終わったら、「エクスポート」をクリック</li>
          </ol>
        </div>
      </div>

      {/* 2. File Operations */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">ファイル操作</div>

        {/* Import/Export Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-3">インポート・エクスポート</div>
          <div className="text-lg text-muted-foreground">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-2 pr-4 font-medium w-48 border-b border-border pl-2 text-foreground">操作</th>
                  <th className="text-left py-2 font-medium border-b border-border pl-2 text-foreground">対応形式・備考</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-3 pr-4 font-medium align-top pl-2 text-foreground">インポート</td>
                  <td className="py-3 pl-2">
                    <div className="mb-2">
                      <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded mr-2">.txt</span>
                      <span className="font-mono text-sm bg-accent/10 text-accent px-2 py-1 rounded">.lrc</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ※ LRCファイル：1行目に歌詞が読み込まれ、2〜4行目は空行になります
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium align-top pl-2 text-foreground">エクスポート</td>
                  <td className="py-3 pl-2">
                    <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">.txt</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* File Format Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-2">ファイルフォーマット <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">.txt</span></div>
          <div className="text-lg text-muted-foreground">
            <div className="font-mono text-sm bg-muted p-4 rounded mb-3 text-foreground">
              <div className="text-primary">120.5</div>
              <div>最初の歌詞/!/!/!/12.50</div>
              <div>次の歌詞/2行目/!/!/25.30</div>
              <div>!/!/!/!/999.9</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Controls and Shortcuts */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">ショートカットキー</div>

        {/* Keyboard Shortcuts Help */}
        <div className="mb-6">
          <div className="text-lg text-muted-foreground">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">F2</kbd>
                </div>
                <span className="text-base text-foreground">タイムスタンプ入力</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Enter</kbd>
                </div>
                <span className="text-base text-foreground">ページ追加</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Space</kbd>
                </div>
                <span className="text-base text-foreground">再生/一時停止</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">←</kbd>
                </div>
                <span className="text-base text-foreground">1秒巻き戻し</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">→</kbd>
                </div>
                <span className="text-base text-foreground">1秒早送り</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Shift</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">V</kbd>
                </div>
                <span className="text-base text-foreground">歌詞貼り付け</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Z</kbd>
                </div>
                <span className="text-base text-foreground">元に戻す</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Ctrl</kbd>
                  <span className="text-sm text-muted-foreground">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-muted border border-border rounded font-mono text-center text-foreground">Y</kbd>
                </div>
                <span className="text-base text-foreground">やり直す</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Other Features */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b border-border pb-2">その他の機能</div>

        {/* Text Processing Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-2">歌詞変換</div>
          <div className="text-lg text-muted-foreground">
            <div>ページ追加・編集時に以下の変換が自動で行われます：</div>
            <ul className="ml-4 mt-1 list-disc">
              <li>前後のスペース削除</li>
              <li>記号削除</li>
              <li>半角 → 全角変換</li>
              <li>カタカナ → ひらがな変換</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
