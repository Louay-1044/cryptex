from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone_number = models.PositiveIntegerField(blank=True, null=True)

    def __str__(self):
        return self.username

