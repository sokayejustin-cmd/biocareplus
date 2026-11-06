from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from clinic.models import (
    Appointment,
    Consultation,
    ConsultationTicket,
    Doctor,
    MedicalComment,
    MedicalRecord,
    Nurse,
    Patient,
    Prescription,
    PrescriptionItem,
    Receptionist,
    Specialty,
    User,
)


class Command(BaseCommand):
    help = "Charge les données de démonstration BIO CARE PLUS (5 rôles)."

    def handle(self, *args, **options):
        specs = {}
        for name in [
            "Médecine générale",
            "Cardiologie",
            "Pédiatrie",
            "Gynécologie",
            "Dermatologie",
            "Odontologie",
            "Ophtalmologie",
        ]:
            specs[name], _ = Specialty.objects.get_or_create(
                name=name, defaults={"description": f"Spécialité {name.lower()}."}
            )

        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={
                "role": User.Role.ADMIN,
                "first_name": "Camille",
                "last_name": "Martin",
                "email": "admin@biocareplus.fr",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.set_password("Admin123!")
        admin.role = User.Role.ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()

        def staff_user(username, role, first, last, email, password):
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={
                    "role": role,
                    "first_name": first,
                    "last_name": last,
                    "email": email,
                    "phone": "01 23 45 67 80",
                },
            )
            user.role = role
            user.first_name = first
            user.last_name = last
            user.set_password(password)
            user.save()
            return user

        u_doc = staff_user(
            "docteur",
            User.Role.DOCTOR,
            "Léa",
            "Moreau",
            "lea.moreau@biocareplus.fr",
            "Docteur123!",
        )
        doctor, _ = Doctor.objects.get_or_create(
            user=u_doc,
            defaults={
                "specialty": specs["Médecine générale"],
                "license_number": "RPPS-100200",
                "bio": "Médecin généraliste, 12 ans d’expérience.",
            },
        )
        doctor.specialty = specs["Médecine générale"]
        doctor.save()

        u_cardio = staff_user(
            "docteur2",
            User.Role.DOCTOR,
            "Karim",
            "Benali",
            "karim.benali@biocareplus.fr",
            "Docteur123!",
        )
        Doctor.objects.get_or_create(
            user=u_cardio,
            defaults={
                "specialty": specs["Cardiologie"],
                "license_number": "RPPS-100201",
                "bio": "Cardiologue, suivi des pathologies chroniques.",
            },
        )

        u_nurse = staff_user(
            "infirmier",
            User.Role.NURSE,
            "Sofia",
            "Diallo",
            "sofia.diallo@biocareplus.fr",
            "Infirmier123!",
        )
        nurse, _ = Nurse.objects.get_or_create(
            user=u_nurse, defaults={"department": "Soins généraux"}
        )

        u_rec = staff_user(
            "reception",
            User.Role.RECEPTIONIST,
            "Hugo",
            "Petit",
            "hugo.petit@biocareplus.fr",
            "Reception123!",
        )
        Receptionist.objects.get_or_create(user=u_rec, defaults={"desk": "Accueil principal"})

        def make_patient(username, first, last, code, sex, extra=None):
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={
                    "role": User.Role.PATIENT,
                    "first_name": first,
                    "last_name": last,
                    "email": f"{username}@mail.fr",
                    "phone": "06 12 34 56 78",
                },
            )
            user.set_password("Patient123!")
            user.role = User.Role.PATIENT
            user.save()
            patient, _ = Patient.objects.get_or_create(
                user=user,
                defaults={
                    "patient_code": code,
                    "date_of_birth": date(1988, 4, 12),
                    "sex": sex,
                    "address": "18 rue des Lilas, 75011 Paris",
                    "emergency_contact_name": "Contact urgence",
                    "emergency_contact_phone": "06 00 00 00 00",
                },
            )
            record = patient.medical_record
            record.blood_type = (extra or {}).get("blood", "A+")
            record.allergies = (extra or {}).get("allergies", "Aucune connue")
            record.medical_history = "Hypertension suivie depuis 2021."
            record.surgical_history = "Appendicectomie (2010)."
            record.current_treatments = "Aucun traitement au long cours."
            record.observations = "Patient coopérant."
            record.save()
            return patient

        p1 = make_patient("patient", "Nadia", "Bernard", "PAT-1001", "F")
        p2 = make_patient("patient2", "Marc", "Leroy", "PAT-1002", "M", {"blood": "O+"})
        p3 = make_patient("patient3", "Inès", "Koffi", "PAT-1003", "F", {"allergies": "Pénicilline"})
        nurse.assigned_patients.set([p1, p2])

        today = timezone.localdate()
        a1, _ = Appointment.objects.get_or_create(
            doctor=doctor,
            date=today,
            time=time(9, 30),
            defaults={
                "patient": p1,
                "specialty": doctor.specialty,
                "reason": "Contrôle annuel",
                "status": Appointment.Status.CONFIRMED,
            },
        )
        Appointment.objects.get_or_create(
            doctor=doctor,
            date=today + timedelta(days=1),
            time=time(14, 0),
            defaults={
                "patient": p2,
                "specialty": doctor.specialty,
                "reason": "Douleurs abdominales",
                "status": Appointment.Status.SCHEDULED,
            },
        )

        c1, _ = Consultation.objects.get_or_create(
            patient=p1,
            doctor=doctor,
            date=today - timedelta(days=20),
            defaults={
                "appointment": a1,
                "reason": "Fatigue persistante",
                "symptoms": "Asthénie, céphalées occasionnelles",
                "diagnosis": "Syndrome de fatigue, bilan rassurant",
                "observations": "Examen clinique normal",
                "comments": "Revoir dans 3 mois",
                "treatment": "Repos, hydratation",
                "recommendations": "Activité physique modérée",
            },
        )
        rx, created = Prescription.objects.get_or_create(
            consultation=c1,
            patient=p1,
            doctor=doctor,
            date=c1.date,
            defaults={
                "instructions": "À prendre pendant les repas.",
                "observations": "Pas d’automédication.",
            },
        )
        if created:
            PrescriptionItem.objects.create(
                prescription=rx,
                medication="Paracétamol 500 mg",
                dosage="500 mg",
                posology="1 comprimé 3 fois par jour",
                duration="5 jours",
                instructions="Si douleur",
            )

        MedicalComment.objects.get_or_create(
            patient=p1,
            author=u_doc,
            kind=MedicalComment.Kind.DOCTOR,
            text="Suivi tensionnel à poursuivre.",
        )
        MedicalComment.objects.get_or_create(
            patient=p1,
            author=u_nurse,
            kind=MedicalComment.Kind.NURSE,
            text="Constantes stables à l’accueil (TA 12/8, T° 36.6).",
        )

        ConsultationTicket.objects.get_or_create(
            numero=f"BC-{today.strftime('%Y%m%d')}-0001",
            defaults={
                "patient": p1,
                "doctor": doctor,
                "heure": a1.time,
            },
        )

        self.stdout.write(self.style.SUCCESS("Données de démonstration prêtes."))
        self.stdout.write(
            """
Comptes de test (mot de passe indiqué) :
  admin / Admin123!
  docteur / Docteur123!
  infirmier / Infirmier123!
  reception / Reception123!
  patient / Patient123!
"""
        )
