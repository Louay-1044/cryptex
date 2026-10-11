from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response

from ..models import Algorithm, CryptoOwnershipRecord, Wallet
from ..permissions import AlgorithmTokenAuthentication, IsAlgorithm
from ..serializers.orderserializer import BuyOrderLiquidSerializer, SellOrderCryptoSerializer
from ..services import algorithmrunner
from ..services.algorithmrunner import AlgorithmRunnerError
from .trading import execute_order


def status_payload(algorithm):
    if algorithm is None:
        return {'status': Algorithm.STOPPED, 'start_time': None, 'end_time': None,
                'error_message': None}
    return {
        'id': algorithm.id,
        'status': algorithm.status,
        'start_time': algorithm.start_time,
        'end_time': algorithm.end_time,
        'error_message': algorithm.error_message,
    }


# ── Endpoints used by the Algorithm Builder page ──

@api_view(['GET'])
def fetch(request):
    algorithm = algorithmrunner.latest_for(request.user)
    state = (algorithm.stored_state or {}) if algorithm else {}
    return Response({
        'blocks_json': state.get('blocks_json') or {},
        'source': state.get('source') or '',
        'algorithm_status': algorithm.status if algorithm else None,
    })


@api_view(['GET'])
def algorithm_status(request):
    return Response(status_payload(algorithmrunner.latest_for(request.user)))


@api_view(['POST'])
def start(request):
    source = request.data.get('source') or ''
    if not source.strip():
        return Response({'error': 'No code to run.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        algorithm = algorithmrunner.start(
            request.user, source, request.data.get('blocks_json') or {}
        )
    except AlgorithmRunnerError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response(status_payload(algorithm), status=status.HTTP_201_CREATED)


@api_view(['POST'])
def pause(request):
    algorithm = algorithmrunner.latest_for(request.user)
    if algorithm is None or algorithm.status not in (Algorithm.RUNNING, Algorithm.PAUSED):
        return Response({'error': 'Algorithm is not running.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_status = algorithmrunner.toggle_pause(algorithm)
    except AlgorithmRunnerError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    message = 'Algorithm paused' if new_status == Algorithm.PAUSED else 'Algorithm resumed'
    return Response({'success': message, 'status': new_status})


@api_view(['POST'])
def stop(request):
    algorithm = algorithmrunner.latest_for(request.user)
    if algorithm is None or algorithm.status not in (Algorithm.RUNNING, Algorithm.PAUSED):
        return Response({'error': 'Algorithm is not running.'}, status=status.HTTP_400_BAD_REQUEST)

    algorithmrunner.stop(algorithm)
    return Response({'success': 'Algorithm stopped', 'status': Algorithm.STOPPED})


@api_view(['PATCH'])
def save(request):
    blocks_json = request.data.get('blocks_json') or {}
    algorithm = algorithmrunner.latest_for(request.user)
    if algorithm is None:
        algorithm = Algorithm.objects.create(owner=request.user, stored_state={})

    algorithm.stored_state = {**(algorithm.stored_state or {}), 'blocks_json': blocks_json}
    algorithm.save(update_fields=['stored_state'])
    return Response({'status': 'saved'})


# ── Endpoints called by the running CryptexVM (cryptexVM/src/user.zig) ──

@api_view(['GET'])
@authentication_classes([AlgorithmTokenAuthentication])
@permission_classes([IsAlgorithm])
def vm_balance(request):
    wallet, _ = Wallet.objects.get_or_create(trader=request.user, defaults={'balance': 1000})
    return Response({'wallet_balance': float(wallet.balance)})


@api_view(['GET'])
@authentication_classes([AlgorithmTokenAuthentication])
@permission_classes([IsAlgorithm])
def vm_holding(request):
    ticker = (request.query_params.get('ticker') or '').upper()
    record = CryptoOwnershipRecord.objects.filter(
        wallet__trader=request.user, ticker_id=ticker
    ).first()
    return Response({'ticker': ticker, 'amount': float(record.amount) if record else 0.0})


@api_view(['POST'])
@authentication_classes([AlgorithmTokenAuthentication])
@permission_classes([IsAlgorithm])
def vm_buy(request):
    return execute_order(BuyOrderLiquidSerializer, request.user, request.data)


@api_view(['POST'])
@authentication_classes([AlgorithmTokenAuthentication])
@permission_classes([IsAlgorithm])
def vm_sell(request):
    return execute_order(SellOrderCryptoSerializer, request.user, request.data)
