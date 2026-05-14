// Supabase configuration and client
export { supabase, testConnection } from './config';

// Competition functions
export {
  createCompetition,
  getCompetition,
  getAllCompetitions,
  updateCompetition,
  deleteCompetition,
  getCompetitionStats
} from './competitions';

// Category functions
export {
  createCategory,
  getCompetitionCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  bulkCreateCategories
} from './categories';

// Age division functions
export {
  createAgeDivision,
  getCompetitionAgeDivisions,
  getAgeDivision,
  updateAgeDivision,
  deleteAgeDivision,
  bulkCreateAgeDivisions
} from './ageDivisions';

// Entry functions
export {
  createEntry,
  getCompetitionEntries,
  getEntry,
  getEntriesByCategory,
  getEntriesByAgeDivision,
  updateEntry,
  deleteEntry,
  bulkCreateEntries,
  getNextEntryNumber
} from './entries';

// Score functions
export {
  createScore,
  getEntryScores,
  getCompetitionScores,
  getJudgeScores,
  updateScore,
  deleteScore,
  checkExistingScore,
  bulkCreateScores
} from './scores';

// Photo functions
export {
  uploadEntryPhoto,
  deleteEntryPhoto,
  bulkUploadPhotos,
  getCompetitionPhotos,
  updateEntryPhotoUrl
} from './photos';

// Realtime functions
export {
  subscribeToScores,
  subscribeToEntries,
  subscribeToMedalStandings,
  subscribeToCompetition,
  unsubscribeFromChannel,
  subscribeToCompetitionData,
  unsubscribeFromAllChannels
} from './realtime';

