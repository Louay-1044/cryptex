import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/homepage.js';
import Login from './pages/Login.js';
import Signup from './pages/Signup.js';
import AlgorithmBuilder from './pages/Algorithm-builder.js';
import Settings from './pages/Settings.js';
import TradingView from './pages/TradingView.js';
import Organisation from './pages/Organisation.js';
import CryptAIAssistant from "./pages/cryptAI-assistant";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const handleLogout = () => setIsLoggedIn(false);
    window.addEventListener('logout', handleLogout);
    return () => window.removeEventListener('logout', handleLogout);
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/tradingview" />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
          <Route path="/signup" element={<Signup onLogin={() => setIsLoggedIn(true)} />} />
          <Route path="/tradingview" element={isLoggedIn ? <TradingView /> : <Navigate to="/login" />} />
          <Route path="/algorithm-builder" element={isLoggedIn ? <AlgorithmBuilder /> : <Navigate to="/login" />} />
          <Route path="/settings" element={isLoggedIn ? <Settings /> : <Navigate to="/login" />} />
          <Route path="/organisation" element={isLoggedIn ? <Organisation /> : <Navigate to="/login" />} />
          <Route path="/cryptAI" element={isLoggedIn ? <CryptAIAssistant /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
