from datetime import time, timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Appointment, Doctor, MedicalRecord, Patient, User


class SmokeTest(TestCase):
    def test_public_clinic(self):
        response = self.client.get("/api/public/clinic/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "BIO CARE PLUS")


class ClinicAPITestCase(TestCase):
    """Base : données de démo (5 rôles) + client authentifié par rôle."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())
        cls.admin = User.objects.get(username="admin")
        cls.doctor_user = User.objects.get(username="docteur")
        cls.doctor2_user = User.objects.get(username="docteur2")
        cls.nurse_user = User.objects.get(username="infirmier")
        cls.reception_user = User.objects.get(username="reception")
        cls.patient_user = User.objects.get(username="patient")
        cls.doctor = cls.doctor_user.doctor_profile
        cls.patient = cls.patient_user.patient_profile
        cls.patient3 = Patient.objects.get(patient_code="PAT-1003")

    def as_user(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def results(self, response):
        data = response.json()
        return data["results"] if isinstance(data, dict) and "results" in data else data


class AuthTests(ClinicAPITestCase):
    def test_login_returns_tokens_and_user(self):
        r = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "Admin123!"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("access", body)
        self.assertIn("refresh", body)
        self.assertEqual(body["user"]["role"], "admin")

    def test_login_wrong_password(self):
        r = self.client.post(
            "/api/auth/login/",
            {"username": "admin", "password": "mauvais"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 401)

    def test_anonymous_is_rejected(self):
        self.assertEqual(APIClient().get("/api/patients/").status_code, 401)

    def test_me_patch_cannot_change_role(self):
        c = self.as_user(self.patient_user)
        r = c.patch("/api/auth/me/", {"phone": "07 00 00 00 00", "role": "admin"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.patient_user.refresh_from_db()
        self.assertEqual(self.patient_user.phone, "07 00 00 00 00")
        self.assertEqual(self.patient_user.role, "patient")

    def test_change_password(self):
        c = self.as_user(self.patient_user)
        bad = c.post(
            "/api/auth/change-password/",
            {"old_password": "faux", "new_password": "NouveauMdp2026!"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        ok = c.post(
            "/api/auth/change-password/",
            {"old_password": "Patient123!", "new_password": "NouveauMdp2026!"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.patient_user.refresh_from_db()
        self.assertTrue(self.patient_user.check_password("NouveauMdp2026!"))


class UserManagementTests(ClinicAPITestCase):
    def test_only_admin_can_list_users(self):
        self.assertEqual(self.as_user(self.admin).get("/api/users/").status_code, 200)
        for u in (self.doctor_user, self.nurse_user, self.reception_user, self.patient_user):
            self.assertEqual(self.as_user(u).get("/api/users/").status_code, 403, u.username)

    def test_create_admin_sets_temporary_password(self):
        r = self.as_user(self.admin).post(
            "/api/users/",
            {"username": "admin2", "role": "admin", "password": "Provisoire2026!"},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        created = User.objects.get(username="admin2")
        self.assertTrue(created.must_change_password)
        self.assertTrue(created.check_password("Provisoire2026!"))

    def test_cannot_create_non_admin_role(self):
        r = self.as_user(self.admin).post(
            "/api/users/",
            {"username": "doc3", "role": "doctor", "password": "Provisoire2026!"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(username="doc3").exists())

    def test_cannot_change_role(self):
        r = self.as_user(self.admin).patch(
            f"/api/users/{self.doctor_user.id}/", {"role": "admin"}, format="json"
        )
        self.assertEqual(r.status_code, 400)
        self.doctor_user.refresh_from_db()
        self.assertEqual(self.doctor_user.role, "doctor")

    def test_admin_cannot_deactivate_self(self):
        c = self.as_user(self.admin)
        self.assertEqual(c.patch(f"/api/users/{self.admin.id}/", {"is_active": False}, format="json").status_code, 400)
        self.assertEqual(c.delete(f"/api/users/{self.admin.id}/").status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_delete_deactivates_instead_of_deleting(self):
        c = self.as_user(self.admin)
        self.assertEqual(c.delete(f"/api/users/{self.nurse_user.id}/").status_code, 200)
        self.nurse_user.refresh_from_db()
        self.assertFalse(self.nurse_user.is_active)
        self.assertEqual(
            c.patch(f"/api/users/{self.nurse_user.id}/", {"is_active": True}, format="json").status_code, 200
        )

    def test_password_reset_by_admin_forces_change(self):
        r = self.as_user(self.admin).patch(
            f"/api/users/{self.reception_user.id}/", {"password": "Reinit2026!x"}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.reception_user.refresh_from_db()
        self.assertTrue(self.reception_user.must_change_password)
        self.assertTrue(self.reception_user.check_password("Reinit2026!x"))


class PatientScopeTests(ClinicAPITestCase):
    def test_patient_sees_only_own_profile_and_record(self):
        c = self.as_user(self.patient_user)
        patients = self.results(c.get("/api/patients/"))
        self.assertEqual([p["id"] for p in patients], [self.patient.id])
        records = self.results(c.get("/api/medical-records/"))
        self.assertEqual([r["patient"] for r in records], [self.patient.id])

    def test_nurse_sees_only_assigned_patients(self):
        ids = {p["id"] for p in self.results(self.as_user(self.nurse_user).get("/api/patients/"))}
        expected = set(self.nurse_user.nurse_profile.assigned_patients.values_list("id", flat=True))
        self.assertEqual(ids, expected)
        self.assertNotIn(self.patient3.id, ids)

    def test_doctor_sees_only_own_patients(self):
        ids = {p["id"] for p in self.results(self.as_user(self.doctor2_user).get("/api/patients/"))}
        self.assertEqual(ids, set())  # docteur2 n'a aucun rendez-vous dans la démo

    def test_patient_cannot_edit_record(self):
        record = self.patient.medical_record
        r = self.as_user(self.patient_user).patch(
            f"/api/medical-records/{record.id}/", {"allergies": "Rien"}, format="json"
        )
        self.assertEqual(r.status_code, 403)

    def test_doctor_can_edit_record(self):
        record = self.patient.medical_record
        r = self.as_user(self.doctor_user).patch(
            f"/api/medical-records/{record.id}/", {"blood_type": "B-"}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(MedicalRecord.objects.get(pk=record.pk).blood_type, "B-")

    def test_patient_cannot_create_patient(self):
        r = self.as_user(self.patient_user).post("/api/patients/", {}, format="json")
        self.assertEqual(r.status_code, 403)


class AppointmentTests(ClinicAPITestCase):
    def payload(self, **extra):
        return {
            "patient": self.patient3.id,
            "doctor": self.doctor.id,
            "date": str(timezone.localdate() + timedelta(days=10)),
            "time": "10:00",
            "reason": "Test",
            **extra,
        }

    def test_reception_creates_appointment_with_doctor_specialty(self):
        r = self.as_user(self.reception_user).post("/api/appointments/", self.payload(), format="json")
        self.assertEqual(r.status_code, 201, r.content)
        appt = Appointment.objects.get(pk=r.json()["id"])
        self.assertEqual(appt.specialty_id, self.doctor.specialty_id)

    def test_double_booking_is_rejected(self):
        c = self.as_user(self.reception_user)
        self.assertEqual(c.post("/api/appointments/", self.payload(), format="json").status_code, 201)
        r = c.post("/api/appointments/", self.payload(patient=self.patient.id), format="json")
        self.assertEqual(r.status_code, 400)

    def test_cancelled_slot_can_be_rebooked(self):
        c = self.as_user(self.reception_user)
        first = c.post("/api/appointments/", self.payload(), format="json").json()
        c.patch(f"/api/appointments/{first['id']}/", {"status": "cancelled"}, format="json")
        r = c.post("/api/appointments/", self.payload(patient=self.patient.id), format="json")
        self.assertEqual(r.status_code, 201, r.content)

    def test_patient_cannot_create_appointment(self):
        r = self.as_user(self.patient_user).post("/api/appointments/", self.payload(), format="json")
        self.assertEqual(r.status_code, 403)

    def test_doctor_sees_only_own_appointments(self):
        other = Doctor.objects.get(user=self.doctor2_user)
        Appointment.objects.create(
            patient=self.patient3, doctor=other, date=timezone.localdate(), time=time(11, 0)
        )
        rows = self.results(self.as_user(self.doctor_user).get("/api/appointments/"))
        self.assertTrue(rows)
        self.assertTrue(all(a["doctor"] == self.doctor.id for a in rows))


class StatsTests(ClinicAPITestCase):
    def test_analytics_admin_only(self):
        r = self.as_user(self.admin).get("/api/stats/analytics/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["patients_total"], 3)
        self.assertEqual(self.as_user(self.doctor_user).get("/api/stats/analytics/").status_code, 403)

    def test_dashboard_for_each_role(self):
        for u in (self.admin, self.doctor_user, self.nurse_user, self.reception_user, self.patient_user):
            self.assertEqual(self.as_user(u).get("/api/stats/dashboard/").status_code, 200, u.username)
