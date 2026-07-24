from rest_framework import serializers
from ..models import Organisation, Membership, User

class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = ['id', 'name', 'owner', 'created_at']
        read_only_fields = ['id', 'owner', 'created_at']

class MembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    organisation_name = serializers.CharField(source='organisation.name', read_only=True)
    class Meta:
        model = Membership
        fields = ['id', 'user', 'username', 'email', 'organisation', 'organisation_name', 'joined_at', 'accepted']
        read_only_fields = ['id', 'joined_at']