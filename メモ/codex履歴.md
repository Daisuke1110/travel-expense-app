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

› step4の実装が完了しました。次にstep5をお願いします。
Step 5. APIレスポンスに name を含める
目的:

- 画面表示を sub から name 優先に変えるためのデータを返す

やること:

1. GET /trips/{tripId}/members に name を追加
2. GET /trips/{tripId}/expenses に paid_by_name を追加
3. 必要なら user_name も追加
4. Users テーブルを batch_get してマージ

完了条件:

- members/expenses API が name 系フィールドを返す

• 以下の形で実装してください。
Step 5 の目的は、members と expenses API が name を返せるようにすることです。

———

## 1. TripMemberItem と ExpenseItem を拡張する

対象: C:\travel-expense-app\backend\app\routes\trips.py

### TripMemberItem

class TripMemberItem(BaseModel):  
 user_id: str  
 name: Optional[str] = None  
 trip_id: str  
 role: str  
 joined_at: Optional[str] = None

### ExpenseItem

class ExpenseItem(BaseModel):
expense_id: str  
 trip_id: str  
 user_id: str  
 user_name: Optional[str] = None  
 paid_by_user_id: str  
 paid_by_name: Optional[str] = None
amount: float  
 currency: str  
 category: Optional[str] = None  
 note: Optional[str] = None  
 datetime: str  
 datetime_expense_id: str  
 created_at: Optional[str] = None

意味:

- user_name: 誰が登録したかの表示名
- paid_by_name: 誰が支払ったかの表示名

———

## 2. Users をまとめて引く helper を追加する

同じ trips.py に helper を追加します。  
 既存の \_batch_get_items(...) を使えば十分です。

def \_get_user_name_map(dynamodb, users_table: str, user_ids: List[str]) -> Dict[str, str]:  
 unique_ids = list({user_id for user_id in user_ids if user_id})  
 users = \_batch_get_items(  
 dynamodb=dynamodb,  
 table_name=users_table,  
 ids=unique_ids,  
 key_name="user_id",  
 )
return {  
 user["user_id"]: user.get("name") or user.get("email") or user["user_id"]  
 for user in users  
 if "user_id" in user  
 }

### ここでの方針

表示名は次の優先順にしています。

1. name
2. email
3. user_id

理由:

- name 未設定でも UI を壊さない
- 一時的に email を見せたくないなら or user["user_id"] だけにしてもよいです

———

## 3. GET /trips/{trip_id}/members に name を追加する

対象: list_trip_members(...)

今の members = \_query_trip_members_by_trip_id(...) の後に、name_map を作ってマージします。

members = \_query_trip_members_by_trip_id(  
 dynamodb=dynamodb,  
 table_name=tables["trip_members"],  
 trip_id=trip_id,  
 )

name_map = \_get_user_name_map(  
 dynamodb=dynamodb,
users_table=tables["users"],  
 user_ids=[item.get("user_id", "") for item in members],  
 )

return TripMembersResponse(  
 members=[
TripMemberItem(
user_id=item.get("user_id", ""),
name=name_map.get(item.get("user_id", "")),
trip_id=item.get("trip_id", ""),
role=item.get("role", ""),
joined_at=item.get("joined_at"),
)
for item in members
]  
 )

———

## 4. GET /trips/{trip_id}/expenses に paid_by_name / user_name を追加する

対象: list_expenses(...)

Expense 一覧取得後、user_id と paid_by_user_id をまとめて Users から引きます。

### 追加する処理

items を取得した後、expenses を組み立てる前にこれを追加:

user_ids_for_names: List[str] = []  
 for item in items:  
 user_ids_for_names.append(item.get("user_id", ""))  
 user_ids_for_names.append(item.get("paid_by_user_id", item.get("user_id", "")))

name_map = \_get_user_name_map(  
 dynamodb=dynamodb,  
 users_table=tables["users"],  
 user_ids=user_ids_for_names,  
 )

### ExpenseItem(...) をこう変える

expenses.append(  
 ExpenseItem(  
 expense_id=item.get("expense_id", ""),  
 trip_id=item.get("trip_id", ""),  
 user_id=item.get("user_id", ""),  
 user_name=name_map.get(item.get("user_id", "")),  
 paid_by_user_id=item.get("paid_by_user_id", item.get("user_id", "")),  
 paid_by_name=name_map.get(  
 item.get("paid_by_user_id", item.get("user_id", ""))  
 ),  
 amount=\_as_float(item.get("amount", 0)),  
 currency=item.get("currency", ""),  
 category=item.get("category"),  
 note=item.get("note"),  
 datetime=item.get("datetime", ""),  
 datetime_expense_id=item.get("datetime_expense_id", ""),  
 created_at=item.get("created_at"),  
 )  
 )

———

## 5. create_expense と update_expense のレスポンスにも name を含める

ここは一覧APIだけでも要件は満たせますが、作成直後/更新直後のレスポンスにも name を載せた方がフロントが楽です。

### create_expense(...)

返却直前に name_map を作る:

name_map = \_get_user_name_map(  
 dynamodb=dynamodb,
users_table=tables["users"],  
 user_ids=[user_id, paid_by_user_id],  
 )

返却をこう変更:

return ExpenseItem(  
 expense_id=expense_id,  
 trip_id=trip_id,  
 user_id=user_id,  
 user_name=name_map.get(user_id),  
 paid_by_user_id=paid_by_user_id,  
 paid_by_name=name_map.get(paid_by_user_id),  
 amount=\_as_float(amount),
currency=req.currency,  
 category=req.category,  
 note=req.note,  
 datetime=datetime_value,  
 datetime_expense_id=datetime_expense_id,  
 created_at=created_at,  
 )

### update_expense(...)

updated を作った後に同様に:

updated_user_id = updated.get("user_id", "")  
 updated_paid_by_user_id = updated.get("paid_by_user_id", updated_user_id)

name_map = \_get_user_name_map(  
 dynamodb=dynamodb,  
 users_table=tables["users"],  
 user_ids=[updated_user_id, updated_paid_by_user_id],  
 )

返却をこう変更:

return ExpenseItem(  
 expense_id=updated.get("expense_id", ""),  
 trip_id=updated.get("trip_id", ""),  
 user_id=updated_user_id,  
 user_name=name_map.get(updated_user_id),  
 paid_by_user_id=updated_paid_by_user_id,  
 paid_by_name=name_map.get(updated_paid_by_user_id),  
 amount=\_as_float(updated.get("amount", 0)),  
 currency=updated.get("currency", ""),  
 category=updated.get("category"),
note=updated.get("note"),  
 datetime=updated.get("datetime", ""),  
 datetime_expense_id=updated.get("datetime_expense_id", ""),  
 created_at=updated.get("created_at"),  
 )

———

## 6. 変更後に確認するAPI

### Members API

Invoke-RestMethod `                                                                                                                                                                                                                                                       
    -Method GET`  
 -Uri "https://travel-expense-api-dev.daisuke-selfstudy.com/trips/<tripId>/members" `  
 -Headers @{ Authorization = "Bearer $TOKEN" }

期待:

{  
 "members": [
{
"user_id": "...",
"name": "Daisuke",
"trip_id": "...",
"role": "owner"
}
]  
 }

### Expenses API

Invoke-RestMethod `                                                                                                                                                                                                                                                       
    -Method GET`  
 -Uri "https://travel-expense-api-dev.daisuke-selfstudy.com/trips/<tripId>/expenses" `  
 -Headers @{ Authorization = "Bearer $TOKEN" }

期待:

{  
 "expenses": [
{
"expense_id": "...",
"user_id": "...",
"user_name": "Daisuke",
"paid_by_user_id": "...",
"paid_by_name": "Hanako",
"amount": 120
}
]  
 }

———

## 7. このステップの完了条件

以下が満たされれば Step 5 完了です。

1. GET /trips/{tripId}/members が name を返す
2. GET /trips/{tripId}/expenses が paid_by_name を返す
3. 必要なら user_name も返す
4. いずれも Users テーブルから batch_get で名前解決している

———

## 実装順のおすすめ

1. 型追加
2. \_get_user_name_map() 追加
3. members API 変更
4. expenses API 変更
5. create_expense / update_expense の返却調整
6. dev デプロイして API 確認

必要なら次に、Step 6 のフロント表示変更をそのまま書ける形で出します。
