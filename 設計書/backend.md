# API 設計（v1 / MVP）

本ドキュメントは、Travel Expense App のバックエンド API 仕様を定義する。

- バックエンド: FastAPI（Python）
- デプロイ: AWS Lambda + API Gateway HTTP API
- データストア: DynamoDB

MVP のため、一部機能は簡易実装とする。

---

# 0. 共通仕様

## 基本仕様

- **Base URL（本番）**: `https://travel.daisuke-selfstudy.com/`
- 開発環境は別ドメインを利用する（例: `https://travel-dev.daisuke-selfstudy.com/`）。
- リクエスト / レスポンス形式: JSON
- 日時形式: ISO8601 (`2026-05-01T12:34:56Z`)
- ID の形式: UUID もしくは `"trip-xxx"`, `"exp-xxx"` のようなプレフィックス付き文字列を使用  
  （MVP では Python の UUID 標準ライブラリを利用）

## 認証（MVP → 将来）

### MVP（認証なし）

- Cognito が未導入のため、一時的にヘッダから user_id を受け取る簡易実装とする。

例:

```
X-Debug-User-Id: user-123
```

※ 本番では削除する。

### 将来（正式認証）

- Cognito User Pool を利用し、JWT 内の `sub` を user_id として扱う。
- API Gateway の JWT 検証 → Lambda への `user_id` の委譲を行う。

---

# 1. トリップ一覧取得（自分 & 共有）

## `GET /me/trips`

ログインユーザーが参加しているトリップ一覧を取得する。

返却形式は：

- `own_trips`: 自分がオーナーのトリップ
- `shared_trips`: メンバーとして参加している共有トリップ

### レスポンス例

```json
{
  "own_trips": [
    {
      "trip_id": "trip-123",
      "title": "2026 バンコク",
      "country": "TH",
      "start_date": "2026-05-01",
      "end_date": "2026-05-05"
    }
  ],
  "shared_trips": [
    {
      "trip_id": "trip-999",
      "title": "2026 ソウル旅行",
      "country": "KR",
      "start_date": "2026-06-10",
      "end_date": "2026-06-13",
      "owner_name": "友達A"
    }
  ]
}
```

### 詳細仕様

- `TripMembers` を `user_id` で Query する。
- 得られた `trip_id` を元に `Trips` を取得する。
- `role === "owner"` → `own_trips`  
  `role === "member"` → `shared_trips`
- `owner_name` は次のいずれかで取得する：
  - `Trips.owner_id` を利用して `Users.name` を参照
  - （MVP 簡易）固定値や `"owner"` でもよい

### エラー

| ステータス | 意味                         |
| ---------- | ---------------------------- |
| 401        | 将来：未ログイン（JWT 無効） |
| 500        | DynamoDB エラー              |

### ページング

- トリップ数は少ない想定のため、MVP ではページング不要とする。

---

# 2. トリップ作成

## `POST /trips`

ログインユーザーをオーナーとして新しいトリップを作成する。

### リクエスト例

```json
{
  "title": "2026 バンコク旅行",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-05",
  "base_currency": "THB",
  "rate_to_jpy": 4.2
}
```

### レスポンス例

```json
{
  "trip_id": "trip-123",
  "title": "2026 バンコク旅行",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-05",
  "base_currency": "THB",
  "rate_to_jpy": 4.2,
  "owner_id": "user-abc"
}
```

### サーバー処理フロー

1. UUID を生成し `trip_id` とする。
2. `Trips` にレコードを追加する。
3. `TripMembers` に以下のレコードを追加する：

```json
{
  "user_id": "user-abc",
  "trip_id": "trip-123",
  "role": "owner",
  "joined_at": "<ISO8601>"
}
```

### エラー

| ステータス | 意味                     |
| ---------- | ------------------------ |
| 400        | 入力バリデーションエラー |
| 500        | DynamoDB 書き込みエラー  |

---

# 3. トリップ詳細取得

## `GET /trips/{tripId}`

指定トリップの詳細情報を返す。

### レスポンス例

```json
{
  "trip_id": "trip-123",
  "title": "2026 バンコク旅行",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-05",
  "base_currency": "THB",
  "rate_to_jpy": 4.2,
  "owner_id": "user-abc"
}
```

### エラー

| ステータス  | 意味                         |
| ----------- | ---------------------------- |
| 404         | トリップが存在しない         |
| 403（将来） | このトリップを見る権限がない |

---

# 4. トリップメンバー追加（将来機能）

## `POST /trips/{tripId}/members`

共有トリップへ新しいメンバーを追加する機能。  
MVP では実装しないが、将来のため仕様を残しておく。

### リクエスト例

```json
{
  "user_id": "user-friend-1",
  "role": "member"
}
```

---

# 5. 支出一覧取得

## `GET /trips/{tripId}/expenses`

指定トリップの支出一覧を返す。

### レスポンス例

```json
{
  "expenses": [
    {
      "expense_id": "exp-1",
      "trip_id": "trip-123",
      "user_id": "user-abc",
      "amount": 120,
      "currency": "THB",
      "category": "food",
      "note": "屋台ラーメン",
      "datetime": "2026-05-01T12:00:00Z",
      "created_at": "2026-05-01T12:05:00Z"
    }
  ]
}
```

### 詳細仕様

- DynamoDB `Expenses` を PK=`trip_id` で Query する。
- 日本円換算額は以下の方針とする：
  - **MVP**：フロント側で `amount * rate_to_jpy` を計算する。
  - **将来**：バックエンドで `yen_amount` を計算して返す。

### エラー

| ステータス | 意味                  |
| ---------- | --------------------- |
| 404        | トリップが存在しない  |
| 500        | DynamoDB Query エラー |

---

# 6. 支出追加

## `POST /trips/{tripId}/expenses`

新しい支出（Expense）を登録する。

### リクエスト例

```json
{
  "amount": 120,
  "currency": "THB",
  "category": "food",
  "note": "屋台ラーメン",
  "datetime": "2026-05-01T12:00:00Z"
}
```

### レスポンス例

```json
{
  "expense_id": "exp-1",
  "trip_id": "trip-123",
  "user_id": "user-abc",
  "amount": 120,
  "currency": "THB",
  "category": "food",
  "note": "屋台ラーメン",
  "datetime": "2026-05-01T12:00:00Z",
  "created_at": "2026-05-01T12:05:00Z"
}
```

### サーバー処理フロー

1. UUID を生成し `expense_id` を作成する。
2. `user_id` はヘッダ（MVP）または Cognito から取得する。
3. DynamoDB `Expenses` に Put する。

###エラー

| ステータス | 意味                       |
| ---------- | -------------------------- |
| 404        | トリップが存在しない       |
| 400        | 入力のバリデーションエラー |
| 500        | DynamoDB 書き込みエラー    |

---

# 7. 支出削除

## `DELETE /trips/{tripId}/expenses/{expenseId}`

指定した支出を削除する。

### レスポンス

- 成功時: `204 No Content`

### エラー

| ステータス  | 意味             |
| ----------- | ---------------- |
| 404         | 支出が存在しない |
| 403（将来） | 削除権限なし     |

---

# 8. 将来拡張 API（メモ）

これらは MVP 以降に実装予定。

## レシート画像 → OCR

```text
POST /trips/{tripId}/receipts
```

## 為替レート取得

```text
GET /rates?base=THB&target=JPY
```

---

# 9. 設計方針メモ

- GSI は MVP では作成しない。必要に応じて追加する。
- API はできる限り単純な CRUD とし、複雑な計算は基本的にクライアント側で行う。
- 認証は MVP では簡易版とし、将来的に Cognito に置き換える。
