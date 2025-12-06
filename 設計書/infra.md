# インフラ仕様（infra-spec）

Travel Expense App（PWA + サーバレス）のインフラ構成を定義する。

本ドキュメントは Terraform で構築する AWS リソースの方針・構成・命名ルールをまとめたもの。

---

# 1. 目的

- フロントエンド（PWA）とバックエンド API を **低コスト・低運用負荷** で提供する。
- 個人開発＋友人利用を前提とした、小規模なサーバレス構成とする。
- すべてのインフラは Terraform によって IaC 管理する。

---

# 2. 前提

- クラウド：AWS
- リージョン：
  - 基本：`ap-northeast-3`（大阪）
  - CloudFront / ACM（証明書）関連のみ `us-east-1` を利用する。
- ドメイン：
  - Route 53 で管理されている `daisuke-selfstudy.com` を利用する想定。
  - サブドメイン例：
    - フロント：`.daisuke-selfstudy.com`
    - API：`api.daisuke-selfstudy.com`
- 認証：
  - MVP：認証なし（または簡易ヘッダ）
  - 将来：Cognito User Pool を導入予定

---

# 3. 環境（ステージ）

- `dev`：開発・検証用環境
- `prod`：本番環境（友人に使ってもらう）

両者は Terraform の `-var-file` などを用いて、同じコードベースで構築する。

---

# 4. 利用サービスと役割

## 4.1 フロントエンド

- **S3（静的ホスティング用バケット）**
  - 役割：
    - `npm run build` したフロントエンド（HTML / JS / CSS / 画像）を配置する。
  - ポイント：
    - パブリックアクセスは禁止し、CloudFront 経由のみアクセスさせる（Origin Access Control / Origin Access Identity）。
- **CloudFront**
  - 役割：
    - 世界中のユーザーに対してフロントエンドを HTTPS で高速配信する。
  - ポイント：
    - オリジン：フロントエンド S3 バケット。
    - ビヘイビア：すべてのパス（`/*`）を S3 にフォワード。
- **ACM（SSL 証明書）**
  - 役割：
    - `app.daisuke-selfstudy.com` 用の証明書。
  - ポイント：
    - CloudFront 用証明書は `us-east-1` リージョンで発行する。

---

## 4.2 バックエンド（API）

- **API Gateway HTTP API**
  - 役割：
    - `https://api.daisuke-selfstudy.com` で FastAPI（Lambda）を公開する。
  - ポイント：
    - HTTP API タイプを利用（REST API より安価）。
    - 将来、JWT オーソライザ（Cognito）を追加しやすい構成にする。
- **Lambda**
  - 役割：
    - FastAPI アプリケーションを実行する。
  - 方針：
    - MVP では 1 つの Lambda 関数で API 全体を提供（モノリシック構成）。
    - デプロイ方法は以下いずれか：
      - zip デプロイ（シンプル）
      - コンテナイメージ（将来的に選択肢）
- **DynamoDB**
  - 役割：
    - アプリケーションデータ（Users / Trips / TripMembers / Expenses）を保存。
  - 詳細：
    - テーブル設計は `data-model.md` を参照。
    - `dev` / `prod` でテーブル名を分ける（例：`Trips-dev`, `Trips-prod`）。

---

## 4.3 ドメイン・DNS

- **Route 53**
  - 役割：
    - `daisuke-selfstudy.com` の DNS 管理。
  - レコード例：
    - `app.daisuke-selfstudy.com` → CloudFront ディストリビューション（A レコード + ALIAS）
    - `api.daisuke-selfstudy.com` → API Gateway カスタムドメイン

---

## 4.4 将来導入予定

※ infra-spec には書いておくが、MVP では実際には作らない場合もある。

- **Cognito User Pool**
  - 役割：
    - ユーザー認証・管理。
  - 導入後：
    - API Gateway の JWT オーソライザと連携。
- **CloudWatch Alarms / SNS**
  - 役割：
    - エラー率や 5xx レスポンスの検知。
  - MVP では必須ではないが、将来の運用改善で検討。

---

# 5. 命名規則

## 5.1 共通ルール

- 命名フォーマット：

  ```
  <project>-<component>-<stage>
  ```

- 例：
  - プロジェクト名：`travel-expense-app`（略して `tea` などでも可）

## 5.2 代表的なリソース名例

- S3 バケット（フロント）：
  - `travel-expense-frontend-dev`
  - `travel-expense-frontend-prod`
  - ※ バケット名はグローバル一意なので、必要ならランダムサフィックスを付与（`-1234abcd` など）。
- Lambda 関数：
  - `travel-expense-api-dev`
  - `travel-expense-api-prod`
- DynamoDB テーブル：
  - `tea-Users-dev`
  - `tea-Trips-dev`
  - `tea-TripMembers-dev`
  - `tea-Expenses-dev`
  - （prod も同様に `-prod` サフィックス）
- CloudFront：
  - `travel-expense-frontend-dev`
  - `travel-expense-frontend-prod`
- API Gateway（HTTP API 名）：
  - `travel-expense-http-api-dev`
  - `travel-expense-http-api-prod`

---

# 6. Terraform 構成方針

## 6.1 ディレクトリ構成（案）

```
infra/
  terraform/
    main.tf
    providers.tf
    variables.tf
    outputs.tf
    envs/
      dev.tfvars
      prod.tfvars
    modules/
      frontend/
        s3.tf
        cloudfront.tf
        acm_us_east_1.tf
      backend/
        lambda.tf
        api_gateway.tf
        iam.tf
      database/
        dynamodb.tf
      dns/
        route53.tf
```

- `envs/dev.tfvars` / `envs/prod.tfvars` でステージごとの差分（ドメイン、ステージ名など）を管理。
- `modules/` 配下に役割ごとのモジュールを分割。

## 6.2 プロバイダ設定

- メインリージョン：`ap-northeast-3`
- us-east-1 用のプロバイダを別途用意（ACM for CloudFront 用）：

```hcl
provider "aws" {
  region = "ap-northeast-3"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

---

# 7. セキュリティ・IAM

## 7.1 IAM ロール（Lambda 実行）

- Lambda 実行ロール：
  - DynamoDB へのアクセス権限（GetItem / PutItem / Query / UpdateItem / DeleteItem）。
  - CloudWatch Logs への書き込み権限。
- ポリシーは最小権限の原則に従う。

## 7.2 S3 アクセス制御

- フロントエンドバケット：
  - パブリックアクセスブロックを有効化。
  - CloudFront からのみ読み取り可能（OAC/OAI）。
- ログバケット（必要なら）：
  - アクセスログを保存する専用バケットを用意しても良い（MVP では任意）。

## 7.3 API セキュリティ（MVP）

- CORS 設定：
  - フロントエンドのオリジンのみ許可  
    （例：`https://app.daisuke-selfstudy.com`）
- 認証：
  - MVP では未実装だが、将来的に Cognito による JWT 認証を追加できるように設計しておく。

---

# 8. デプロイフロー（構想）

※ 実装は後からでも良いが、方向性だけ整理しておく。

1. **インフラ構築**

   - `infra/terraform` ディレクトリで：
     - `terraform init`
     - `terraform plan -var-file="envs/dev.tfvars"`
     - `terraform apply -var-file="envs/dev.tfvars"`
   - prod も同様。

2. **バックエンドデプロイ**

   - FastAPI アプリをビルド（必要なら Docker イメージ）。
   - Lambda 用アーティファクト（zip or イメージ）を作成。
   - Terraform から Lambda のコードを参照する、もしくは AWS CLI / コンソールでアップロード。

3. **フロントエンドデプロイ**

   - `npm run build`
   - 出力（`dist/`）を S3 バケットに同期：
     - `aws s3 sync dist/ s3://travel-expense-frontend-dev --delete`

4. **動作確認**
   - dev 環境の CloudFront ドメイン or サブドメインにアクセスして、フローを確認。
   - API が正しく動作するか（トリップ一覧取得、支出登録など）確認。

---

# 9. MVP と将来拡張の切り分け

## 9.1 MVP で必須のインフラ

- S3（フロント）
- CloudFront（フロント用）
- API Gateway HTTP API
- Lambda（FastAPI）
- DynamoDB（4 テーブル）
- Route 53 の DNS レコード（最低限）

## 9.2 将来追加を検討するインフラ

- Cognito User Pool（認証）
- CloudWatch Alarms + SNS（障害通知）
- S3 / CloudFront アクセスログ用バケット
- WAF（攻撃対策）
- CI/CD パイプライン（GitHub Actions 等）

---

# 10. まとめ

- 本ドキュメントは Travel Expense App のインフラを Terraform で構築するための仕様書である。
- `dev` / `prod` 2 環境を前提とし、低コスト・低運用負荷のサーバレス構成を採用する。
- MVP 段階ではシンプルな構成とし、認証・オフライン高度化・監視強化などは将来の拡張として位置づける。
