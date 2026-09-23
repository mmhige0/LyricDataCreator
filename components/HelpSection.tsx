import React from 'react'
import { HelpCircle, ChevronDown } from 'lucide-react'

export const HelpSection: React.FC = () => {
  return (
    <details className="rounded-lg border bg-card p-4 group">
      <summary className="text-base font-semibold text-foreground flex items-center gap-3 cursor-pointer list-none select-none">
        <HelpCircle className="h-5 w-5 text-primary" />
        操作ガイド
        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-6">

      {/* 1. Basic Usage */}
      <div className="mb-8">
        <div className="text-base font-semibold text-foreground mb-4 border-b border-border pb-2">データ作成の流れ</div>
        <div className="text-sm text-muted-foreground">
          <ol className="list-decimal ml-4 space-y-1">
            <li>作成する曲のYouTubeのURLを入力し、「読み込み」をクリック</li>
            <li>一覧下部の「＋」で空ページを追加し、歌詞を入力</li>
            <li>動画を再生し、ページを表示したいタイミングで<kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded font-mono text-foreground">F2</kbd>キーでタイムスタンプを入力<br />
              💡 入力されるタイミングは「補正」で微調整できます（-0.2〜-0.1秒がおすすめ）</li>
            <li>歌詞と時刻は一覧で直接編集できます。歌詞のないページは4行とも空欄にします</li>
            <li>追加と編集を繰り返して、すべてのページを追加し終わったら、「エクスポート」をクリック</li>
          </ol>
        </div>
      </div>

      {/* 2. File Operations */}
      <div className="mb-8">
        <div className="text-base font-semibold text-foreground mb-4 border-b border-border pb-2">ファイル操作</div>

        {/* Import/Export Information */}
        <div className="mb-6">
          <div className="text-sm font-medium text-foreground mb-3">インポート・エクスポート</div>
          <div className="text-sm text-muted-foreground">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-2 pr-4 font-medium w-24 border-b border-border pl-2 text-foreground">操作</th>
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
                      ※ LRCファイル：<code className="bg-muted px-1 rounded">/</code>区切りで最大4行に分割されます（例：<code className="bg-muted px-1 rounded">歌詞1/歌詞2</code> → 1行目と2行目に分割）
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
          <div className="text-sm font-medium text-foreground mb-2">ファイルフォーマット <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-1 rounded">.txt</span></div>
          <div className="text-sm text-muted-foreground">
            <div className="font-mono text-sm bg-muted p-4 rounded mb-3 text-foreground">
              <div className="text-primary">120.5</div>
              <div>最初の歌詞/!/!/!/12.50</div>
              <div>次の歌詞/2行目/!/!/25.30</div>
              <div>!/!/!/!/999.9</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Other Features */}
      <div className="mb-8">
        <div className="text-base font-semibold text-foreground mb-4 border-b border-border pb-2">その他の機能</div>

        {/* Text Processing Information */}
        <div className="mb-6">
          <div className="text-sm font-medium text-foreground mb-2">歌詞変換</div>
          <div className="text-sm text-muted-foreground">
            <div>歌詞の編集終了時に以下の変換が自動で行われます：</div>
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
    </details>
  )
}
