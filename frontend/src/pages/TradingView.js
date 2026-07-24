import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../Components/Navbar';
import '../styles/TradingView.css';

const API_BASE = 'http://127.0.0.1:8000/api';
const WS_BASE = 'ws://127.0.0.1:8000';

const INTERVALS = ['1m', '5m', '10m', '30m', '1h', '6h', '12h', '1d', '1w'];

const TradingView = () => {
  const [tradeType, setTradeType] = useState('buy');
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedInterval, setSelectedInterval] = useState('1h');

  const [walletBalance, setWalletBalance] = useState(null);
  const [walletCrypto, setWalletCrypto] = useState([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [walletError, setWalletError] = useState('');

  const [coins, setCoins] = useState([]);
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [coinsError, setCoinsError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [chartData, setChartData] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [coinPrices, setCoinPrices] = useState({});
  const [chartError, setChartError] = useState('');
  const socketRef = useRef(null);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [sellSourceCoin, setSellSourceCoin] = useState('ETH');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState('');

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('access');

  const fetchCurrencies = async () => {
    setLoadingCoins(true);
    setCoinsError('');

    try {
      const response = await fetch(`${API_BASE}/currency/list/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const raw = await response.text();
      let data = [];

      try {
        data = raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error('Currency list response was not JSON:', raw);
      }

      if (!response.ok) {
        setCoinsError('Failed to fetch currencies.');
        return;
      }

      const normalizedCoins = Array.isArray(data)
        ? data.map((coin) => ({
            symbol: coin.ticker,
            name: coin.name,
          }))
        : [];

      setCoins(normalizedCoins);

      if (normalizedCoins.length > 0) {
        setSelectedCoin((prev) => {
          const exists = normalizedCoins.some((coin) => coin.symbol === prev);
          return exists ? prev : normalizedCoins[0].symbol;
        });

        setSellSourceCoin((prev) => {
          const exists = normalizedCoins.some((coin) => coin.symbol === prev);
          if (exists) return prev;

          const fallback = normalizedCoins.find(
            (coin) => coin.symbol !== normalizedCoins[0].symbol
          );
          return fallback ? fallback.symbol : normalizedCoins[0].symbol;
        });
      }
    } catch (error) {
      console.error('Currency fetch failed:', error);
      setCoinsError('Could not connect to backend for currencies.');
    } finally {
      setLoadingCoins(false);
    }
  };

  const selectedCoinMeta = useMemo(
    () => coins.find((c) => c.symbol === selectedCoin) || coins[0] || { symbol: '', name: '' },
    [coins, selectedCoin]
  );

  const filteredCoins = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return coins;

    return coins.filter((coin) => {
      return (
        coin.symbol.toLowerCase().includes(query) ||
        coin.name.toLowerCase().includes(query)
      );
    });
  }, [coins, searchTerm]);

  const selectedHolding = useMemo(() => {
    return walletCrypto.find((item) => item.ticker_id === selectedCoin);
  }, [walletCrypto, selectedCoin]);

  const portfolioValueEstimate = useMemo(() => {
    if (!livePrice || !walletCrypto.length) return null;
    const selectedAmount = parseFloat(selectedHolding?.amount || 0);
    return selectedAmount * parseFloat(livePrice);
  }, [livePrice, selectedHolding, walletCrypto]);

  const chartStats = useMemo(() => {
    if (!chartData.length) return null;

    const highs = chartData.map((candle) => Number(candle.high));
    const lows = chartData.map((candle) => Number(candle.low));
    const last = chartData[chartData.length - 1];
    const volume = chartData.reduce((sum, candle) => sum + Number(candle.volume || 0), 0);

    return {
      high: Math.max(...highs),
      low: Math.min(...lows),
      current: Number(last.close),
      volume,
    };
  }, [chartData]);

  const chartBounds = useMemo(() => {
    if (!chartData.length) return null;

    const prices = chartData.map((candle) => Number(candle.close));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return { minPrice, maxPrice };
  }, [chartData]);

  const chartYAxisLabels = useMemo(() => {
    if (!chartBounds) return [];

    const { minPrice, maxPrice } = chartBounds;
    const steps = 5;
    const labels = [];

    for (let i = 0; i < steps; i++) {
      const value = maxPrice - ((maxPrice - minPrice) / (steps - 1)) * i;
      const y = 20 + (i / (steps - 1)) * 220;

      labels.push({
        value,
        y,
      });
    }

    return labels;
  }, [chartBounds]);

  const formatUSD = (value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return '$0.00';
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatNumber = (value, digits = 2) => {
    const num = Number(value);
    if (Number.isNaN(num)) return '0.00';
    return num.toLocaleString('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const getHoldingUsdValue = (holding) => {
    const amountHeld = Number(holding?.amount || 0);
    const liveCoinPrice = Number(coinPrices[holding?.ticker_id] || 0);

    if (Number.isNaN(amountHeld) || Number.isNaN(liveCoinPrice)) {
      return 0;
    }

    return amountHeld * liveCoinPrice;
  };

  const fetchWallet = async () => {
    setLoadingWallet(true);
    setWalletError('');

    if (!token) {
      setWalletError('You are not logged in. Please log in again.');
      setLoadingWallet(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/account/fetchBalance/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
      });

      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (e) {
        console.error('Wallet response was not JSON:', raw);
      }

      if (!response.ok) {
        setWalletError(data.error || data.detail || 'Failed to fetch wallet.');
        return;
      }

      setWalletBalance(data.wallet_balance);
      setWalletCrypto(data.wallet_crypto || []);
    } catch (error) {
      console.error('Wallet fetch failed:', error);
      setWalletError('Could not connect to backend.');
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  useEffect(() => {
    if (token) {
      fetchWallet();
    } else {
      setLoadingWallet(false);
      setWalletError('You are not logged in. Please log in again.');
    }
  }, [token]);

  useEffect(() => {
    if (!selectedCoin) return;

    let isUnmounting = false;

    setChartError('');
    setChartData([]);
    setLivePrice(null);

    if (socketRef.current) {
      const existingSocket = socketRef.current;
      if (
        existingSocket.readyState === WebSocket.OPEN ||
        existingSocket.readyState === WebSocket.CONNECTING
      ) {
        existingSocket.close();
      }
    }

    const socket = new WebSocket(`${WS_BASE}/ws/chart/${selectedCoin}/`);
    socketRef.current = socket;

    socket.onopen = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ interval: selectedInterval }));
      }
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'history') {
        setChartData(message.data || []);
      }

      if (message.type === 'live_price') {
        setLivePrice(message.data?.price ?? null);
      }

      if (message.type === 'live_candle') {
        setChartData((prev) => {
          if (!prev.length) return [message.data];

          const updated = [...prev];
          const incoming = message.data;
          const last = updated[updated.length - 1];

          if (last.time === incoming.time) {
            updated[updated.length - 1] = incoming;
          } else {
            updated.push(incoming);
          }

          return updated;
        });
      }

      if (message.type === 'error') {
        setChartError(message.message || 'Chart error.');
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
      if (!isUnmounting) {
        console.warn('WebSocket closed:', event);
      }
    };

    return () => {
      isUnmounting = true;
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [selectedCoin, selectedInterval]);

  useEffect(() => {
    if (!coins.length) return;

    const sockets = [];

    coins.forEach((coin) => {
      const socket = new WebSocket(`${WS_BASE}/ws/chart/${coin.symbol}/`);
      sockets.push(socket);

      socket.onopen = () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ interval: '1m' }));
        }
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'live_price' && message.data?.price != null) {
          setCoinPrices((prev) => ({
            ...prev,
            [coin.symbol]: message.data.price,
          }));
        }
      };

      socket.onerror = () => {
        console.warn(`Price socket failed for ${coin.symbol}`);
      };
    });

    return () => {
      sockets.forEach((socket) => {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      });
    };
  }, [coins]);

  useEffect(() => {
    if (sellSourceCoin === selectedCoin) {
      const fallbackCoin = coins.find((coin) => coin.symbol !== selectedCoin);
      if (fallbackCoin) {
        setSellSourceCoin(fallbackCoin.symbol);
      }
    }
  }, [selectedCoin, sellSourceCoin, coins]);

  const handleTrade = async () => {
    setTradeMessage('');

    if (!token) {
      setTradeMessage('You are not logged in. Please log in again.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setTradeMessage('Please enter a valid amount.');
      return;
    }

    setTradeLoading(true);

    try {
      let url = '';
      let body = {};

      if (tradeType === 'buy') {
        if (paymentMethod === 'wallet') {
          url = `${API_BASE}/buyOrder/liquid/execute/`;
          body = {
            amount_bought: amount,
            currency_bought: selectedCoin,
          };
        } else {
          url = `${API_BASE}/buyOrder/crypto/execute/`;
          body = {
            amount_bought: amount,
            currency_bought: selectedCoin,
            currency_sold: sellSourceCoin,
          };
        }
      } else {
        url = `${API_BASE}/sellOrder/execute/`;
        body = {
          amount_sold: amount,
          currency_sold: selectedCoin,
        };
      }

      console.log('Trade token:', token);
      console.log('Trade url:', url);
      console.log('Trade payload:', body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(body),
      });

      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (e) {
        console.error('Non-JSON response from backend:', raw);
      }

      console.log('Backend error response:', data);

      if (!response.ok) {
        setTradeMessage(
          data.detail ||
            data.error ||
            data.message ||
            JSON.stringify(data) ||
            `Trade failed (${response.status}).`
        );
        return;
      }

      setTradeMessage(data.message || 'Trade completed successfully.');
      setAmount('');
      await fetchWallet();
    } catch (error) {
      console.error('Trade request failed:', error);
      setTradeMessage('Request failed. Check browser console and backend terminal.');
    } finally {
      setTradeLoading(false);
    }
  };

  const buildPolylinePoints = () => {
    if (!chartData.length) return '';

    const width = 900;
    const height = 260;
    const leftPadding = 80;
    const rightPadding = 20;
    const topBottomPadding = 20;

    const prices = chartData.map((candle) => Number(candle.close));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;

    return prices
      .map((price, index) => {
        const x =
          leftPadding +
          (index / Math.max(prices.length - 1, 1)) * (width - leftPadding - rightPadding);

        const y =
          topBottomPadding +
          ((maxPrice - price) / range) * (height - topBottomPadding * 2);

        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="trading-page">
      <Navbar />

      <div className="trading-container">
        <div className="trading-header">
          <h1>Trading Dashboard</h1>
          <p>View your wallet, track live crypto prices, and place buy or sell orders.</p>
        </div>

        <div className="trading-summary-grid">
          <div className="trading-card">
            <h3>Wallet Balance</h3>
            <p className="trading-value">
              {walletBalance !== null ? formatUSD(walletBalance) : 'Loading...'}
            </p>
          </div>

          <div className="trading-card">
            <h3>Selected Asset</h3>
            <p className="trading-value">{selectedCoinMeta.symbol || 'Loading...'}</p>
          </div>

          <div className="trading-card">
            <h3>Live Price</h3>
            <p className="trading-value">
              {livePrice !== null ? formatUSD(livePrice) : 'Loading...'}
            </p>
          </div>
        </div>

        <div className="portfolio-section">
          <h2>Wallet Portfolio</h2>

          {loadingWallet && <p>Loading wallet...</p>}
          {walletError && <p className="negative">{walletError}</p>}

          {!loadingWallet && !walletError && (
            <div className="portfolio-grid">
              <div className="portfolio-card">
                <h3>Cash Balance</h3>
                <p>Available to trade</p>
                <strong>{formatUSD(walletBalance || 0)}</strong>
              </div>

              {walletCrypto.length === 0 ? (
                <div className="portfolio-card">
                  <h3>No crypto yet</h3>
                  <p>Buy a currency to see it here</p>
                  <strong>$0.00</strong>
                </div>
              ) : (
                walletCrypto.map((holding) => (
                  <div className="portfolio-card" key={holding.ticker_id}>
                    <h3>{holding.ticker_id}</h3>
                    <p>Holdings: {formatNumber(holding.amount, 2)}</p>
                    <strong>{formatUSD(getHoldingUsdValue(holding))}</strong>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="market-section">
          <h2>Market Overview</h2>

          {loadingCoins && <p>Loading currencies...</p>}
          {coinsError && <p className="negative">{coinsError}</p>}

          {!loadingCoins && !coinsError && (
            <>
              <div className="market-toolbar">
                <input
                  type="text"
                  className="market-search"
                  placeholder="Search currency..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="market-scroll-row">
                {filteredCoins.length === 0 ? (
                  <p className="no-results">No currencies found for "{searchTerm}".</p>
                ) : (
                  filteredCoins.map((coin) => (
                    <button
                      key={coin.symbol}
                      className={`market-card market-card-button ${
                        selectedCoin === coin.symbol ? 'selected-coin' : ''
                      }`}
                      onClick={() => setSelectedCoin(coin.symbol)}
                    >
                      <div className="market-top">
                        <div>
                          <h3>{coin.symbol}</h3>
                          <p>{coin.name}</p>
                        </div>
                      </div>
                      <h4>
                        {coinPrices[coin.symbol] != null
                          ? formatUSD(coinPrices[coin.symbol])
                          : 'Loading...'}
                      </h4>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="chart-section">
          <h2>Asset Performance</h2>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h3>
                  {selectedCoinMeta.name} ({selectedCoinMeta.symbol})
                </h3>
              </div>

              <div className="chart-price">
                <span>Current Price</span>
                <h3>{livePrice !== null ? formatUSD(livePrice) : 'Loading...'}</h3>
              </div>
            </div>

            <div className="interval-row">
              {INTERVALS.map((interval) => (
                <button
                  key={interval}
                  className={`interval-btn ${
                    selectedInterval === interval ? 'interval-btn-active' : ''
                  }`}
                  onClick={() => setSelectedInterval(interval)}
                >
                  {interval}
                </button>
              ))}
            </div>

            <div className="chart-placeholder">
              {chartData.length ? (
                <svg viewBox="0 0 900 260" className="chart-svg" preserveAspectRatio="none">
                  {chartYAxisLabels.map((label, index) => (
                    <g key={index}>
                      <line
                        x1="80"
                        y1={label.y}
                        x2="880"
                        y2={label.y}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                      />
                      <text x="10" y={label.y + 4} fontSize="14" fill="white">
                        {formatUSD(label.value)}
                      </text>
                    </g>
                  ))}

                  <polyline
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    points={buildPolylinePoints()}
                  />
                </svg>
              ) : (
                <p>Loading chart...</p>
              )}
            </div>

            {chartError && <p className="negative">{chartError}</p>}

            {chartStats && (
              <div className="chart-stats">
                <div className="chart-stat-box">
                  <h4>High</h4>
                  <p>{formatUSD(chartStats.high)}</p>
                </div>
                <div className="chart-stat-box">
                  <h4>Low</h4>
                  <p>{formatUSD(chartStats.low)}</p>
                </div>
                <div className="chart-stat-box">
                  <h4>Volume</h4>
                  <p>{formatNumber(chartStats.volume, 2)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="trade-section">
          <h2>Place Order</h2>

          <div className="trade-card">
            <div className="trade-toggle">
              <button
                className={tradeType === 'buy' ? 'active-buy' : ''}
                onClick={() => setTradeType('buy')}
              >
                Buy
              </button>
              <button
                className={tradeType === 'sell' ? 'active-sell' : ''}
                onClick={() => setTradeType('sell')}
              >
                Sell
              </button>
            </div>

            <div className="trade-form">
              <label>Asset</label>
              <select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)}>
                {coins.map((coin) => (
                  <option key={coin.symbol} value={coin.symbol}>
                    {coin.name} ({coin.symbol})
                  </option>
                ))}
              </select>

              <label>{tradeType === 'buy' ? 'Amount to buy' : 'Amount to sell'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              {tradeType === 'buy' && (
                <>
                  <label>Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="wallet">Demo Wallet</option>
                    <option value="crypto">Pay with Crypto</option>
                  </select>

                  {paymentMethod === 'crypto' && (
                    <>
                      <label>Crypto to spend</label>
                      <select
                        value={sellSourceCoin}
                        onChange={(e) => setSellSourceCoin(e.target.value)}
                      >
                        {coins
                          .filter((coin) => coin.symbol !== selectedCoin)
                          .map((coin) => (
                            <option key={coin.symbol} value={coin.symbol}>
                              {coin.name} ({coin.symbol})
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                </>
              )}

              <button
                className={`trade-btn ${tradeType === 'buy' ? 'buy-btn' : 'sell-btn'}`}
                onClick={handleTrade}
                disabled={tradeLoading}
              >
                {tradeLoading
                  ? 'Processing...'
                  : tradeType === 'buy'
                  ? 'Confirm Buy'
                  : 'Confirm Sell'}
              </button>

              {tradeMessage && <p className="trade-message">{tradeMessage}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingView;