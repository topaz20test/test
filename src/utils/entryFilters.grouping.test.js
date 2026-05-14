import { describe, it, expect } from 'vitest';
import { groupEntries, sharesMemberBetweenEntries } from './entryFilters.js';

describe('groupEntries (TOPAZ-style data)', () => {
  it('merges Trio rows #9 / #15 / #16 by overlapping members + same dance_type', () => {
    const entries = [
      {
        id: '9',
        entry_number: 9,
        division_type: 'Trio',
        dance_type: 'Vocal',
        competitor_name: 'The Scooby Doobie',
        group_members: ['Fred york', 'Wendy shorts', 'Bugur'],
      },
      {
        id: '15',
        entry_number: 15,
        division_type: 'Trio',
        dance_type: 'Vocal',
        competitor_name: 'THE SCOBBY DOBBIE',
        group_members: ['FRED YORK', 'BUGER', 'WENDY SHORTS'],
      },
      {
        id: '16',
        entry_number: 16,
        division_type: 'Trio',
        dance_type: 'Vocal',
        competitor_name: 'The Scooby Doobie',
        group_members: ['fred york', 'wendy shorts', 'bugur'],
      },
    ];
    const { primary, siblingMap } = groupEntries(entries);
    expect(primary).toHaveLength(1);
    expect(primary[0].id).toBe('9');
    const sibs = siblingMap.get('9');
    expect(sibs.map((e) => e.id).sort()).toEqual(['15', '16']);
  });

  it('merges Duo #6 and #18 (same members different order)', () => {
    const entries = [
      { id: '6', entry_number: 6, division_type: 'Duo', dance_type: 'Tap', group_members: ['Aa', 'Bcd'] },
      { id: '18', entry_number: 18, division_type: 'Duo', dance_type: 'Tap', group_members: ['Bcd', 'Aa'] },
    ];
    const { primary, siblingMap } = groupEntries(entries);
    expect(primary).toHaveLength(1);
    expect(primary[0].id).toBe('6');
    expect(siblingMap.get('6').map((e) => e.id)).toEqual(['18']);
  });

  it('merges Duo #7 and #8 (same two members, different order)', () => {
    const entries = [
      { id: '7', entry_number: 7, division_type: 'Duo', dance_type: 'Tap', group_members: ['Duo1', 'Duo2'] },
      { id: '8', entry_number: 8, division_type: 'Duo', dance_type: 'Tap', group_members: ['Duo2', 'Duo1'] },
    ];
    const { primary, siblingMap } = groupEntries(entries);
    expect(primary).toHaveLength(1);
    expect(primary[0].id).toBe('7');
    expect(siblingMap.get('7').map((e) => e.id)).toEqual(['8']);
  });

  it('Production with null group_members stays a single standalone row', () => {
    const entries = [
      {
        id: '19',
        entry_number: 19,
        division_type: 'Production',
        dance_type: 'Production',
        group_members: null,
      },
    ];
    const { primary, siblingMap } = groupEntries(entries);
    expect(primary).toHaveLength(1);
    expect(siblingMap.get('19')).toEqual([]);
  });

  it('does not merge Trios with different dance_type strings', () => {
    const entries = [
      {
        id: 'a',
        entry_number: 1,
        division_type: 'Trio',
        dance_type: 'Vocal',
        group_members: ['x', 'y'],
      },
      {
        id: 'b',
        entry_number: 2,
        division_type: 'Trio',
        dance_type: 'Tap',
        group_members: ['x', 'y'],
      },
    ];
    const { primary } = groupEntries(entries);
    expect(primary).toHaveLength(2);
  });
});

describe('sharesMemberBetweenEntries', () => {
  it('detects overlap case-insensitively', () => {
    const a = { group_members: ['Fred york'] };
    const b = { group_members: ['FRED YORK', 'Other'] };
    expect(sharesMemberBetweenEntries(a, b)).toBe(true);
  });
});
