from django.db import models
from .user import User
from django.contrib.auth.hashers import make_password, check_password
import secrets


class AlgorithmToken(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="algorithm_token"
    )
    key_hash = models.CharField(max_length=255, unique=True, db_index=True)
    created = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    name = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-created']

    def __str__(self):
        return f"AlgorithmToken for {self.user.username}"

    @staticmethod
    def generate_key():
        return secrets.token_urlsafe(48)

    def set_key(self, raw_key):
        self.key_hash = make_password(raw_key)

    def verify_key(self, raw_key):
        return check_password(raw_key, self.key_hash)

    def save(self, *args, **kwargs):
        if not self.key_hash:
            raw_key = self.generate_key()
            self.set_key(raw_key)
        super().save(*args, **kwargs)
