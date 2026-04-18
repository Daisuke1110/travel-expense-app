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
        setError((err as Error).message ?? "プロフィールの読み込みに失敗しました。");
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
      setError("表示名を入力してください。");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateMe({ name: trimmed });
      navigate("/");
    } catch (err) {
      setError((err as Error).message ?? "プロフィールの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="status">プロフィールを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="modal">
        <header className="modal__header">
          <div>
            <div className="modal__title">プロフィール設定</div>
            <div className="modal__subtitle">
              旅行メンバーや支払者として表示する名前を設定します。
            </div>
          </div>
        </header>

        <form className="modal__form" onSubmit={onSubmit}>
          <label className="field">
            <span>メールアドレス</span>
            <input type="text" value={email} disabled />
          </label>

          <label className="field">
            <span>表示名</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: ダイスケ"
              maxLength={50}
              required
            />
          </label>

          {error && <div className="status status--error">{error}</div>}

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </form>
      </div>
    </div>
  );
}
