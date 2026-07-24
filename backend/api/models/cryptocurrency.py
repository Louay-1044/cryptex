from django.db import models

class Cryptocurrency(models.Model):
    ticker = models.CharField(max_length=5, primary_key=True)
    name = models.CharField(max_length=50)