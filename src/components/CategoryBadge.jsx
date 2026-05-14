function CategoryBadge({ categoryName, varietyLevel = null }) {
  // Special categories list
  const specialCategories = ['Production', 'Student Choreography', 'Teacher/Student'];
  const isSpecial = specialCategories.includes(categoryName);

  const getCategoryColor = (name) => {
    const lowerName = name.toLowerCase();
    
    // Performing Arts Categories
    if (lowerName.includes('tap')) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    } else if (lowerName.includes('jazz')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    } else if (lowerName.includes('ballet')) {
      return 'bg-pink-100 text-pink-800 border-pink-300';
    } else if (lowerName.includes('lyrical') || lowerName.includes('contemporary')) {
      return 'bg-teal-100 text-teal-800 border-teal-300';
    } else if (lowerName.includes('vocal')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    } else if (lowerName.includes('acting')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    } else if (lowerName.includes('hip hop')) {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    } 
    // Special Categories
    else if (lowerName.includes('production') || lowerName.includes('choreography') || lowerName.includes('teacher')) {
      return 'bg-gray-100 text-gray-800 border-gray-400';
    } else {
      return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const colorClass = getCategoryColor(categoryName);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 ${colorClass} font-semibold text-sm`}>
      <span>{categoryName}</span>
      {isSpecial && (
        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full" title="Not eligible for high score awards">
          SPECIAL
        </span>
      )}
      {varietyLevel && varietyLevel !== 'None' && (
        <span className="text-xs px-2 py-0.5 bg-white/50 rounded-full">
          {varietyLevel}
        </span>
      )}
    </div>
  );
}

export default CategoryBadge;


