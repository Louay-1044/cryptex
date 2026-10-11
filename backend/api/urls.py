from django.urls import path

from .views import account, algorithm, cryptai, organisation, trading

urlpatterns = [
    # Accounts
    path('register/', account.register),
    path('login/', account.login),
    path('user/', account.user),
    path('user/delete/', account.delete_user),
    path('account/fetchDetails/', account.fetch_details),
    path('account/fetchBalance/', account.fetch_balance),
    path('currency/list/', account.currency_list),

    # Trading
    path('buyOrder/liquid/execute/', trading.buy_liquid),
    path('buyOrder/crypto/execute/', trading.buy_with_crypto),
    path('sellOrder/execute/', trading.sell),

    # Organisations
    path('organisation/mine/', organisation.mine),
    path('organisation/create/', organisation.create),
    path('organisation/invitations/', organisation.invitations),
    path('organisation/<int:org_id>/rename/', organisation.rename),
    path('organisation/<int:org_id>/delete/', organisation.delete),
    path('organisation/<int:org_id>/invite/', organisation.invite),
    path('organisation/<int:org_id>/invitation/accept/', organisation.accept_invitation),
    path('organisation/<int:org_id>/remove/<int:user_id>/', organisation.remove),
    path('organisation/<int:org_id>/traders/', organisation.traders),
    path('organisation/<int:org_id>/portfolio/', organisation.portfolio),
    path('organisation/<int:org_id>/trader/<int:user_id>/history/', organisation.trader_history),

    # Algorithm builder
    path('algorithm/fetch/', algorithm.fetch),
    path('algorithm/status/', algorithm.algorithm_status),
    path('algorithm/start/', algorithm.start),
    path('algorithm/pause/', algorithm.pause),
    path('algorithm/stop/', algorithm.stop),
    path('algorithm/save/', algorithm.save),

    # Called by the running CryptexVM with an algorithm token
    path('algorithm/balance/', algorithm.vm_balance),
    path('algorithm/holding/', algorithm.vm_holding),
    path('algorithm/buy/', algorithm.vm_buy),
    path('algorithm/sell/', algorithm.vm_sell),

    # CryptAI
    path('cryptAI/query/', cryptai.query),
]
