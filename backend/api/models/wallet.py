from django.db import models

class Wallet(models.Model):
    trader = models.OneToOneField('User', on_delete=models.CASCADE, primary_key=True)
    balance = models.DecimalField(max_digits=10, decimal_places=2)

    def updateBalance(self, amount):
        self.balance = amount
        self.save(update_fields=['balance'])

    def getBalance(self):
        return self.balance

    def getTrader(self):
        return self.trader

    class Meta:
        verbose_name_plural = "Wallet"