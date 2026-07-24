from django.db import models

class BuyOrder(models.Model):
    id = models.AutoField(primary_key=True)
    amount_bought = models.DecimalField(max_digits=10, decimal_places=2)
    currency_bought = models.ForeignKey('Cryptocurrency', on_delete=models.CASCADE)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    buy_date_time = models.DateTimeField(auto_now_add=True)
    buyer = models.ForeignKey('User', on_delete=models.CASCADE, related_name="buy_orders")

    def getBoughCoin(self):
        return self.currency_bought

    def getBoughtPrice(self):
        return self.buy_price

    def getBoughtAmount(self):
        return self.amount_bought

    def getOrderDateTime(self):
        return self.buy_date_time.strftime("%Y-%m-%d %H:%M")


class SellOrder(models.Model):
    id = models.AutoField(primary_key=True)
    amount_sold = models.DecimalField(max_digits=10, decimal_places=2)
    currency_sold = models.ForeignKey('Cryptocurrency', on_delete=models.CASCADE)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_date_time = models.DateTimeField(auto_now_add=True)
    seller = models.ForeignKey('User', on_delete=models.CASCADE, related_name="sell_orders")

    def getCurrencySold(self):
        return self.currency_sold

    def getSoldPrice(self):
        return self.sell_price

    def getSoldAmount(self):
        return self.amount_sold

    def getOrderDateTime(self):
        return self.sell_date_time.strftime("%Y-%m-%d %H:%M")