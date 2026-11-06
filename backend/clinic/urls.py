from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet)
router.register("specialties", views.SpecialtyViewSet)
router.register("doctors", views.DoctorViewSet)
router.register("nurses", views.NurseViewSet)
router.register("receptionists", views.ReceptionistViewSet)
router.register("patients", views.PatientViewSet, basename="patient")
router.register("medical-records", views.MedicalRecordViewSet, basename="medical-record")
router.register("appointments", views.AppointmentViewSet, basename="appointment")
router.register("consultations", views.ConsultationViewSet, basename="consultation")
router.register("prescriptions", views.PrescriptionViewSet, basename="prescription")
router.register("comments", views.MedicalCommentViewSet, basename="comment")
router.register("tickets", views.ConsultationTicketViewSet, basename="ticket")
router.register("notifications", views.NotificationViewSet, basename="notification")

urlpatterns = [
    path("public/clinic/", views.public_clinic),
    path("auth/login/", views.EmailTokenObtainPairView.as_view()),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("auth/me/", views.me),
    path("auth/change-password/", views.change_password),
    path("auth/password-reset/", views.password_reset_request),
    path("auth/password-reset/confirm/", views.password_reset_confirm),
    path("stats/dashboard/", views.dashboard_stats),
    path("stats/analytics/", views.admin_analytics),
    path("", include(router.urls)),
]
