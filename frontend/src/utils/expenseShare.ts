export type ExpenseShareSummary = {
  participantCount: number;
  perPersonAmount: number;
  myShareAmount: number;
  myAdvanceAmount: number;
  coveredByOthersAmount: number;
};

function normalizeParticipantUserIds(participantUserIds: string[] | undefined) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const userId of participantUserIds ?? []) {
    const value = String(userId).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function formatAmount(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function calculateExpenseShareSummary(
  currentUserId: string,
  amount: number,
  paidByUserId: string,
  participantUserIds: string[] | undefined,
): ExpenseShareSummary {
  const normalizedParticipantUserIds =
    normalizeParticipantUserIds(participantUserIds);
  const participantCount = normalizedParticipantUserIds.length;

  if (participantCount === 0) {
    return {
      participantCount: 0,
      perPersonAmount: 0,
      myShareAmount: 0,
      myAdvanceAmount: 0,
      coveredByOthersAmount: 0,
    };
  }

  const perPersonAmount = amount / participantCount;
  const includesCurrentUser =
    !!currentUserId && normalizedParticipantUserIds.includes(currentUserId);
  const myShareAmount = includesCurrentUser ? perPersonAmount : 0;
  const myAdvanceAmount =
    paidByUserId === currentUserId ? Math.max(0, amount - myShareAmount) : 0;
  const coveredByOthersAmount =
    paidByUserId !== currentUserId && includesCurrentUser ? myShareAmount : 0;

  return {
    participantCount,
    perPersonAmount,
    myShareAmount,
    myAdvanceAmount,
    coveredByOthersAmount,
  };
}
