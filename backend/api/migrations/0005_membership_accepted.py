from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_buyorder_buyer_sellorder_seller'),
    ]

    operations = [
        migrations.AddField(
            model_name='membership',
            name='accepted',
            field=models.BooleanField(default=False),
        ),
    ]