# データモデル設計

本システムでは、以下 4 テーブルを DynamoDB に作成する。
- Users
- Trips
- TripMembers
- Expenses

将来は Cognito と連携し、ユーザー ID として Cognito の `sub` を利用する。

---

## 1. Users テーブル

### 用途
- アプリユーザー情報を保持する。
- ログインに使用する ID（Cognito `sub`）と表示名などを管理する。

### スキーマ
- テーブル名: `Users`
- パーティションキー (PK): `user_id` (String)

| 属性名    | 型    | 説明                               |
| --------- | ----- | ---------------------------------- |
| user_id   | String| ユーザー ID。Cognito の `sub` を想定 |
| name      | String| 表示名                             |
| email     | String| メールアドレス                     |
| created_at| String| 作成日時(ISO8601)                  |

### 備考
- MVP では必須ではないが、将来ユーザー名やアイコンなどを保持する拡張ポイントとして用意。

---

## 2. Trips テーブル

### 用途
- 1 つの海外旅行（トリップ）に関する情報を保持する。

### スキーマ
- テーブル名: `Trips`
- パーティションキー (PK): `trip_id` (String)

| 属性名       | 型     | 説明                                         |
| ------------ | ------ | -------------------------------------------- |
| trip_id      | String | トリップ ID。UUID など                       |
| owner_id     | String | トリップ作成者の user_id                     |
| title        | String | トリップ名（例: 2026 バンコク旅）            |
| country      | String | 国コードまたは国名（例: "TH"）              |
| start_date   | String | 開始日 (ISO8601, 例: "2026-05-01")          |
| end_date     | String | 終了日 (ISO8601)                              |
| base_currency| String | 基準通貨（例: "THB", "USD"）               |
| rate_to_jpy  | Number | 1 基準通貨あたりの円レート（例: 4.2）        |
| created_at   | String | 作成日時(ISO8601)                            |

### 備考
- MVP では `base_currency` は作成後は変更不可（変更要求は 400 を返す）。レートは更新可。
- `owner_id` と `created_at` をキーにした GSI (GSI1) はパフォーマンス要件を見て追加検討。MVP では作成しない想定。
- 当面はトリップごとに 1 つの基準通貨 (`base_currency`) を想定。通常は `Expenses.currency` と同一。
- レート（`rate_to_jpy`）は更新可能だが、`base_currency` は MVP では不変。過去の支出はそのまま保持し、表示時に最新レートで換算する。
- 将来、同一トリップ内で複数通貨の支出を扱う場合は、支出ごとに「その時点のレート」や `yen_amount` を保存する設計を検討する。

---

## 3. TripMembers テーブル

### 用途
- どのユーザーがどのトリップに参加しているかを保持する。
- 共有トリップを実現するための中間テーブル。
- `user_id` + `trip_id` をキーにし、同じユーザーが同じトリップに重複登録されないようにする。

### スキーマ
- テーブル名: `TripMembers`
- パーティションキー (PK): `user_id` (String)
- ソートキー (SK): `trip_id` (String)

| 属性名  | 型     | 説明                           |
| ------- | ------ | ------------------------------ |
| user_id | String | ユーザー ID                    |
| trip_id | String | トリップ ID                    |
| role    | String | "owner" / "member" などのロール |
| joined_at|String | 参加日時(ISO8601)              |

### 取得パターン
- ログインユーザーのトリップ一覧: `user_id = <ログインユーザー>` で Query。`role = "owner"` → 自分トリップ、`role = "member"` → 共有トリップ。
- メンバー一覧取得用に、GSI1（PK=`trip_id`, SK=`user_id`）を作成する想定（MVP から準備）。

---

## 4. Expenses テーブル

### 用途
- 各トリップに紐づく支出（Expense）を保持する。

### スキーマ
- テーブル名: `Expenses`
- パーティションキー (PK): `trip_id` (String)
- ソートキー (SK): `datetime_expense_id` (String) — `"{datetime_iso8601}#{expense_id}"` 形式でユニーク化
- GSI1（MVP から作成）: PK=`expense_id` で単一支出を特定し編集/削除しやすくする

| 属性名    | 型     | 説明                                                     |
| --------- | ------ | -------------------------------------------------------- |
| trip_id   | String | トリップ ID                                              |
| datetime  | String | 支出日時(ISO8601, UTC)                                   |
| expense_id| String | 支出の ID。UUID など（GSI1 用）                          |
| datetime_expense_id | String | `"datetime#expense_id"`。PK+SK の一意性確保とソート用 |
| user_id   | String | この支出を登録したユーザーの ID                          |
| amount    | Number | 金額（現地通貨）。通貨の最小単位の整数で保持（小数なし） |
| currency  | String | 通貨コード（例: "THB", "EUR"）                          |
| category  | String | カテゴリ（例: "food", "transport", "hotel", ...）       |
| note      | String | メモ                                                     |
| created_at| String | 登録日時(ISO8601)                                        |

### 備考
- トリップごとの支出一覧は `trip_id` で Query し、`datetime` で昇順取得する。
- 換算額は計算で出せるため、テーブルには持たない（`amount * rate_to_jpy` で算出）。将来 `yen_amount` を冗長に保存することも検討。
- `TripMembers` に参加していないユーザーは支出の登録・閲覧・削除ができないようにする。
- レート変更時も `amount` は更新しない。表示時に最新の `Trips.rate_to_jpy` を用いて換算する。
- `expense_id` はクライアント向け ID として保持し、必要なら GSI1 で単体取得できるようにする。
- DynamoDB は PK/SK を直接更新できないため、`datetime` を変更する PATCH は「GSI1 で対象取得 → 新しい `datetime_expense_id` を計算 → 新レコード Put → 旧レコード Delete」の再書き込みフローを取る。

## レビュー反映メモ
- Expenses は SK=`datetime_expense_id`（`datetime#expense_id`）で重複を防ぎ、GSI1 (PK=`expense_id`) を作成する前提に変更。
- TripMembers はメンバー一覧取得用に GSI1 (PK=`trip_id`, SK=`user_id`) を用意する前提。
- MVP では Users.name はローカル DB に手動登録し、X-Debug-User-Id と紐づけて owner_name を返す。欠損時は `"owner"` をフォールバック表示。
- MVP で作成する GSI:
  - TripMembers: GSI1 (PK=`trip_id`, SK=`user_id`) — 共有トリップのメンバー一覧取得・権限チェックに利用
  - Expenses: GSI1 (PK=`expense_id`) — 編集/削除時の一意取得に利用
- Expenses.currency は Trips.base_currency と同一にする（MVP）。複数通貨対応は将来拡張で検討する。
