from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        post_migrate.connect(self.setup_currencies, sender=self)

    @staticmethod
    def setup_currencies(**kwargs):
        from .models import Cryptocurrency

        INITIAL_CRYPTOCURRENCIES = [
            ("BTC", "Bitcoin"),
            ("ETH", "Ethereum"),
            ("XRP", "Ripple"),
            ("LTC", "Litecoin"),
            ("BCH", "Bitcoin Cash"),
            ("BNB", "Binance Coin"),
            ("SOL", "Solana"),
            ("ADA", "Cardano"),
            ("DOGE", "Dogecoin"),
            ("DOT", "Polkadot"),
            ("MATIC", "Polygon"),
            ("AVAX", "Avalanche"),
            ("TRX", "TRON"),
            ("LINK", "Chainlink"),
            ("SHIB", "Shiba Inu"),
        ]

        for (ticker, name) in INITIAL_CRYPTOCURRENCIES:
            Cryptocurrency.objects.get_or_create(ticker=ticker, name=name)
