function RankBadge({ rank, isTied = false }) {
  const getRankStyle = () => {
    switch (rank) {
      case 1:
        return {
          bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
          text: 'text-yellow-900',
          emoji: '🥇'
        };
      case 2:
        return {
          bg: 'bg-gradient-to-br from-gray-300 to-gray-500',
          text: 'text-gray-900',
          emoji: '🥈'
        };
      case 3:
        return {
          bg: 'bg-gradient-to-br from-orange-400 to-orange-600',
          text: 'text-orange-900',
          emoji: '🥉'
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-gray-200 to-gray-400',
          text: 'text-gray-800',
          emoji: null
        };
    }
  };

  const style = getRankStyle();

  return (
    <div className={`${style.bg} rounded-xl p-4 flex flex-col items-center justify-center min-w-[100px] shadow-lg`}>
      {style.emoji && (
        <span className="text-4xl mb-1">{style.emoji}</span>
      )}
      <div className={`text-3xl font-bold ${style.text}`}>
        {rank}
        {rank === 1 && 'st'}
        {rank === 2 && 'nd'}
        {rank === 3 && 'rd'}
        {rank > 3 && 'th'}
      </div>
      <div className={`text-xs font-semibold ${style.text} uppercase`}>
        PLACE
      </div>
      {isTied && (
        <div className="mt-1 px-2 py-0.5 bg-white/50 rounded text-xs font-semibold">
          (Tied)
        </div>
      )}
    </div>
  );
}

export default RankBadge;


