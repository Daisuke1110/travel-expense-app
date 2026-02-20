import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTrip } from "../api/trips";

const COUNTRIES = [
  { code: "JP", label: "Japan", currency: "JPY" },
  { code: "US", label: "United States", currency: "USD" },
  { code: "GB", label: "United Kingdom", currency: "GBP" },
  { code: "EU", label: "Eurozone", currency: "EUR" },
  { code: "KR", label: "Korea", currency: "KRW" },
  { code: "TH", label: "Thailand", currency: "THB" },
  { code: "SG", label: "Singapore", currency: "SGD" },
  { code: "AU", label: "Australia", currency: "AUD" },
  { code: "CA", label: "Canada", currency: "CAD" },
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
      setRateError("Missing exchange rate API key.");
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
        throw new Error("Failed to fetch rate.");
      }
      setRateToJpy(String(data.conversion_rate));
    } catch (err) {
      setRateError((err as Error).message ?? "Failed to fetch rate.");
    } finally {
      setRateLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title || !country || !startDate || !endDate || !baseCurrency || !rateToJpy) {
      setError("All fields are required.");
      return;
    }

    if (!isUpper3(baseCurrency)) {
      setError("Base currency must be 3 uppercase letters.");
      return;
    }

    const parsedRate = Number(rateToJpy);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError("Rate to JPY must be a positive number.");
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
      setError((err as Error).message ?? "Failed to create trip");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="modal">
        <header className="modal__header">
          <div>
            <div className="modal__title">New Trip</div>
            <div className="modal__subtitle">Create a trip and invite friends.</div>
          </div>
          <Link className="modal__close" to="/">×</Link>
        </header>

        <form className="modal__form" onSubmit={onSubmit}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="field">
            <span>Country</span>
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
                Select country
              </option>
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.code})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>

          <label className="field">
            <span>End date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>

          <label className="field">
            <span>Base currency</span>
            <input value={baseCurrency} readOnly />
          </label>

          <label className="field">
            <span>Rate to JPY</span>
            <input
              type="number"
              step="0.01"
              value={rateToJpy}
              onChange={(e) => setRateToJpy(e.target.value)}
              required
            />
          </label>

          {rateLoading && <div className="status">Fetching rate...</div>}
          {rateError && <div className="status status--error">{rateError}</div>}
          {error && <div className="status status--error">{error}</div>}

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create Trip"}
          </button>
        </form>
      </div>

      <div className="modal-backdrop" />
    </div>
  );
}
