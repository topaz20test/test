import { describe, it, expect } from 'vitest';
import { getScoreRowTotal, pickReconciledJudgeScore } from './scoreReconciliation.js';

describe('getScoreRowTotal', () => {
  it('uses total_score when set', () => {
    expect(getScoreRowTotal({ total_score: 87.5, technique: 1, creativity: 1, presentation: 1, appearance: 1 })).toBe(87.5);
  });

  it('sums components when total_score absent', () => {
    expect(
      getScoreRowTotal({
        technique: 25,
        creativity: 25,
        presentation: 25,
        appearance: 25,
      })
    ).toBe(100);
  });

  it('handles half points', () => {
    expect(
      getScoreRowTotal({
        technique: 22.5,
        creativity: 23,
        presentation: 24,
        appearance: 25,
      })
    ).toBe(94.5);
  });
});

describe('pickReconciledJudgeScore', () => {
  const score = (total, idSuffix = '') => ({
    id: `score-${idSuffix}`,
    judge_number: 1,
    technique: total / 4,
    creativity: total / 4,
    presentation: total / 4,
    appearance: total / 4,
    total_score: total,
  });

  it('prefers primary row when it has a score', () => {
    const primaryId = 'entry-9';
    const candidates = [
      { entry: { id: primaryId, entry_number: 9 }, score: score(100, 'a') },
      { entry: { id: 'entry-15', entry_number: 15 }, score: score(20, 'b') },
      { entry: { id: 'entry-16', entry_number: 16 }, score: score(100, 'c') },
    ];
    const picked = pickReconciledJudgeScore(candidates, primaryId);
    expect(picked.total_score).toBe(100);
    expect(picked.id).toBe('score-a');
  });

  it('when primary missing score, picks highest total', () => {
    const primaryId = 'entry-9';
    const candidates = [
      { entry: { id: 'entry-15', entry_number: 15 }, score: score(20, 'b') },
      { entry: { id: 'entry-16', entry_number: 16 }, score: score(100, 'c') },
    ];
    const picked = pickReconciledJudgeScore(candidates, primaryId);
    expect(picked.total_score).toBe(100);
    expect(picked.id).toBe('score-c');
  });

  it('tie-breaks equal totals by lower entry_number', () => {
    const primaryId = 'missing';
    const candidates = [
      { entry: { id: 'e2', entry_number: 16 }, score: score(80, 'x') },
      { entry: { id: 'e1', entry_number: 15 }, score: score(80, 'y') },
    ];
    const picked = pickReconciledJudgeScore(candidates, primaryId);
    expect(picked.id).toBe('score-y');
  });
});
