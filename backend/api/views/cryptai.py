from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..cryptAI import chat


@api_view(['POST'])
def query(request):
    prompt = (request.data.get('prompt') or '').strip()
    if not prompt:
        return Response({'error': 'Prompt is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        if request.data.get('type') == 'code':
            answer = chat.query_with_code(prompt, request.data.get('code') or '')
        else:
            answer = chat.query_with_market(prompt)
    except RuntimeError as e:
        return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        return Response({'error': f'CryptAI request failed: {e}'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'response': answer})
