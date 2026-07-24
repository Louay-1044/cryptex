from django.db import models
from django.utils import timezone
from .user import User


class Algorithm(models.Model):
    RUNNING = "RUN"
    PAUSED  = "PSE"
    STOPPED = "STP"
    ERROR   = "ERR"
    STATUS_CHOICES = {
        RUNNING: "Running",
        PAUSED:  "Paused",
        STOPPED: "Stopped",
        ERROR:   "Error",
    }

    owner      = models.ForeignKey(User, on_delete=models.CASCADE)
    pid        = models.IntegerField(null=True, blank=True)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time   = models.DateTimeField(null=True, blank=True)
    status     = models.CharField(
        max_length=3,
        choices=STATUS_CHOICES,
        default=STOPPED,
    )
    error_message = models.TextField(null=True, blank=True)
    stored_state = models.JSONField(null=True)
    token_cache_key = models.CharField(max_length=255, null=True, blank=True)
    algorithm_token_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-start_time']
        verbose_name_plural = "Algorithms"

    def __str__(self):
        return f"{self.owner.username} - {self.get_status_display()} ({self.start_time})"
