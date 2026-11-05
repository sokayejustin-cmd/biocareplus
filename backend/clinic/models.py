from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        DOCTOR = "doctor", "Docteur"
        NURSE = "nurse", "Infirmier"
        RECEPTIONIST = "receptionist", "Réceptionniste"
        PATIENT = "patient", "Patient"

    role = models.CharField(max_length=20, choices=Role.choices)
    phone = models.CharField(max_length=30, blank=True)
    must_change_password = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class Specialty(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "specialties"

    def __str__(self):
        return self.name


class Doctor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="doctor_profile"
    )
    specialty = models.ForeignKey(
        Specialty, on_delete=models.PROTECT, related_name="doctors"
    )
    license_number = models.CharField(max_length=50, blank=True)
    bio = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Dr {self.user.get_full_name()} — {self.specialty}"


class Nurse(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="nurse_profile"
    )
    department = models.CharField(max_length=120, blank=True)
    assigned_patients = models.ManyToManyField(
        "Patient", blank=True, related_name="assigned_nurses"
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class Receptionist(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="receptionist_profile",
    )
    desk = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class Patient(models.Model):
    class Sex(models.TextChoices):
        M = "M", "Masculin"
        F = "F", "Féminin"
        O = "O", "Autre"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="patient_profile"
    )
    patient_code = models.CharField(max_length=20, unique=True)
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=1, choices=Sex.choices, blank=True)
    address = models.CharField(max_length=255, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.patient_code} — {self.user.get_full_name()}"


class MedicalRecord(models.Model):
    patient = models.OneToOneField(
        Patient, on_delete=models.CASCADE, related_name="medical_record"
    )
    blood_type = models.CharField(max_length=8, blank=True)
    allergies = models.TextField(blank=True)
    medical_history = models.TextField(blank=True)
    surgical_history = models.TextField(blank=True)
    current_treatments = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Programmé"
        CONFIRMED = "confirmed", "Confirmé"
        WAITING = "waiting", "En attente"
        COMPLETED = "completed", "Terminé"
        CANCELLED = "cancelled", "Annulé"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="appointments"
    )
    doctor = models.ForeignKey(
        Doctor, on_delete=models.CASCADE, related_name="appointments"
    )
    specialty = models.ForeignKey(Specialty, on_delete=models.PROTECT)
    date = models.DateField()
    time = models.TimeField()
    reason = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-time"]
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "date", "time"],
                condition=~models.Q(status="cancelled"),
                name="unique_active_slot_per_doctor",
            )
        ]

    def clean(self):
        clash = Appointment.objects.filter(
            doctor=self.doctor, date=self.date, time=self.time
        ).exclude(status=self.Status.CANCELLED)
        if self.pk:
            clash = clash.exclude(pk=self.pk)
        if clash.exists():
            raise ValidationError(
                "Ce docteur a déjà un rendez-vous à cet horaire."
            )

    def save(self, *args, **kwargs):
        if self.doctor_id and not self.specialty_id:
            self.specialty = self.doctor.specialty
        super().save(*args, **kwargs)


class Consultation(models.Model):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="consultations"
    )
    doctor = models.ForeignKey(
        Doctor, on_delete=models.CASCADE, related_name="consultations"
    )
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="consultations",
    )
    date = models.DateField()
    reason = models.CharField(max_length=255)
    symptoms = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    comments = models.TextField(blank=True)
    treatment = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]


class Prescription(models.Model):
    consultation = models.ForeignKey(
        Consultation, on_delete=models.CASCADE, related_name="prescriptions"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="prescriptions"
    )
    doctor = models.ForeignKey(
        Doctor, on_delete=models.CASCADE, related_name="prescriptions"
    )
    date = models.DateField()
    instructions = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name="items"
    )
    medication = models.CharField(max_length=200)
    dosage = models.CharField(max_length=120, blank=True)
    posology = models.CharField(max_length=200, blank=True)
    duration = models.CharField(max_length=120, blank=True)
    instructions = models.CharField(max_length=255, blank=True)


class MedicalComment(models.Model):
    class Kind(models.TextChoices):
        DOCTOR = "doctor", "Commentaire médical"
        NURSE = "nurse", "Observation infirmière"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="medical_comments"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ConsultationTicket(models.Model):
    STATUS_CHOICES = [
        ("EN_ATTENTE", "En attente"),
        ("EN_COURS", "En cours"),
        ("TERMINE", "Terminé"),
        ("ANNULE", "Annulé"),
    ]

    numero = models.CharField(
        max_length=20,
        unique=False,
        null=True,
        blank=True,
    )

    patient = models.ForeignKey(
        "Patient",
        on_delete=models.CASCADE,
        related_name="tickets",
    )

    doctor = models.ForeignKey(
        "Doctor",
        on_delete=models.CASCADE,
        related_name="tickets",
    )

    date = models.DateField(auto_now_add=True)

    heure = models.TimeField(
        null=True,
        blank=True,
    )

    statut = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="EN_ATTENTE",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.numero} - {self.patient}"

class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField(max_length=160)
    message = models.TextField()
    event = models.CharField(max_length=40)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
