from django.urls import re_path

from .consumers import ChartConsumer

websocket_urlpatterns = [
    re_path(r'^ws/chart/(?P<ticker>[A-Za-z0-9]+)/$', ChartConsumer.as_asgi()),
]
