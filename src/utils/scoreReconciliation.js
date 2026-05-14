/**
 * Total from a scores row (prefer DB total_score).
 */
export function getScoreRowTotal(s) {
  if (s == null) return 0;
  const fromCol = parseFloat(s.total_score);
  if (!Number.isNaN(fromCol) && s.total_score != null && s.total_score !== '') return fromCol;
  return (
    (parseFloat(s.technique) || 0) +
    (parseFloat(s.creativity) || 0) +
    (parseFloat(s.presentation) || 0) +
    (parseFloat(s.appearance) || 0)
  );
}

/**
 * When merged routine rows have different scores for the same judge, pick one deterministically:
 * 1) Prefer the primary entry's row (canonical card).
 * 2) Else highest total; tie-break lowest entry_number.
 *
 * @param {Array<{ entry: object, score: object }>} candidates
 * @param {string} primaryEntryId
 */
export function pickReconciledJudgeScore(candidates, primaryEntryId) {
  if (!candidates?.length) return null;
  const onPrimary = candidates.find((c) => c.entry?.id === primaryEntryId);
  if (onPrimary) return onPrimary.score;
  return candidates.reduce((best, cur) => {
    const bt = getScoreRowTotal(best.score);
    const ct = getScoreRowTotal(cur.score);
    if (ct > bt) return cur;
    if (ct < bt) return best;
    const bn = best.entry?.entry_number ?? Infinity;
    const cn = cur.entry?.entry_number ?? Infinity;
    return cn < bn ? cur : best;
  }).score;
}
