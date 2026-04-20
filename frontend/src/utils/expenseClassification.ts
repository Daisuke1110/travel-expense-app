export type ExpenseKind =
  | "self"
  | "advance"
  | "advanced_by_other"
  | "shared"
  | "unrelated";

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

export function classifyExpense(
  currentUserId: string,
  paidByUserId: string,
  participantUserIds: string[] | undefined,
): ExpenseKind {
  const normalizedParticipantUserIds =
    normalizeParticipantUserIds(participantUserIds);
  const includesCurrentUser =
    !!currentUserId && normalizedParticipantUserIds.includes(currentUserId);

  if (
    normalizedParticipantUserIds.length === 1 &&
    includesCurrentUser &&
    paidByUserId === currentUserId
  ) {
    return "self";
  }

  if (
    normalizedParticipantUserIds.length === 1 &&
    !includesCurrentUser &&
    paidByUserId === currentUserId
  ) {
    return "advance";
  }

  if (
    normalizedParticipantUserIds.length === 1 &&
    includesCurrentUser &&
    paidByUserId !== currentUserId
  ) {
    return "advanced_by_other";
  }

  if (
    normalizedParticipantUserIds.length >= 2 &&
    (includesCurrentUser || paidByUserId === currentUserId)
  ) {
    return "shared";
  }

  return "unrelated";
}

export function getExpenseKindLabel(kind: ExpenseKind): string {
  switch (kind) {
    case "self":
      return "自分だけの費用";
    case "advance":
      return "自分が立て替えた費用";
    case "advanced_by_other":
      return "立て替えてもらった費用";
    case "shared":
      return "共通費";
    case "unrelated":
    default:
      return "自分に関係ない費用";
  }
}
