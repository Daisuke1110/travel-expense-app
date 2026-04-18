import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTrip } from "../api/trips";

const COUNTRIES = [
  { code: "JP", label: "日本", currency: "JPY" },
  { code: "US", label: "アメリカ", currency: "USD" },
  { code: "GB", label: "イギリス", currency: "GBP" },
  { code: "EU", label: "ユーロ圏", currency: "EUR" },
  { code: "KR", label: "韓国", currency: "KRW" },
  { code: "TH", label: "タイ", currency: "THB" },
  { code: "SG", label: "シンガポール", currency: "SGD" },
  { code: "AU", label: "オーストラリア", currency: "AUD" },
  { code: "CA", label: "カナダ", currency: "CAD" },
];

function isUpper3(value: string) {
  return /^[A-Z]{3}$/.test(value);
}

export default function AddTripPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [rateToJpy, setRateToJpy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_EXCHANGE_RATE_API_KEY ?? "";
  // const selectedCountry = useMemo(
  //   () => COUNTRIES.find((item) => item.code === country) ?? null,
  //   [country]
  // );

  const fetchRate = async (currency: string) => {
    if (!apiKey) {
      setRateError("為替レート取得用の API キーが設定されていません。");
      return;
    }
    setRateLoading(true);
    setRateError(null);
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${currency}/JPY`
      );
      if (!res.ok) {
        throw new Error(`Rate API error: ${res.status}`);
      }
      const data = await res.json();
      if (data.result !== "success" || typeof data.conversion_rate !== "number") {
        throw new Error("為替レートの取得に失敗しました。");
      }
      setRateToJpy(String(data.conversion_rate));
    } catch (err) {
      setRateError((err as Error).message ?? "為替レートの取得に失敗しました。");
    } finally {
      setRateLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || !country || !startDate || !endDate || !baseCurrency || !rateToJpy) {
      setError("すべての項目を入力してください。");
      return;
    }

    if (!isUpper3(baseCurrency)) {
      setError("基準通貨は3文字の大文字コードで入力してください。");
      return;
    }

    const parsedRate = Number(rateToJpy);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError("JPY レートは正の数で入力してください。");
      return;
    }

    setSaving(true);
    try {
      const trip = await createTrip({
        title,
        country,
        start_date: startDate,
        end_date: endDate,
        base_currency: baseCurrency,
        rate_to_jpy: parsedRate,
      });
      navigate(`/trips/${trip.trip_id}`);
    } catch (err) {
      setError((err as Error).message ?? "旅行の作成に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="modal">
        <header className="modal__header">
          <div>
            <div className="modal__title">旅行を作成</div>
            <div className="modal__subtitle">新しい旅行を作成します。</div>
          </div>
          <Link className="modal__close" to="/">×</Link>
        </header>

        <form className="modal__form" onSubmit={onSubmit}>
          <label className="field">
            <span>タイトル</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="field">
            <span>国</span>
            <select
              value={country}
              onChange={(e) => {
                const code = e.target.value;
                setCountry(code);
                const match = COUNTRIES.find((item) => item.code === code);
                if (match) {
                  setBaseCurrency(match.currency);
                  fetchRate(match.currency);
                } else {
                  setBaseCurrency("");
                }
              }}
              required
            >
              <option value="" disabled>
                国を選択
              </option>
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.code})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>開始日</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>

          <label className="field">
            <span>終了日</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>

          <label className="field">
            <span>基準通貨</span>
            <input value={baseCurrency} readOnly />
          </label>

          <label className="field">
            <span>JPY レート</span>
            <input
              type="number"
              step="0.01"
              value={rateToJpy}
              onChange={(e) => setRateToJpy(e.target.value)}
              required
            />
          </label>

          {rateLoading && <div className="status">為替レートを取得中...</div>}
          {rateError && <div className="status status--error">{rateError}</div>}
          {error && <div className="status status--error">{error}</div>}

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "保存中..." : "旅行を作成"}
          </button>
        </form>
      </div>

      <div className="modal-backdrop" />
    </div>
  );
}
