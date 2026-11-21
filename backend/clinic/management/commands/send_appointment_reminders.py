"""Envoie les rappels WhatsApp des rendez-vous à venir.

Usage :
    python manage.py send_appointment_reminders            # un passage
    python manage.py send_appointment_reminders --dry-run  # liste sans envoyer
    python manage.py send_appointment_reminders --loop 15  # toutes les 15 min

En production, planifier un passage toutes les 15 minutes (cron, Planificateur
de tâches Windows…). Chaque rendez-vous n'est rappelé qu'une fois
(champ ``reminder_sent_at``), sauf s'il est déplacé.
"""

import time
from datetime import datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from clinic.models import Appointment
from clinic.whatsapp import send_appointment_reminder


def due_appointments(now=None, hours=None):
    now = now or timezone.now()
    hours = settings.APPOINTMENT_REMINDER_HOURS if hours is None else hours
    horizon = now + timedelta(hours=hours)
    candidates = Appointment.objects.select_related(
        "patient__user", "doctor__user", "specialty"
    ).filter(
        status__in=(Appointment.Status.SCHEDULED, Appointment.Status.CONFIRMED),
        reminder_sent_at__isnull=True,
        patient__whatsapp_opt_in=True,
        date__gte=timezone.localdate(now),
        date__lte=timezone.localtime(horizon).date(),
    )
    tz = timezone.get_current_timezone()
    for appointment in candidates:
        starts = timezone.make_aware(
            datetime.combine(appointment.date, appointment.time), tz
        )
        if now <= starts <= horizon:
            yield appointment


class Command(BaseCommand):
    help = "Envoie les rappels WhatsApp des rendez-vous des prochaines heures."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Lister sans envoyer.")
        parser.add_argument(
            "--loop",
            type=int,
            metavar="MINUTES",
            help="Relancer automatiquement toutes les N minutes (Ctrl+C pour arrêter).",
        )

    def handle(self, *args, **options):
        if not options["loop"]:
            self.run_once(options["dry_run"])
            return
        self.stdout.write(f"Rappels toutes les {options['loop']} min — Ctrl+C pour arrêter.")
        try:
            while True:
                self.run_once(options["dry_run"])
                time.sleep(options["loop"] * 60)
        except KeyboardInterrupt:
            self.stdout.write("Arrêt.")

    def run_once(self, dry_run):
        sent = failed = 0
        for appointment in due_appointments():
            label = f"RDV #{appointment.pk} {appointment.date} {appointment.time:%H:%M} — {appointment.patient}"
            if dry_run:
                self.stdout.write(f"[à envoyer] {label}")
                continue
            log = send_appointment_reminder(appointment)
            if log.status == "sent":
                sent += 1
                self.stdout.write(self.style.SUCCESS(f"[envoyé] {label}"))
            else:
                failed += 1
                self.stdout.write(self.style.WARNING(f"[{log.status}] {label} : {log.error}"))
        stamp = timezone.localtime().strftime("%d/%m %H:%M")
        self.stdout.write(f"{stamp} — rappels envoyés : {sent}, non envoyés : {failed}")
