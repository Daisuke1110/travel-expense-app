# インフラ仕様（infra）

Travel Expense App のインフラ構成を定義する。Terraform で構築する前提。

---

# 1. 目標
- フロントエンド（PWA）とバックエンド API を低コスト・低運用負荷で提供
- 個人/友人利用の小規模サーバレス構成
- すべて Terraform で IaC 管理

---

# 2. 前提
- クラウド: AWS
- リージョン: ap-northeast-3（大阪）
- ドメイン: `daisuke-selfstudy.com` 想定
  - フロント: `travel.daisuke-selfstudy.com`
  - API: `travel-api.daisuke-selfstudy.com`
- 認証: MVP は認証なし（将来 Cognito）

---

# 3. 環境/ステージ
- `dev`: 開発・検証用
- `prod`: 本番
- 同一コードで `-var-file` を切り替え

---

# 4. 利用サービスと役割
## 4.1 フロントエンド
- S3（静的ホスティング、パブリックアクセス禁止。CloudFront 経由のみ）
- CloudFront（フロント配信、OAC/OAI で S3 を保護）
- ACM 証明書（us-east-1、CloudFront 用）
  - dev: arn:aws:acm:us-east-1:xxx:certificate/aaa...
  - prod: arn:aws:acm:us-east-1:xxx:certificate/bbb...

## 4.2 バックエンド / API
- API Gateway HTTP API（Regional、HTTPS 終端）
- Lambda（FastAPI 実行）
- DynamoDB（Users/Trips/TripMembers/Expenses）
- CORS 設定（API Gateway）
  - AllowedOrigins: https://travel-dev.daisuke-selfstudy.com, https://travel.daisuke-selfstudy.com, http://localhost:5173
  - AllowedMethods: GET, POST, PATCH, DELETE

## 4.3 ドメイン・DNS
- Route 53: サブドメインを CloudFront / API Gateway カスタムドメインへ ALIAS 連携

## 4.4 将来導入予定
- Cognito User Pool（認証）
- CloudWatch Alarms + SNS（アラート）
- WAF（必要に応じて）

---

# 5. 命名規則
- フォーマット: `<project>-<component>-<stage>`
- 例: `travel-expense-frontend-dev`, `travel-expense-api-prod`

---

# 6. Terraform 構成方針
## 6.1 ディレクトリ構成案
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
- `envs/dev.tfvars` / `envs/prod.tfvars` でステージごとの差分を管理
- `modules/` 配下に役割ごとに分割

## 6.2 プロバイダ設定
- メインリージョン: ap-northeast-3
- us-east-1 用に別プロバイダ（CloudFront/ACM 用）

## 6.3 秘匿情報の取り扱い
- tfvars に認証情報は置かない
- AWS 認証は SSO または GitHub Actions OIDC を利用
- `.gitignore` に `*.auto.tfvars`, `*.tfstate` を追加

---

# 7. セキュリティ・IAM
- Lambda 実行ロール: DynamoDB への最小権限、CloudWatch Logs 書き込み
- S3 バケット: パブリックブロック有効、OAC/OAI 経由のみ読み取り
- API セキュリティ: CORS をフロントドメインに限定、HTTPS のみ許可

---

# 8. デプロイフロー（構想）
1. `terraform init`
2. `terraform plan/apply -var-file=envs/dev.tfvars`
3. バックエンド: FastAPI をビルドし Lambda へデプロイ（zip or イメージ）
4. フロント: `npm run build` → S3 へ `aws s3 sync dist/ ...`
5. 動作確認（CloudFront ドメイン経由で API 含め確認）

---

# 9. MVP と将来拡張
- MVP: S3, CloudFront, API Gateway HTTP API, Lambda, DynamoDB, Route 53
- 将来: Cognito, CloudWatch Alarms+SNS, WAF, CI/CD など
