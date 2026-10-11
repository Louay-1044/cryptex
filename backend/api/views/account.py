from django.db.models import Q
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import CryptoOwnershipRecord, Cryptocurrency, User, Wallet
from ..serializers.userserializer import UserSerializer, UserUpdateSerializer


def user_details(user):
    return {'id': user.id, **UserUpdateSerializer(user).data}


def wallet_summary(user):
    wallet, _ = Wallet.objects.get_or_create(trader=user, defaults={'balance': 1000})
    holdings = CryptoOwnershipRecord.objects.filter(wallet=wallet).order_by('ticker_id')
    return {
        'wallet_balance': float(wallet.balance),
        'wallet_crypto': [
            {'ticker_id': h.ticker_id, 'amount': float(h.amount)} for h in holdings
        ],
    }


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    serializer = UserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({**serializer.data, 'token': token.key}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    identifier = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if not identifier or not password:
        return Response({'error': 'Username and password are required.'},
                        status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(Q(username=identifier) | Q(email__iexact=identifier)).first()
    if user is None or not user.is_active or not user.check_password(password):
        return Response({'error': 'Invalid username or password.'},
                        status=status.HTTP_401_UNAUTHORIZED)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'username': user.username})


@api_view(['GET', 'PATCH'])
def user(request):
    if request.method == 'PATCH':
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(user_details(request.user))


@api_view(['DELETE'])
def delete_user(request):
    request.user.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def fetch_details(request):
    return Response(user_details(request.user))


@api_view(['GET'])
def fetch_balance(request):
    return Response(wallet_summary(request.user))


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def currency_list(request):
    currencies = Cryptocurrency.objects.order_by('ticker').values('ticker', 'name')
    return Response(list(currencies))
