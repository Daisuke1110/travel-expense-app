import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExpenseItemCard from "../components/ExpenseItem";
import SummaryBox from "../components/SummaryBox";
import { addTripMember, deleteTrip, updateTrip } from "../api/trips";
import { getCurrentUserId } from "../auth/currentUser";
import { useExpenses } from "../hooks/useExpenses";
import { useMembers } from "../hooks/useMembers";
import { useTrip } from "../hooks/useTrip";
import { formatJapaneseDate } from "../utils/date";
import { calculateExpenseShareSummary } from "../utils/expenseShare";

export default function TripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const tripState = useTrip(tripId);
  const expenseState = useExpenses(tripId);
  const memberState = useMembers(tripId);
  const [rateInput, setRateInput] = useState("");
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [tripError, setTripError] = useState<string | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);

  const totals = useMemo(() => {
    const totalAmount = expenseState.data.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const rate = tripState.data?.rate_to_jpy ?? 0;
    const totalYen = Math.round(totalAmount * rate);
    return { totalAmount, totalYen };
  }, [expenseState.data, tripState.data]);

  const currentUserId = getCurrentUserId();

  const settlementTotals = useMemo(() => {
    return expenseState.data.reduce(
      (sum, item) => {
        const shareSummary = calculateExpenseShareSummary(
          currentUserId,
          item.amount,
          item.paid_by_user_id,
          item.participant_user_ids,
        );

        sum.myShareTotal += shareSummary.myShareAmount;
        sum.myAdvanceTotal += shareSummary.myAdvanceAmount;
        sum.coveredByOthersTotal += shareSummary.coveredByOthersAmount;
        return sum;
      },
      {
        myShareTotal: 0,
        myAdvanceTotal: 0,
        coveredByOthersTotal: 0,
      },
    );
  }, [currentUserId, expenseState.data]);

  const memberNameById = useMemo(() => {
    return new Map(
      memberState.data.map((member) => [
        member.user_id,
        member.name ?? member.user_id,
      ]),
    );
  }, [memberState.data]);

  const paidTotals = useMemo(() => {
    const totalsByUserId = new Map<string, number>();

    memberState.data.forEach((member) => {
      totalsByUserId.set(member.user_id, 0);
    });

    expenseState.data.forEach((item) => {
      const current = totalsByUserId.get(item.paid_by_user_id) ?? 0;
      totalsByUserId.set(item.paid_by_user_id, current + item.amount);
    });

    return Array.from(totalsByUserId.entries())
      .map(([userId, totalAmount]) => ({
        userId,
        totalAmount,
        totalYen: Math.round(totalAmount * (tripState.data?.rate_to_jpy ?? 0)),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expenseState.data, memberState.data, tripState.data]);

  const canDelete =
    !!tripState.data?.owner_id && tripState.data.owner_id === currentUserId;
  const canEditRate = canDelete;

  const handleDelete = async () => {
    if (!tripState.data) return;
    const ok = window.confirm(
      "この旅行を削除しますか？ この操作は元に戻せません。",
    );
    if (!ok) return;
    await deleteTrip(tripState.data.trip_id);
    navigate("/");
  };

  const handleRateSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripState.data) return;

    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError("レートは正の数で入力してください。");
      return;
    }

    setRateError(null);
    setSavingRate(true);
    try {
      const updated = await updateTrip(tripState.data.trip_id, {
        rate_to_jpy: parsed,
      });
      tripState.data.rate_to_jpy = updated.rate_to_jpy;
      setRateInput("");
    } catch (err) {
      setRateError((err as Error).message ?? "レートの更新に失敗しました。");
    } finally {
      setSavingRate(false);
    }
  };

  const handleTripSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripState.data) return;

    const title = titleInput.trim();
    const startDate = startDateInput.trim();
    const endDate = endDateInput.trim();
    if (!title || !startDate || !endDate) {
      setTripError("タイトルと日付を入力してください。");
      return;
    }

    setTripError(null);
    setSavingTrip(true);
    try {
      const updated = await updateTrip(tripState.data.trip_id, {
        title,
        start_date: startDate,
        end_date: endDate,
      });
      tripState.data.title = updated.title;
      tripState.data.start_date = updated.start_date;
      tripState.data.end_date = updated.end_date;
      setTitleInput("");
      setStartDateInput("");
      setEndDateInput("");
    } catch (err) {
      setTripError((err as Error).message ?? "旅行情報の更新に失敗しました。");
    } finally {
      setSavingTrip(false);
    }
  };

  const handleMemberSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripState.data) return;

    const email = memberEmail.trim();
    if (!email) {
      setMemberError("メールアドレスを入力してください。");
      return;
    }

    setMemberError(null);
    setSavingMember(true);
    try {
      await addTripMember(tripState.data.trip_id, { email });
      setMemberEmail("");
      await memberState.refresh();
    } catch (err) {
      setMemberError(
        (err as Error).message ?? "メンバーの追加に失敗しました。",
      );
    } finally {
      setSavingMember(false);
    }
  };

  if (tripState.loading) {
    return (
      <div className="page">
        <div className="status">旅行情報を読み込み中...</div>
      </div>
    );
  }

  if (tripState.error || !tripState.data) {
    return (
      <div className="page">
        <div className="status status--error">
          {tripState.error ?? "旅行が見つかりません。"}
        </div>
        <Link className="back-link" to="/">
          旅行一覧へ戻る
        </Link>
      </div>
    );
  }

  const trip = tripState.data;

  return (
    <div className="page">
      <header className="detail-header">
        <Link className="back-link" to="/">
          ＜ 旅行一覧
        </Link>
        <h1 className="detail-title">{trip.title}</h1>
      </header>

      <SummaryBox
        baseCurrency={trip.base_currency}
        totalAmount={totals.totalAmount}
        totalYen={totals.totalYen}
        rateToJpy={trip.rate_to_jpy}
        myShareTotal={settlementTotals.myShareTotal}
        myAdvanceTotal={settlementTotals.myAdvanceTotal}
        coveredByOthersTotal={settlementTotals.coveredByOthersTotal}
      />

      <section className="paid-summary">
        <div className="section-title">支払合計</div>
        {memberState.loading && (
          <div className="status">メンバーを読み込み中...</div>
        )}
        {!memberState.loading && paidTotals.length === 0 && (
          <div className="empty">まだ支払データがありません。</div>
        )}
        <div className="paid-summary__list">
          {paidTotals.map((item) => (
            <div key={item.userId} className="paid-summary__item">
              <div className="paid-summary__user">
                {memberNameById.get(item.userId) ?? item.userId}
              </div>
              <div className="paid-summary__values">
                <div>
                  {item.totalAmount} {trip.base_currency}
                </div>
                <div className="muted">{item.totalYen} 円</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {canEditRate && (
        <section className="settings">
          <div className="settings__header">
            <div className="section-title">旅行設定</div>
            <button
              className="settings__toggle"
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
            >
              {settingsOpen ? "閉じる" : "編集"}
            </button>
          </div>
          {!settingsOpen && (
            <div className="settings__summary">
              <div>{trip.title}</div>
              <div>
                {formatJapaneseDate(trip.start_date)} - {formatJapaneseDate(trip.end_date)}
              </div>
              <div>基準通貨: {trip.base_currency}</div>
              <div>レート: {trip.rate_to_jpy}</div>
              <div className="settings__members">
                <div className="settings__label">メンバー</div>
                {memberState.loading && (
                  <div className="status">メンバーを読み込み中...</div>
                )}
                {memberState.error && (
                  <div className="status status--error">
                    {memberState.error}
                  </div>
                )}
                {!memberState.loading && memberState.data.length === 0 && (
                  <div className="empty">メンバーはまだいません。</div>
                )}
                <div className="members-list">
                  {memberState.data.map((member) => (
                    <div key={member.user_id} className="members-list__item">
                      <span className="members-list__user">
                        {member.name ?? member.user_id}
                      </span>
                      <span className="members-list__role">{member.role}</span>
                      {canDelete && member.role !== "owner" && (
                        <button
                          className="members-list__delete"
                          type="button"
                          onClick={() => memberState.remove(member.user_id)}
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {settingsOpen && (
            <form className="settings__form" onSubmit={handleTripSave}>
              <label className="field">
                <span>タイトル</span>
                <input
                  type="text"
                  placeholder={trip.title}
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                />
              </label>
              <label className="field">
                <span>開始日</span>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(event) => setStartDateInput(event.target.value)}
                />
              </label>
              <label className="field">
                <span>終了日</span>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(event) => setEndDateInput(event.target.value)}
                />
              </label>
              {tripError && (
                <div className="status status--error">{tripError}</div>
              )}
              <button className="primary" type="submit" disabled={savingTrip}>
                {savingTrip ? "保存中..." : "旅行情報を更新"}
              </button>
            </form>
          )}

          {settingsOpen && <div className="settings__divider" />}

          {settingsOpen && (
            <form className="settings__form" onSubmit={handleRateSave}>
              <label className="field">
                <span>基準通貨</span>
                <input type="text" value={trip.base_currency} disabled />
              </label>
              <label className="field">
                <span>JPY レート</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={String(trip.rate_to_jpy)}
                  value={rateInput}
                  onChange={(event) => setRateInput(event.target.value)}
                />
              </label>
              {rateError && (
                <div className="status status--error">{rateError}</div>
              )}
              <button className="primary" type="submit" disabled={savingRate}>
                {savingRate ? "保存中..." : "レートを更新"}
              </button>
            </form>
          )}

          {settingsOpen && <div className="settings__divider" />}

          {settingsOpen && (
            <form className="settings__form" onSubmit={handleMemberSave}>
              <label className="field">
                <span>メンバー追加</span>
                <input
                  type="text"
                  placeholder="foo@example.com"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                />
              </label>
              {memberError && (
                <div className="status status--error">{memberError}</div>
              )}
              <button className="primary" type="submit" disabled={savingMember}>
                {savingMember ? "追加中..." : "メンバーを追加"}
              </button>
            </form>
          )}
        </section>
      )}

      {canDelete && (
        <button className="danger" onClick={handleDelete}>
          旅行を削除
        </button>
      )}

      <section className="expenses-section">
        <div className="section-title">支出一覧</div>
        {expenseState.loading && (
          <div className="status">支出を読み込み中...</div>
        )}
        {expenseState.error && (
          <div className="status status--error">{expenseState.error}</div>
        )}
        {!expenseState.loading && expenseState.data.length === 0 && (
          <div className="empty">まだ支出がありません。</div>
        )}
        <div className="expense-list">
          {expenseState.data.map((item) => (
            <ExpenseItemCard
              currentUserId={currentUserId}
              key={item.expense_id}
              item={item}
              members={memberState.data}
              rateToJpy={trip.rate_to_jpy}
              onDelete={expenseState.remove}
              onUpdate={expenseState.update}
            />
          ))}
        </div>
      </section>

      <Link className="fab" to={`/trips/${trip.trip_id}/add`}>
        + 支出を追加
      </Link>
    </div>
  );
}
