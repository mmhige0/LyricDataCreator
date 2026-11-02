# 譜面投稿・承認

## 利用者の操作

1. `/editor/`で作成・プレイ確認し、譜面のインポート・エクスポートと並ぶ「投稿する」を押し、モーダルで制作者名・曲情報を入力して申請する。ログインは不要。申請前の編集は既存のブラウザ下書きで保持する。
2. 申請後は編集URLを控える。投稿者用の管理画面は使わず、同じ操作列の「申請内容を確認」からモーダルを開く。別端末では編集URLを開く。
3. 投稿内容を読み込み、エディターで変更して再申請できる。承認待ちの変更も可能。プレイ画面への切替時も編集画面を非表示で保持し、投稿情報・版番号・未申請の編集内容を維持する。版番号で競合を検出し、他の画面の変更を上書きしない。
4. 承認時は公開用のSongへ譜面TXT・解析済みデータ・YouTube URL・制作者名などを保存し、同じトランザクションで申請を削除する。編集URLは以後使えない。管理者が確認した版より更新されていたら承認は409で止まる。

制作者名は自己申告で本人確認ではない。編集URLは秘密情報で、知る人は修正できる。URLのキーはフラグメントに入れ、読み込み後にURLから除去し、APIにはAuthorizationヘッダーで送る。DBにはハッシュだけ保存する。自動的な再発行・本人確認による復旧はない。第三者へ共有しない。
公開曲の練習画面の「編集する」から、誰でも修正案を申請できる。曲番号は自動で引き継ぎ、管理者が承認時に確認する。投稿者向けの一覧画面は設けず、旧 `/submissions/` はエディターへ転送する。

## 管理者の操作

`/admin/submissions/`でLDC専用の管理用キーを入力し、初期表示の承認待ち一覧から内容を開く。補足情報・TXTの全文・ダウンロード・プレイプレビューで確認し、ゲームの曲番号を指定して承認する。プレビューは既存のプレイ機能と同じく歌詞ページを確認するもので、ポップ演出はTXTまたはゲーム側で確認する。却下しても公開済み版は残る。管理用キーは画面のメモリだけに保持する。

承認によってゲームへの組み込みや公開まで自動化するものではない。承認・ランキング登録の成功を確認してからゲームへ公開する。

申請と公開済みを切り替え、曲番号・曲名・アーティスト・難易度・制作者・状態を表で確認する。検索、状態絞り込み、ページ送りに対応する。申請の「確認・編集」で曲名・アーティスト・難易度・曲番号を同じ画面から編集する。入力順は自由で、曲番号が未定でも「変更を保存」でDBの申請の各列に保存できる。投稿者の元入力は別途保持しない。保存はランキングへ送信せず、申請の版番号を更新して同時編集を検出する。投稿者にも変更後の曲情報が表示され、再申請時は曲名・アーティストなどを更新できる。管理者の曲番号・難易度は維持する。「ランキングに登録」で変更の保存と登録をまとめて行える。却下済みも状態フィルターで確認し、「承認待ちに戻す」で再開できる。却下・復帰も版番号を更新する。公開済みの「修正する」はエディターで新しい修正申請を作る操作。

曲番号入力後に既存の公開API `GET /api/v1/songs/{gameSongId}/rankings?players=1&limit=1` を照会する。プレイ実績がなくても曲情報を取得でき、404だけを未登録と扱う。照会失敗時は承認できない。既存曲の情報を取り込むボタンと更新確認を表示する。承認直前にも照会するが、ランキング側キャッシュや別システムからの同時登録に対する原子的な番号予約ではない。

### 承認の整合性

- ランキングへの仮登録は行わない。未承認の譜面はLDCだけに保存する。
- 曲番号・曲名・アーティスト・難易度の正式情報はランキングDB、譜面TXT・YouTube URL・制作者名はLDCが管理する。
- 初回登録で申請の各列に版・曲番号・曲名・アーティスト・難易度を保存して固定し`publishing`にする。ランキングの既存の曲登録APIで登録が成功したら、同じトランザクションでLDCの公開Songを保存し、申請を削除する。承認済み申請や編集キーのハッシュはDBへ残さない。
- 承認は曲番号・申請ごとのDBロックを取り、ランキングAPIの呼び出しから公開保存・申請削除まで保持する。同じ申請の並行承認による重複送信を防ぐ。同じ曲の別申請が`publishing`の間は、その申請の再試行を先に完了し、別申請の承認を409で止める。
- 通信失敗・結果不明の場合は`publishing`を維持し、その間の編集・却下を禁止する。管理者が同じ版・登録情報で承認を再試行する。ランキング成功後にLDCが失敗しても、再試行で公開処理を完了できる。
- 新規・修正とも既存の`PUT /api/v1/admin/songs/{gameSongId}`を使う。投稿ID・版番号はLDC内だけで管理し、ランキングへ送信・保存しない。ランキング側のコード・DB変更は不要。
- 既存のランキングAPIはUPSERTのため、登録済み番号を指定するとその曲情報を更新する。画面と承認直前のサーバーで重複を確認し、既存曲の場合は「この既存曲を更新する」の明示確認を必須にする。ランキング側で古い版の再送を拒否する仕組みは追加しない。
- 修正版は同じ曲番号・同じ公開Songを更新する。既存の成績は残す。別の曲番号を指定すると、その番号への登録となり、元の公開曲や成績の番号変更・削除は行わない。
- 承認待ちの間だけ公開版と申請中の版を分けて保持する。承認後は公開版だけを残す。全過去版の履歴・復元、自動ゲーム配信は初期実装に含めない。Discordには申請時に通知する。

## 投稿の制限

サーバーで本文を最大160KiB、TXTを128KiB、1000ページ・ポップ1000件、総時間3600秒までに制限する。YouTube URLはHTTPSの動画URLだけを受理し、正規URLへ変換する。任意のURLをサーバーから取得しない。

Turnstileはサーバーで成功・hostname・actionを検証し、未設定・検証エラー時は投稿を受け付けない。

PostgreSQLのトランザクションとadvisory lockを使って、複数のサーバーから同時投稿されても以下の上限を超えないようにする。

| 設定 | 初期値 | 対象 |
|---|---|---|
| `SUBMISSION_DAILY_LIMIT` | 50 | サイト全体の新規投稿・変更の合計／日本時間の1日 |
| `SUBMISSION_TOTAL_LIMIT` | 500 | 保存する申請の総件数。新規投稿だけを停止する |

申請が残っている間は、同じ成功結果の再送は件数を増やさない。承認後に同じ申請への閲覧・変更・承認を再送すると404になる。承認応答を受け取れなかった場合は、管理者が公開曲と申請一覧を確認する。アプリではIPアドレスを取得・保存・ハッシュ化せず、Turnstileにも転送しない。期限切れカウンターと旧IP別カウンターは次の成功投稿時に削除する。

上限はDB保存の増加を抑えるためのもので、HTTPリクエスト自体やTurnstile検証・関数実行を完全に止めるものではない。大量の不正アクセスへの対策はホスティング側のFirewall／Rate Limitingも併用する。承認済み申請は自動削除する。未承認・却下済み投稿の整理や容量確認は運用で行い、全体上限に達したら整理後に再開する。

歌詞・曲名・制作者名の記号はSQL文字列に連結せず、Prismaの値として渡す。画面はReactのテキスト描画を使い、投稿内容をHTMLとして実行しない。譜面TXTの装飾記法・文字制約は既存エディターの規則に従う。

## ランキングAPIとの連携

承認処理はLDCのサーバーから既存の`PUT /api/v1/admin/songs/{gameSongId}`を呼び出す。`RANKING_ADMIN_API_KEY`を`Authorization: Bearer <キー>`として付け、`Content-Type: application/json`で次の曲情報だけを送る。

```json
{"title":"架空の曲名","artist":null,"level":null}
```

曲番号はURLで指定する。管理者が確認・編集した曲名・アーティスト・難易度を送信する。難易度は空欄ならnull。新規登録・既存曲の修正は同じAPIを使い、投稿ID・版番号・譜面本文・YouTube URL・制作者名は送らない。201 `created`、200 `updated`、200 `unchanged`を成功として扱う。応答の曲情報を確認してからLDCの公開処理を完了する。

通信タイムアウト後にランキング側の処理が継続する可能性まで、既存APIだけで完全に排除することはできない。結果不明時は別申請の承認を進めず同じ内容で再試行する。

LDCとランキングのDBをまたぐ1つのトランザクションはないため、ランキングへの登録が一時的に先行する場合がある。失敗時は上記の承認処理中の状態を維持し、同じ曲番号・本文で再試行する。

この呼び出しはサーバーから行うため、ランキング側のCORS変更は不要。公開曲一覧APIからの曲情報の取り込みは、この投稿・承認処理とは別の機能として扱う。

## 導入手順

1. 既存のランキング曲登録APIの管理用キーを用意する。ランキング側のデプロイ・DB移行は不要。
2. LDCのDBバックアップを取得し、既存曲の`gameSongId`が正しいゲーム曲番号で全件設定済みであることを確認してから、`npx prisma migrate deploy`を実行する。今回の1つのマイグレーションで主キーを`gameSongId`へ変更し、旧`id`を削除する。譜面データは保持する。未設定・形式不正・重複があれば旧ID削除前に失敗し、トランザクション全体を戻す。旧内部IDからゲーム曲番号を推測して自動補完しない。

   現行DBに`gameSongId`列がまだない場合は、事前に`ALTER TABLE song ADD COLUMN IF NOT EXISTS "gameSongId" TEXT;`で列を作り、確認済みの曲マスターとの対応で全件設定する。旧`id`とゲーム曲番号が一致するとは限らないので、単純なゼロ埋めで代用しない。移行前に以下を確認する。

   ```sql
   SELECT id, title, "gameSongId" FROM song
   WHERE "gameSongId" IS NULL OR "gameSongId" !~ '^[0-9]{3,8}$' OR "gameSongId" = '000';
   SELECT "gameSongId", COUNT(*) FROM song GROUP BY "gameSongId" HAVING COUNT(*) > 1;
   ```

   両方0件を確認してから移行する。既に旧版の本PRマイグレーションを適用したDBでは、書き換えたマイグレーションを再実行せず、バックアップを基に適用状態を確認する。
3. Turnstileで対象ホストを登録し、以下をVercelの環境変数へ設定する。
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`：公開サイトキー（ビルド時に必要）
   - `TURNSTILE_SECRET_KEY`：秘密キー
   - `TURNSTILE_HOSTNAME`：`ldc.kayomodoki.com`（スキーム・パスなし）
   - `SUBMISSION_ADMIN_KEY`：LDC管理者専用の32文字以上のランダムな秘密情報
   - `RANKING_ADMIN_API_KEY`：ランキング側の管理用キー。公開変数へ入れない
4. DBと必要な環境変数を設定して再デプロイする。投稿受付の有効化スイッチは不要。Turnstile未設定・検証失敗時は投稿を受け付けない。
5. 架空の譜面で投稿・修正・却下・承認・ランキング登録を確認する。公開済み版が承認前に変わらないこと、再試行で重複しないことを確認する。

管理画面なしでも、同じAPIをHTTPクライアントから利用可能。管理者認証は`Authorization: Bearer <SUBMISSION_ADMIN_KEY>`。
- `GET /api/admin/submissions/`：申請の表（20件、`page`・`q`・`status`でページ・検索・状態を指定）。`view=published`で公開曲の表
- `GET /api/admin/ranking-song/?gameSongId=001`：ランキングとLDCの既存曲を照会
- `GET /api/admin/submissions/{id}/`：申請の全文・版番号
- `POST /api/admin/submissions/{id}/`：`{"action":"save","revision":1,"registration":{"gameSongId":"001","title":"曲名","artist":null,"level":"5+"}}`で申請の各列を直接更新。保存時の曲番号は空欄可。`action=approve`で入力内容の保存とランキング登録、既存曲を更新する場合は`allowOverwrite:true`も指定。却下は`{"action":"reject","revision":1}`、復帰は`{"action":"restore","revision":2}`

管理キー・編集URL・投稿全文をアクセスログやエラー調査ログへ保存しない。

## 公開済み曲を修正・再承認する場合

修正したTXTを通常どおり新規申請し、管理者が内容と曲番号を確認して、承認画面で公開曲と同じ`gameSongId`を指定する。承認までは公開中の譜面を維持し、承認時に同じ曲番号の公開曲を更新する。内部IDへの紐付けSQLは不要。承認後は申請を削除し、次の修正は新しい申請にする。

`Song.gameSongId`は文字列の主キーで、`song.id`は持たない。申請側も`gameSongId`だけを持ち、`publishedSongId`・Prismaの関連フィールド・公開曲への外部キーは設けない。新曲にはまだ公開曲が存在しないため、曲番号の形式と承認状態はアプリ側で検証する。申請の曲番号は重複を許し、同じ曲の承認処理を曲番号のDBロックで直列化する。

取り込みAPIは`gameSongId`の文字列を必須とし、曲名ではなく曲番号で追加・更新を判定する。難易度更新APIも`{gameSongId:"001",level:"5+"}`を受け付ける。CLIのCSVは`gameSongId`列、単曲は`--game-song-id 001`を指定する（数字のみのファイル名の場合はその番号を利用可能）。GASも曲番を表示文字列として読み、先頭ゼロを保持して送信する。

## 公開曲一覧の曲番号

曲一覧のNo.表示・番号順の並べ替え・曲番号検索は`Song.gameSongId`を使う。全曲にゲーム曲番号が設定されている前提とする。練習画面のURLも`/songs/001`のように同じ文字列を使用する。従来の内部IDによるURL互換は提供せず、正しいゲーム曲番号のURLへ更新する。先頭ゼロは文字列のまま表示し、並び順は数値で比較する。同じ数値の番号は元の文字列順で比較する（ランキングと同じ）。通常の一覧・ページ分割・ランダム選曲後の並べ替えに適用する。

### 投稿UI

「投稿する」は譜面のインポート・エクスポートと同じ操作列に表示する。必須・任意は括弧を付けず小さなラベルで表示する。難易度の入力欄は設けない。曲名・アーティスト・曲番号は申請の既存列を直接更新し、難易度は申請の `level` 列に保存する。登録情報のJSON列は設けない。難易度は管理画面で設定する。公開Songの `level`・`levelValue` は一覧・検索用に維持する。補足情報は任意の2000文字以内の複数行入力で、承認後は公開Songにも保存し、練習画面の「補足情報」から閲覧できる。修正時にも引き継ぐ。ランキング・譜面TXTには含めない。曲情報はモーダルで入力し、曲名とYouTube URLはエディターから補完する。閉じる・プレイへの切替で未送信の情報は消えない。同一ページ内での保持であり、再読み込みをまたぐ入力保存ではない。
申請後は編集用リンクをコピーできる。内部の版番号は表示しない。編集用リンクを開いた初回のみ「編集を始める」で申請を読み込み、その後は再読み込みせず確認・再申請する。
公開曲の練習画面の「編集する」から修正案を作成できる。曲番号は自動で引き継ぎ、管理者が承認時に確認する。元の制作者名を修正投稿者として自動入力しない。TXT未保存の旧曲は解析済みページから復元するため、ポップ情報の完全な復元には元TXTの再取り込みが必要。

## ローカルで投稿を確認する

今回のマイグレーションは `20261029000000_chart_submissions` の1つにまとめている。未適用のDBでは最新ブランチで次を実行する。

```sh
npm ci
npx prisma migrate deploy
npx prisma generate
```

旧版の同名マイグレーションを適用済みの開発用DBには、`migrate deploy`を再実行しても補足情報・申請の難易度列や登録情報の列変更は反映されない。データを保持する場合は、DBのSQLエディターで次を一度実行してから `npx prisma generate` を実行する。

```sql
ALTER TABLE "chart_submission" ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "song" ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "chart_submission" ADD COLUMN IF NOT EXISTS "level" TEXT;

-- 旧版の管理者による変更を各列へ引き継いでからJSON列を削除する。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'chart_submission'
      AND column_name = 'registrationData'
  ) THEN
    EXECUTE 'UPDATE chart_submission SET
      title = "registrationData"->>''title'',
      artist = "registrationData"->>''artist'',
      "gameSongId" = "registrationData"->>''gameSongId'',
      level = "registrationData"->>''level''
      WHERE "registrationData" IS NOT NULL AND "registrationData" <> ''null''::jsonb';
  END IF;
END $$;
ALTER TABLE "chart_submission" DROP COLUMN IF EXISTS "registrationData";
DELETE FROM "submission_quota" WHERE "key" LIKE 'ip:%';
```

このSQLは主キー変更まで適用済みの開発DB向け。旧コードで`publishing`の申請がある場合は、更新前に同じ内容で再試行を完了する。旧処理の登録内容を推測して補完しない。実行前に開発サーバーを停止し、最新版コードと一緒に適用する。適用済みファイルをまとめ直したため、今後 `prisma migrate dev` では履歴の変更を検出する場合がある。開発データを消してよい場合は `prisma migrate reset` で作り直せるが、データを保持したい場合は実行しない。

Prisma CLIは `.env` の `DATABASE_URL` を使う。Next.js用の `.env.local` に別の接続先がある場合は同じ開発用DBを指定する。

`.env.local` に以下を設定する。既に同じ変数がある場合は置き換える。公開サイトキーと秘密キーは [Cloudflare公式の成功用テストキー](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) で、Cloudflareへの登録は不要。

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_HOSTNAME=localhost
SUBMISSION_ADMIN_KEY=ここを32文字以上のランダム文字列に置き換える
RANKING_ADMIN_API_KEY=
SUBMISSION_DAILY_LIMIT=500
```

秘密情報は次のコマンドで生成できる。

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run dev
```

`http://localhost:3000/editor/`でYouTube URLと1ページ以上の譜面を用意し、「投稿する」から必須情報を入れて申請する。Turnstileは成功するテスト表示になる。申請後は編集用リンクをコピーし、情報・補足情報の修正と再申請を確認できる。
`http://localhost:3000/admin/submissions/`で `SUBMISSION_ADMIN_KEY` と同じ値を入力すると、申請・補足情報の確認と却下ができる。

テストキーのhostname/actionに対する例外は `npm run dev` の開発環境と公式の成功用テスト秘密キー・ダミートークンの組合せだけで有効。Siteverifyへの通信と成功判定は省略しない。本番では通常のhostname/action検証を行う。環境変数を変更したら開発サーバーを再起動する。

投稿・再申請・閲覧・却下にはランキングのキーは不要。**承認処理の接続先は本番の `ranking.kayomodoki.com` なので、ローカル確認では `RANKING_ADMIN_API_KEY` を空欄にし、承認は行わない。** ランキング連携まで確認するには、テスト用接続先への対応を別途用意する。

## Discordへの申請通知

Discordの通知先チャンネルでIncoming Webhookを作成し、サーバー専用の環境変数 `DISCORD_SUBMISSION_WEBHOOK_URL` にURLを設定する。空欄では通知せず、申請機能だけを利用できる。公開変数には設定しない。通常のテキストチャンネルのWebhook、または既存スレッドを指定したWebhook URLを利用する。フォーラムへの新規スレッド作成には対応しない。

新規申請・再申請のDB保存後に、ゲーム参加者全員に向けて曲名 → アーティスト → YouTube URL → 制作者の順で共有する。補足情報を続け、譜面TXTを`chart.txt`として添付する。管理画面URL・内部の申請ID・版番号・編集用キー・管理用キーは送信しない。Discord側に送信済みのTXT・補足情報・メッセージは承認後も残る。投稿モーダルにも共有範囲を明記する。

通知のHTTPリクエストは最大5秒待つ。Webhookの送信確認を有効にし、メンションは無効化する。通知失敗時も申請保存は成功し、投稿画面に案内を表示する。管理画面の「Discordへ再送」で、その時点の版を管理者が再送できる。通常の申請APIの同一内容の再試行では通知を重複送信しない。自動再送キューは設けないため、保存直後のサーバー停止などで未通知になる場合は管理画面で確認・再送する。タイムアウト時はDiscord側で送信済みの場合もあり、手動再送で重複する可能性がある。Webhook URL・応答本文・投稿全文はログに出さない。

ローカルで通知も確認する場合は、テスト用チャンネルのWebhookを `.env.local` に設定して開発サーバーを再起動する。

```dotenv
DISCORD_SUBMISSION_WEBHOOK_URL=https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
```

API仕様：[Discord Execute Webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook)
