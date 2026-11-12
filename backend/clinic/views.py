from datetime import date

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import (
    Appointment,
    Consultation,
    ConsultationTicket,
    Doctor,
    MedicalComment,
    MedicalRecord,
    Nurse,
    Notification,
    Patient,
    Prescription,
    PrescriptionItem,
    Receptionist,
    Specialty,
    User,
)
from .pdfs import build_prescription_pdf, build_ticket_pdf
from .permissions import (
    IsAdmin,
    IsAdminOrReceptionist,
    IsDoctor,
    IsStaffUser,
)
from .serializers import (
    AppointmentSerializer,
    ChangePasswordSerializer,
    ClinicTokenSerializer,
    ConsultationSerializer,
    ConsultationTicketSerializer,
    DoctorSerializer,
    MeSerializer,
    MedicalCommentSerializer,
    MedicalRecordSerializer,
    NurseSerializer,
    NotificationSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PatientSerializer,
    PrescriptionSerializer,
    ReceptionistSerializer,
    SpecialtySerializer,
    UserSerializer,
    decode_reset_user,
    encode_reset,
)


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = ClinicTokenSerializer


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "PATCH":
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(MeSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = request.user
    if not user.check_password(serializer.validated_data["old_password"]):
        return Response(
            {"old_password": "Mot de passe actuel incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.set_password(serializer.validated_data["new_password"])
    user.must_change_password = False
    user.save()
    return Response({"detail": "Mot de passe mis à jour."})


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        user = User.objects.get(username=serializer.validated_data["username"])
    except User.DoesNotExist:
        return Response(
            {
                "detail": "Si un compte existe, un lien de récupération a été généré."
            }
        )
    payload = encode_reset(user)
    # Console email backend in development; also returned so the demo UI can complete reset.
    return Response(
        {
            "detail": "Lien de récupération généré (mode démonstration).",
            "reset": payload if settings.DEBUG else None,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = decode_reset_user(serializer.validated_data["uid"])
    if not user or not default_token_generator.check_token(
        user, serializer.validated_data["token"]
    ):
        return Response(
            {"detail": "Lien invalide ou expiré."}, status=status.HTTP_400_BAD_REQUEST
        )
    user.set_password(serializer.validated_data["new_password"])
    user.save()
    return Response({"detail": "Mot de passe réinitialisé."})


def _patient_scope(user):
    if user.role == User.Role.ADMIN:
        return Patient.objects.all()
    if user.role == User.Role.RECEPTIONIST:
        return Patient.objects.all()
    if user.role == User.Role.DOCTOR:
        doctor = getattr(user, "doctor_profile", None)
        if not doctor:
            return Patient.objects.none()
        return Patient.objects.filter(appointments__doctor=doctor).distinct()
    if user.role == User.Role.NURSE:
        nurse = getattr(user, "nurse_profile", None)
        if not nurse:
            return Patient.objects.none()
        return nurse.assigned_patients.all()
    if user.role == User.Role.PATIENT:
        return Patient.objects.filter(user=user)
    return Patient.objects.none()

class UserViewSet(viewsets.ModelViewSet):
    """
    Gestion des comptes utilisateurs par l'administrateur.
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    search_fields = (
        "username",
        "first_name",
        "last_name",
        "email",
        "phone",
    )

    filterset_fields = (
        "role",
        "is_active",
    )

    def perform_update(self, serializer):
        if (
            serializer.instance.id == self.request.user.id
            and serializer.validated_data.get("is_active") is False
        ):
            raise ValidationError(
                {"detail": "Vous ne pouvez pas désactiver votre propre compte."}
            )
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """
        Désactivation du compte au lieu de sa suppression définitive.
        """
        user = self.get_object()

        # L'administrateur ne peut pas désactiver son propre compte
        if user.id == request.user.id:
            return Response(
                {
                    "detail": "Vous ne pouvez pas désactiver votre propre compte."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.save(update_fields=["is_active"])

        return Response(
            {
                "detail": "Utilisateur désactivé avec succès."
            },
            status=status.HTTP_200_OK,
        )

class SpecialtyViewSet(viewsets.ModelViewSet):
    queryset = Specialty.objects.all()
    serializer_class = SpecialtySerializer
    search_fields = ("name",)
    filterset_fields = ("is_active",)

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return [IsAdmin()]


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related("user", "specialty").all()
    serializer_class = DoctorSerializer

    search_fields = (
        "user__first_name",
        "user__last_name",
        "user__username",
        "specialty__name",
        "license_number",
    )

    filterset_fields = ("specialty", "is_active")

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]

        return [IsAdmin()]

    def get_queryset(self):
        return Doctor.objects.select_related(
            "user",
            "specialty",
        ).filter(
            is_active=True
        ).order_by(
            "user__first_name",
            "user__last_name",
        )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.user.is_active = False
        instance.user.save()
        instance.save()


class NurseViewSet(viewsets.ModelViewSet):
    queryset = Nurse.objects.select_related("user").prefetch_related("assigned_patients")
    serializer_class = NurseSerializer
    search_fields = ("user__first_name", "user__last_name", "user__username")

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsStaffUser()]
        return [IsAdmin()]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.user.is_active = False
        instance.user.save()
        instance.save()


class ReceptionistViewSet(viewsets.ModelViewSet):
    queryset = Receptionist.objects.select_related("user")
    serializer_class = ReceptionistSerializer
    search_fields = ("user__first_name", "user__last_name", "user__username")

    def get_permissions(self):
        return [IsAdmin()]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.user.is_active = False
        instance.user.save()
        instance.save()


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer

    search_fields = (
        "patient_code",
        "user__first_name",
        "user__last_name",
        "user__username",
        "user__email",
    )

    filterset_fields = ("sex",)

    def get_queryset(self):
        user = self.request.user

        if user.role in {
            User.Role.ADMIN,
            User.Role.RECEPTIONIST,
        }:
            return Patient.objects.select_related(
                "user"
            ).order_by(
                "user__first_name",
                "user__last_name",
            )
        if user.role == User.Role.DOCTOR:
            doctor = getattr(user, "doctor_profile", None)

            if not doctor:
                return Patient.objects.none()

            return Patient.objects.filter(
                appointments__doctor=doctor
            ).select_related(
                "user"
            ).distinct()

        # Infirmier :
        # uniquement ses patients affectés.
        if user.role == User.Role.NURSE:
            nurse = getattr(user, "nurse_profile", None)

            if not nurse:
                return Patient.objects.none()

            return nurse.assigned_patients.all().select_related("user")

        # Patient :
        # uniquement son propre dossier.
        if user.role == User.Role.PATIENT:
            return Patient.objects.filter(
                user=user
            ).select_related("user")

        return Patient.objects.none()

    def get_permissions(self):
        # Lecture :
        # tout utilisateur connecté peut consulter
        # les données auxquelles son rôle lui donne accès.
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]

        # Création d'un patient :
        # administrateur ou réceptionniste.
        if self.action == "create":
            return [IsAdminOrReceptionist()]

        # Suppression :
        # administrateur uniquement.
        if self.action == "destroy":
            return [IsAdmin()]

        # Modification :
        # administrateur ou réceptionniste.
        return [IsAdminOrReceptionist()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class MedicalRecordViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalRecordSerializer
    filterset_fields = ("patient",)

    def get_queryset(self):
        patients = _patient_scope(self.request.user)
        qs = MedicalRecord.objects.filter(patient__in=patients).select_related("patient__user")
        if self.request.user.role == User.Role.RECEPTIONIST:
            # Reception sees administrative identity, not full clinical notes in list —
            # still allowed to open the dossier as specified.
            return qs
        return qs

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]
        if self.request.user.role in {User.Role.DOCTOR, User.Role.ADMIN, User.Role.NURSE}:
            return [IsAuthenticated()]
        return [IsDoctor()]


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    search_fields = (
        "patient__user__first_name",
        "patient__user__last_name",
        "patient__patient_code",
        "reason",
    )
    filterset_fields = ("date", "doctor", "patient", "status", "specialty")

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related(
            "patient__user", "doctor__user", "specialty"
        )
        if user.role == User.Role.ADMIN or user.role == User.Role.RECEPTIONIST:
            return qs
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        if user.role == User.Role.NURSE:
            nurse = getattr(user, "nurse_profile", None)
            if not nurse:
                return qs.none()
            return qs.filter(patient__in=nurse.assigned_patients.all())
        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user)
        return qs.none()

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]
        if self.request.user.role in {
            User.Role.ADMIN,
            User.Role.RECEPTIONIST,
            User.Role.DOCTOR,
        }:
            return [IsAuthenticated()]
        return [IsAdminOrReceptionist()]


class ConsultationViewSet(viewsets.ModelViewSet):
    serializer_class = ConsultationSerializer
    filterset_fields = ("patient", "doctor", "date")

    def get_queryset(self):
        user = self.request.user
        qs = Consultation.objects.select_related("patient__user", "doctor__user")
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        if user.role == User.Role.NURSE:
            nurse = getattr(user, "nurse_profile", None)
            if not nurse:
                return qs.none()
            return qs.filter(patient__in=nurse.assigned_patients.all())
        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user)
        return qs.none()

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]
        return [IsDoctor()]

    def perform_create(self, serializer):
        doctor = serializer.validated_data.get("doctor")
        if self.request.user.role == User.Role.DOCTOR:
            doctor = self.request.user.doctor_profile
        serializer.save(doctor=doctor)
        appointment = serializer.validated_data.get("appointment")
        if appointment:
            appointment.status = Appointment.Status.COMPLETED
            appointment.save(update_fields=["status"])


class PrescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PrescriptionSerializer
    search_fields = (
        "patient__user__first_name",
        "patient__user__last_name",
        "patient__patient_code",
        "items__medication",
    )
    filterset_fields = ("patient", "doctor", "date")

    def get_queryset(self):
        user = self.request.user
        qs = Prescription.objects.select_related(
            "patient__user", "doctor__user", "consultation"
        ).prefetch_related("items")
        if user.role == User.Role.ADMIN:
            return qs
        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)
        if user.role == User.Role.NURSE:
            nurse = getattr(user, "nurse_profile", None)
            if not nurse:
                return qs.none()
            return qs.filter(patient__in=nurse.assigned_patients.all())
        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user)
        return qs.none()

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]
        return [IsDoctor()]

    def perform_create(self, serializer):
        doctor = serializer.validated_data.get("doctor")
        if self.request.user.role == User.Role.DOCTOR:
            doctor = self.request.user.doctor_profile
        serializer.save(doctor=doctor)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        prescription = self.get_object()
        buffer = build_prescription_pdf(prescription)
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"ordonnance-{prescription.id}.pdf",
            content_type="application/pdf",
        )


class MedicalCommentViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalCommentSerializer
    filterset_fields = ("patient", "kind")

    def get_queryset(self):
        patients = _patient_scope(self.request.user)
        return MedicalComment.objects.filter(patient__in=patients).select_related(
            "author", "patient"
        )

    def perform_create(self, serializer):
        kind = MedicalComment.Kind.NURSE
        if self.request.user.role == User.Role.DOCTOR:
            kind = MedicalComment.Kind.DOCTOR
        serializer.save(author=self.request.user, kind=kind)

class ConsultationTicketViewSet(viewsets.ModelViewSet):
    serializer_class = ConsultationTicketSerializer

    def get_queryset(self):
        user = self.request.user

        qs = ConsultationTicket.objects.select_related(
            "patient__user",
            "doctor__user",
            "doctor__specialty",
        )

        if user.role in {User.Role.ADMIN, User.Role.RECEPTIONIST}:
            return qs

        if user.role == User.Role.DOCTOR:
            return qs.filter(doctor__user=user)

        if user.role == User.Role.PATIENT:
            return qs.filter(patient__user=user)

        return qs.none()

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD"):
            return [IsAuthenticated()]

        return [IsAdminOrReceptionist()]

    def perform_create(self, serializer):
        today = timezone.localdate().strftime("%Y%m%d")

        count = ConsultationTicket.objects.filter(
            numero__startswith=f"BC-{today}"
        ).count() + 1

        numero = f"BC-{today}-{count:04d}"

        serializer.save(numero=numero)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        ticket = self.get_object()

        buffer = build_ticket_pdf(ticket)

        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"bon-{ticket.numero}.pdf",
            content_type="application/pdf",
        )

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        item = self.get_object()
        item.is_read = True
        item.save(update_fields=["is_read"])
        return Response(NotificationSerializer(item).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    user = request.user
    today = date.today()
    if user.role == User.Role.ADMIN:
        data = {
            "patients": Patient.objects.count(),
            "doctors": Doctor.objects.filter(is_active=True).count(),
            "nurses": Nurse.objects.filter(is_active=True).count(),
            "appointments": Appointment.objects.exclude(
                status=Appointment.Status.CANCELLED
            ).count(),
            "consultations": Consultation.objects.count(),
            "prescriptions": Prescription.objects.count(),
            "today_appointments": Appointment.objects.filter(date=today)
            .exclude(status=Appointment.Status.CANCELLED)
            .count(),
            "new_patients": Patient.objects.filter(created_at__date=today).count(),
        }
        return Response(data)
    if user.role == User.Role.DOCTOR:
        doctor = user.doctor_profile
        return Response(
            {
                "my_appointments_today": Appointment.objects.filter(
                    doctor=doctor, date=today
                )
                .exclude(status=Appointment.Status.CANCELLED)
                .count(),
                "my_patients": Patient.objects.filter(appointments__doctor=doctor)
                .distinct()
                .count(),
                "my_consultations": Consultation.objects.filter(doctor=doctor).count(),
                "my_prescriptions": Prescription.objects.filter(doctor=doctor).count(),
            }
        )
    if user.role == User.Role.NURSE:
        nurse = getattr(user, "nurse_profile", None)
        patients = nurse.assigned_patients.all() if nurse else Patient.objects.none()
        return Response(
            {
                "assigned_patients": patients.count(),
                "today_appointments": Appointment.objects.filter(
                    patient__in=patients, date=today
                ).count(),
            }
        )
    if user.role == User.Role.RECEPTIONIST:
        return Response(
            {
                "patients": Patient.objects.count(),
                "today_appointments": Appointment.objects.filter(date=today)
                .exclude(status=Appointment.Status.CANCELLED)
                .count(),
                "waiting": Appointment.objects.filter(
                    date=today, status=Appointment.Status.WAITING
                ).count(),
            }
        )
    if user.role == User.Role.PATIENT:
        patient = getattr(user, "patient_profile", None)
        return Response(
            {
                "upcoming_appointments": Appointment.objects.filter(
                    patient=patient, date__gte=today
                )
                .exclude(status=Appointment.Status.CANCELLED)
                .count()
                if patient
                else 0,
                "consultations": Consultation.objects.filter(patient=patient).count()
                if patient
                else 0,
                "prescriptions": Prescription.objects.filter(patient=patient).count()
                if patient
                else 0,
            }
        )
    return Response({})


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_analytics(request):
    today = date.today()
    try:
        months = max(1, min(int(request.query_params.get("months", 12)), 36))
    except ValueError:
        months = 12

    # Liste des N derniers mois (1er jour), du plus ancien au plus récent.
    month_starts = []
    y, m = today.year, today.month
    for _ in range(months):
        month_starts.append(date(y, m, 1))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    month_starts.reverse()
    since = month_starts[0]

    def monthly(qs, field):
        rows = (
            qs.annotate(month=TruncMonth(field))
            .values("month")
            .annotate(total=Count("id"))
        )
        counts = {}
        for r in rows:
            mo = r["month"]
            if mo is None:
                continue
            if hasattr(mo, "date"):
                mo = mo.date()
            counts[(mo.year, mo.month)] = r["total"]
        return [counts.get((d.year, d.month), 0) for d in month_starts]

    patients_m = monthly(
        Patient.objects.filter(created_at__date__gte=since), "created_at"
    )
    appointments_m = monthly(Appointment.objects.filter(date__gte=since), "date")
    consultations_m = monthly(Consultation.objects.filter(date__gte=since), "date")
    prescriptions_m = monthly(Prescription.objects.filter(date__gte=since), "date")
    activity_by_month = [
        {
            "month": d.isoformat(),
            "patients": patients_m[i],
            "appointments": appointments_m[i],
            "consultations": consultations_m[i],
            "prescriptions": prescriptions_m[i],
        }
        for i, d in enumerate(month_starts)
    ]

    consultations_by_doctor = [
        {
            "doctor": f"Dr {r['doctor__user__first_name']} {r['doctor__user__last_name']}".strip(),
            "total": r["total"],
        }
        for r in Consultation.objects.values(
            "doctor__user__first_name", "doctor__user__last_name"
        )
        .annotate(total=Count("id"))
        .order_by("-total")[:10]
    ]

    status_labels = dict(Appointment.Status.choices)
    appointments_by_status = [
        {"status": r["status"], "label": status_labels.get(r["status"], r["status"]), "total": r["total"]}
        for r in Appointment.objects.values("status").annotate(total=Count("id")).order_by("-total")
    ]

    appointments_by_specialty = [
        {"specialty": r["specialty__name"], "total": r["total"]}
        for r in Appointment.objects.exclude(status=Appointment.Status.CANCELLED)
        .values("specialty__name")
        .annotate(total=Count("id"))
        .order_by("-total")
    ]

    weekday_names = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    weekday_counts = [0] * 7
    for d in Appointment.objects.exclude(
        status=Appointment.Status.CANCELLED
    ).values_list("date", flat=True):
        weekday_counts[d.weekday()] += 1
    appointments_by_weekday = [
        {"day": weekday_names[i], "total": weekday_counts[i]} for i in range(7)
    ]

    sex_labels = dict(Patient.Sex.choices)
    patients_by_sex = [
        {"sex": sex_labels.get(r["sex"], "Non renseigné"), "total": r["total"]}
        for r in Patient.objects.values("sex").annotate(total=Count("id"))
    ]

    age_buckets = [
        ("0-17", 0, 17), ("18-29", 18, 29), ("30-44", 30, 44),
        ("45-59", 45, 59), ("60-74", 60, 74), ("75+", 75, 200),
    ]
    age_counts = {label: 0 for label, _, _ in age_buckets}
    unknown_age = 0
    for dob in Patient.objects.values_list("date_of_birth", flat=True):
        if not dob:
            unknown_age += 1
            continue
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        for label, lo, hi in age_buckets:
            if lo <= age <= hi:
                age_counts[label] += 1
                break
    patients_by_age = [{"range": k, "total": v} for k, v in age_counts.items()]

    ticket_labels = dict(ConsultationTicket.STATUS_CHOICES)
    tickets_by_status = [
        {"status": ticket_labels.get(r["statut"], r["statut"]), "total": r["total"]}
        for r in ConsultationTicket.objects.values("statut").annotate(total=Count("id"))
    ]

    top_medications = [
        {"medication": r["medication"], "total": r["total"]}
        for r in PrescriptionItem.objects.values("medication")
        .annotate(total=Count("id"))
        .order_by("-total")[:8]
    ]

    appointments_total = Appointment.objects.count()
    cancelled = Appointment.objects.filter(status=Appointment.Status.CANCELLED).count()
    completed = Appointment.objects.filter(status=Appointment.Status.COMPLETED).count()

    return Response({
        "users_total": User.objects.count(),
        "patients_total": Patient.objects.count(),
        "doctors_total": Doctor.objects.filter(is_active=True).count(),
        "nurses_total": Nurse.objects.filter(is_active=True).count(),
        "receptionists_total": Receptionist.objects.filter(is_active=True).count(),
        "consultations_total": Consultation.objects.count(),
        "appointments_total": appointments_total,
        "prescriptions_total": Prescription.objects.count(),
        "cancellation_rate": round(100 * cancelled / appointments_total, 1) if appointments_total else 0,
        "completion_rate": round(100 * completed / appointments_total, 1) if appointments_total else 0,
        "unknown_age": unknown_age,
        "activity_by_month": activity_by_month,
        "consultations_by_doctor": consultations_by_doctor,
        "appointments_by_status": appointments_by_status,
        "appointments_by_specialty": appointments_by_specialty,
        "appointments_by_weekday": appointments_by_weekday,
        "patients_by_sex": patients_by_sex,
        "patients_by_age": patients_by_age,
        "tickets_by_status": tickets_by_status,
        "top_medications": top_medications,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def public_clinic(request):
    doctors = Doctor.objects.filter(is_active=True).select_related("user", "specialty")
    return Response(
        {
            "name": settings.CLINIC_NAME,
            "address": settings.CLINIC_ADDRESS,
            "phone": settings.CLINIC_PHONE,
            "email": settings.CLINIC_EMAIL,
            "professionals": [
                {
                    "id": d.id,
                    "name": d.user.get_full_name(),
                    "specialty": d.specialty.name,
                    "bio": d.bio,
                }
                for d in doctors
            ],
        }
    )
