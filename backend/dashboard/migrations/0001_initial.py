# Generated by Django 4.2.18 on 2025-04-07 02:46

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='StatisticsDashboard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ],
            options={
                'verbose_name': 'Статистика Общая',
                'verbose_name_plural': 'Статистика Общая',
                'managed': False,
            },
        ),
    ]
