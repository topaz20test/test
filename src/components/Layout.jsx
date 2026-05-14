import React from 'react';

const Layout = ({ children, overlayOpacity = 'bg-white/30' }) => {
  const backgroundPath = '/background.jpg';

  return (
    <div className="relative min-h-screen w-full max-w-full flex flex-col overflow-x-hidden app-no-horizontal-scroll">
      {/* 1. Background Image Layer */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${backgroundPath})`,
          backgroundColor: '#f1f5f9' // Fallback
        }}
      />

      {/* 2. 30% Opacity Overlay Layer */}
      <div className={`fixed inset-0 ${overlayOpacity}`}></div>

      {/* 3. Branding Gradient Layer (Kept on top of image/overlay) */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-50/40 via-white/10 to-teal-50/40 pointer-events-none"></div>

      {/* 4. Content Layer */}
      <div className="relative z-10 flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export default Layout;
