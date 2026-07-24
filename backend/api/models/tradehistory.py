from django.db import models

class TradeHistory(models.Model):
    trader = models.ForeignKey('User', on_delete=models.CASCADE, related_name='tradehistory')
    buy_order = models.ForeignKey('BuyOrder', null=True, blank=True, on_delete=models.CASCADE)
    sell_order = models.ForeignKey('SellOrder', null=True, blank=True, on_delete=models.CASCADE)

    def getTrader(self):
        return self.trader

    def getOrder(self):
        if self.buy_order:
            return self.buy_order
        return self.sell_order

    class Meta:
        verbose_name_plural = "TradeHistory"