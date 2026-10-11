from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Algorithm,
    AlgorithmToken,
    BuyOrder,
    CryptoOwnershipRecord,
    Cryptocurrency,
    Membership,
    Organisation,
    SellOrder,
    TradeHistory,
    User,
    Wallet,
)

admin.site.register(User, UserAdmin)
for model in (Algorithm, AlgorithmToken, BuyOrder, CryptoOwnershipRecord, Cryptocurrency,
              Membership, Organisation, SellOrder, TradeHistory, Wallet):
    admin.site.register(model)
