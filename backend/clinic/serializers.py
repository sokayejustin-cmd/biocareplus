from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Appointment,
    Consultation,
    ConsultationTicket,
    Doctor,
    LabResult,
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
    WhatsAppMessage,
)

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "is_active",
            "must_change_password",
            "date_joined",
            "last_login",
        )
        read_only_fields = (
            "id",
            "date_joined",
            "last_login",
        )

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        user = User(**validated_data)

        if password:
            user.set_password(password)
            # Mot de passe choisi par l'administrateur : provisoire.
            user.must_change_password = True
        else:
            user.set_unusable_password()

        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)
            request = self.context.get("request")
            # Mot de passe redéfini par un tiers : l'utilisateur devra le changer.
            if not request or request.user.pk != instance.pk:
                instance.must_change_password = True

        instance.save()

        return instance
class ClinicTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["name"] = user.get_full_name()
        return token

    def validate(self, attrs):
        # Connexion possible avec l'adresse e-mail à la place de l'identifiant,
        # à condition que l'e-mail ne corresponde qu'à un seul compte.
        login = (attrs.get("username") or "").strip()
        if "@" in login and not User.objects.filter(username=login).exists():
            matches = list(
                User.objects.filter(email__iexact=login).values_list("username", flat=True)[:2]
            )
            if len(matches) == 1:
                attrs["username"] = matches[0]
        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "email": self.user.email,
            "phone": self.user.phone,
            "role": self.user.role,
            "must_change_password": self.user.must_change_password,
        }
        return data


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "is_active",
        )
        read_only_fields = fields


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "must_change_password",
        )
        read_only_fields = ("id", "username", "role", "must_change_password")


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    username = serializers.CharField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField()

    def validate_new_password(self, value):
        validate_password(value)
        return value


def encode_reset(user):
    return {
        "uid": urlsafe_base64_encode(force_bytes(user.pk)),
        "token": default_token_generator.make_token(user),
    }


def decode_reset_user(uid):
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        return User.objects.get(pk=pk)
    except (User.DoesNotExist, ValueError, TypeError):
        return None


class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ("id", "name", "description", "is_active")


class UserWriteMixin:
    def create_user(self, validated, role, password):
        user_data = validated.pop("user")
        pwd = user_data.pop("password", password)
        user = User.objects.create_user(role=role, **user_data)
        if pwd:
            user.set_password(pwd)
            user.must_change_password = True
            user.save()
        return user, validated


class NestedUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "phone",
            "is_active",
        )
        extra_kwargs = {"username": {"required": False}}


class DoctorSerializer(serializers.ModelSerializer):
    user = NestedUserSerializer()
    specialty_name = serializers.CharField(source="specialty.name", read_only=True)

    class Meta:
        model = Doctor
        fields = (
            "id",
            "user",
            "specialty",
            "specialty_name",
            "license_number",
            "bio",
            "is_active",
        )

    def create(self, validated):
        user_data = validated.pop("user")
        password = user_data.pop("password", None)
        user = User.objects.create_user(role=User.Role.DOCTOR, **user_data)
        if password:
            user.set_password(password)
            user.must_change_password = True
            user.save()
        return Doctor.objects.create(user=user, **validated)

    def update(self, instance, validated):
        user_data = validated.pop("user", None)
        if user_data:
            password = user_data.pop("password", None)
            for k, v in user_data.items():
                setattr(instance.user, k, v)
            if password:
                instance.user.set_password(password)
                instance.user.must_change_password = True
            instance.user.save()
        return super().update(instance, validated)


class NurseSerializer(serializers.ModelSerializer):
    user = NestedUserSerializer()
    assigned_patients = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Patient.objects.all(), required=False
    )

    class Meta:
        model = Nurse
        fields = ("id", "user", "department", "assigned_patients", "is_active")

    def create(self, validated):
        patients = validated.pop("assigned_patients", [])
        user_data = validated.pop("user")
        password = user_data.pop("password", None)
        user = User.objects.create_user(role=User.Role.NURSE, **user_data)
        if password:
            user.set_password(password)
            user.must_change_password = True
            user.save()
        nurse = Nurse.objects.create(user=user, **validated)
        nurse.assigned_patients.set(patients)
        return nurse

    def update(self, instance, validated):
        patients = validated.pop("assigned_patients", None)
        user_data = validated.pop("user", None)
        if user_data:
            password = user_data.pop("password", None)
            for k, v in user_data.items():
                setattr(instance.user, k, v)
            if password:
                instance.user.set_password(password)
                instance.user.must_change_password = True
            instance.user.save()
        instance = super().update(instance, validated)
        if patients is not None:
            instance.assigned_patients.set(patients)
        return instance


class ReceptionistSerializer(serializers.ModelSerializer):
    user = NestedUserSerializer()

    class Meta:
        model = Receptionist
        fields = ("id", "user", "desk", "is_active")

    def create(self, validated):
        user_data = validated.pop("user")
        password = user_data.pop("password", None)
        user = User.objects.create_user(role=User.Role.RECEPTIONIST, **user_data)
        if password:
            user.set_password(password)
            user.must_change_password = True
            user.save()
        return Receptionist.objects.create(user=user, **validated)

    def update(self, instance, validated):
        user_data = validated.pop("user", None)
        if user_data:
            password = user_data.pop("password", None)
            for k, v in user_data.items():
                setattr(instance.user, k, v)
            if password:
                instance.user.set_password(password)
                instance.user.must_change_password = True
            instance.user.save()
        return super().update(instance, validated)


class PatientSerializer(serializers.ModelSerializer):
    user = NestedUserSerializer()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = (
            "id",
            "patient_code",
            "user",
            "full_name",
            "date_of_birth",
            "sex",
            "address",
            "emergency_contact_name",
            "emergency_contact_phone",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def create(self, validated):
        user_data = validated.pop("user")
        password = user_data.pop("password", None)
        user = User.objects.create_user(role=User.Role.PATIENT, **user_data)
        if password:
            user.set_password(password)
            user.must_change_password = True
            user.save()
        return Patient.objects.create(user=user, **validated)

    def update(self, instance, validated):
        user_data = validated.pop("user", None)
        if user_data:
            password = user_data.pop("password", None)
            allowed = user_data
            request = self.context.get("request")
            if request and request.user.role == User.Role.PATIENT:
                allowed = {
                    k: v
                    for k, v in user_data.items()
                    if k in {"first_name", "last_name", "email", "phone"}
                }
            for k, v in allowed.items():
                setattr(instance.user, k, v)
            if password and request and request.user.role != User.Role.PATIENT:
                instance.user.set_password(password)
                instance.user.must_change_password = True
            instance.user.save()
        return super().update(instance, validated)


class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.user.get_full_name", read_only=True
    )

    class Meta:
        model = MedicalRecord
        fields = (
            "id",
            "patient",
            "patient_name",
            "blood_type",
            "allergies",
            "medical_history",
            "surgical_history",
            "current_treatments",
            "observations",
            "updated_at",
        )
        read_only_fields = ("updated_at",)


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.user.get_full_name", read_only=True
    )
    doctor_name = serializers.CharField(
        source="doctor.user.get_full_name", read_only=True
    )
    specialty_name = serializers.CharField(source="specialty.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Appointment
        fields = (
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "specialty",
            "specialty_name",
            "date",
            "time",
            "reason",
            "status",
            "status_label",
            "reminder_sent_at",
            "created_at",
        )
        read_only_fields = ("created_at", "reminder_sent_at")
        # La spécialité est déduite du médecin quand elle n'est pas fournie.
        extra_kwargs = {"specialty": {"required": False}}

    def validate(self, attrs):
        doctor = attrs.get("doctor") or getattr(self.instance, "doctor", None)
        date = attrs.get("date") or getattr(self.instance, "date", None)
        time = attrs.get("time") or getattr(self.instance, "time", None)
        status = attrs.get("status") or getattr(
            self.instance, "status", Appointment.Status.SCHEDULED
        )
        if doctor and date and time and status != Appointment.Status.CANCELLED:
            qs = Appointment.objects.filter(
                doctor=doctor, date=date, time=time
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Ce docteur a déjà un rendez-vous à cet horaire."
                )
        if doctor and "specialty" not in attrs:
            attrs["specialty"] = doctor.specialty
        # Un rendez-vous déplacé doit faire l'objet d'un nouveau rappel.
        if self.instance and (
            ("date" in attrs and attrs["date"] != self.instance.date)
            or ("time" in attrs and attrs["time"] != self.instance.time)
        ):
            attrs["reminder_sent_at"] = None
        return attrs


class ConsultationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.user.get_full_name", read_only=True
    )
    doctor_name = serializers.CharField(
        source="doctor.user.get_full_name", read_only=True
    )

    class Meta:
        model = Consultation
        fields = (
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "appointment",
            "date",
            "reason",
            "symptoms",
            "diagnosis",
            "observations",
            "comments",
            "treatment",
            "recommendations",
            "created_at",
        )
        read_only_fields = ("created_at",)


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ("id", "medication", "dosage", "posology", "duration", "instructions")


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True)
    patient_name = serializers.CharField(
        source="patient.user.get_full_name", read_only=True
    )
    doctor_name = serializers.CharField(
        source="doctor.user.get_full_name", read_only=True
    )

    class Meta:
        model = Prescription
        fields = (
            "id",
            "consultation",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "date",
            "instructions",
            "observations",
            "items",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def create(self, validated):
        items = validated.pop("items", [])
        prescription = Prescription.objects.create(**validated)
        for item in items:
            PrescriptionItem.objects.create(prescription=prescription, **item)
        return prescription

    def update(self, instance, validated):
        items = validated.pop("items", None)
        instance = super().update(instance, validated)
        if items is not None:
            instance.items.all().delete()
            for item in items:
                PrescriptionItem.objects.create(prescription=instance, **item)
        return instance


class MedicalCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.get_full_name", read_only=True)

    class Meta:
        model = MedicalComment
        fields = ("id", "patient", "author", "author_name", "kind", "text", "created_at")
        read_only_fields = ("author", "kind", "created_at")


class ConsultationTicketSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.user.get_full_name",
        read_only=True
    )

    doctor_name = serializers.CharField(
        source="doctor.user.get_full_name",
        read_only=True
    )

    class Meta:
        model = ConsultationTicket
        fields = [
            "id",
            "numero",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "date",
            "heure",
            "statut",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "numero",
            "date",
            "heure",
            "created_at",
        ]

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "title", "message", "event", "is_read", "created_at")
        read_only_fields = ("title", "message", "event", "created_at")


class LabResultSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.user.get_full_name", read_only=True
    )
    doctor_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    file = serializers.FileField(write_only=True, required=False, allow_null=True)
    has_file = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = LabResult
        fields = (
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "test_name",
            "status",
            "status_label",
            "result_summary",
            "file",
            "has_file",
            "file_name",
            "requested_at",
            "available_at",
            "created_at",
        )
        read_only_fields = ("available_at", "created_at")
        extra_kwargs = {"doctor": {"required": False}}

    def get_doctor_name(self, obj):
        return obj.doctor.user.get_full_name() if obj.doctor else ""

    def get_has_file(self, obj):
        return bool(obj.file)

    def get_file_name(self, obj):
        return obj.file.name.rsplit("/", 1)[-1] if obj.file else ""

    def validate(self, attrs):
        status = attrs.get("status") or getattr(
            self.instance, "status", LabResult.Status.REQUESTED
        )
        if status == LabResult.Status.AVAILABLE:
            summary = attrs.get("result_summary", getattr(self.instance, "result_summary", ""))
            has_file = attrs.get("file") or getattr(self.instance, "file", None)
            if not (summary or "").strip() and not has_file:
                raise serializers.ValidationError(
                    "Ajoutez un compte rendu ou un fichier avant de publier le résultat."
                )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        is_patient = request and request.user.role == User.Role.PATIENT
        # Le patient ne voit le contenu qu'une fois le résultat publié.
        if is_patient and instance.status != LabResult.Status.AVAILABLE:
            data["result_summary"] = ""
            data["has_file"] = False
            data["file_name"] = ""
        return data


class PatientWhatsAppSerializer(serializers.ModelSerializer):
    effective_number = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = ("whatsapp_opt_in", "whatsapp_number", "effective_number")

    def get_effective_number(self, obj):
        from .whatsapp import normalize_number

        return normalize_number(obj.whatsapp_target)

    def validate_whatsapp_number(self, value):
        from .whatsapp import normalize_number

        value = (value or "").strip()
        if value and not normalize_number(value):
            raise serializers.ValidationError(
                "Numéro invalide. Utilisez le format international, ex. +228 90 12 34 56."
            )
        return value

    def validate(self, attrs):
        from .whatsapp import normalize_number

        opt_in = attrs.get("whatsapp_opt_in", self.instance.whatsapp_opt_in)
        number = attrs.get("whatsapp_number", self.instance.whatsapp_number)
        if opt_in and not normalize_number(number or self.instance.user.phone):
            raise serializers.ValidationError(
                {"whatsapp_number": "Indiquez un numéro WhatsApp pour activer les messages."}
            )
        return attrs


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.user.get_full_name", read_only=True
    )
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = WhatsAppMessage
        fields = (
            "id",
            "patient",
            "patient_name",
            "kind",
            "kind_label",
            "to_number",
            "body",
            "provider",
            "status",
            "status_label",
            "error",
            "created_at",
        )
        read_only_fields = fields

    def get_status_label(self, obj):
        # En mode console, rien ne part réellement : ne pas afficher « Envoyé ».
        if obj.provider == "console" and obj.status == WhatsAppMessage.Status.SENT:
            return "Simulé (console)"
        return obj.get_status_display()
