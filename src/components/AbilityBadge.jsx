import React from 'react';

/**
 * AbilityBadge Component
 * Displays ability level with appropriate styling
 * 
 * @param {string} abilityLevel - "Beginning", "Intermediate", or "Advanced"
 * @param {string} size - "sm", "md", or "lg" (default: "md")
 */
function AbilityBadge({ abilityLevel, size = 'md' }) {
  if (!abilityLevel || abilityLevel === 'Not specified') {
    return (
      <span
        className={`inline-flex items-center rounded-full font-semibold border-2 bg-gray-100 text-gray-600 border-gray-300 ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-4 py-1.5 text-base' : 'px-3 py-1 text-sm'
        }`}
      >
        Not specified
      </span>
    );
  }

  // Badge colors based on ability level
  const colorMap = {
    'Beginning': 'bg-blue-100 text-blue-800 border-blue-300',
    'Intermediate': 'bg-orange-100 text-orange-800 border-orange-300',
    'Advanced': 'bg-purple-100 text-purple-800 border-purple-300'
  };

  // Size classes
  const sizeMap = {
    'sm': 'px-2 py-0.5 text-xs',
    'md': 'px-3 py-1 text-sm',
    'lg': 'px-4 py-1.5 text-base'
  };

  const colorClass = colorMap[abilityLevel] || 'bg-gray-100 text-gray-800 border-gray-300';
  const sizeClass = sizeMap[size] || sizeMap['md'];

  // Get description text
  const getDescription = (level) => {
    switch (level) {
      case 'Beginning':
        return 'Less than 2 years';
      case 'Intermediate':
        return '2-4 years';
      case 'Advanced':
        return '5+ years';
      default:
        return '';
    }
  };

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-full font-semibold border-2 ${colorClass} ${sizeClass}`}
      title={getDescription(abilityLevel)}
    >
      {abilityLevel}
    </span>
  );
}

export default AbilityBadge;

