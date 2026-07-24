from rest_framework import serializers
from ..models import Cryptocurrency
from ..services.orderprocessing import OrderProcessing, OrderProcessingError
from django.db import transaction

class BuyOrderLiquidSerializer(serializers.Serializer):
    amount_bought = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency_bought = serializers.CharField()

    def create(self, validated_data):
        user = self.context["user"]
        currency_bought_object = Cryptocurrency.objects.get(ticker=validated_data['currency_bought'].upper())

        try:
            with transaction.atomic():
                process_order = OrderProcessing.process_buy_order(
                    user,
                    currency_bought_object,
                    None,
                    validated_data['amount_bought']
                )
        except OrderProcessingError as e:
            raise serializers.ValidationError({"detail": str(e)})

        return process_order



class BuyOrderWithCryptoSerializer(serializers.Serializer):
    amount_bought = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency_bought = serializers.CharField()
    currency_sold = serializers.CharField()

    def create(self, validated_data):
        user = self.context["user"]
        currency_bought_object = Cryptocurrency.objects.get(ticker=validated_data['currency_bought'].upper())
        currency_sold_object = Cryptocurrency.objects.get(ticker=validated_data['currency_sold'].upper())

        try:
            with transaction.atomic():
                process_order = OrderProcessing.process_buy_order(
                    user,
                    currency_bought_object,
                    currency_sold_object,
                    validated_data['amount_bought']
                )
        except OrderProcessingError as e:
            raise serializers.ValidationError({"detail": str(e)})

        return process_order


class SellOrderCryptoSerializer(serializers.Serializer):
    amount_sold = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency_sold = serializers.CharField()

    def create(self, validated_data):
        user = self.context["user"]
        currency_sold_object = Cryptocurrency.objects.get(ticker=validated_data['currency_sold'].upper())

        try:
            with transaction.atomic():
                process_order = OrderProcessing.process_sell_order(
                    user,
                    currency_sold_object,
                    validated_data['amount_sold']
                )

        except OrderProcessingError as e:
            raise serializers.ValidationError({"detail": str(e)})

        return process_order