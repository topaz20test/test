/**
 * Normalization for matching website-synced labels to competition categories / filters.
 * Case-insensitive; removes hyphens and whitespace (see product requirement).
 */
export function normalizeMatchKey(str) {
  if (str == null || str === '') return '';
  return String(str).toLowerCase().replace(/[-\s]/g, '');
}

export function normalizeFilterText(str) {
  if (str == null || str === '') return '';
  return String(str).toLowerCase().trim().replace(/[-\s]+/g, ' ');
}


export function cleanDisplayText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null' || lowered === 'nan') return fallback;
  return text;
}

export function firstDisplayValue(...values) {
  for (const value of values) {
    const cleaned = cleanDisplayText(value, '');
    if (cleaned) return cleaned;
  }
  return '';
}

export function getAgeGroup(age) {
  const n = parseInt(age, 10);
  if (Number.isNaN(n)) return 'Unknown';
  if (n >= 3 && n <= 7) return 'Junior Primary (3-7)';
  if (n >= 8 && n <= 10) return 'Primary (8-10)';
  if (n >= 11 && n <= 13) return 'Junior (11-13)';
  if (n >= 14 && n <= 18) return 'Teen (14-18)';
  if (n >= 19) return 'Senior (19+)';
  return 'Unknown';
}

export function getEntryAgeGroupLabel(entry, ageDivisionsList = []) {
  if (!entry) return 'Unknown';

  if (entry.age_division?.name) {
    const withRange =
      entry.age_division.min_age != null && entry.age_division.max_age != null
        ? `${entry.age_division.name} (${entry.age_division.min_age}-${entry.age_division.max_age})`
        : entry.age_division.name;
    return withRange;
  }

  if (entry.age_division_id) {
    const byId = ageDivisionsList.find((d) => d.id === entry.age_division_id);
    if (byId?.name) {
      const withRange =
        byId.min_age != null && byId.max_age != null
          ? `${byId.name} (${byId.min_age}-${byId.max_age})`
          : byId.name;
      return withRange;
    }
  }

  return getAgeGroup(entry.age);
}

/**
 * Normalize division-type strings for admin division filters (extends legacy normalization).
 */
export function normalizeDivisionCompare(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[-_\s()/]/g, '');
}

function normalizeDivisionLabel(raw) {
  if (raw == null || raw === '') return '';
  let divisionType = String(raw).trim();
  const pipeIndex = divisionType.indexOf('|');
  if (pipeIndex > -1) {
    const beforePipe = divisionType.substring(0, pipeIndex).trim();
    const afterPipe = divisionType.substring(pipeIndex + 1).trim();
    const beforeNorm = normalizeDivisionCompare(beforePipe);
    const afterNorm = normalizeDivisionCompare(afterPipe);
    const beforeLooksLikeDivision = /solo|duo|trio|smallgroup|largegroup|production/.test(beforeNorm);
    const afterLooksLikeDivision = /solo|duo|trio|smallgroup|largegroup|production/.test(afterNorm);
    divisionType = beforeLooksLikeDivision ? beforePipe : afterLooksLikeDivision ? afterPipe : beforePipe;
  }

  divisionType = divisionType.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const lower = divisionType.toLowerCase();

  if (lower.includes('small group')) return 'Small Group';
  if (lower.includes('large group')) return 'Large Group';
  if (lower.includes('duo') && !lower.includes('trio')) return 'Duo';
  if (lower.includes('trio')) return 'Trio';
  if (lower.includes('production')) return 'Production';
  if (lower.includes('student choreography')) return 'Student Choreography';
  if (lower.includes('teacher') && lower.includes('student')) return 'Teacher/Student';
  if (lower.includes('solo')) return 'Solo';
  return '';
}

export function getEntryDivisionType(entry) {
  const direct = normalizeDivisionLabel(entry?.division_type);
  if (direct) return direct;

  const danceText = normalizeDivisionLabel(entry?.dance_type);
  if (danceText) return danceText;

  // Last-resort fallback for imported group records where dance_type stores only the style
  // (for example "Vocal") but group_members tells us this is a Duo/Trio/Group.
  const memberCount = Array.isArray(entry?.group_members) ? entry.group_members.length : 0;
  if (memberCount === 2) return 'Duo';
  if (memberCount === 3) return 'Trio';
  if (memberCount >= 4 && memberCount <= 10) return 'Small Group';
  if (memberCount >= 11) return 'Large Group';

  return 'Solo';
}

export function getGroupMemberNames(entry) {
  const gm = entry?.group_members;
  if (Array.isArray(gm) && gm.length > 0) {
    return gm
      .map((m) => (typeof m === 'string' ? m : m?.name))
      .map((name) => cleanDisplayText(name, ''))
      .filter(Boolean);
  }

  const dt = entry?.dance_type;
  if (typeof dt === 'string') {
    try {
      const match = dt.match(/Members: (\[.*?\])/);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          return parsed
            .map((m) => (typeof m === 'string' ? m : m?.name))
            .map((name) => cleanDisplayText(name, ''))
            .filter(Boolean);
        }
      }
    } catch {
      /* ignore malformed legacy member data */
    }
  }

  return [];
}

export function getGroupMemberNamesLabel(entry) {
  const names = getGroupMemberNames(entry);
  return names.length ? names.join(' + ') : '';
}

/**
 * Display label: "#{entry_number} {routine/group name}".
 * For duos/trios/groups, competitor_name is treated as the routine/group name
 * and group_members holds the actual dancer entry names.
 */
export function formatEntryName(entry) {
  if (!entry) return 'Entry';
  const num = cleanDisplayText(entry.entry_number, '?');
  const routineName = getRoutineDisplayTitle(entry) || 'Untitled Entry';
  return '#' + num + ' ' + routineName;
}

/** @deprecated Use formatEntryName — same implementation */
export const formatEntryNameWithNumber = formatEntryName;

export function getAbilityLevel(entry) {
  return cleanDisplayText(entry?.ability_level, 'Not specified');
}

export function getMemberCount(entry) {
  if (!entry) return 0;
  if (Array.isArray(entry.group_members) && entry.group_members.length > 0) {
    return entry.group_members.length;
  }
  const d = getEntryDivisionType(entry);
  if (d === 'Duo') return 2;
  if (d === 'Trio') return 3;
  if (d === 'Small Group') return 6;
  if (d === 'Large Group') return 11;
  if (d === 'Production') return 10;
  return 0;
}

function normMemberToken(m) {
  if (m == null) return '';
  if (typeof m === 'string') return m.toLowerCase().trim();
  if (typeof m === 'object') return String(m.name ?? '').toLowerCase().trim();
  return '';
}

function memberTokens(entry) {
  const gm = entry?.group_members;
  if (!Array.isArray(gm) || gm.length === 0) return [];
  return gm.map(normMemberToken).filter(Boolean);
}

/** True if two entries share at least one group member name (case-insensitive). */
export function sharesMemberBetweenEntries(a, b) {
  const aMembers = memberTokens(a);
  const bMembers = memberTokens(b);
  if (!aMembers.length || !bMembers.length) return false;
  return aMembers.some((m) => m && bMembers.includes(m));
}

/**
 * Group DB rows into one scoring routine.
 * Non-Solo rows with group_members: same division_type + same dance_type + overlapping member names → one primary + siblings.
 * Solos, or rows without group member data, stay standalone (incl. Production with null group_members).
 */
export function groupEntries(entries) {
  if (!entries || !Array.isArray(entries)) {
    return { primary: [], siblingMap: new Map() };
  }

  const sorted = [...entries].sort(
    (a, b) => (a.entry_number ?? 0) - (b.entry_number ?? 0)
  );

  const primary = [];
  const siblingMap = new Map();
  const assignedIds = new Set();
  const sameScoringDivision = (a, b) =>
    getEntryDivisionType(a) === getEntryDivisionType(b) &&
    normalizeMatchKey(getEntryStyleLabelForCategoryMatch(a) || a?.dance_type || '') ===
      normalizeMatchKey(getEntryStyleLabelForCategoryMatch(b) || b?.dance_type || '') &&
    (a?.category_id || '') === (b?.category_id || '') &&
    (a?.age_division_id || '') === (b?.age_division_id || '');

  for (const entry of sorted) {
    if (!entry || entry.id == null || assignedIds.has(entry.id)) continue;

    if (!isGroupDivisionForScoring(entry)) {
      primary.push(entry);
      siblingMap.set(entry.id, []);
      assignedIds.add(entry.id);
      continue;
    }

    const routineKey = getRoutineGroupKey(entry);
    const siblings = [];

    for (const other of sorted) {
      if (!other || other.id === entry.id || assignedIds.has(other.id)) continue;
      if (!isGroupDivisionForScoring(other)) continue;
      if (!sameScoringDivision(entry, other)) continue;

      const sameRoutineKey = getRoutineGroupKey(other) === routineKey;
      const sameMembers = sharesMemberBetweenEntries(entry, other);

      // Imported website rows may create one row per dancer/entry number.
      // Merge them into one scoring card when they are the same routine by
      // routine key, or when the member lists overlap within the same style/division.
      if (sameRoutineKey || sameMembers) {
        siblings.push(other);
        assignedIds.add(other.id);
      }
    }

    primary.push(entry);
    siblingMap.set(entry.id, siblings);
    assignedIds.add(entry.id);
  }

  return { primary, siblingMap };
}

/** Division type filter — exact match on entries.division_type (null/undefined treated as Solo). */
export function matchesDivisionTypeFilter(entry, filter) {
  if (!filter || filter === 'all') return true;
  if (!entry) return false;

  const selected = normalizeDivisionCompare(filter);
  const normalizedDivision = normalizeDivisionCompare(getEntryDivisionType(entry));

  if (normalizedDivision === selected) return true;

  // Fallback for imported/legacy records where the division may be embedded
  // in dance_type instead of division_type, e.g. "Vocal | Duo" or "Duo - Jazz".
  const rawText = normalizeDivisionCompare(
    [entry.division_type, entry.dance_type, entry.category_name, entry.name]
      .filter(Boolean)
      .join(' ')
  );

  if (selected === 'duo') return rawText.includes('duo') && !rawText.includes('trio');
  if (selected === 'trio') return rawText.includes('trio');
  if (selected === 'smallgroup') return rawText.includes('smallgroup');
  if (selected === 'largegroup') return rawText.includes('largegroup');
  if (selected === 'production') return rawText.includes('production');
  if (selected === 'studentchoreography') return rawText.includes('studentchoreography');
  if (selected === 'teacherstudent') return rawText.includes('teacherstudent');
  if (selected === 'solo') {
    return !rawText.includes('duo') &&
      !rawText.includes('trio') &&
      !rawText.includes('smallgroup') &&
      !rawText.includes('largegroup') &&
      !rawText.includes('production');
  }

  return false;
}


export const SPECIAL_CATEGORY_DIVISION_FILTERS = [
  'Production',
  'Student Choreography',
  'Teacher/Student'
];

export function matchesSpecialCategoryDivisionFilter(entry, filter, categoriesList = []) {
  if (!entry || !filter || !SPECIAL_CATEGORY_DIVISION_FILTERS.includes(filter)) return false;
  const selected = normalizeMatchKey(filter);
  const categoryNames = [
    entry.category_name,
    entry.category?.name,
    categoriesList?.find((c) => c.id === entry.category_id)?.name,
    getEntryStyleLabelForCategoryMatch(entry)
  ];
  return categoryNames.some((name) => normalizeMatchKey(name) === selected);
}

export function matchesCategoryFilter(entry, filter) {
  if (!filter || filter === 'all') return true;
  if (!entry) return false;
  return (entry.category_name ?? entry.dance_type ?? '') === filter;
}

export function matchesAgeDivisionFilter(entry, filter) {
  if (!filter || filter === 'all') return true;
  if (!entry) return false;
  return (entry.age_division_name ?? '') === filter;
}

/**
 * Infer the performance category label stored in entries.dance_type.
 * - Setup app / groups: "Solo | Tap", "Small Group (4-10) | Jazz"
 * - Website sync: style only e.g. "TAP", "HIP HOP"
 */
export function getEntryStyleLabelForCategoryMatch(entry) {
  const raw = entry?.dance_type;
  if (raw == null || raw === '') return '';

  const trimmed = String(raw).trim();
  const pipeIndex = trimmed.indexOf('|');
  const beforePipe = pipeIndex > -1 ? trimmed.slice(0, pipeIndex).trim() : trimmed;
  const afterPipe = pipeIndex > -1 ? trimmed.slice(pipeIndex + 1).trim() : '';

  const normSeg = (s) => String(s).toLowerCase().replace(/[-_\s()/]/g, '');
  const beforeN = normSeg(beforePipe);
  const looksLikeDivision =
    beforeN.includes('solo') ||
    beforeN.includes('duo') ||
    beforeN.includes('trio') ||
    beforeN.includes('smallgroup') ||
    beforeN.includes('largegroup') ||
    beforeN.includes('production');

  if (afterPipe && looksLikeDivision) return afterPipe;
  if (!afterPipe && !looksLikeDivision) return beforePipe;
  if (!afterPipe && looksLikeDivision) return '';
  return afterPipe || beforePipe;
}

export function entryMatchesCategory(entry, category) {
  if (!entry || !category?.id) return false;
  if (entry.category_id === category.id) return true;

  const linkedName = entry.category?.name;
  if (linkedName && normalizeMatchKey(linkedName) === normalizeMatchKey(category.name)) {
    return true;
  }

  const styleLabel = getEntryStyleLabelForCategoryMatch(entry);
  if (!styleLabel) return false;
  return normalizeMatchKey(styleLabel) === normalizeMatchKey(category.name);
}

export function entryMatchesCategoryId(entry, categoryId, categoriesList) {
  if (!categoryId) return true;
  const cat = categoriesList?.find((c) => c.id === categoryId);
  if (!cat) return entry.category_id === categoryId;
  return entryMatchesCategory(entry, cat);
}

export function normalizeAbilityKey(s) {
  if (s == null || s === '') return '';
  const n = String(s).trim().toLowerCase().replace(/[-\s]/g, '');
  if (n.startsWith('beg')) return 'beginning';
  if (n.startsWith('int')) return 'intermediate';
  if (n.startsWith('adv')) return 'advanced';
  return n;
}

export function abilitiesMatch(entryAbility, filterAbility) {
  if (!filterAbility || filterAbility === 'all') return true;
  return normalizeAbilityKey(entryAbility) === normalizeAbilityKey(filterAbility);
}

export function ageFilterMatchesEntry(entry, filterAgeDivisionId, ageDivisionsList = []) {
  if (!filterAgeDivisionId) return true;
  if (!entry) return false;

  // Keep fast path for structured entries where age_division_id is linked.
  if (entry.age_division_id === filterAgeDivisionId) return true;

  // Fallback for website-synced rows that only have numeric age.
  const selectedDivision = ageDivisionsList.find((d) => d.id === filterAgeDivisionId);
  if (!selectedDivision) return false;

  const entryLabel = normalizeFilterText(getEntryAgeGroupLabel(entry, ageDivisionsList));
  const selectedLabel = normalizeFilterText(
    selectedDivision.min_age != null && selectedDivision.max_age != null
      ? `${selectedDivision.name} (${selectedDivision.min_age}-${selectedDivision.max_age})`
      : selectedDivision.name
  );

  if (entryLabel === selectedLabel) return true;

  const age = parseInt(entry.age, 10);
  if (Number.isNaN(age)) return false;
  if (selectedDivision.min_age != null && age < selectedDivision.min_age) return false;
  if (selectedDivision.max_age != null && age > selectedDivision.max_age) return false;
  return true;
}

/** Resolve label for UI when category_id is missing (e.g. website sync). */
export function getDisplayCategoryName(entry, categoriesList) {
  if (!entry) return 'N/A';
  const direct = categoriesList?.find((c) => c.id === entry.category_id);
  if (direct) return cleanDisplayText(direct.name, 'N/A');
  const style = cleanDisplayText(getEntryStyleLabelForCategoryMatch(entry), '');
  if (style) {
    const byStyle = categoriesList?.find(
      (c) => normalizeMatchKey(c.name) === normalizeMatchKey(style)
    );
    if (byStyle) return cleanDisplayText(byStyle.name, 'N/A');
    return style;
  }
  return 'N/A';
}

/** Division types that score as one routine (multiple DB rows may exist per routine). */
export const GROUP_DIVISION_TYPES_FOR_SCORING = [
  'Duo',
  'Trio',
  'Small Group',
  'Large Group',
  'Production'
];

function parseGroupMembersSortedKey(entry) {
  const gm = entry?.group_members;
  if (Array.isArray(gm) && gm.length > 0) {
    return gm
      .map((m) =>
        typeof m === 'string'
          ? String(m).trim().toLowerCase()
          : String(m?.name || '').trim().toLowerCase()
      )
      .filter(Boolean)
      .sort()
      .join('|');
  }
  const dt = entry?.dance_type;
  if (typeof dt === 'string') {
    try {
      const match = dt.match(/Members: (\[.*?\])/);
      if (match) {
        const arr = JSON.parse(match[1]);
        return arr
          .map((x) => String(typeof x === 'string' ? x : x?.name || '').trim().toLowerCase())
          .filter(Boolean)
          .sort()
          .join('|');
      }
    } catch {
      /* ignore */
    }
  }
  return '';
}

export function isGroupDivisionForScoring(entry) {
  const d = getEntryDivisionType(entry);
  return GROUP_DIVISION_TYPES_FOR_SCORING.includes(d);
}

/**
 * Stable key: same routine + same category/age/division → one scoring card.
 * Uses routine_name when present; otherwise competitor_name (website sync stores routine there).
 * Appends sorted member names when present so duplicate rows share one key even if labels differ slightly.
 */
export function getRoutineGroupKey(entry) {
  if (!entry) return '';
  if (!isGroupDivisionForScoring(entry)) {
    return `solo::${entry.id}`;
  }
  const routineLabel = String(entry.routine_name ?? entry.competitor_name ?? '').trim();
  const membersKey = parseGroupMembersSortedKey(entry);
  const routineNorm = normalizeMatchKey(routineLabel);
  const identity = membersKey ? `${routineNorm}::${membersKey}` : routineNorm;
  return [
    entry.category_id || normalizeMatchKey(getEntryStyleLabelForCategoryMatch(entry) || entry.dance_type || ''),
    entry.age_division_id || '',
    normalizeMatchKey(getEntryDivisionType(entry)),
    identity
  ].join('::');
}

export function dedupeEntriesForGroupScoring(entryList) {
  if (!entryList?.length) return [];
  return entryList.filter((entry, index, arr) => {
    if (!isGroupDivisionForScoring(entry)) return true;
    const key = getRoutineGroupKey(entry);
    return arr.findIndex((e) => isGroupDivisionForScoring(e) && getRoutineGroupKey(e) === key) === index;
  });
}

export function getSiblingRoutineEntries(entry, allEntries) {
  if (!entry || !allEntries?.length || !isGroupDivisionForScoring(entry)) return [];
  const key = getRoutineGroupKey(entry);
  return allEntries.filter(
    (e) => e.id !== entry.id && isGroupDivisionForScoring(e) && getRoutineGroupKey(e) === key
  );
}

/** Primary headline for group cards: explicit routine title when synced/admin adds it. */
export function getRoutineDisplayTitle(entry) {
  if (!entry) return '';
  return firstDisplayValue(
    entry.routine_name,
    entry.performance_name,
    entry.performanceTitle,
    entry.title,
    entry.competitor_name,
    entry.name
  );
}

/** Match search query against routine title and group member names. */
export function entryMatchesSearchQuery(entry, queryLower) {
  if (!queryLower) return true;
  if (!entry) return false;
  if (cleanDisplayText(entry.competitor_name, '').toLowerCase().includes(queryLower)) return true;
  if (String(entry.entry_number ?? '').includes(queryLower)) return true;
  const routine = cleanDisplayText(entry.routine_name, '').toLowerCase();
  if (routine.includes(queryLower)) return true;
  const gm = entry.group_members;
  if (Array.isArray(gm)) {
    for (const m of gm) {
      const n = cleanDisplayText(typeof m === 'string' ? m : m?.name, '');
      if (n && n.toLowerCase().includes(queryLower)) return true;
    }
  }
  return false;
}
