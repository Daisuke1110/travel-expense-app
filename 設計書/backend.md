# API 設計（v1 / MVP）

本ドキュメントは Travel Expense App のバックエンド API 仕様を定義する。

- バックエンド: FastAPI + Python
- デプロイ: AWS Lambda + API Gateway HTTP API
- データストア: DynamoDB（Users / Trips / TripMembers / Expenses）
- GSI: TripMembers(GSI1: PK=trip_id, SK=user_id), Expenses(GSI1: PK=expense_id) を MVP で作成する
- MVP のため、一部機能は簡易実装とする

---

# 0. 共通仕様

## 基本仕様

- Base URL（本番案）: `https://travel-api.daisuke-selfstudy.com/`
- 開発環境は別ドメインを利用（例: `https://travel-api-dev.daisuke-selfstudy.com/`）
- リクエスト/レスポンス形式: JSON
- 日時形式: ISO8601 (`2026-05-01T12:34:56Z`)
- ID 形式: UUID もしくは `"trip-xxx"`, `"exp-xxx"` のようなプレフィックス付き文字列

## 認証（MVP → 将来）

### MVP: 認証なし

- Cognito 未導入のため、一時的にヘッダから user_id を受け取る簡易実装とする

```
X-Debug-User-Id: user-123
```

※ 本番では削除する

### 将来: 正式認証

- Cognito User Pool + JWT 検証を追加し、`sub` を `user_id` として扱う
- API Gateway で JWT 検証を行い、Lambda に `user_id` を委譲

## 権限・認可（MVP から必須）

- TripMembers に存在するユーザーだけが、そのトリップの閲覧・支出追加/削除/編集を行える
- owner のみ: トリップの更新（タイトル/期間/レート/基準通貨）、トリップ削除、メンバー追加
- member/owner: 支出の追加・削除・編集

---

# 1. トリップ一覧取得（自分 & 共有）

## `GET /me/trips`

ログインユーザーが参加しているトリップ一覧を取得する。

返却形式:

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
      "end_date": "2026-05-05",
      "owner_name": "あなた"
    }
  ],
  "shared_trips": [
    {
      "trip_id": "trip-999",
      "title": "2026 ソウル旅",
      "country": "KR",
      "start_date": "2026-06-10",
      "end_date": "2026-06-13",
      "owner_name": "友達A"
    }
  ]
}
```

### 詳細仕様

- `TripMembers` を `user_id` で Query する
- 得られた `trip_id` を元に `Trips` を取得する
- `role === "owner"` → `own_trips` / `role === "member"` → `shared_trips`
- `owner_name` は `Trips.owner_id` を利用して `Users.name` を参照し、該当がない場合は `"owner"` を返す
- `TripMembers` に存在しない `trip_id` は返さず、未参加トリップを閲覧できないようにする（MVP から 403 を返す）

### エラー

| ステータス | 意味                        |
| ---------- | --------------------------- |
| 401        | 将来: 未ログイン / JWT 無効 |
| 500        | DynamoDB エラー             |

### ページング

- トリップ数は少ない想定のため、MVP ではペジング不要

---

# 2. トリップ作成

## `POST /trips`

ログインユーザーをオーナーとして新しいトリップを作成する。

### リクエスト例

```json
{
  "title": "2026 バンコク旅",
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
  "title": "2026 バンコク旅",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-05",
  "base_currency": "THB",
  "rate_to_jpy": 4.2,
  "owner_id": "user-abc",
  "owner_name": "あなた"
}
```

### サーバー処理フロー

1. UUID を生成し `trip_id` とする
2. `Trips` にレコードを追加
3. `TripMembers` に以下を追加

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
  "owner_id": "user-abc",
  "owner_name": "友達A"
}
```

### エラー

| ステータス  | 意味                                                    |
| ----------- | ------------------------------------------------------- |
| 404         | トリップが存在しない                                    |
| 403         | このトリップを見る権限がない（TripMembers に無い user） |

---

# 4. トリップ更新（タイトル/期間/基準通貨/レート）

## `PATCH /trips/{tripId}`

トリップのメタデータを更新する。オーナーのみ実行可能。指定フィールドのみ部分更新する。

### リクエスト例

```json
{
  "title": "2026 バンコク旅行",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-06",
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
  "end_date": "2026-05-06",
  "base_currency": "THB",
  "rate_to_jpy": 4.2,
  "owner_id": "user-abc",
  "owner_name": "あなた"
}
```

### サーバー処理フロー

1. `TripMembers` で `role = "owner"` を確認し、オーナー以外は 403 を返す
2. `Trips` の指定フィールドを Update する
3. 過去の支出は再計算しない（表示時に最新の `rate_to_jpy` で換算）

### エラー

| ステータス  | 意味                     |
| ----------- | ------------------------ |
| 404         | トリップが存在しない     |
| 403         | オーナー以外の更新       |
| 400         | 入力バリデーションエラー |
| 500         | DynamoDB 更新エラー      |

---

# 5. トリップ削除

## `DELETE /trips/{tripId}`

トリップを削除する。オーナーのみ実行可能。

### 挙動

- `Trips` の該当レコードを削除
- `TripMembers` の該当メンバーも削除（GSI1 で `trip_id` を Query）
- `Expenses` の該当支出も削除（PK=trip_id で Query して削除）
- 将来、ソフトデリートや履歴保持を検討

### エラー

| ステータス  | 意味                     |
| ----------- | ------------------------ |
| 404         | トリップが存在しない     |
| 403         | オーナー以外の削除       |
| 500         | DynamoDB 削除エラー      |

---

# 6. トリップメンバー追加（MVP）

## `POST /trips/{tripId}/members`

共有トリップへ新しいメンバーを追加する。MVP ではオーナーが user_id を直接入力する簡易仕様。

### リクエスト例

```json
{
  "user_id": "user-friend-1",
  "role": "member"
}
```

### サーバー処理フロー

1. `TripMembers` で `role = "owner"` を確認し、オーナー以外は 403
2. `TripMembers` に (user_id, trip_id, role="member") を Put（重複時は 409 を返す想定）
3. `Users` に `user_id` が無い場合は追加せず、フロント表示時は `"member"` などにフォールバック（Users.name はローカル登録前提）

### エラー

| ステータス | 意味                                    |
| ---------- | --------------------------------------- |
| 404        | トリップが存在しない                    |
| 403        | オーナー以外の追加                      |
| 409        | すでに同じユーザーが参加済み            |
| 400        | 入力バリデーションエラー                |
| 500        | DynamoDB 書き込みエラー                 |

---

# 7. 支出一覧取得

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
      "datetime_expense_id": "2026-05-01T12:00:00Z#exp-1",
      "created_at": "2026-05-01T12:05:00Z"
    }
  ]
}
```

### 詳細仕様

- DynamoDB `Expenses` を PK=`trip_id` で Query する
- SK は `datetime_expense_id = "<datetime>#<expense_id>"` として保存し、同一日時の重複を防ぎ、編集/削除時に一意に特定する
- Expenses.currency は MVP では Trips.base_currency に固定（異通貨入力は不可）
- 金額は通貨の最小単位の整数（小数は切り捨て）
- 日時は ISO8601 UTC で扱う（保存は UTC 固定、表示時にローカライズ）
- 日本円換算額は以下の方針とする
  - MVP: フロントで `amount * rate_to_jpy` を計算する
  - 将来: バックエンドで `yen_amount` を計算して返す
- `user_id` が `TripMembers` にない場合は 403 を返し、参加していないトリップの支出は閲覧できないようにする

### エラー

| ステータス | 意味                  |
| ---------- | --------------------- |
| 404        | トリップが存在しない  |
| 403        | 権限なし              |
| 500        | DynamoDB Query エラー |

---

# 8. 支出追加

## `POST /trips/{tripId}/expenses`

新しい支出（Expense）を登録する。

### リクエスト例

```json
{
  "amount": 120,
  "currency": "THB",
  "category": "food",
  "note": "屋台ラーメン",
  "datetime": "2026-05-01T12:00:00Z" // SK として保存
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
  "datetime_expense_id": "2026-05-01T12:00:00Z#exp-1",
  "created_at": "2026-05-01T12:05:00Z"
}
```

### サーバー処理フロー

1. UUID を生成し `expense_id` を作成する
2. `user_id` はヘッダ（MVP）または Cognito から取得する
3. `datetime_expense_id = "<datetime>#<expense_id>"` を組み立て、DynamoDB `Expenses` に Put する
4. `TripMembers` に存在するユーザーのみ追加可能（メンバー/オーナーは追加可）
5. `amount` は通貨の最小単位の整数で受け付ける（小数なし）
6. `currency` は Trips.base_currency と一致することをバリデーションする（MVP）

### エラー

| ステータス | 意味                       |
| ---------- | -------------------------- |
| 404        | トリップが存在しない       |
| 403        | 権限なし                   |
| 400        | 入力・バリデーションエラー |
| 500        | DynamoDB 書き込みエラー    |

---

# 9. 支出削除

## `DELETE /trips/{tripId}/expenses/{expenseId}`

指定した支出を削除する。

### レスポンス

- 成功時: `204 No Content`

### サーバー処理フロー

1. GSI1 (PK=`expense_id`) で対象を特定し、`trip_id` + `datetime_expense_id` を取得
2. `TripMembers` に存在するユーザーかを確認（member/owner 可）
3. DynamoDB から該当アイテムを削除

### エラー

| ステータス  | 意味                                    |
| ----------- | --------------------------------------- |
| 404         | 支出が存在しない                        |
| 403         | 削除権限なし（TripMembers にない user） |
| 500         | DynamoDB 削除エラー                     |

---

# 10. 支出編集

## `PATCH /trips/{tripId}/expenses/{expenseId}`

指定した支出を更新する（amount/category/note/datetime）。

### サーバー処理フロー

1. GSI1 (PK=`expense_id`) で `expense_id` を引き当て、`trip_id` と `datetime_expense_id` を取得する
2. `TripMembers` に存在するユーザーかを確認し、参加者以外なら 403
3. 更新後の `datetime` が変わる場合は新しい `datetime_expense_id` を計算する（`<datetime>#<expense_id>`）
4. DynamoDB の該当アイテムを Update する

### エラー

| ステータス  | 意味                                    |
| ----------- | --------------------------------------- |
| 404         | 支出が存在しない                        |
| 403         | 更新権限なし（TripMembers にない user） |
| 400         | 入力バリデーションエラー                |
| 500         | DynamoDB 更新エラー                     |

---

# 11. 将来拡張 API（メモ）

MVP 以降に実装予定。

## レシート画像 → OCR

```
POST /trips/{tripId}/receipts
```

## 為替レート取得

```
GET /rates?base=THB&target=JPY
```

---

# 12. 設計方針メモ

- TripMembers/Expenses の GSI1 は MVP で作成し、編集・削除・メンバー一覧取得に利用する
- API は単純な CRUD とし、複雑な計算は基本的にクライアント側で行う
- 認証は MVP では簡易版とし、将来 Cognito に置き換える
