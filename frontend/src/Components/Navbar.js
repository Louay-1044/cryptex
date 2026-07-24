import React, { useState, useEffect, useRef } from 'react';
import '../styles/Navbar.css';
import { useNavigate } from 'react-router-dom';
import profilePic from '../assets/profile.jpg';
import AccountSwitcherModal from './AccountSwitcherModal.js';

// ─── Multi-account token helpers ────────────────────────────────────────────

const ACCOUNTS_KEY = 'accounts';
const ACTIVE_TOKEN_KEY = 'token';
const ACTIVE_USER_KEY = 'activeUsername';

const getAccounts = () => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || [];
  } catch {
    return [];
  }
};

const saveAccounts = (accounts) => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const registerLogin = (token, username) => {
  const accounts = getAccounts();
  const existing = accounts.findIndex((a) => a.username === username);
  if (existing !== -1) {
    accounts[existing].token = token;
  } else {
    accounts.push({ username, token });
  }
  saveAccounts(accounts);
  localStorage.setItem(ACTIVE_TOKEN_KEY, token);
  localStorage.setItem(ACTIVE_USER_KEY, username);
};

// ────────────────────────────────────────────────────────────────────────────

const Navbar = ({ dark = false }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const dropdownRef = useRef(null);

  const isLoggedIn = !!localStorage.getItem(ACTIVE_TOKEN_KEY);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeDropdown = () => setDropdownOpen(false);

  const handleLogout = () => {
    const activeUsername = localStorage.getItem(ACTIVE_USER_KEY);
    const accounts = getAccounts();
    const updatedAccounts = accounts.filter((a) => a.username !== activeUsername);

    saveAccounts(updatedAccounts);

    localStorage.removeItem(ACTIVE_TOKEN_KEY);
    localStorage.removeItem(ACTIVE_USER_KEY);
    window.dispatchEvent(new Event('logout'));
    setShowSwitcherModal(false);
    closeDropdown();
    navigate('/');
  };

  const handleSwitchAccount = (account) => {
    localStorage.setItem(ACTIVE_TOKEN_KEY, account.token);
    localStorage.setItem(ACTIVE_USER_KEY, account.username);
    window.dispatchEvent(new Event('login'));
    setShowSwitcherModal(false);
    closeDropdown();
    navigate('/tradingview');
  };

  const handleAddAccount = () => {
    setShowSwitcherModal(false);
    closeDropdown();
    navigate('/login');
  };

  return (
    <>
      <nav className={`navbar ${dark ? 'dark' : ''}`}>
        <button className="logo" onClick={() => navigate('/')}>Cryptex</button>
        <div className="nav-links">
          <button onClick={() => navigate('/algorithm-builder')}>Create Algorithm</button>
          <button onClick={() => navigate('/tradingview')}>Trading View</button>
          <button onClick={() => navigate('/organisation')}>Organisation</button>
          <button onClick={() => navigate('/cryptAI')}>CryptAI</button>

          <div className="dropdown" ref={dropdownRef}>
            <img
              src={profilePic}
              alt="profile"
              className="profile-img"
              onClick={() => setDropdownOpen((prev) => !prev)}
            />

            {dropdownOpen && (
              <div className="dropdown-menu">
                <button onClick={() => { navigate('/settings'); closeDropdown(); }}>
                  Settings
                </button>

                {isLoggedIn && (
                  <button onClick={() => { setShowSwitcherModal(true); closeDropdown(); }}>
                    Switch Account
                  </button>
                )}

                {isLoggedIn ? (
                  <button onClick={() => {handleLogout();}}>Logout</button>
                ) : (
                  <button onClick={() => { navigate('/login'); closeDropdown(); }}>
                    Login
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Google-style account switcher modal ── */}
      {showSwitcherModal && (
        <AccountSwitcherModal
          onClose={() => setShowSwitcherModal(false)}
          onSwitch={handleSwitchAccount}
          onAddAccount={handleAddAccount}
          onLogout={handleLogout}
        />
      )}
    </>
  );
};

export default Navbar;
