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
