from django.test import TestCase


class SmokeTest(TestCase):
    def test_public_clinic(self):
        response = self.client.get("/api/public/clinic/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "BIO CARE PLUS")
