from django.db import models

class CryptoOwnershipRecord(models.Model):
    wallet = models.ForeignKey('Wallet', on_delete=models.CASCADE, related_name="crypto_holdings")
    ticker = models.ForeignKey('Cryptocurrency', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ['wallet', 'ticker']
