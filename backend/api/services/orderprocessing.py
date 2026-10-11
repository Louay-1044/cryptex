from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP, ROUND_UP

from ..models import (
    BuyOrder,
    CryptoOwnershipRecord,
    SellOrder,
    TradeHistory,
    Wallet,
)
from .market import MarketDataError, get_price

CENT = Decimal('0.01')


class OrderProcessingError(Exception):
    pass


def _price(currency):
    try:
        return get_price(currency.ticker)
    except MarketDataError as e:
        raise OrderProcessingError(str(e))


def _wallet(user):
    wallet, _ = Wallet.objects.select_for_update().get_or_create(
        trader=user, defaults={'balance': Decimal('1000.00')}
    )
    return wallet


def _holding(wallet, currency):
    return (
        CryptoOwnershipRecord.objects.select_for_update()
        .filter(wallet=wallet, ticker=currency)
        .first()
    )


def _add_holding(wallet, currency, amount):
    holding = _holding(wallet, currency)
    if holding is None:
        CryptoOwnershipRecord.objects.create(wallet=wallet, ticker=currency, amount=amount)
    else:
        holding.amount += amount
        holding.save(update_fields=['amount'])


def _remove_holding(wallet, currency, amount):
    holding = _holding(wallet, currency)
    owned = holding.amount if holding else Decimal('0')
    if owned < amount:
        raise OrderProcessingError(
            f'Insufficient {currency.ticker}: you own {owned} but need {amount}.'
        )
    holding.amount -= amount
    if holding.amount == 0:
        holding.delete()
    else:
        holding.save(update_fields=['amount'])


def _record_buy(user, currency, amount, price):
    order = BuyOrder.objects.create(
        amount_bought=amount,
        currency_bought=currency,
        buy_price=price.quantize(CENT),
        buyer=user,
    )
    TradeHistory.objects.create(trader=user, buy_order=order)
    return order


def _record_sell(user, currency, amount, price):
    order = SellOrder.objects.create(
        amount_sold=amount,
        currency_sold=currency,
        sell_price=price.quantize(CENT),
        seller=user,
    )
    TradeHistory.objects.create(trader=user, sell_order=order)
    return order


class OrderProcessing:
    """Executes market orders against the user's demo wallet. Callers wrap these in a transaction."""

    @staticmethod
    def process_buy_order(user, currency_bought, currency_sold, amount):
        amount = Decimal(amount).quantize(CENT)
        if amount <= 0:
            raise OrderProcessingError('Amount must be greater than zero.')
        if currency_sold is not None and currency_sold.ticker == currency_bought.ticker:
            raise OrderProcessingError('Cannot pay for a currency with itself.')

        wallet = _wallet(user)
        buy_price = _price(currency_bought)
        cost = amount * buy_price

        if currency_sold is None:
            cost = cost.quantize(CENT, rounding=ROUND_UP)
            if wallet.balance < cost:
                raise OrderProcessingError(
                    f'Insufficient balance: {amount} {currency_bought.ticker} costs ${cost} '
                    f'but your balance is ${wallet.balance}.'
                )
            wallet.updateBalance(wallet.balance - cost)
            paid = f'${cost}'
        else:
            sell_price = _price(currency_sold)
            if sell_price <= 0:
                raise OrderProcessingError(f'No price available for {currency_sold.ticker}.')
            # Holdings are stored to 2 decimal places, so round to the nearest unit
            needed = (cost / sell_price).quantize(CENT, rounding=ROUND_HALF_UP)
            if needed <= 0:
                raise OrderProcessingError(
                    f'Order too small to pay with {currency_sold.ticker}: it is worth less than '
                    f'0.01 {currency_sold.ticker}.'
                )
            _remove_holding(wallet, currency_sold, needed)
            _record_sell(user, currency_sold, needed, sell_price)
            paid = f'{needed} {currency_sold.ticker}'

        _add_holding(wallet, currency_bought, amount)
        _record_buy(user, currency_bought, amount, buy_price)

        return {
            'message': f'Bought {amount} {currency_bought.ticker} for {paid}.',
            'wallet_balance': wallet.balance,
        }

    @staticmethod
    def process_sell_order(user, currency_sold, amount):
        amount = Decimal(amount).quantize(CENT)
        if amount <= 0:
            raise OrderProcessingError('Amount must be greater than zero.')

        wallet = _wallet(user)
        sell_price = _price(currency_sold)
        _remove_holding(wallet, currency_sold, amount)

        proceeds = (amount * sell_price).quantize(CENT, rounding=ROUND_DOWN)
        wallet.updateBalance(wallet.balance + proceeds)
        _record_sell(user, currency_sold, amount, sell_price)

        return {
            'message': f'Sold {amount} {currency_sold.ticker} for ${proceeds}.',
            'wallet_balance': wallet.balance,
        }
