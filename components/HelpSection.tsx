import React from 'react'
import { HelpCircle } from 'lucide-react'

export const HelpSection: React.FC = () => {
  return (
    <div className="mt-8 max-w-[1600px] mx-auto px-8">
      <div className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-3">
        <HelpCircle className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        操作ガイド
      </div>

      {/* 1. Basic Usage */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b pb-2">データ作成の流れ</div>
        <div className="text-lg text-gray-700 dark:text-gray-300">
          <ol className="list-decimal ml-4 space-y-1">
            <li>作成する曲のYouTubeのURLを入力し、「読み込み」をクリック</li>
            <li>動画を再生し、歌詞を表示したいタイミングで<kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 border rounded font-mono">F2</kbd>キーでタイムスタンプを入力<br />
            💡 入力されるタイミングは「補正」で微調整できます（-0.2〜-0.1秒がおすすめ）</li>
            <li>歌詞（最大4行）を入力し、「ページ追加」をクリック（何も表示されないページを追加する場合は、4行とも空行にして追加）</li>
            <li>すべてのページを追加し終わったら、「エクスポート」をクリック</li>
          </ol>
        </div>
      </div>

      {/* 2. File Operations */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b pb-2">ファイル操作</div>

        {/* Import/Export Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-3">インポート・エクスポート</div>
          <div className="text-lg text-gray-700 dark:text-gray-300">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left py-2 pr-4 font-medium w-48 border-b border-gray-200 dark:border-gray-700 pl-2">操作</th>
                  <th className="text-left py-2 font-medium border-b border-gray-200 dark:border-gray-700 pl-2">対応形式・備考</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-3 pr-4 font-medium align-top pl-2">インポート</td>
                  <td className="py-3 pl-2">
                    <div className="mb-2">
                      <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded mr-2">.txt</span>
                      <span className="font-mono text-sm bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">.lrc</span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      ※ LRCファイル：1行目に歌詞が読み込まれ、2〜4行目は空行になります
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium align-top pl-2">エクスポート</td>
                  <td className="py-3 pl-2">
                    <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">.txt</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* File Format Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-2">ファイルフォーマット <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">.txt</span></div>
          <div className="text-lg text-gray-700 dark:text-gray-300">
            <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded mb-3">
              <div className="text-blue-600 dark:text-blue-400">120.5</div>
              <div>最初の歌詞/!/!/!/12.50</div>
              <div>次の歌詞/2行目/!/!/25.30</div>
              <div>!/!/!/!/999.9</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Controls and Shortcuts */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b pb-2">ショートカットキー</div>

        {/* Keyboard Shortcuts Help */}
        <div className="mb-6">
          <div className="text-lg text-gray-700 dark:text-gray-300">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">F2</kbd>
                </div>
                <span className="text-base">タイムスタンプ入力</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Ctrl</kbd>
                  <span className="text-sm text-gray-500">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Enter</kbd>
                </div>
                <span className="text-base">ページ追加</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Ctrl</kbd>
                  <span className="text-sm text-gray-500">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Space</kbd>
                </div>
                <span className="text-base">再生/一時停止</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Ctrl</kbd>
                  <span className="text-sm text-gray-500">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">←</kbd>
                </div>
                <span className="text-base">1秒巻き戻し</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Ctrl</kbd>
                  <span className="text-sm text-gray-500">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">→</kbd>
                </div>
                <span className="text-base">1秒早送り</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex items-center gap-1 w-[180px]">
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Ctrl</kbd>
                  <span className="text-sm text-gray-500">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">Shift</kbd>
                  <span className="text-sm text-gray-500">+</span>
                  <kbd className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded font-mono text-center">V</kbd>
                </div>
                <span className="text-base">歌詞貼り付け</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Other Features */}
      <div className="mb-8">
        <div className="text-xl font-semibold text-foreground mb-4 border-b pb-2">その他の機能</div>

        {/* Text Processing Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-2">歌詞変換</div>
          <div className="text-lg text-gray-700 dark:text-gray-300">
            <div>ページ追加・編集時に以下の変換が自動で行われます：</div>
            <ul className="ml-4 mt-1 list-disc">
              <li>前後のスペース削除</li>
              <li>記号削除</li>
              <li>半角 → 全角変換</li>
              <li>カタカナ → ひらがな変換</li>
            </ul>
          </div>
        </div>

        {/* kpm Information */}
        <div className="mb-6">
          <div className="text-lg font-medium text-foreground mb-2">kpm計算</div>
          <div className="text-lg text-gray-700 dark:text-gray-300">
            <div>打ち切りに必要なkpmをローマ字入力換算で計算します。</div>
            <div className="text-base mt-1 text-gray-700 dark:text-gray-300">※ 実際の打鍵数と誤差が生じる場合があります</div>
          </div>
        </div>
      </div>
    </div>
  )
}