
# 要件定義（MVP）

Travel Expense App の MVP における要件をまとめる。非機能要件も含めて明確化する。

---

## 1. 機能要件（概要）
詳細は各ドキュメントを参照: `product.md`, `data-model.md`, `backend.md`, `frontend.md`。

- トリップ管理
  - 自分トリップ一覧 / 共有トリップ一覧
  - トリップ作成
  - トリップ詳細表示
  - トリップ更新（タイトル/期間/基準通貨/レート、オーナーのみ）
  - トリップ削除（オーナーのみ）
  - トリップメンバー追加（オーナーのみ、user_id を直接入力する簡易版）
- 支出管理
  - トリップごとの支出一覧表示
  - 支出の登録（メンバー/オーナー）
  - 支出の削除（メンバー/オーナー、`expense_id` 指定）
  - 支出の編集（amount/category/note/datetime、`expense_id` 指定）
  - 現地通貨での合計表示
  - 円換算表示（rate_to_jpy を利用）
- PWA 対応（ホーム画面追加、簡易オフライン対応）
- 認証/UI: MVP はログイン画面なし。API 呼び出し時に `X-Debug-User-Id` ヘッダで user_id を指定（将来 Cognito ログインを追加）
- Users.name は MVP ではローカル DB に手動登録して利用する（`X-Debug-User-Id` と紐づけ）

---

## 2. 非機能要件
### 2.1 パフォーマンス
- フロント: トリップ一覧/詳細の初回表示は 4G + スマホ環境で 3 秒以内を目標。2 回目以降は PWA キャッシュで体感 2 秒以内。
- バックエンド: API レスポンス(Lambda 実行)は 500ms 以内を目標。
- コールドスタートで 1 秒程度は許容。
- データ量想定: ユーザー数は数名〜十数名、トリップはユーザーあたり数十件、支出はトリップあたり数百件程度。

### 2.2 セキュリティ
- MVP: 認証なしだが HTTPS / CORS 制限を行い、デバッグヘッダは本番前に削除。
- 将来: Cognito + JWT。API Gateway で検証し、Lambda へ `user_id=sub` を委譲。
- アクセス制御（MVP から方針を明記）:
  - トリップ閲覧/支出閲覧: TripMembers に存在するユーザーのみ
  - トリップ編集（タイトル・期間・レート・基準通貨）: owner のみ
  - トリップ削除: owner のみ（将来実装）
  - 支出追加/削除: member/owner

### 2.3 オフライン（PWA ロードのみ）
- MVP: 静的ファイルのみキャッシュ。オフライン時は画面は開くが API は失敗し、「オフラインです。接続後にもう一度お試しください」と表示。
- 将来: オフライン入力キュー（IndexedDB）と簡易コンフリクト解消を検討。

### 2.4 通貨・レート方針
- トリップごとに基準通貨を設定できる。
- `amount` は通貨の最小単位の整数（小数なし）。
- レート変更時も過去支出の金額は変更しない。表示時に最新の `rate_to_jpy` で換算する。
- 将来、複数通貨や履歴レートを扱う場合は `yen_amount` など冗長保持を検討。
 - MVP では支出入力時の `currency` は Trips.base_currency と一致させる。

### 2.5 コスト
- 月数百円〜千円程度を目標。Lambda + API Gateway + DynamoDB を基本とし、S3 + CloudFront で配信。
- dev 環境は無料枠を目安に利用し、不要リソースは Terraform で削除可能にする。

### 2.6 運用・監視
- ログ: Lambda → CloudWatch Logs。重要な例外はスタックトレース付きで出力。
- MVP では自動アラートなし。開発者が定期的にログを確認。
- データ保護: DynamoDB のバックアップ/復旧（オンデマンドバックアップや PITR）は将来検討。MVP では手動エクスポートでも可。
- GSI: TripMembers(GSI1: PK=trip_id, SK=user_id)、Expenses(GSI1: PK=expense_id) を MVP から作成し、メンバー一覧/編集・削除で利用。

### 2.7 対応ブラウザ・端末
- ターゲット: iPhone Safari 最新版を最優先。
- 推奨: PC (Chrome/Edge) でも動くことが望ましいが、モバイル最適化を優先。
- OS 範囲: 直近数年の iOS を目安（厳密な表は持たない）。

### 2.8 可用性・スケーラビリティ
- 個人/友人利用のため 24x365 は求めない。短時間の停止は許容。
- Lambda + DynamoDB で将来的なスケールに備えるが、大規模負荷を想定したチューニングは不要。

---

## 3. まとめ
- 機能要件は各設計ドキュメントで詳細定義済み。
- 非機能要件としてパフォーマンス、セキュリティ（含むアクセス制御方針）、オフライン、通貨・レート方針、コスト、運用、対応ブラウザ、可用性を明確化した。
- 支出編集: PATCH /trips/{tripId}/expenses/{expenseId}（amount/category/note/datetime を更新、TripMembers 参加者のみ）
- Trip delete: DELETE /trips/{tripId} (owner only; cascade delete expenses; soft delete is future option)
- Member add: POST /trips/{tripId}/members (owner only; user_id 直接指定の簡易版)
