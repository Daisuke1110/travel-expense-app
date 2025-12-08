# アーキテクチャ設計（MVP）

Travel Expense App の全体アーキテクチャを定義する。

---

# 1. 全体像
- フロントエンド: PWA（React + TypeScript + Vite）
- バックエンド: FastAPI（Python）
- インフラ: AWS サーバレス（Lambda + API Gateway + DynamoDB + S3 + CloudFront）
- 認証: MVP では無し（将来 Cognito 導入）
- 主に iPhone Safari から PWA として利用する想定

---

# 2. コンポーネント構成

## 2.1 フロントエンド
- 技術: React + TypeScript + Vite, PWA 対応（manifest/service worker）
- 配信: ビルド成果物を S3 に配置し CloudFront から配信（HTTPS）
- 主な機能: トリップ一覧・詳細、支出追加/削除、サマリー表示
- PWA: ホーム画面追加（iOS対応）、静的アセットキャッシュ

## 2.2 バックエンド / API
- 技術: FastAPI（Python）
- 実行: AWS Lambda（コンテナ or zip デプロイ）、API Gateway HTTP API から呼び出し
- 主な責務: REST API 提供（backend.md 準拠）、DynamoDB とのデータ入出力
- 認証: 将来 Cognito JWT を検証予定（MVP は簡易ヘッダ）
- 例: GET /me/trips, POST /trips, GET /trips/{tripId}, GET/POST/DELETE /trips/{tripId}/expenses

## 2.3 データストア（DynamoDB）
- テーブル: Users, Trips, TripMembers, Expenses
- 詳細は data-model.md 参照
- リージョン: ap-northeast-3（単一リージョン運用）

## 2.4 インフラ（AWS）
- API Gateway HTTP API（Regional、HTTPS 終端）
- Lambda（FastAPI 実行）
- DynamoDB（アプリデータ）
- S3（フロントエンド静的ホスティング）
- CloudFront（CDN、フロントのみ利用）
- Route 53（独自ドメイン）
- Cognito（将来導入）

---

# 3. 環境構成

## 3.1 ローカル
- フロント: `npm run dev`（http://localhost:5173）
- バックエンド: `uvicorn main:app --reload --port 8000`
- API ベース URL: `http://localhost:8000`
- DB: DynamoDB Local も可（任意）

## 3.2 dev（AWS）
- 検証用。dev 用プレフィックスのリソース。
- 不要時に Terraform で削除可能。

## 3.3 prod（AWS）
- 実利用向け。本番ドメイン利用。
- 例: フロント `travel.daisuke-selfstudy.com`、API `travel-api.daisuke-selfstudy.com`
- CloudFront + ACM による HTTPS

---

# 4. リクエストフロー
1. ユーザーがブラウザ（iPhone Safari 想定）でアプリを開く。
2. CloudFront が S3 のフロント静的ファイルを配信。
3. フロントが `GET /me/trips` など API を呼び出し。
4. API Gateway がリクエストを受け、Lambda（FastAPI）が DynamoDB にアクセス。
5. API Gateway 経由でレスポンスがフロントへ返る。

---

# 5. セキュリティ・ネットワーク設計
- Lambda は VPC 外（パブリックエンドポイント、シンプルさ優先）
- HTTPS 終端: API Gateway（Regional）で実施。CloudFront はフロント配信のみで利用。
- CORS: API Gateway で許可ドメインを設定
  - AllowedOrigins: https://travel-dev.daisuke-selfstudy.com, https://travel.daisuke-selfstudy.com, http://localhost:5173（ローカル開発用）
  - AllowedMethods: GET, POST, PATCH, DELETE
- すべての通信は HTTPS のみ許可
- 将来: Cognito 導入時に JWT 認証を追加

---

# 6. デプロイ・運用フロー（構想）
- コード管理: GitHub
- デプロイ方針（当初は手動）
  - フロント: `npm run build` → S3 へアップロード
  - バックエンド: Docker イメージ or zip をビルド → Lambda にデプロイ
  - インフラ: Terraform で dev/prod を構築
- 将来: GitHub Actions で CI/CD を構築

---

# 7. まとめ
- PWA + AWS サーバレスのシンプル構成
- MVP では認証・オフラインを簡素化し、支出管理に集中
- Terraform で IaC 化し dev/prod を分離して運用する方針
