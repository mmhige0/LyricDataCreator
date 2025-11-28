# Lyric Data Creator

YouTube 動画に合わせて歌詞のタイミングデータを作成する Web アプリケーションです。

## デモ

- GitHub Pages（旧運用）: https://mmhige0.github.io/LyricDataCreator/
- Vercel: 移行検証中（このブランチで準備）

## デプロイ

- Vercel を前提に `basePath` / `assetPrefix` を撤廃し、標準の `next build` でデプロイします。
- 本番相当の動作確認は `npm run preview`（`next build` -> `next start`）で行えます。
- 非ルート配下に置く場合は `NEXT_PUBLIC_BASE_PATH` を指定して静的アセット参照パスを上書きできます。
