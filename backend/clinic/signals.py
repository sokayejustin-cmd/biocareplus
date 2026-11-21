from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from .models import (
    Appointment,
    Consultation,
    LabResult,
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


@receiver(pre_save, sender=LabResult)
def remember_lab_status(sender, instance, **kwargs):
    previous = None
    if instance.pk:
        previous = (
            LabResult.objects.filter(pk=instance.pk)
            .values_list("status", flat=True)
            .first()
        )
    instance._previous_status = previous
    if instance.status == LabResult.Status.AVAILABLE and not instance.available_at:
        instance.available_at = timezone.now()


@receiver(post_save, sender=LabResult)
def notify_lab_result(sender, instance, created, **kwargs):
    if created and instance.status != LabResult.Status.AVAILABLE:
        notify(
            instance.patient.user,
            "lab_requested",
            "Analyse prescrite",
            f"L'analyse « {instance.test_name} » a été demandée.",
        )
        return

    became_available = (
        instance.status == LabResult.Status.AVAILABLE
        and getattr(instance, "_previous_status", None) != LabResult.Status.AVAILABLE
    )
    if not became_available:
        return

    notify(
        instance.patient.user,
        "lab_available",
        "Résultat d'analyse disponible",
        f"Le résultat de « {instance.test_name} » est disponible dans votre espace.",
    )

    def send():
        from .whatsapp import lab_result_text, send_whatsapp

        send_whatsapp(
            instance.patient,
            "lab_result",
            lab_result_text(instance),
        )

    transaction.on_commit(send)


# keep User import used for role checks if needed later
_ = User
