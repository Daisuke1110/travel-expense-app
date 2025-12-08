# API 設計 / MVP

Travel Expense App のバックエンド API 仕様（MVP）。  
- フレームワーク: FastAPI + Python  
- デプロイ: AWS Lambda + API Gateway HTTP API  
- データストア: DynamoDB（Users / Trips / TripMembers / Expenses）  
- GSI: TripMembers(GSI1: PK=trip_id, SK=user_id), Expenses(GSI1: PK=expense_id) は MVP から作成

---

# 0. 共通仕様
## 基本仕様
- Base URL 例: `https://travel-api.daisuke-selfstudy.com/`（dev は別ドメイン）
- リクエスト/レスポンス: JSON
- 日付: ISO8601 UTC (`2026-05-01T12:34:56Z`)。`datetime` は UTC、`start_date/end_date` はトリップ現地日付として扱う。
- ID: UUID または `"trip-xxx"`, `"exp-xxx"` 形式
- 金額: 通貨の最小単位の整数のみ受け付ける。小数を送った場合は 400 を返し、自動丸めはしない。
- 通貨: MVP では `Trips.base_currency` と一致しない `currency` を受け取った場合は 400 を返す。

## 認証 / MVP と将来
- MVP: 認証なし。デバッグヘッダ `X-Debug-User-Id: user-123` で user_id を受け取る（本番前に削除）。
- 将来: Cognito User Pool + JWT を API Gateway で検証し、`sub` を `user_id` として渡す。

## 権限 / 認可（MVP から実装）
- TripMembers に存在するユーザーのみ、そのトリップの閲覧・支出追加/削除/編集が可能。
- owner のみ: トリップ更新（タイトル/期間/レートのみ。基準通貨は変更不可）、トリップ削除、メンバー追加。
- member/owner: 支出の追加・削除・編集。

## owner_name のフォールバック
- `Trips.owner_id` から Users を参照し、未登録時は `"owner"` を返す。

---

# 1. トリップ一覧取得（自分 & 共有）
## `GET /me/trips`
ログインユーザーが参加しているトリップ一覧を取得する。
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
      "owner_name": "owner"
    }
  ],
  "shared_trips": [
    {
      "trip_id": "trip-999",
      "title": "2026 ソウル",
      "country": "KR",
      "start_date": "2026-06-10",
      "end_date": "2026-06-13",
      "owner_name": "友達A"
    }
  ]
}
```
### 詳細仕様
- `TripMembers` を `user_id` で Query し、得た `trip_id` で `Trips` を BatchGet。
- `role === "owner"` を `own_trips`、`role === "member"` を `shared_trips` に分類。
- `owner_name`: Users.name を参照し、無ければ `"owner"` を返す。
- `TripMembers` に存在しない `trip_id` は返さない。
### エラー
| ステータス | 意味 |
| --- | --- |
| 401 | 将来: 未ログイン / JWT 無効 |
| 500 | DynamoDB エラー |
### ページング
- 件数が少ない前提のため、MVP ではなし。

---

# 2. トリップ作成
## `POST /trips`
ログインユーザーをオーナーとしてトリップを作成する。
### リクエスト例
```json
{
  "title": "2026 バンコク",
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
  "title": "2026 バンコク",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-05",
  "base_currency": "THB",
  "rate_to_jpy": 4.2,
  "owner_id": "user-abc",
  "owner_name": "owner"
}
```
### サーバー処理フロー
1. UUID を生成し `trip_id` とする。
2. `Trips` にレコードを追加。
3. `TripMembers` に (user_id, trip_id, role="owner", joined_at) を追加。
### エラー
| ステータス | 意味 |
| --- | --- |
| 400 | 入力バリデーションエラー |
| 500 | DynamoDB 書き込みエラー |

---

# 3. トリップ詳細取得
## `GET /trips/{tripId}`
指定トリップの詳細情報を返す。
### レスポンス例
```json
{
  "trip_id": "trip-123",
  "title": "2026 バンコク",
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
| ステータス | 意味 |
| --- | --- |
| 404 | トリップが存在しない |
| 403 | 権限なし（TripMembers に存在しない） |

---

# 4. トリップ更新（タイトル/期間/レート）
## `PATCH /trips/{tripId}`
トリップのメタデータを更新する。オーナーのみ。指定フィールドのみ部分更新。
### リクエスト例
```json
{
  "title": "2026 バンコク 改",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-06",
  "rate_to_jpy": 4.5
}
```
### レスポンス例
```json
{
  "trip_id": "trip-123",
  "title": "2026 バンコク 改",
  "country": "TH",
  "start_date": "2026-05-01",
  "end_date": "2026-05-06",
  "base_currency": "THB",
  "rate_to_jpy": 4.5,
  "owner_id": "user-abc",
  "owner_name": "owner"
}
```
### サーバー処理フロー
1. `TripMembers` で `role = "owner"` を確認し、オーナー以外は 403。
2. `base_currency` は更新不可。リクエストに含まれ現在値と異なる場合は 400 を返す。
3. `Trips` の対象フィールドを Update。
4. 過去の支出は再計算しない。表示時に最新の `rate_to_jpy` で換算する旨をクライアントへ明示。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | トリップが存在しない |
| 403 | オーナー以外が更新 |
| 400 | 入力バリデーションエラー / 基準通貨変更要求 |
| 500 | DynamoDB 更新エラー |

---

# 5. トリップ削除
## `DELETE /trips/{tripId}`
トリップを削除する。オーナーのみ。
### 挙動
- `Trips` の該当レコードを削除。
- `TripMembers` は GSI1 (PK=trip_id) で Query し、該当メンバーを削除。
- `Expenses` は `trip_id` で Query し、該当支出をページネーションしつつバッチで削除。
- 部分失敗時は 500 を返し、ログに残して再実行できるようにする。冪等性のため、削除対象を列挙しながら進捗ログを出し、再実行時は残存レコードのみ削除する。将来はソフトデリート／バッチのバックグラウンド削除も検討。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | トリップが存在しない |
| 403 | オーナー以外が削除 |
| 500 | DynamoDB 削除エラー |

---

# 6. トリップメンバー追加（MVP）
## `POST /trips/{tripId}/members`
共有トリップへ新しいメンバーを追加する。オーナーのみ（user_id 直接入力）。
### リクエスト例
```json
{
  "user_id": "user-friend-1",
  "role": "member"
}
```
### サーバー処理フロー
1. `TripMembers` で `role = "owner"` を確認し、オーナー以外は 403。
2. `TripMembers` に (user_id, trip_id, role="member") を Put。重複時は 409。
3. `Users` に `user_id` が無くても登録は行う。表示時は `"member"` などにフォールバック。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | トリップが存在しない |
| 403 | オーナー以外が追加 |
| 409 | すでに同じユーザーが参加済み |
| 400 | 入力バリデーションエラー |
| 500 | DynamoDB 書き込みエラー |

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
- DynamoDB `Expenses` を PK=`trip_id` で Query。SK=`datetime_expense_id` で昇順取得。
- `Expenses.currency` は MVP では `Trips.base_currency` と一致必須（異通貨は 400）。
- 金額は通貨の最小単位の整数。日時は ISO8601 UTC。表示時のローカライズはフロントで実施。
- 換算額は MVP ではクライアントで `amount * rate_to_jpy` 計算。将来はバックエンドで `yen_amount` を返すことも検討。
- `TripMembers` に存在しないユーザーは閲覧不可（403）。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | トリップが存在しない |
| 403 | 権限なし |
| 500 | DynamoDB Query エラー |

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
  "datetime_expense_id": "2026-05-01T12:00:00Z#exp-1",
  "created_at": "2026-05-01T12:05:00Z"
}
```
### サーバー処理フロー
1. UUID を生成し `expense_id` とする。
2. `user_id` はヘッダ（MVP）または Cognito から取得。
3. `datetime_expense_id = "<datetime>#<expense_id>"` を作成し、`Expenses` に Put。
4. `TripMembers` に存在するユーザーのみ追加可能。member/owner は追加可。
5. `amount` は整数。`currency` は `Trips.base_currency` と一致するかバリデーション。小数入力や異通貨は 400。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | トリップが存在しない |
| 403 | 権限なし |
| 400 | 入力バリデーションエラー |
| 500 | DynamoDB 書き込みエラー |

---

# 9. 支出削除
## `DELETE /trips/{tripId}/expenses/{expenseId}`
指定した支出を削除する。
### レスポンス
- 成功時は `204 No Content`
### サーバー処理フロー
1. GSI1 (PK=`expense_id`) で対象を特定し、`trip_id` と `datetime_expense_id` を取得。
2. `TripMembers` に存在するユーザーかを確認（member/owner 可）。
3. DynamoDB から該当アイテムを削除。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | 支出が存在しない |
| 403 | 削除権限なし |
| 500 | DynamoDB 削除エラー |

---

# 10. 支出編集
## `PATCH /trips/{tripId}/expenses/{expenseId}`
指定した支出を更新する（amount/category/note/datetime）。
### サーバー処理フロー
1. GSI1 (PK=`expense_id`) で `expense_id` を引き当て、`trip_id` と `datetime_expense_id` を取得。
2. `TripMembers` に存在するユーザーかを確認（member/owner 可）。
3. DynamoDB は PK/SK を直接更新できないため、`datetime` 変更時は再書き込みする。既存を取得→新しい `datetime_expense_id` を計算→新アイテムを Put→旧アイテムを Delete。
4. 変更後の `currency` は `Trips.base_currency` と一致必須（MVP）。
### エラー
| ステータス | 意味 |
| --- | --- |
| 404 | 支出が存在しない |
| 403 | 更新権限なし |
| 400 | 入力バリデーションエラー |
| 500 | DynamoDB 更新エラー |

---

# 11. 将来拡張 API（メモ）
- レシート画像 → OCR: `POST /trips/{tripId}/receipts`
- 為替レート取得: `GET /rates?base=THB&target=JPY`

---

# 12. 設計方針メモ
- TripMembers/Expenses の GSI1 は MVP で作成し、メンバー一覧・編集/削除に利用。
- 複雑な計算は基本クライアント側で実施（換算など）。将来、サーバー側で `yen_amount` を返すオプションを検討。
- 認証は MVP では簡易版とし、将来 Cognito に置き換える。
- トリップ日付（start/end）は現地日付の文字列として扱う。`datetime` は UTC 固定で保存する。
