import { useState } from 'react';
import SplashScreen from './pages/SplashScreen.jsx';
import MainShell from './pages/MainShell.jsx';

/// Equivalente de app.dart: arranca en el splash y pasa al shell.
export default function App() {
  const [stage, setStage] = useState('splash');

  if (stage === 'splash') {
    return <SplashScreen onFinish={() => setStage('shell')} />;
  }

  // Transición de 450 ms, como el PageRouteBuilder de Flutter.
  return (
    <div style={{ animation: 'polimap-fade 450ms ease' }}>
      <style>{'@keyframes polimap-fade { from { opacity: 0 } to { opacity: 1 } }'}</style>
      <MainShell />
    </div>
  );
}
