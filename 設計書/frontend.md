# フロントエンド仕様（PWA）

本ドキュメントは Travel Expense App のフロントエンド（PWA）の画面仕様および動作仕様を定義する。

---

# 1. 技術スタック

- React + TypeScript
- Vite（SPA）
- PWA 対応
  - manifest.json
  - service-worker.ts（静的キャッシュ）
- UI はモバイル（iPhone）最適化
- react-router-dom v6 を使用して画面遷移を制御

---

# 2. 画面構成（Routes）

| 画面                           | パス                     | 備考               |
| ------------------------------ | ------------------------ | ------------------ |
| ホーム（トリップ一覧）         | `/`                      | 初期表示           |
| トリップ詳細                   | `/trips/:tripId`         | 支出一覧＋サマリー |
| 支出追加（モーダルまたは画面） | `/trips/:tripId/add`     | モーダルを推奨     |
| 設定                           | `/settings` または詳細内 | レート編集         |

※ MVP のためログイン画面は無し（将来 Cognito 導入時に `/login` を追加）

---

# 3. 画面仕様

## 3.1 ホーム画面（トリップ一覧）

### データ取得

- 初期表示で `GET /me/trips` を実行

### 表示セクション

- あなたのトリップ（own_trips）
- 共有トリップ（shared_trips）

### トリップカード表示項目

- タイトル
- 国
- 期間
- 共有トリップのみオーナー名

### ユーザー操作

- トリップカードタップ → `/trips/:tripId` へ遷移

---

## 3.2 トリップ詳細画面

### データ取得

画面ロード時に以下を実行：

```
GET /trips/{tripId}
GET /trips/{tripId}/expenses
```

### 表示内容

#### トリップ情報

- タイトル
- 国
- 開始日〜終了日
- 基準通貨（base_currency）
- 円レート（rate_to_jpy）

#### サマリー

- 現地通貨合計
- 円換算合計（amount \* rate_to_jpy）

#### 支出一覧

- 日付
- 金額（現地通貨）
- カテゴリ
- メモ
- 日本円換算額
- 削除ボタン

### 操作

- 「支出を追加」ボタン → 支出追加モーダルを表示

---

## 3.3 支出追加モーダル

### 入力項目

- 日付・時刻（初期値：現在時刻）
- 金額（number）
- 通貨（初期値：trip.base_currency）
- カテゴリ（food / transport / hotel / other）
- メモ（任意）

### バリデーション

- 金額：必須・0 以上
- 日付：必須
- カテゴリ：必須

### 保存動作

- `POST /trips/{tripId}/expenses`
- 成功後：
  - モーダルを閉じる
  - 支出一覧を再取得（またはローカル state に push）

---

## 3.4 設定画面（または詳細画面内のセクション）

### 機能

- 円レート（rate_to_jpy）を編集可能
- 保存 API は将来的に PATCH /trips/{tripId} を想定

---

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

---

# 5. 状態管理

MVP では React のローカル state で十分。

以下の場合、Zustand などの小型ストアを利用しても良い：

- オフライン時のローカル保存
- 画面間でトリップ情報を共有したい場合

---

# 6. PWA 要件

## manifest.json 必須項目

- name
- short_name
- start_url="/"
- display="standalone"
- icons（192, 512）

## service-worker.ts

- 静的ファイルキャッシュ
- index.html キャッシュ
- 将来：API キャッシュ、オフライン入力キュー

---

# 7. UI ガイドライン（スマホ最適化）

- ボタンは画面下部に配置
- タップ領域は 44px 以上
- 最小フォントサイズ 14px
- iPhone 幅（375px）で最適化
- 支出一覧は表ではなくカード形式が望ましい

---

# 8. 今後の拡張（メモ）

- OCR によるレシート読み取り
- 割り勘機能
- マルチ通貨管理
- オフライン → 後同期
