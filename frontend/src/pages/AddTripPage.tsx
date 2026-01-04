import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTrip } from "../api/trips";

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
            <input value={country} onChange={(e) => setCountry(e.target.value)} required />
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
            <input value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())} required />
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
