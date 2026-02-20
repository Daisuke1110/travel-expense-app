import sys
import importlib

zip_path = r"backend/lambda.zip"
sys.path.insert(0, zip_path)

print("追加したパス:", sys.path[0])
print("-" * 40)

try:
    import app.main

    print("✅ app.main の import に成功")
except Exception as e:
    print("❌ app.main の import に失敗")
    print("エラー:", type(e).__name__, str(e))

print("-" * 40)

try:
    lam = importlib.import_module("app.lambda")
    print("✅ app.lambda の import に成功")
    print("handler が存在するか:", hasattr(lam, "handler"))
except Exception as e:
    print("❌ app.lambda の import に失敗")
    print("エラー:", type(e).__name__, str(e))
