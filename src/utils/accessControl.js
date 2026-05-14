const JUDGE_LOCK_KEY = 'topaz_judge_locked';
const ADMIN_UNLOCKED_KEY = 'topaz_admin_unlocked';

export const ADMIN_PASSWORD = 'topazadmin';

export const lockJudgeMode = () => {
  sessionStorage.setItem(JUDGE_LOCK_KEY, 'true');
  sessionStorage.removeItem(ADMIN_UNLOCKED_KEY);
};

export const unlockJudgeMode = () => {
  sessionStorage.removeItem(JUDGE_LOCK_KEY);
};

export const isJudgeLocked = () => {
  return sessionStorage.getItem(JUDGE_LOCK_KEY) === 'true';
};

export const markAdminUnlocked = () => {
  sessionStorage.setItem(ADMIN_UNLOCKED_KEY, 'true');
};

export const clearAdminUnlocked = () => {
  sessionStorage.removeItem(ADMIN_UNLOCKED_KEY);
};

export const isAdminUnlocked = () => {
  return sessionStorage.getItem(ADMIN_UNLOCKED_KEY) === 'true';
};

export const verifyAdminPassword = (password) => {
  return password === ADMIN_PASSWORD;
};
