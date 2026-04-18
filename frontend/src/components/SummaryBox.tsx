type Props = {
  baseCurrency: string;
  totalAmount: number;
  totalYen: number;
  rateToJpy: number;
};

export default function SummaryBox({
  baseCurrency,
  totalAmount,
  totalYen,
  rateToJpy,
}: Props) {
  return (
    <div className="summary">
      <div>
        <div className="summary__label">合計 ({baseCurrency})</div>
        <div className="summary__value">
          {totalAmount} {baseCurrency}
        </div>
      </div>
      <div>
        <div className="summary__label">合計 (JPY)</div>
        <div className="summary__value">¥{totalYen}</div>
      </div>
      <div className="summary__rate">レート: 1 {baseCurrency} = ¥{rateToJpy}</div>
    </div>
  );
}
