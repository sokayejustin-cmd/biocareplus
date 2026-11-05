from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import (
    Appointment,
    Consultation,
    Notification,
    Patient,
    Prescription,
    User,
)


def notify(user, event, title, message):
    if user:
        Notification.objects.create(
            user=user, event=event, title=title, message=message
        )


@receiver(post_save, sender=Patient)
def create_medical_record(sender, instance, created, **kwargs):
    if created:
        from .models import MedicalRecord

        MedicalRecord.objects.get_or_create(patient=instance)


@receiver(post_save, sender=Appointment)
def notify_appointment(sender, instance, created, **kwargs):
    patient_user = instance.patient.user
    doctor_user = instance.doctor.user
    label = instance.get_status_display()
    when = f"{instance.date} {instance.time}"
    if created:
        notify(
            patient_user,
            "appointment_new",
            "Nouveau rendez-vous",
            f"Rendez-vous le {when} avec {instance.doctor}.",
        )
        notify(
            doctor_user,
            "appointment_new",
            "Nouveau rendez-vous",
            f"Patient {instance.patient} le {when}.",
        )
        return
    if instance.status == Appointment.Status.CONFIRMED:
        notify(
            patient_user,
            "appointment_confirmed",
            "Rendez-vous confirmé",
            f"Votre rendez-vous du {when} est confirmé.",
        )
    elif instance.status == Appointment.Status.CANCELLED:
        notify(
            patient_user,
            "appointment_cancelled",
            "Rendez-vous annulé",
            f"Le rendez-vous du {when} a été annulé.",
        )
        notify(
            doctor_user,
            "appointment_cancelled",
            "Rendez-vous annulé",
            f"Le rendez-vous de {instance.patient} le {when} est annulé.",
        )


@receiver(post_save, sender=Consultation)
def notify_consultation(sender, instance, created, **kwargs):
    if created:
        notify(
            instance.patient.user,
            "consultation_new",
            "Nouvelle consultation",
            f"Une consultation a été enregistrée le {instance.date}.",
        )


@receiver(post_save, sender=Prescription)
def notify_prescription(sender, instance, created, **kwargs):
    if created:
        notify(
            instance.patient.user,
            "prescription_new",
            "Nouvelle ordonnance",
            f"Une ordonnance a été établie le {instance.date}.",
        )


# keep User import used for role checks if needed later
_ = User
