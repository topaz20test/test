import React from 'react';

/**
 * MedalBadge Component
 * Displays medal achievement badges with appropriate styling
 * 
 * @param {string} medalLevel - "None", "Bronze", "Silver", or "Gold"
 * @param {number} points - Current total points
 * @param {string} size - "sm", "md", or "lg" (default: "md")
 * @param {boolean} showProgress - Whether to show progress text (default: false)
 */
function MedalBadge({ medalLevel, points = 0, size = 'md', showProgress = false }) {
  if (!medalLevel || medalLevel === 'None') {
    if (!showProgress) return null;
    
    // Show progress toward Bronze
    return (
      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold border-2 border-gray-300">
        Working toward Bronze ({points}/25)
      </span>
    );
  }

  // Medal colors and icons
  const medalConfig = {
    'Bronze': {
      color: 'bg-amber-100 text-amber-800 border-amber-400',
      icon: '🥉',
      emoji: '🥉'
    },
    'Silver': {
      color: 'bg-slate-200 text-slate-800 border-slate-400',
      icon: '🥈',
      emoji: '🥈'
    },
    'Gold': {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-400',
      icon: '🥇',
      emoji: '🥇'
    }
  };

  // Size classes
  const sizeMap = {
    'sm': 'px-2 py-0.5 text-xs',
    'md': 'px-3 py-1 text-sm',
    'lg': 'px-4 py-1.5 text-base'
  };

  const config = medalConfig[medalLevel];
  if (!config) return null;

  const sizeClass = sizeMap[size] || sizeMap['md'];

  // Get next level progress
  const getProgressText = () => {
    if (medalLevel === 'Gold') {
      return `${config.emoji} Gold Medal Achieved!`;
    } else if (medalLevel === 'Silver') {
      return `${config.emoji} Silver Medal - Working toward Gold (${points}/50)`;
    } else if (medalLevel === 'Bronze') {
      return `${config.emoji} Bronze Medal - Working toward Silver (${points}/35)`;
    }
    return `${config.emoji} ${medalLevel} Medal`;
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full font-semibold border-2 ${config.color} ${sizeClass}`}
      title={`${medalLevel} Medal - ${points} points`}
    >
      {showProgress ? getProgressText() : `${config.emoji} ${medalLevel}`}
    </span>
  );
}

/**
 * Helper function to determine medal level based on points
 */
export const getMedalLevel = (points) => {
  if (points >= 50) return 'Gold';
  if (points >= 35) return 'Silver';
  if (points >= 25) return 'Bronze';
  return 'None';
};

/**
 * Helper function to get progress text
 */
export const getMedalProgress = (points) => {
  if (points >= 50) {
    return '🥇 Gold Medal Achieved!';
  } else if (points >= 35) {
    return `🥈 Silver Medal - Working toward Gold (${points}/50)`;
  } else if (points >= 25) {
    return `🥉 Bronze Medal - Working toward Silver (${points}/35)`;
  } else {
    return `Working toward Bronze (${points}/25)`;
  }
};

export default MedalBadge;

