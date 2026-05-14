/**
 * Persist active competition context in sessionStorage.
 * Survives page refresh but clears when tab/browser closes.
 */

const KEY_COMPETITION_ID = 'topaz_active_competition_id';
const KEY_JUDGE_NUMBER = 'topaz_active_judge_number';

export const setActiveCompetition = (competitionId) => {
  if (competitionId) {
    try {
      sessionStorage.setItem(KEY_COMPETITION_ID, competitionId);
    } catch (e) {
      console.warn('sessionStorage set failed:', e);
    }
  }
};

export const getActiveCompetition = () => {
  try {
    return sessionStorage.getItem(KEY_COMPETITION_ID) || null;
  } catch (e) {
    return null;
  }
};

export const setActiveJudge = (judgeNumber) => {
  if (judgeNumber) {
    try {
      sessionStorage.setItem(KEY_JUDGE_NUMBER, String(judgeNumber));
    } catch (e) {
      console.warn('sessionStorage set failed:', e);
    }
  }
};

export const getActiveJudge = () => {
  try {
    const n = sessionStorage.getItem(KEY_JUDGE_NUMBER);
    return n ? parseInt(n, 10) : null;
  } catch (e) {
    return null;
  }
};

export const clearActiveCompetition = () => {
  try {
    sessionStorage.removeItem(KEY_COMPETITION_ID);
    sessionStorage.removeItem(KEY_JUDGE_NUMBER);
  } catch (e) {
    console.warn('sessionStorage clear failed:', e);
  }
};
