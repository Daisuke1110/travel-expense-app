# データモデル設計

本システムでは、以下の 4 テーブルを DynamoDB に作成する。

- Users
- Trips
- TripMembers
- Expenses

将来的に Cognito と連携し、ユーザー ID として Cognito の `sub` を利用する。

---

## 1. Users テーブル

### 用途

- アプリ内ユーザー情報を保持する。
- ログインに使用する ID（Cognito `sub`）と表示名などを管理する。

### スキーマ

- テーブル名: `Users`
- パーティションキー (PK): `user_id` (String)

| 属性名     | 型     | 説明                                   |
| ---------- | ------ | -------------------------------------- |
| user_id    | String | ユーザー ID。Cognito の `sub` を想定。 |
| name       | String | 表示名                                 |
| email      | String | メールアドレス                         |
| created_at | String | 作成日時 (ISO8601 文字列)              |

将来、他の属性（アイコン URL など）を追加する余地を残す。

### 備考

- MVP では必須ではないが、将来ユーザー名やアイコンなどアプリ独自のプロフィール情報を
  管理するための拡張ポイントとして用意しておく。

---

## 2. Trips テーブル

### 用途

- 1 つの海外旅行（トリップ）に関する情報を保持する。

### スキーマ

- テーブル名: `Trips`
- パーティションキー (PK): `trip_id` (String)

| 属性名        | 型     | 説明                                  |
| ------------- | ------ | ------------------------------------- |
| trip_id       | String | トリップ ID（UUID など）              |
| owner_id      | String | トリップ作成者の user_id              |
| title         | String | トリップ名（例: 2026 バンコク旅行）   |
| country       | String | 国コードまたは国名（例: "TH"）        |
| start_date    | String | 開始日 (ISO8601, 例: "2026-05-01")    |
| end_date      | String | 終了日 (ISO8601)                      |
| base_currency | String | 基準通貨（例: "THB", "USD"）          |
| rate_to_jpy   | Number | 1 基準通貨あたりの円レート（例: 4.2） |
| created_at    | String | 作成日時 (ISO8601)                    |

### 備考

- `owner_id` と `created_at` をキーにした GSI (GSI1) を追加して、  
  「ユーザーが作成したトリップ一覧」を高速に取得できるようにすることも検討する。
- GSI はパフォーマンス要件を見てから追加する。
  MVP の段階では作成しない前提とする。
- 当面はトリップごとに 1 つの基準通貨 (`base_currency`) を想定し、
  通常は `Expenses.currency` も `base_currency` と同一とする。
- 将来的に、同一トリップ内で複数通貨の支出を扱う場合は、
  支出ごとに「その時点のレート」や `yen_amount` を保存する設計も検討する。

---

## 3. TripMembers テーブル

### 用途

- どのユーザーがどのトリップに参加しているか、を保持する。
- 共有トリップを実現するための中間テーブル。
- `user_id` + `trip_id` をキーとすることで、
  同じユーザーが同じトリップに重複登録されないようにする。

### スキーマ

- テーブル名: `TripMembers`
- パーティションキー (PK): `user_id` (String)
- ソートキー (SK): `trip_id` (String)

| 属性名    | 型     | 説明                            |
| --------- | ------ | ------------------------------- |
| user_id   | String | ユーザー ID                     |
| trip_id   | String | トリップ ID                     |
| role      | String | "owner" / "member" などのロール |
| joined_at | String | 参加日時 (ISO8601)              |

### 取得パターン

- ログインユーザーのトリップ一覧:

  - `Query` 条件: `user_id = <ログインユーザー>`
  - 結果のうち：
    - `role = "owner"` → 「自分のトリップ」
    - `role = "member"` → 「共有トリップ」

- 将来、トリップに参加しているメンバー一覧を取得したい場合のために、  
  `trip_id` をパーティションキーにした GSI (GSI1) を追加することも検討する。

---

## 4. Expenses テーブル

### 用途

- 各トリップに紐づく支出（expense）を保持する。

### スキーマ

- テーブル名: `Expenses`
- パーティションキー (PK): `trip_id` (String)
- ソートキー (SK): `expense_id` (String)

| 属性名     | 型     | 説明                                          |
| ---------- | ------ | --------------------------------------------- |
| trip_id    | String | トリップ ID                                   |
| expense_id | String | 支出の ID（UUID など）                        |
| user_id    | String | この支出を登録したユーザーの ID               |
| amount     | Number | 金額（現地通貨）                              |
| currency   | String | 通貨コード（例: "THB", "EUR"）                |
| category   | String | カテゴリ（"food", "transport", "hotel", ...） |
| note       | String | メモ                                          |
| datetime   | String | 支出日時 (ISO8601)                            |
| created_at | String | 登録日時 (ISO8601)                            |

### 備考

- トリップごとの支出一覧は `trip_id` で Query する。
- 円換算額は計算で出せるため、テーブルには持たず `amount * rate_to_jpy` で算出する想定。
  - 必要になれば `yen_amount` を冗長に保存することも検討する。
