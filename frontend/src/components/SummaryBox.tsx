import { formatAmount } from "../utils/expenseShare";

type Props = {
  baseCurrency: string;
  totalAmount: number;
  totalYen: number;
  rateToJpy: number;
  myShareTotal: number;
  myAdvanceTotal: number;
  coveredByOthersTotal: number;
};

export default function SummaryBox({
  baseCurrency,
  totalAmount,
  totalYen,
  rateToJpy,
  myShareTotal,
  myAdvanceTotal,
  coveredByOthersTotal,
}: Props) {
  return (
    <div className="summary">
      <div>
        <div className="summary__label">合計 ({baseCurrency})</div>
        <div className="summary__value">
          {formatAmount(totalAmount)} {baseCurrency}
        </div>
      </div>
      <div>
        <div className="summary__label">合計 (JPY)</div>
        <div className="summary__value">¥{formatAmount(totalYen)}</div>
      </div>
      <div>
        <div className="summary__label">自分負担</div>
        <div className="summary__value">
          {formatAmount(myShareTotal)} {baseCurrency}
        </div>
      </div>
      <div>
        <div className="summary__label">立替中</div>
        <div className="summary__value">
          {formatAmount(myAdvanceTotal)} {baseCurrency}
        </div>
      </div>
      <div>
        <div className="summary__label">立て替えてもらい中</div>
        <div className="summary__value">
          {formatAmount(coveredByOthersTotal)} {baseCurrency}
        </div>
      </div>
      <div className="summary__rate">レート: 1 {baseCurrency} = ¥{rateToJpy}</div>
    </div>
  );
}
