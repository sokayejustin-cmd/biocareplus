from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    Appointment,
    ConsultationTicket,
    Doctor,
    MedicalComment,
    MedicalRecord,
    Nurse,
    Notification,
    Patient,
    Specialty,
    User,
)

PASSWORD = "Str0ng-Passw0rd!"


def make_user(username, role, **extra):
    return User.objects.create_user(
        username=username,
        password=PASSWORD,
        role=role,
        first_name=username.capitalize(),
        last_name="Test",
        **extra,
    )


class BaseAPITest(TestCase):
    """Jeu de données minimal : un utilisateur de chaque rôle."""

    @classmethod
    def setUpTestData(cls):
        cls.specialty = Specialty.objects.create(name="Médecine générale")

        cls.admin = make_user("admin", User.Role.ADMIN)
        cls.reception = make_user("reception", User.Role.RECEPTIONIST)

        cls.doctor_user = make_user("docteur", User.Role.DOCTOR)
        cls.doctor = Doctor.objects.create(user=cls.doctor_user, specialty=cls.specialty)

        cls.other_doctor_user = make_user("docteur2", User.Role.DOCTOR)
        cls.other_doctor = Doctor.objects.create(
            user=cls.other_doctor_user, specialty=cls.specialty
        )

        cls.nurse_user = make_user("infirmier", User.Role.NURSE)
        cls.nurse = Nurse.objects.create(user=cls.nurse_user)

        cls.patient_user = make_user("patient", User.Role.PATIENT)
        cls.patient = Patient.objects.create(user=cls.patient_user, patient_code="P-0001")

        cls.stranger_user = make_user("inconnu", User.Role.PATIENT)
        cls.stranger = Patient.objects.create(user=cls.stranger_user, patient_code="P-0002")

    def setUp(self):
        self.client = APIClient()

    def login(self, user):
        self.client.force_authenticate(user=user)


class AuthTests(BaseAPITest):
    def test_public_clinic(self):
        response = self.client.get("/api/public/clinic/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "BIO CARE PLUS")

    def test_login_returns_tokens_and_user(self):
        response = self.client.post(
            "/api/auth/login/", {"username": "admin", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertEqual(data["user"]["role"], "admin")

    def test_login_wrong_password(self):
        response = self.client.post(
            "/api/auth/login/", {"username": "admin", "password": "nope"}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_api_requires_authentication(self):
        self.assertEqual(self.client.get("/api/patients/").status_code, 401)

    def test_me_update_and_change_password(self):
        self.login(self.patient_user)
        response = self.client.patch("/api/auth/me/", {"phone": "0600000000"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["phone"], "0600000000")

        wrong = self.client.post(
            "/api/auth/change-password/",
            {"old_password": "mauvais", "new_password": "An0ther-Passw0rd!"},
            format="json",
        )
        self.assertEqual(wrong.status_code, 400)

        ok = self.client.post(
            "/api/auth/change-password/",
            {"old_password": PASSWORD, "new_password": "An0ther-Passw0rd!"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.patient_user.refresh_from_db()
        self.assertTrue(self.patient_user.check_password("An0ther-Passw0rd!"))

    def test_change_password_clears_must_change_flag(self):
        User.objects.filter(pk=self.patient_user.pk).update(must_change_password=True)
        self.patient_user.refresh_from_db()
        self.login(self.patient_user)
        self.client.post(
            "/api/auth/change-password/",
            {"old_password": PASSWORD, "new_password": "An0ther-Passw0rd!"},
            format="json",
        )
        self.patient_user.refresh_from_db()
        self.assertFalse(self.patient_user.must_change_password)


class PermissionTests(BaseAPITest):
    def test_only_admin_manages_users(self):
        self.login(self.reception)
        self.assertEqual(self.client.get("/api/users/").status_code, 403)
        self.login(self.admin)
        self.assertEqual(self.client.get("/api/users/").status_code, 200)

    def test_patient_only_sees_own_record(self):
        self.login(self.patient_user)
        response = self.client.get("/api/patients/")
        self.assertEqual(response.status_code, 200)
        ids = [p["id"] for p in response.json()["results"]]
        self.assertEqual(ids, [self.patient.id])

    def test_nurse_only_sees_assigned_patients(self):
        self.nurse.assigned_patients.add(self.patient)
        self.login(self.nurse_user)
        ids = [p["id"] for p in self.client.get("/api/patients/").json()["results"]]
        self.assertEqual(ids, [self.patient.id])

    def test_patient_cannot_create_patient(self):
        self.login(self.patient_user)
        response = self.client.post("/api/patients/", {}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_stats_analytics_admin_only(self):
        self.login(self.doctor_user)
        self.assertEqual(self.client.get("/api/stats/analytics/").status_code, 403)
        self.login(self.admin)
        self.assertEqual(self.client.get("/api/stats/analytics/").status_code, 200)

    def test_dashboard_stats_for_each_role(self):
        for user in (
            self.admin,
            self.doctor_user,
            self.nurse_user,
            self.reception,
            self.patient_user,
        ):
            self.login(user)
            self.assertEqual(
                self.client.get("/api/stats/dashboard/").status_code,
                200,
                msg=user.role,
            )


class AppointmentTests(BaseAPITest):
    def payload(self, **extra):
        data = {
            "patient": self.patient.id,
            "doctor": self.doctor.id,
            "date": "2030-01-15",
            "time": "09:00:00",
            "reason": "Contrôle",
        }
        data.update(extra)
        return data

    def test_reception_creates_appointment_and_notifies(self):
        self.login(self.reception)
        response = self.client.post("/api/appointments/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["specialty"], self.specialty.id)
        self.assertTrue(Notification.objects.filter(user=self.patient_user).exists())
        self.assertTrue(Notification.objects.filter(user=self.doctor_user).exists())

    def test_double_booking_is_rejected(self):
        self.login(self.reception)
        first = self.client.post("/api/appointments/", self.payload(), format="json")
        self.assertEqual(first.status_code, 201, first.content)
        second = self.client.post(
            "/api/appointments/",
            self.payload(patient=self.stranger.id),
            format="json",
        )
        self.assertEqual(second.status_code, 400)

    def test_slot_is_free_again_after_cancellation(self):
        self.login(self.reception)
        first = self.client.post("/api/appointments/", self.payload(), format="json")
        self.client.patch(
            f"/api/appointments/{first.json()['id']}/", {"status": "cancelled"}, format="json"
        )
        again = self.client.post(
            "/api/appointments/", self.payload(patient=self.stranger.id), format="json"
        )
        self.assertEqual(again.status_code, 201, again.content)

    def test_doctor_only_sees_own_appointments(self):
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            specialty=self.specialty,
            date=date(2030, 1, 15),
            time=time(9, 0),
        )
        Appointment.objects.create(
            patient=self.stranger,
            doctor=self.other_doctor,
            specialty=self.specialty,
            date=date(2030, 1, 15),
            time=time(10, 0),
        )
        self.login(self.doctor_user)
        results = self.client.get("/api/appointments/").json()["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["doctor"], self.doctor.id)

    def test_patient_cannot_book(self):
        self.login(self.patient_user)
        response = self.client.post("/api/appointments/", self.payload(), format="json")
        self.assertEqual(response.status_code, 403)


class MedicalRecordTests(BaseAPITest):
    def test_record_is_created_with_patient(self):
        self.assertTrue(MedicalRecord.objects.filter(patient=self.patient).exists())

    def test_nurse_can_update_assigned_patient_record(self):
        self.nurse.assigned_patients.add(self.patient)
        record = MedicalRecord.objects.get(patient=self.patient)
        self.login(self.nurse_user)
        response = self.client.patch(
            f"/api/medical-records/{record.id}/", {"allergies": "Pénicilline"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        record.refresh_from_db()
        self.assertEqual(record.allergies, "Pénicilline")

    def test_nurse_cannot_touch_unassigned_record(self):
        record = MedicalRecord.objects.get(patient=self.patient)
        self.login(self.nurse_user)
        response = self.client.patch(
            f"/api/medical-records/{record.id}/", {"allergies": "x"}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_patient_cannot_edit_own_record(self):
        record = MedicalRecord.objects.get(patient=self.patient)
        self.login(self.patient_user)
        response = self.client.patch(
            f"/api/medical-records/{record.id}/", {"allergies": "x"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_comment_permissions(self):
        self.nurse.assigned_patients.add(self.patient)

        self.login(self.patient_user)
        denied = self.client.post(
            "/api/comments/", {"patient": self.patient.id, "text": "hello"}, format="json"
        )
        self.assertEqual(denied.status_code, 403)

        self.login(self.nurse_user)
        ok = self.client.post(
            "/api/comments/", {"patient": self.patient.id, "text": "RAS"}, format="json"
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(MedicalComment.objects.get().kind, MedicalComment.Kind.NURSE)

        out_of_scope = self.client.post(
            "/api/comments/", {"patient": self.stranger.id, "text": "RAS"}, format="json"
        )
        self.assertEqual(out_of_scope.status_code, 403)


class TicketTests(BaseAPITest):
    def test_ticket_numbering_and_time(self):
        self.login(self.reception)
        first = self.client.post(
            "/api/tickets/",
            {"patient": self.patient.id, "doctor": self.doctor.id},
            format="json",
        )
        second = self.client.post(
            "/api/tickets/",
            {"patient": self.stranger.id, "doctor": self.doctor.id},
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 201, second.content)
        self.assertTrue(first.json()["numero"].endswith("-0001"))
        self.assertTrue(second.json()["numero"].endswith("-0002"))
        self.assertIsNotNone(ConsultationTicket.objects.first().heure)

    def test_ticket_pdf(self):
        self.login(self.reception)
        created = self.client.post(
            "/api/tickets/",
            {"patient": self.patient.id, "doctor": self.doctor.id},
            format="json",
        )
        response = self.client.get(f"/api/tickets/{created.json()['id']}/pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")


# ---------- Espace patient, résultats d'analyse et WhatsApp ----------

import logging
import shutil
import tempfile
from datetime import datetime, timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from .models import LabResult, WhatsAppMessage
from .whatsapp import normalize_number

MEDIA_TMP = tempfile.mkdtemp()


@override_settings(
    WHATSAPP_PROVIDER="console",
    WHATSAPP_DEFAULT_COUNTRY_CODE="228",
    MEDIA_ROOT=MEDIA_TMP,
)
class PatientPortalTests(BaseAPITest):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)

    def setUp(self):
        super().setUp()
        # Silence la sortie du fournisseur « console » pendant les tests.
        logging.getLogger("clinic.whatsapp").disabled = True
        self.addCleanup(setattr, logging.getLogger("clinic.whatsapp"), "disabled", False)

    def opt_in(self, patient=None, number="+22890123456"):
        patient = patient or self.patient
        patient.whatsapp_opt_in = True
        patient.whatsapp_number = number
        patient.save()

    def test_normalize_number(self):
        self.assertEqual(normalize_number("+228 90 12 34 56"), "+22890123456")
        self.assertEqual(normalize_number("00228 90 12 34 56"), "+22890123456")
        self.assertEqual(normalize_number("228 90 12 34 56"), "+22890123456")
        self.assertEqual(normalize_number("90 12 34 56"), "+22890123456")
        self.assertEqual(normalize_number("+33 6 12 34 56 78"), "+33612345678")
        self.assertEqual(normalize_number("abc"), "")

    def test_patient_manages_whatsapp_preferences(self):
        self.login(self.patient_user)
        url = "/api/portal/whatsapp/"
        self.assertFalse(self.client.get(url).json()["whatsapp_opt_in"])

        bad = self.client.patch(url, {"whatsapp_opt_in": True}, format="json")
        self.assertEqual(bad.status_code, 400)  # aucun numéro connu

        ok = self.client.patch(
            url, {"whatsapp_opt_in": True, "whatsapp_number": "+228 90 12 34 56"}, format="json"
        )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["effective_number"], "+22890123456")

    def test_portal_is_patient_only(self):
        self.login(self.admin)
        self.assertEqual(self.client.get("/api/portal/whatsapp/").status_code, 403)

    def test_whatsapp_test_message(self):
        self.opt_in()
        self.login(self.patient_user)
        response = self.client.post("/api/portal/whatsapp/test/")
        self.assertEqual(response.json()["status"], "sent")
        self.assertEqual(WhatsAppMessage.objects.get().to_number, "+22890123456")

    def test_lab_result_publication_notifies_and_sends_whatsapp(self):
        self.opt_in()
        # Le docteur doit suivre le patient (rendez-vous) pour y avoir accès.
        Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, specialty=self.specialty,
            date=date(2030, 1, 1), time=time(9, 0),
        )
        self.login(self.doctor_user)
        created = self.client.post(
            "/api/lab-results/", {"patient": self.patient.id, "test_name": "NFS"}, format="json"
        )
        self.assertEqual(created.status_code, 201, created.content)
        result_id = created.json()["id"]
        self.assertEqual(LabResult.objects.get().doctor, self.doctor)

        # Le patient voit l'analyse en attente, sans contenu.
        LabResult.objects.filter(pk=result_id).update(result_summary="brouillon")
        self.login(self.patient_user)
        pending = self.client.get(f"/api/lab-results/{result_id}/").json()
        self.assertEqual(pending["result_summary"], "")

        # Publication impossible sans compte rendu ni fichier.
        self.login(self.doctor_user)
        LabResult.objects.filter(pk=result_id).update(result_summary="")
        refused = self.client.patch(
            f"/api/lab-results/{result_id}/", {"status": "available"}, format="json"
        )
        self.assertEqual(refused.status_code, 400)

        upload = SimpleUploadedFile("nfs.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        with self.captureOnCommitCallbacks(execute=True):
            published = self.client.patch(
                f"/api/lab-results/{result_id}/",
                {"status": "available", "result_summary": "Normal", "file": upload},
                format="multipart",
            )
        self.assertEqual(published.status_code, 200, published.content)
        self.assertIsNotNone(LabResult.objects.get().available_at)

        message = WhatsAppMessage.objects.get(kind="lab_result")
        self.assertEqual(message.status, "sent")
        self.assertIn("NFS", message.body)
        self.assertNotIn("Normal", message.body)  # aucune donnée médicale par WhatsApp
        self.assertTrue(
            Notification.objects.filter(user=self.patient_user, event="lab_available").exists()
        )

        # Re-sauvegarder un résultat déjà publié ne renvoie pas de message.
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(
                f"/api/lab-results/{result_id}/", {"result_summary": "Normal."}, format="json"
            )
        self.assertEqual(WhatsAppMessage.objects.filter(kind="lab_result").count(), 1)

        self.login(self.patient_user)
        download = self.client.get(f"/api/lab-results/{result_id}/download/")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(b"".join(download.streaming_content), b"%PDF-1.4 test")

    def test_lab_result_visibility(self):
        LabResult.objects.create(patient=self.patient, test_name="Glycémie")
        self.login(self.stranger_user)
        self.assertEqual(self.client.get("/api/lab-results/").json()["count"], 0)
        self.login(self.reception)
        self.assertEqual(self.client.get("/api/lab-results/").json()["count"], 0)
        self.login(self.patient_user)
        self.assertEqual(self.client.get("/api/lab-results/").json()["count"], 1)
        denied = self.client.post(
            "/api/lab-results/", {"patient": self.patient.id, "test_name": "X"}, format="json"
        )
        self.assertEqual(denied.status_code, 403)

    def _appointment_in(self, hours, patient=None, minute=0):
        when = timezone.localtime() + timedelta(hours=hours)
        return Appointment.objects.create(
            patient=patient or self.patient,
            doctor=self.doctor,
            specialty=self.specialty,
            date=when.date(),
            time=when.time().replace(minute=minute, second=0, microsecond=0),
        )

    def test_reminder_command(self):
        self.opt_in()
        soon = self._appointment_in(3)
        later = self._appointment_in(72, minute=30)
        self._appointment_in(4, patient=self.stranger, minute=15)  # sans opt-in

        call_command("send_appointment_reminders", stdout=mock.MagicMock())
        soon.refresh_from_db()
        later.refresh_from_db()
        self.assertIsNotNone(soon.reminder_sent_at)
        self.assertIsNone(later.reminder_sent_at)
        self.assertEqual(WhatsAppMessage.objects.count(), 1)

        # Un second passage ne renvoie rien.
        call_command("send_appointment_reminders", stdout=mock.MagicMock())
        self.assertEqual(WhatsAppMessage.objects.count(), 1)

        # Déplacer le rendez-vous réarme le rappel.
        self.login(self.reception)
        new_time = (datetime.combine(soon.date, soon.time) + timedelta(minutes=45)).time()
        moved = self.client.patch(
            f"/api/appointments/{soon.id}/", {"time": new_time.strftime("%H:%M")}, format="json"
        )
        self.assertEqual(moved.status_code, 200, moved.content)
        soon.refresh_from_db()
        self.assertIsNone(soon.reminder_sent_at)

    def test_manual_reminder_and_provider_failure(self):
        self.opt_in()
        appointment = self._appointment_in(30)
        self.login(self.reception)
        with override_settings(WHATSAPP_PROVIDER="twilio", TWILIO_ACCOUNT_SID=""):
            failed = self.client.post(f"/api/appointments/{appointment.id}/remind/")
        self.assertEqual(failed.status_code, 200)
        self.assertEqual(failed.json()["status"], "failed")
        appointment.refresh_from_db()
        self.assertIsNone(appointment.reminder_sent_at)

        ok = self.client.post(f"/api/appointments/{appointment.id}/remind/")
        self.assertEqual(ok.json()["status"], "sent")

        self.login(self.patient_user)
        self.assertEqual(
            self.client.post(f"/api/appointments/{appointment.id}/remind/").status_code, 403
        )

    def test_whatsapp_log_visibility(self):
        self.opt_in()
        self.login(self.patient_user)
        self.client.post("/api/portal/whatsapp/test/")
        self.assertEqual(self.client.get("/api/whatsapp-messages/").json()["count"], 1)
        self.login(self.stranger_user)
        self.assertEqual(self.client.get("/api/whatsapp-messages/").json()["count"], 0)
        self.login(self.admin)
        self.assertEqual(self.client.get("/api/whatsapp-messages/").json()["count"], 1)


class ProvisionalPasswordTests(BaseAPITest):
    NEW = "Pr0visoire-2026!"

    def test_admin_reset_forces_change_until_user_picks_own(self):
        self.login(self.admin)
        response = self.client.patch(
            f"/api/users/{self.patient_user.id}/", {"password": self.NEW}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.patient_user.refresh_from_db()
        self.assertTrue(self.patient_user.must_change_password)

        self.client.force_authenticate(user=None)
        login = self.client.post(
            "/api/auth/login/", {"username": "patient", "password": self.NEW}, format="json"
        )
        self.assertTrue(login.json()["user"]["must_change_password"])

        self.login(self.patient_user)
        changed = self.client.post(
            "/api/auth/change-password/",
            {"old_password": self.NEW, "new_password": "M0n-Propre-Secret!"},
            format="json",
        )
        self.assertEqual(changed.status_code, 200, changed.content)
        self.patient_user.refresh_from_db()
        self.assertFalse(self.patient_user.must_change_password)

    def test_reception_reset_on_patient_page_forces_change(self):
        self.login(self.reception)
        response = self.client.patch(
            f"/api/patients/{self.patient.id}/",
            {"user": {"password": self.NEW}},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.patient_user.refresh_from_db()
        self.assertTrue(self.patient_user.must_change_password)
        self.assertTrue(self.patient_user.check_password(self.NEW))

    def test_admin_changing_own_password_is_not_provisional(self):
        self.login(self.admin)
        self.client.patch(f"/api/users/{self.admin.id}/", {"password": self.NEW}, format="json")
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.must_change_password)

    def test_editing_without_password_keeps_flag(self):
        self.login(self.admin)
        self.client.patch(f"/api/users/{self.patient_user.id}/", {"phone": "90123456"}, format="json")
        self.patient_user.refresh_from_db()
        self.assertFalse(self.patient_user.must_change_password)


@override_settings(WHATSAPP_PROVIDER="console", WHATSAPP_DEFAULT_COUNTRY_CODE="228")
class CredentialsWhatsAppTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        logger = logging.getLogger("clinic.whatsapp")
        logger.disabled = True
        self.addCleanup(setattr, logger, "disabled", False)

    def create_patient(self, phone):
        self.login(self.reception)
        return self.client.post(
            "/api/patients/",
            {
                "patient_code": "P-0100",
                "user": {
                    "username": "kossi",
                    "password": "Bienvenue-2026!",
                    "first_name": "Kossi",
                    "phone": phone,
                },
            },
            format="json",
        )

    def test_credentials_sent_on_creation_and_password_masked_in_log(self):
        sender = mock.Mock(return_value="console")
        with mock.patch.dict("clinic.whatsapp.PROVIDERS", {"console": sender}):
            response = self.create_patient("90 12 34 56")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["credentials_whatsapp"]["status"], "sent")
        self.assertEqual(response.json()["credentials_whatsapp"]["to_number"], "+22890123456")

        to, body = sender.call_args.args
        self.assertEqual(to, "+22890123456")
        self.assertIn("kossi", body)
        self.assertIn("Bienvenue-2026!", body)

        log = WhatsAppMessage.objects.get(kind="credentials")
        self.assertNotIn("Bienvenue-2026!", log.body)
        self.assertIn("kossi", log.body)

        user = User.objects.get(username="kossi")
        self.assertTrue(user.must_change_password)
        self.assertFalse(user.patient_profile.whatsapp_opt_in)

    def test_creation_without_phone_still_succeeds(self):
        response = self.create_patient("")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["credentials_whatsapp"]["status"], "skipped")
        self.assertTrue(User.objects.filter(username="kossi").exists())


class EmailLoginTests(BaseAPITest):
    def login_with(self, login):
        return self.client.post(
            "/api/auth/login/", {"username": login, "password": PASSWORD}, format="json"
        )

    def test_login_with_email_case_insensitive(self):
        self.patient_user.email = "Patient@Example.com"
        self.patient_user.save()
        response = self.login_with("patient@example.com")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["user"]["username"], "patient")

    def test_ambiguous_email_is_refused(self):
        for user in (self.patient_user, self.stranger_user):
            user.email = "shared@example.com"
            user.save()
        self.assertEqual(self.login_with("shared@example.com").status_code, 401)

    def test_wrong_password_with_email(self):
        self.patient_user.email = "p@example.com"
        self.patient_user.save()
        response = self.client.post(
            "/api/auth/login/", {"username": "p@example.com", "password": "nope"}, format="json"
        )
        self.assertEqual(response.status_code, 401)


class AdminCreateUserTests(BaseAPITest):
    """Le bouton « Nouvel utilisateur » crée le compte ET le profil du rôle."""

    def setUp(self):
        super().setUp()
        logger = logging.getLogger("clinic.whatsapp")
        logger.disabled = True
        self.addCleanup(setattr, logger, "disabled", False)
        self.login(self.admin)

    def user_payload(self, username):
        return {
            "username": username,
            "password": "Provisoire-2026!",
            "first_name": "Ama",
            "last_name": "Mensah",
            "email": f"{username}@example.com",
            "phone": "",
        }

    def assert_created(self, res, username, role):
        self.assertEqual(res.status_code, 201, res.content)
        user = User.objects.get(username=username)
        self.assertEqual(user.role, role)
        self.assertTrue(user.must_change_password)
        self.assertTrue(user.check_password("Provisoire-2026!"))
        return user

    def test_create_doctor(self):
        res = self.client.post(
            "/api/doctors/",
            {"user": self.user_payload("dr_ama"), "specialty": self.specialty.id, "license_number": "TG-12"},
            format="json",
        )
        user = self.assert_created(res, "dr_ama", User.Role.DOCTOR)
        self.assertEqual(user.doctor_profile.specialty, self.specialty)

    def test_create_nurse(self):
        res = self.client.post(
            "/api/nurses/", {"user": self.user_payload("inf_ama"), "department": "Urgences"}, format="json"
        )
        user = self.assert_created(res, "inf_ama", User.Role.NURSE)
        self.assertEqual(user.nurse_profile.department, "Urgences")

    def test_create_receptionist(self):
        res = self.client.post(
            "/api/receptionists/", {"user": self.user_payload("acc_ama"), "desk": "A"}, format="json"
        )
        user = self.assert_created(res, "acc_ama", User.Role.RECEPTIONIST)
        self.assertEqual(user.receptionist_profile.desk, "A")

    def test_create_patient(self):
        res = self.client.post(
            "/api/patients/",
            {"user": self.user_payload("pat_ama"), "patient_code": "P-0900", "date_of_birth": None, "sex": ""},
            format="json",
        )
        user = self.assert_created(res, "pat_ama", User.Role.PATIENT)
        self.assertEqual(user.patient_profile.patient_code, "P-0900")

    def test_create_admin(self):
        res = self.client.post("/api/users/", {**self.user_payload("adm_ama"), "role": "admin"}, format="json")
        self.assert_created(res, "adm_ama", User.Role.ADMIN)

    def test_duplicate_username_rejected(self):
        res = self.client.post(
            "/api/nurses/", {"user": self.user_payload("infirmier"), "department": ""}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("user", res.json())
