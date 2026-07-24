import React from 'react';
import '../styles/BalanceWidget.css';

const BalanceWidget = ({
  label, value,
  topUp, topUpLoading, topUpMessage, onTopUp,
  crypto, cryptoIcons, fmtCrypto,
}) => {
  const fmt = (n) =>
    `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="balance-widget">
      <p className="balance-widget__label">{label}</p>
      <p className="balance-widget__amount">{fmt(value)}</p>

      {topUp && (
        <div className="balance-widget__topup">
          <button
            className="balance-widget__topup-btn"
            onClick={onTopUp}
            disabled={topUpLoading}
          >
            {topUpLoading ? 'Topping up...' : 'Top Up £1,000.00'}
          </button>
          {topUpMessage && (
            <p className={`balance-widget__topup-msg ${topUpMessage.includes('success') ? 'balance-widget__topup-msg--success' : 'balance-widget__topup-msg--error'}`}>
              {topUpMessage}
            </p>
          )}
        </div>
      )}

      {crypto && crypto.length > 0 && (
        <ul className="balance-widget__crypto-list">
          {crypto.map((holding) => (
            <li key={holding.symbol} className="balance-widget__crypto-item">
              <div className="balance-widget__crypto-icon">
                {cryptoIcons[holding.symbol] ?? holding.symbol.charAt(0)}
              </div>
              <div className="balance-widget__crypto-info">
                <span className="balance-widget__crypto-name">{holding.name}</span>
                <span className="balance-widget__crypto-symbol">{holding.symbol}</span>
              </div>
              <span className="balance-widget__crypto-amount">{fmtCrypto(holding.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {crypto && crypto.length === 0 && (
        <p className="balance-widget__empty">No crypto holdings yet.</p>
      )}
    </div>
  );
};

export default BalanceWidget;