from rest_framework import serializers
from ..models import User
from ..models import Wallet

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'password', 'phone_number']
        extra_kwargs = {
            'password': {'write_only': True},
            'first_name': {'required': False, 'default': ''},
            'last_name': {'required': False, 'default': ''},
            'phone_number': {'required': False, 'allow_null': True},
        }

    def create(self, validated_data):
        user = User(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', None)
        )
        user.set_password(validated_data['password'])
        user.save()

        Wallet.objects.create(
            trader=user,
            balance=1000.00
        )

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'phone_number']
        extra_kwargs = {'password': {'write_only': True}}
