function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}

export default LoadingSpinner;


