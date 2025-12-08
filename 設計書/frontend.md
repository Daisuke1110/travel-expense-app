# フロントエンド仕様（PWA）

Travel Expense App のフロントエンド（PWA）の画面・動作仕様を定義する。
---

# 1. 技術スタック
- React + TypeScript + Vite
- PWA 対応: manifest.json, service-worker.ts（静的キャッシュのみ）
- UI はモバイル（iPhone）最適化
- react-router-dom v6 で画面遷移
- MVP: ログイン画面なし。API 呼び出し時に `X-Debug-User-Id` ヘッダで user_id を指定する。

# 2. 画面構成 / Routes
| 画面 | パス | 備考 |
| --- | --- | --- |
| ホーム（トリップ一覧） | `/` | 初期表示 |
| トリップ詳細 | `/trips/:tripId` | 支出一覧 + サマリー + オーナー設定 |
| 支出追加モーダル/画面 | `/trips/:tripId/add` | モーダル推奨 |
| （設定セクション） | 詳細画面内にセクション表示 | レート/タイトル/期間の編集（基準通貨は表示のみ）、メンバー追加（オーナーのみ） |

※ MVP のためログイン画面は無し（将来 Cognito 導入時に `/login` を追加）

# 3. 画面仕様
## 3.1 ホーム画面（トリップ一覧）
- 初期表示で `GET /me/trips` を実行
- 表示セクション: own_trips（自分が owner）、shared_trips（member）
- カード表示: タイトル/国/期間、共有トリップは owner_name も表示
- カードタップで `/trips/:tripId` へ遷移

## 3.2 トリップ詳細画面
- 画面ロード時: `GET /trips/{tripId}` と `GET /trips/{tripId}/expenses` を実行
- トリップ情報: タイトル/国/開始日-終了日/基準通貨/レート(rate_to_jpy)/owner_name
- サマリー: 現地通貨合計、日本円換算合計（amount * rate_to_jpy）
  - 支出一覧: 日時/金額/カテゴリ/メモ/円換算額/削除ボタン（削除は expense_id をキー）
- 操作: 「支出を追加」ボタンでモーダル表示
- 権限表示: レート編集やトリップ編集・メンバー追加操作は owner のみ、支出追加・削除は member/owner で表示
  - オーナー用設定セクション: タイトル/期間/レート編集（基準通貨は表示のみ）、メンバー追加フォーム（user_id を入力し `POST /trips/{tripId}/members` へ送信）

## 3.3 支出追加モーダル
  - 入力項目: 日付・時刻(既定=現在, UTC 保存), 金額(number), 通貨(既定=trip.base_currency かつ固定), カテゴリ(food/transport/hotel/other), メモ(任意)
- バリデーション: 金額は 0 より大きい整数（通貨の最小単位）。小数入力はエラーとし自動丸めしない。日付/カテゴリは必須
- 保存: `POST /trips/{tripId}/expenses` 成功後にモーダルを閉じ、一覧を再取得または state に反映
- 削除: `DELETE /trips/{tripId}/expenses/{expenseId}` を利用（expense_id で一意に指定）
- 編集（将来または早期実装推奨）: `PATCH /trips/{tripId}/expenses/{expenseId}` で amount/category/note/datetime を更新し、datetime 変更時は datetime_expense_id を再計算

## 3.4 設定/詳細内セクション（レート編集）
- 機能: rate_to_jpy を編集（owner のみ）。**base_currency は MVP では変更不可**のため表示のみで編集 UI は出さない。
- 保存先 API: `PATCH /trips/{tripId}`（MVP 追加）
- レート変更後も過去支出はそのまま。表示時に最新レートで換算する旨を UI 文言で示す（履歴レート非保持）

# 4. コンポーネント構造（推奨）
```
src/
  components/
    TripCard.tsx
    ExpenseItem.tsx
    SummaryBox.tsx
  pages/
    HomePage.tsx
    TripDetailPage.tsx
    AddExpenseModal.tsx
  api/
    client.ts
    trips.ts
    expenses.ts
  hooks/
    useTrips.ts
    useExpenses.ts
```

# 5. 状態管理
- MVP では React のローカル state で十分。
- オフライン入力や画面間共有が増えたら Zustand など小型ストアを検討。

# 6. PWA 要件
- manifest: name, short_name, start_url="/", display="standalone", icons(192,512)
- service-worker: 静的ファイルキャッシュ、index.html キャッシュ、将来 API キャッシュ/オフライン入力キューを検討

# 7. UI ガイドライン（スマホ最適化）
- ボタンは画面下部に配置
- タップ領域は 44px 以上
- 最小フォントサイズ 14px
- iPhone 幅 375px を基準に最適化
- 支出一覧はカード形式を推奨

# 8. 今後の拡張メモ
- OCR によるレシート読み取り
- 割り勘機能
- マルチ通貨管理・レート履歴
- オフライン入力と後同期

# 9. オフライン時の動作・表示方針
- API 呼び出しがオフラインで失敗した場合: 「現在オフラインです。接続が回復したら自動的に同期します」を表示
- 入力はローカルキュー（IndexedDB など）に保存し、オンライン復帰時に同期する（将来対応）
- MVP では静的キャッシュのみ。同期キューはプレースホルダーとして UI 文言を先に用意しておく
