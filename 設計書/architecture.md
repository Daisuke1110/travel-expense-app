# アーキテクチャ設計（MVP）

Travel Expense App の全体アーキテクチャを定義する。

---

# 1. 全体像

本システムは以下の構成をとる：

- フロントエンド：PWA（React + TypeScript + Vite）
- バックエンド：FastAPI（Python）
- インフラ：AWS サーバレス（Lambda + API Gateway + DynamoDB + S3 + CloudFront）
- 認証：MVP では無し、将来的に Cognito を導入予定

利用者は主に **iPhone の Safari から PWA として利用**することを想定する。

---

# 2. コンポーネント構成

## 2.1 フロントエンド

- 技術：
  - React + TypeScript + Vite
  - PWA 対応（manifest.json / service worker）
- 配信方法：
  - ビルド成果物（HTML / JS / CSS / 画像）を S3 に配置
  - CloudFront 経由で配信
- 主な機能：
  - トリップ一覧表示（`GET /me/trips`）
  - トリップ詳細表示（`GET /trips/{tripId}`, `GET /trips/{tripId}/expenses`）
  - 支出の追加・削除（`POST /trips/{tripId}/expenses`, `DELETE /trips/{tripId}/expenses/{expenseId}`）
  - サマリー表示（現地通貨合計・円換算合計）
- PWA：
  - ホーム画面追加（iOS）
  - 静的アセットのキャッシュ（オフライン時も最低限の画面を表示）

---

## 2.2 バックエンド（API）

- 技術：
  - FastAPI（Python）
- 実行環境：
  - AWS Lambda（コンテナ or zip デプロイ）
  - API Gateway HTTP API からの呼び出し
- 主な責務：
  - `backend.md` で定義した REST API を提供
  - DynamoDB とのデータ入出力
  - 将来的な認証（Cognito JWT）の検証（現時点では MVP のため未実装）
- エンドポイント例：
  - `GET /me/trips`
  - `POST /trips`
  - `GET /trips/{tripId}`
  - `GET /trips/{tripId}/expenses`
  - `POST /trips/{tripId}/expenses`
  - `DELETE /trips/{tripId}/expenses/{expenseId}`

---

## 2.3 データストア（DynamoDB）

- テーブル：
  - `Users`
  - `Trips`
  - `TripMembers`
  - `Expenses`
- 詳細は `data-model.md` を参照。
- 特徴：
  - 単一リージョン（ap-northeast-3）で運用。
  - スキーマレスだが、アプリ側でスキーマを固定して運用する。

---

## 2.4 インフラ（AWS）

- 使用サービス：
  - API Gateway（HTTP API）
  - Lambda（FastAPI 実行）
  - DynamoDB（アプリデータ）
  - S3（フロントエンドホスティング）
  - CloudFront（CDN + HTTPS 終端）
  - Route 53（独自ドメイン）
  - Cognito（将来導入）
- 構成管理：
  - Terraform による IaC（`infra/terraform/` 以下に定義）

---

# 3. 環境構成

## 3.1 ローカル環境

- 目的：
  - フロント・バックエンドの開発と動作確認。
- 想定構成：
  - フロント：
    - `npm run dev` で Vite 開発サーバ（例： http://localhost:5173）
  - バックエンド：
    - `uvicorn main:app --reload --port 8000` で FastAPI を起動
  - API ベース URL：
    - フロントからは `http://localhost:8000` を参照
- DB：
  - ローカル開発では DynamoDB Local を使うか、簡易的なモックを利用してもよい（MVP の段階ではお好みで）。

---

## 3.2 dev 環境（AWS）

- 用途：
  - 実際の AWS リソース上での動作確認。
  - 友達に試してもらう前の検証環境として利用。
- 特徴：
  - DynamoDB / Lambda / API Gateway / S3 / CloudFront を dev 用プレフィックス付きで作成。
  - コストを抑えるため、不要時には Terraform で削除可能な構成とする。

---

## 3.3 prod 環境（AWS）

- 用途：
  - 実際に友達に使ってもらう「本番環境」。
- 特徴：
  - Route 53 で取得済みドメイン（例：`daisuke-selfstudy.com`）のサブドメインを利用する想定：
    - 例：`travel.daisuke-selfstudy.com`（フロント）
    - `travel-api.daisuke-selfstudy.com`（API）
  - CloudFront + ACM（証明書）による HTTPS 対応。
  - dev 環境とは別のステージ／リソース名を使用する。

---

# 4. リクエストフロー

## 4.1 フロント → API の流れ

1. ユーザーがブラウザ（主に iPhone Safari）でアプリを開く。
2. CloudFront が S3 上のフロントエンドの静的ファイルを配信。
3. フロントエンドは起動時に `GET /me/trips` などの API を呼び出す。
4. API Gateway がリクエストを受け取り、対応する Lambda を起動。
5. Lambda（FastAPI）が DynamoDB からデータを取得・更新し、JSON を返す。
6. API Gateway → フロントへレスポンスが返る。
7. フロントはレスポンスを元に画面をレンダリングする。

---

# 5. セキュリティ・ネットワーク設計（MVP）

- ネットワーク：
  - 基本的にパブリックなエンドポイント（API Gateway / CloudFront）を使用。
  - VPC 内 Lambda は必須ではない（シンプルさを優先）。
- セキュリティ（MVP）：
  - 認証なしのため、prod 公開時は利用者を限定した上で公開する（URL を知っている人のみ）。
  - CORS 制限：
    - フロントエンドのドメインからのみ API を許可する。
  - すべての通信は HTTPS のみ許可。

将来的に：

- Cognito 導入後、API Gateway に JWT 認証を追加。
- 「誰のデータにアクセスできるか」をユーザー ID ベースで制御。

---

# 6. デプロイ・運用フロー（構想）

※ 実装は後でよいが、方向性だけ記載。

- コード管理：
  - GitHub リポジトリを利用。
- デプロイ方針（案）：
  - 手動デプロイからスタート：
    - フロント：`npm run build` → S3 へアップロード
    - バックエンド：Docker イメージ or zip をビルド → Lambda へデプロイ
    - インフラ：Terraform で dev / prod を構築
  - 将来的に GitHub Actions で CI/CD パイプラインを構築。

---

# 7. まとめ

- 本アプリは、PWA + AWS サーバレスというシンプルかつスケーラブルな構成を採用する。
- MVP 段階では認証やオフライン機能を簡素化し、コア機能（支出管理）に集中する。
- すべての構成は Terraform によって IaC 化し、dev / prod 環境を分離して運用する方針とする。
