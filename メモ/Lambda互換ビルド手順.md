docker run -it --rm --entrypoint bash -v "$($PWD.Path):/work" -w /work public.ecr.aws/lambda/python:3.13
rm -rf build lambda.zip
mkdir -p build
pip install -r requirements.txt -t build
cp -r app build/app
cd build
python -m zipfile -c ../lambda.zip .

3. API確認（dev）
   $API_BASE と $TRIP_ID は実値に置き換え。

- 3-1. Debugヘッダあり → 成功（200系）

Invoke-RestMethod -Method GET -Uri "$API_BASE/me/trips" -Headers @{ "X-Debug-User-Id"="kaito" }

- 3-2. ヘッダなし（JWTもなし） → 401

try {
Invoke-RestMethod -Method GET -Uri "$API*BASE/me/trips"
} catch {
$\*.Exception.Response.StatusCode.value\__
$_.ErrorDetails.Message
}

4. 既存の403テストを再実施（権限制御が壊れていないか）

- member で owner専用API（PATCH /trips/{id} など）を叩いて 403 を確認。

5. 次の実装フェーズ

- フロント frontend/src/api/client.ts を
  - JWTトークンがあれば Authorization: Bearer ...
  - dev移行中のみ X-Debug-User-Id フォールバック
    に変更。

必要なら次で、client.ts の具体的な変更コードをそのまま貼ります。

Invoke-RestMethod -Method GET -Uri "http://localhost:8000/me/trips" -Headers @{ "X-Debug-User-Id" = "kaito" }
