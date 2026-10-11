from collections import defaultdict
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import CryptoOwnershipRecord, Membership, Organisation, TradeHistory, User, Wallet
from ..serializers.organisationserializer import MembershipSerializer, OrganisationSerializer


def error(message, code):
    return Response({'error': message}, status=code)


def current_membership(user):
    return (
        Membership.objects.select_related('organisation')
        .filter(user=user, accepted=True)
        .first()
    )


def is_member(user, organisation):
    return Membership.objects.filter(user=user, organisation=organisation, accepted=True).exists()


@api_view(['GET'])
def mine(request):
    membership = current_membership(request.user)
    if membership is None:
        return error('You are not in an organisation.', status.HTTP_404_NOT_FOUND)
    return Response(OrganisationSerializer(membership.organisation).data)


@api_view(['POST'])
def create(request):
    if current_membership(request.user):
        return error('You are already in an organisation.', status.HTTP_400_BAD_REQUEST)

    serializer = OrganisationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    organisation = serializer.save(owner=request.user)
    Membership.objects.update_or_create(
        user=request.user, organisation=organisation, defaults={'accepted': True}
    )
    return Response(OrganisationSerializer(organisation).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
def rename(request, org_id):
    organisation = get_object_or_404(Organisation, id=org_id)
    if organisation.owner_id != request.user.id:
        return error('Only the owner can rename the organisation.', status.HTTP_403_FORBIDDEN)

    serializer = OrganisationSerializer(organisation, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['DELETE'])
def delete(request, org_id):
    organisation = get_object_or_404(Organisation, id=org_id)
    if organisation.owner_id != request.user.id:
        return error('Only the owner can delete the organisation.', status.HTTP_403_FORBIDDEN)

    organisation.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
def invite(request, org_id):
    organisation = Organisation.objects.filter(id=org_id).first()
    if organisation is None:
        return error('Organisation not found.', status.HTTP_404_NOT_FOUND)
    if organisation.owner_id != request.user.id:
        return error('Only the owner can invite traders.', status.HTTP_403_FORBIDDEN)

    # The frontend matches this exact message to detect ownership
    username = (request.data.get('username') or '').strip()
    if not username:
        return error('Username is required.', status.HTTP_400_BAD_REQUEST)

    invitee = User.objects.filter(username=username).first()
    if invitee is None:
        return error(f'No user named "{username}".', status.HTTP_400_BAD_REQUEST)

    membership = Membership.objects.filter(user=invitee, organisation=organisation).first()
    if membership is not None:
        message = 'already a member' if membership.accepted else 'already invited'
        return error(f'{username} is {message}.', status.HTTP_400_BAD_REQUEST)

    membership = Membership.objects.create(user=invitee, organisation=organisation, accepted=False)
    return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def invitations(request):
    pending = Membership.objects.select_related('user', 'organisation').filter(
        user=request.user, accepted=False
    )
    return Response(MembershipSerializer(pending, many=True).data)


@api_view(['POST'])
def accept_invitation(request, org_id):
    membership = Membership.objects.filter(
        user=request.user, organisation_id=org_id, accepted=False
    ).first()
    if membership is None:
        return error('Invitation not found.', status.HTTP_404_NOT_FOUND)
    if current_membership(request.user):
        return error('Leave your current organisation first.', status.HTTP_400_BAD_REQUEST)

    membership.accepted = True
    membership.save(update_fields=['accepted'])
    return Response(MembershipSerializer(membership).data)


@api_view(['DELETE'])
def remove(request, org_id, user_id):
    organisation = get_object_or_404(Organisation, id=org_id)
    is_owner = organisation.owner_id == request.user.id

    if not is_owner and request.user.id != user_id:
        return error('Only the owner can remove traders.', status.HTTP_403_FORBIDDEN)
    if user_id == organisation.owner_id:
        return error('The owner cannot leave; delete the organisation instead.',
                     status.HTTP_400_BAD_REQUEST)

    deleted, _ = Membership.objects.filter(organisation=organisation, user_id=user_id).delete()
    if not deleted:
        return error('That user is not in this organisation.', status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def traders(request, org_id):
    organisation = get_object_or_404(Organisation, id=org_id)
    if not is_member(request.user, organisation):
        return error('You are not a member of this organisation.', status.HTTP_403_FORBIDDEN)

    members = Membership.objects.select_related('user', 'organisation').filter(
        organisation=organisation, accepted=True
    ).order_by('joined_at')
    return Response(MembershipSerializer(members, many=True).data)


@api_view(['GET'])
def portfolio(request, org_id):
    organisation = get_object_or_404(Organisation, id=org_id)
    if not is_member(request.user, organisation):
        return error('You are not a member of this organisation.', status.HTTP_403_FORBIDDEN)

    member_ids = Membership.objects.filter(
        organisation=organisation, accepted=True
    ).values_list('user_id', flat=True)

    balance = sum(
        Wallet.objects.filter(trader_id__in=member_ids).values_list('balance', flat=True),
        Decimal('0'),
    )
    holdings = defaultdict(Decimal)
    for record in CryptoOwnershipRecord.objects.filter(wallet__trader_id__in=member_ids):
        holdings[record.ticker_id] += record.amount

    return Response({
        'balance': f'{balance:.2f}',
        'portfolio': [
            {'ticker_id': ticker, 'amount': f'{amount:.2f}'}
            for ticker, amount in sorted(holdings.items())
        ],
    })


@api_view(['GET'])
def trader_history(request, org_id, user_id):
    organisation = get_object_or_404(Organisation, id=org_id)
    if organisation.owner_id != request.user.id:
        return error('Only the owner can view trader history.', status.HTTP_403_FORBIDDEN)
    if not Membership.objects.filter(organisation=organisation, user_id=user_id, accepted=True).exists():
        return error('That user is not in this organisation.', status.HTTP_404_NOT_FOUND)

    entries = TradeHistory.objects.select_related('buy_order', 'sell_order').filter(
        trader_id=user_id
    ).order_by('-id')

    history = []
    for entry in entries:
        if entry.buy_order:
            order = entry.buy_order
            history.append({
                'type': 'buy',
                'currency': order.currency_bought_id,
                'amount': str(order.amount_bought),
                'price': str(order.buy_price),
                'datetime': order.buy_date_time.isoformat(),
            })
        elif entry.sell_order:
            order = entry.sell_order
            history.append({
                'type': 'sell',
                'currency': order.currency_sold_id,
                'amount': str(order.amount_sold),
                'price': str(order.sell_price),
                'datetime': order.sell_date_time.isoformat(),
            })

    return Response({'trade_history': history})
