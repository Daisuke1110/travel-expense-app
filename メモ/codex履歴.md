     "user_id": {
              "S": "65aaa780-6001-70c2-7ba2-fe135230dcd9"
          },
          "created_at": {
              "S": "2026-04-01T15:54:08.747867Z"
          },
          "email": {
              "S": "m.daisuke1110@gmail.com"
          },
          "name": {
              "NULL": true
          }
      }

}

• ここまでで切り分けはできています。

分かったこと

- PATCH /me は実行されている  
  理由: updated_at が更新されている
- ただし name は保存されていない  
  理由: DynamoDB 上で name がまだ "NULL": true

つまり、問題は PATCH /me の更新式で name に文字列が入っていない ことです。  
 $body は正しいので、原因はバックエンド実装です。

いま確認すべき箇所  
 C:\travel-expense-app\backend\app\routes\me.py の PATCH /me を見てください。  
 特にこの3点です。

1. リクエストモデル  


class MeUpdateRequest(BaseModel):  
 name: str

2. バリデーション

name = \_validate_name(req.name)

3. update_item

users_table.update_item(  
 Key={"user_id": user_id},  
 UpdateExpression="SET #name = :name, email = :email, updated_at = :updated_at",  
 ExpressionAttributeNames={"#name": "name"},
ExpressionAttributeValues={
":name": name,
":email": email,  
 ":updated_at": now,  
 },  
 )

いまの症状から見てありがちな実装ミス

- req.name ではなく req.get("name") のような誤った取り方をしている
- :name に name ではなく None を入れている
- UpdateExpression に #name = :name が入っていない
- name を返却時だけ見ていて、保存時は更新していない

次の最短アクション  
 これを実行してください。

Get-Content C:\travel-expense-app\backend\app\routes\me.py

その PATCH /me 部分を見れば、どこが漏れているかすぐ分かります。  
 貼ってくれれば、その場で修正箇所を指摘します。

› Get-Content C:\travel-expense-app\backend\app\routes\me.py  
 (.venv) PS C:\travel-expense-app\json> Get-Content C:\travel-expense-app\backend\app\routes\me.py  
 from datetime import datetime, timezone  
 from typing import Optional

from botocore.exceptions import BotoCoreError, ClientError  
 from fastapi import APIRouter, HTTPException  
 from pydantic import BaseModel

from app import auth  
 from app.db import get_dynamodb_resource, get_table_names

router = APIRouter()

class MeResponse(BaseModel):  
 user_id: str  
 email: Optional[str] = None  
 name: Optional[str] = None

class MeUpdateRequest(BaseModel):  
 name: str

def \_utc_now_iso() -> str:  
 return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def \_validate_name(value: str) -> str:  
 name = value.strip()

      if not name:
          raise HTTPException(status_code=400, detail="name is required")

      if len(name) > 50:
          raise HTTPException(
              status_code=400, detail="name must be 50 characters or fewer"
          )



@router.get("/me", response_model=MeResponse)  
 def get_me():  
 claims = auth.get_current_claims()  
 user_id = str(claims.get("sub") or "")  
 email = claims.get("email")

      if not user_id:
          raise HTTPException(status_code=401, detail="Unauthorized")

      tables = get_table_names()
      dynamodb = get_dynamodb_resource()
      users_table = dynamodb.Table(tables["users"])

      try:
          response = users_table.get_item(Key={"user_id": user_id})
          item = response.get("Item")

          if not item:
              now = _utc_now_iso()
              item = {
                  "user_id": user_id,
                  "email": email,
                  "name": None,
                  "created_at": now,
                  "updated_at": now,
              }
              users_table.put_item(Item=item)

          return MeResponse(
              user_id=item["user_id"],
              email=item.get("email"),
              name=item.get("name"),
          )
      except HTTPException:
          raise
      except (ClientError, BotoCoreError) as exc:
          raise HTTPException(status_code=500, detail="Failed to fetch profile") from exc
      except Exception as exc:
          raise HTTPException(status_code=500, detail="Unexpected error") from exc

@router.patch("/me", response_model=MeResponse)
def update_me(req: MeUpdateRequest):
claims = auth.get_current_claims()
user_id = str(claims.get("sub") or "")
email = claims.get("email")

      if not user_id:
          raise HTTPException(status_code=401, detail="Unauthorized")

      name = _validate_name(req.name)

      tables = get_table_names()
      dynamodb = get_dynamodb_resource()
      users_table = dynamodb.Table(tables["users"])

      try:
          now = _utc_now_iso()

          users_table.update_item(
              Key={"user_id": user_id},
              UpdateExpression="SET #name = :name, email = :email, updated_at = :updated_at",
              ExpressionAttributeNames={"#name": "name"},
              ExpressionAttributeValues={
                  ":name": name,
                  ":email": email,
                  ":updated_at": now,
              },
          )

          response = users_table.get_item(Key={"user_id": user_id})
          item = response.get("Item")

          if not item:
              raise HTTPException(status_code=404, detail="User not found")

          return MeResponse(
              user_id=item["user_id"],
              email=item.get("email"),
              name=item.get("name"),
          )

      except HTTPException:
          raise
      except (ClientError, BotoCoreError) as exc:
          raise HTTPException(status_code=500, detail="Failed to update profile") from exc
      except Exception as exc:
          raise HTTPException(status_code=500, detail="Unexpected error") from exc

• 原因はこれです。

def \_validate_name(value: str) -> str:  
 name = value.strip()

      if not name:

つまりこうです。
name = value.strip()

      if not name:
          raise HTTPException(status_code=400, detail="name is required")

      if len(name) > 50:
          raise HTTPException(
              status_code=400, detail="name must be 50 characters or fewer"
          )

      return name

なぜ今の症状になるか

- PATCH /me は正常に動く
- updated_at も更新される
- でも :name に None が入る
- DynamoDB では name = NULL になる

修正後にやること

1. バックエンド再デプロイ
2. PATCH /me 再実行
3. GET /me 確認
4. DynamoDB でも name.S = "Daisuke" になっているか確認

必要なら次に、再デプロイ後の確認コマンドをそのまま出します。

› 実装完了しました。次に以下をお願いします。
Step 3. フロントでプロフィール設定画面を作る
目的:

- name 未設定のユーザーが最初にプロフィールを設定できるようにする

やること:

1. frontend/src/api/me.ts を追加
2. frontend/src/pages/ProfileSetupPage.tsx を追加
3. 名前入力フォームと保存処理を実装

完了条件:

- 画面から name を保存できる
- 保存後に通常画面へ戻れる

• 以下の2ファイルを追加してください。
Step 3 は プロフィール設定画面そのものを作るところまで です。遷移制御は次の Step 4 で入れます。

———

## 1. frontend/src/api/me.ts を追加

対象: C:\travel-expense-app\frontend\src\api\me.ts

import { apiFetch } from "./client";

export type MeResponse = {  
 user_id: string;  
 email?: string | null;  
 name?: string | null;  
 };

export type MeUpdateRequest = {  
 name: string;  
 };

export function fetchMe() {  
 return apiFetch<MeResponse>("/me");  
 }

export function updateMe(payload: MeUpdateRequest) {  
 return apiFetch<MeResponse>("/me", {  
 method: "PATCH",  
 body: JSON.stringify(payload),
});
}

### 役割

- fetchMe(): 現在ユーザーのプロフィール取得
- updateMe(): name 更新  


———

## 2. frontend/src/pages/ProfileSetupPage.tsx を追加

対象: C:\travel-expense-app\frontend\src\pages\ProfileSetupPage.tsx

import { type FormEvent, useEffect, useState } from "react";  
 import { useNavigate } from "react-router-dom";
import { fetchMe, updateMe } from "../api/me";

export default function ProfileSetupPage() {  
 const navigate = useNavigate();  
 const [name, setName] = useState("");
const [email, setEmail] = useState("");  
 const [loading, setLoading] = useState(true);  
 const [saving, setSaving] = useState(false);  
 const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let mounted = true;

      fetchMe()
        .then((me) => {
          if (!mounted) return;
          setEmail(me.email ?? "");
          setName(me.name ?? "");
        })
        .catch((err) => {
          if (!mounted) return;
          setError((err as Error).message ?? "Failed to load profile");
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });

      return () => {
        mounted = false;
      };
    }, []);

    const onSubmit = async (event: FormEvent) => {
      event.preventDefault();

      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name is required.");
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await updateMe({ name: trimmed });
        navigate("/");
      } catch (err) {
        setError((err as Error).message ?? "Failed to save profile");
      } finally {
        setSaving(false);
      }
    };

    if (loading) {
      return (
        <div className="page">
          <div className="status">Loading profile...</div>
        </div>
      );
    }

    return (
      <div className="page">
        <div className="modal">
          <header className="modal__header">
            <div>
              <div className="modal__title">Set up your profile</div>
              <div className="modal__subtitle">
                Add a display name for trip members and payments.
              </div>
            </div>
          </header>

          <form className="modal__form" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input type="text" value={email} disabled />
            </label>

            <label className="field">
              <span>Display name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Daisuke"
                maxLength={50}
                required
              />
            </label>

            {error && <div className="status status--error">{error}</div>}

            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
          </form>
        </div>
      </div>
    );

}

———

## 3. この段階で最低限やる確認

まだ Step 4 前なので、自動遷移は入れません。  
 まずは画面単体で動くことを確認します。

### App.tsx に一時的にルート追加

対象: C:\travel-expense-app\frontend\src\App.tsx

import を追加:

import ProfileSetupPage from "./pages/ProfileSetupPage";

Route を追加:  
 cd C:\travel-expense-app\frontend 2. /profile/setup を開く
例:

https://travel-expense-dev.daisuke-selfstudy.com/profile/setup

3. 確認項目

- Email が表示される
- Display name に入力できる
- 保存すると / に戻る

4. API確認
   保存時に PATCH /me が飛び、name が更新されることを確認してください。

———

## 5. 完了条件

これで Step 3 の完了条件は満たせます。

- 画面から name を保存できる
- 保存後に通常画面へ戻れる

———

次は Step 4 です。
そこで 「name 未設定なら自動で /profile/setup に送る」 を App.tsx に入れます。

› 実装完了しました。次に以下をお願いします。
Step 4. App.tsx に初回プロフィール完了導線を入れる
目的:

- Hosted UI ログイン後、name 未設定なら必ずプロフィール設定画面に送る

やること:

1. 起動時に fetchMe() を呼ぶ
2. name が空なら /profile/setup
3. そうでなければ通常ルーティング

完了条件:

- 初回ログインユーザーはプロフィール設定画面へ遷移
- name 設定済みユーザーは通常どおり使える

• 以下の形で App.tsx を更新してください。
やることは、ログイン確認の後に fetchMe() を入れて、name 未設定なら /profile/setup に送るだけです。

———

## 1. import を追加

対象: C:\travel-expense-app\frontend\src\App.tsx

import { useEffect, useState } from "react";  
 import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";  
 import HomePage from "./pages/HomePage";  
 import TripDetailPage from "./pages/TripDetailPage";  
 import AddExpensePage from "./pages/AddExpensePage";  
 import AddTripPage from "./pages/AddTripPage";  
 import ProfileSetupPage from "./pages/ProfileSetupPage";  
 import { fetchMe } from "./api/me";  
 import { getIdToken, handleCallbackIfNeeded, login } from "./auth/cognito";

———

## 2. App.tsx を以下にする

import { useEffect, useState } from "react";  
 import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";  
 import HomePage from "./pages/HomePage";  
 import TripDetailPage from "./pages/TripDetailPage";
import AddExpensePage from "./pages/AddExpensePage";  
 import AddTripPage from "./pages/AddTripPage";  
 import ProfileSetupPage from "./pages/ProfileSetupPage";  
 import { fetchMe } from "./api/me";  
 import { getIdToken, handleCallbackIfNeeded, login } from "./auth/cognito";

export default function App() {  
 const navigate = useNavigate();  
 const location = useLocation();

    const [ready, setReady] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
      let mounted = true;

      (async () => {
        try {
          await handleCallbackIfNeeded();

          if (!getIdToken()) {
            await login();
            return;
          }

          const me = await fetchMe();
          const hasName = !!me.name?.trim();

          if (!mounted) return;

          if (!hasName && location.pathname !== "/profile/setup") {
            navigate("/profile/setup", { replace: true });
          }

          if (hasName && location.pathname === "/profile/setup") {
            navigate("/", { replace: true });
          }

          setReady(true);
        } catch (err) {
          if (!mounted) return;
          setAuthError((err as Error).message ?? "Authentication failed");
          setReady(true);
        }
      })();

      return () => {
        mounted = false;
      };
    }, [location.pathname, navigate]);

    if (!ready) {
      return (
        <div className="page">
          <div className="status">Signing in...</div>
        </div>
      );
    }

    if (authError) {
      return (
        <div className="page">
          <div className="status status--error">{authError}</div>
        </div>
      );
    }

    return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile/setup" element={<ProfileSetupPage />} />
        <Route path="/trips/new" element={<AddTripPage />} />
        <Route path="/trips/:tripId" element={<TripDetailPage />} />
        <Route path="/trips/:tripId/add" element={<AddExpensePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );

}

———

## 3. この実装でやっていること

### handleCallbackIfNeeded()

- Cognito から戻った code を token に交換  


### getIdToken()

- token が無ければ Hosted UI に飛ばす  


### fetchMe()

- ログイン済みなら GET /me
- name があるかを見る  


### 分岐

- name なし: /profile/setup
- name あり: 通常画面
- name ありで /profile/setup に来た: / に戻す  


———

## 4. 確認方法

期待:

- Hosted UI ログイン後
- /profile/setup に遷移する

### ケース2: name 設定済みユーザー

期待:

- Hosted UI ログイン後
- そのまま通常画面に入る

### ケース3: name 設定済みで /profile/setup を直接開く

期待:

- / に戻される

———

## 5. 完了条件

以下が通れば Step 4 完了です。

1. fetchMe() が起動時に呼ばれる
2. name 未設定なら /profile/setup に飛ぶ
3. name 設定済みなら通常画面に入る

必要なら次に、Step 5 の members/expenses API に name を返す実装 をファイル単位で出します。
