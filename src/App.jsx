import React, { useState, useEffect } from 'react';
import { TimerProvider } from './context/TimerContext';
import { MainApp } from './components/MainApp';
import { OverlayView } from './components/OverlayView';

export function App() {
  const [isOverlay, setIsOverlay] = useState(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.includes('/overlay') ||
      hash.includes('/overlay') ||
      search.includes('mode=overlay') ||
      search.includes('overlay=true')
    );
  });

  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      setIsOverlay(
        path.includes('/overlay') ||
        hash.includes('/overlay') ||
        search.includes('mode=overlay') ||
        search.includes('overlay=true')
      );
    };

    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('popstate', checkRoute);
    return () => {
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('popstate', checkRoute);
    };
  }, []);

  if (isOverlay) {
    return <OverlayView />;
  }

  return (
    <TimerProvider>
      <MainApp />
    </TimerProvider>
  );
}

export default App;
