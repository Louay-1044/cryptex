import React, { useEffect, useRef } from 'react';
import '../styles/AccountSwitcherModal.css';

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

const AVATAR_COLORS = [
  '#1a73e8', '#e67c00', '#188038', '#a142f4',
  '#d93025', '#007b83', '#c5221f', '#185abc',
];

const avatarColor = (username) =>
  AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length];

const AccountSwitcherModal = ({ onClose, onSwitch, onAddAccount, onLogout }) => {
  const overlayRef = useRef(null);
  const accounts = getAccounts();
  const activeUsername = localStorage.getItem(ACTIVE_USER_KEY) || '';
  const activeAccount = accounts.find((a) => a.username === activeUsername);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="asm-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="asm-modal" role="dialog" aria-modal="true" aria-label="Switch account">

        {/* ── Header: active user ── */}
        <div className="asm-header">
          <p className="asm-brand">Cryptex</p>
          {activeAccount && (
            <>
              <div
                className="asm-avatar asm-avatar--large"
                style={{ background: avatarColor(activeAccount.username) }}
              >
                {activeAccount.username.charAt(0).toUpperCase()}
              </div>
              <p className="asm-active-name">{activeAccount.username}</p>
            </>
          )}
        </div>

        {/* ── Account list ── */}
        <ul className="asm-list">
          {accounts.map((acc) => {
            const isActive = acc.username === activeUsername;
            return (
              <li key={acc.username}>
                <button
                  className={`asm-account-row ${isActive ? 'asm-account-row--active' : ''}`}
                  onClick={() => !isActive && onSwitch(acc)}
                  disabled={isActive}
                >
                  <div
                    className="asm-avatar asm-avatar--small"
                    style={{ background: avatarColor(acc.username) }}
                  >
                    {acc.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="asm-account-name">{acc.username}</span>
                  {isActive && <span className="asm-check-icon" aria-label="Active account">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {/* ── Actions ── */}
        <div className="asm-actions">
          <button className="asm-action-btn" onClick={onAddAccount}>
            <span className="asm-action-icon">+</span>
            Add another account
          </button>
          <button className="asm-action-btn" onClick={onLogout}>
            <span className="asm-action-icon asm-action-icon--signout">→</span>
            Sign out
          </button>
        </div>

        <p className="asm-footer">
          To keep your account secure, Cryptex recommends signing out on shared devices.
        </p>
      </div>
    </div>
  );
};

export default AccountSwitcherModal;