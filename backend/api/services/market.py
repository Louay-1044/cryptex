from decimal import Decimal

import httpx
from django.core.cache import cache

# The public market-data mirror is tried if the main API is unreachable
BINANCE_HOSTS = [
    'https://api.binance.com',
    'https://data-api.binance.vision',
]
QUOTE_ASSET = 'USDT'
PRICE_CACHE_SECONDS = 3

# Binance has no 10m interval, so it is built by merging pairs of 5m candles
INTERVALS = {
    '1m': ('1m', 1),
    '5m': ('5m', 1),
    '10m': ('5m', 2),
    '30m': ('30m', 1),
    '1h': ('1h', 1),
    '6h': ('6h', 1),
    '12h': ('12h', 1),
    '1d': ('1d', 1),
    '1w': ('1w', 1),
}
HISTORY_LENGTH = 100


class MarketDataError(Exception):
    pass


def symbol_for(ticker):
    return f'{ticker.upper()}{QUOTE_ASSET}'


def _get(path, params):
    last_error = None
    for host in BINANCE_HOSTS:
        try:
            response = httpx.get(f'{host}{path}', params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            last_error = e
    raise MarketDataError(f'Market data unavailable for {params.get("symbol")}: {last_error}')


async def _aget(client, path, params):
    last_error = None
    for host in BINANCE_HOSTS:
        try:
            response = await client.get(f'{host}{path}', params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            last_error = e
    raise MarketDataError(f'Market data unavailable for {params.get("symbol")}: {last_error}')


def get_price(ticker):
    """Current USD price of a ticker as a Decimal."""
    key = f'price:{ticker.upper()}'
    cached = cache.get(key)
    if cached is not None:
        return Decimal(cached)

    data = _get('/api/v3/ticker/price', {'symbol': symbol_for(ticker)})
    price = data['price']
    cache.set(key, price, PRICE_CACHE_SECONDS)
    return Decimal(price)


def _parse_kline(kline):
    return {
        'time': kline[0] // 1000,
        'open': float(kline[1]),
        'high': float(kline[2]),
        'low': float(kline[3]),
        'close': float(kline[4]),
        'volume': float(kline[5]),
    }


def _merge(candles, group):
    if group == 1:
        return candles

    merged = []
    for i in range(0, len(candles), group):
        chunk = candles[i:i + group]
        merged.append({
            'time': chunk[0]['time'],
            'open': chunk[0]['open'],
            'high': max(c['high'] for c in chunk),
            'low': min(c['low'] for c in chunk),
            'close': chunk[-1]['close'],
            'volume': sum(c['volume'] for c in chunk),
        })
    return merged


async def fetch_candles(client, ticker, interval, limit=HISTORY_LENGTH):
    binance_interval, group = INTERVALS[interval]
    raw_limit = limit * group
    # Align 10m candles so each merged candle starts on a 10 minute boundary
    if group > 1:
        raw_limit += group

    data = await _aget(client, '/api/v3/klines', {
        'symbol': symbol_for(ticker),
        'interval': binance_interval,
        'limit': min(raw_limit, 1000),
    })
    candles = [_parse_kline(k) for k in data]

    if group > 1:
        period = 60 * 5 * group
        while candles and candles[0]['time'] % period != 0:
            candles.pop(0)

    return _merge(candles, group)[-limit:]


async def fetch_price(client, ticker):
    key = f'price:{ticker.upper()}'
    cached = await cache.aget(key)
    if cached is not None:
        return float(cached)

    data = await _aget(client, '/api/v3/ticker/price', {'symbol': symbol_for(ticker)})
    await cache.aset(key, data['price'], PRICE_CACHE_SECONDS)
    return float(data['price'])
