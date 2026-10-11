import asyncio
import json

import httpx
from channels.generic.websocket import AsyncWebsocketConsumer

from .services.market import INTERVALS, MarketDataError, fetch_candles, fetch_price

LIVE_UPDATE_SECONDS = 3


class ChartConsumer(AsyncWebsocketConsumer):
    """
    Streams market data for one ticker. The client sends {"interval": "1h"} and receives:
      {"type": "history",     "data": [candle, ...]}
      {"type": "live_price",  "data": {"price": float}}   every few seconds
      {"type": "live_candle", "data": candle}             every few seconds
      {"type": "error",       "message": str}
    """

    async def connect(self):
        self.ticker = self.scope['url_route']['kwargs']['ticker'].upper()
        self.client = httpx.AsyncClient()
        self.task = None
        await self.accept()

    async def disconnect(self, code):
        if self.task:
            self.task.cancel()
        await self.client.aclose()

    async def receive(self, text_data=None, bytes_data=None):
        try:
            interval = json.loads(text_data or '{}').get('interval', '1h')
        except json.JSONDecodeError:
            interval = '1h'

        if interval not in INTERVALS:
            await self.send_json({'type': 'error', 'message': f'Unsupported interval {interval}.'})
            return

        if self.task:
            self.task.cancel()
        self.task = asyncio.create_task(self.stream(interval))

    async def stream(self, interval):
        try:
            history = await fetch_candles(self.client, self.ticker, interval)
            await self.send_json({'type': 'history', 'data': history})
        except MarketDataError as e:
            await self.send_json({'type': 'error', 'message': str(e)})
            return

        while True:
            try:
                price = await fetch_price(self.client, self.ticker)
                await self.send_json({'type': 'live_price', 'data': {'price': price}})

                latest = await fetch_candles(self.client, self.ticker, interval, limit=1)
                if latest:
                    await self.send_json({'type': 'live_candle', 'data': latest[-1]})
            except MarketDataError:
                pass  # transient upstream failure; try again next tick
            await asyncio.sleep(LIVE_UPDATE_SECONDS)

    async def send_json(self, payload):
        await self.send(text_data=json.dumps(payload))
