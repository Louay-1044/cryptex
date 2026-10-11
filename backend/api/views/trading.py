from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import Cryptocurrency
from ..serializers.orderserializer import (
    BuyOrderLiquidSerializer,
    BuyOrderWithCryptoSerializer,
    SellOrderCryptoSerializer,
)


def execute_order(serializer_class, user, data):
    serializer = serializer_class(data=data, context={'user': user})
    serializer.is_valid(raise_exception=True)
    try:
        result = serializer.save()
    except Cryptocurrency.DoesNotExist:
        return Response({'detail': 'Unknown currency.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(result, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def buy_liquid(request):
    return execute_order(BuyOrderLiquidSerializer, request.user, request.data)


@api_view(['POST'])
def buy_with_crypto(request):
    return execute_order(BuyOrderWithCryptoSerializer, request.user, request.data)


@api_view(['POST'])
def sell(request):
    return execute_order(SellOrderCryptoSerializer, request.user, request.data)
