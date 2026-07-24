from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import AuthenticationFailed
from .models import AlgorithmToken


class AlgorithmTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '').split()
        if len(auth) != 2 or auth[0].lower() != 'token':
            return None

        raw_key = auth[1]
        for token in AlgorithmToken.objects.filter(is_active=True):
            if token.verify_key(raw_key):
                return (token.user, token)

        raise AuthenticationFailed('Invalid or inactive algorithm token.')


class IsAlgorithm(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.auth, AlgorithmToken)
