from django.conf.locale import fi
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

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        user = User(**validated_data)

        if password:
            user.set_password(password)
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
class MedicalRecordSerializer(serializers.ModelSerializer):
     class Meta:
        model = MedicalRecord
        fields = (
            "id",
            "blood_type",
            "allergies",
            "medical_history",
            "surgical_history",
            "current_treatments",
            "observations",
            "updated_at",
        )
        read_only_fields = ("id", "updated_at")

class PatientSerializer(serializers.ModelSerializer):
    user = serializers.DictField(write_only=True)
    medical_record = MedicalRecordSerializer(required=False)

    class Meta:
        model = Patient
        fields = (
            "id",
            "user",
            "patient_code",
            "date_of_birth",
            "sex",
            "address",
            "emergency_contact_name",
            "emergency_contact_phone",
            "medical_record",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        user_data = validated_data.pop("user")
        medical_data = validated_data.pop("medical_record", {})

        password = user_data.pop("password", None)

        # Création du compte utilisateur
        user = User.objects.create_user(
            username=user_data["username"],
            password=password,
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name", ""),
            email=user_data.get("email", ""),
            phone=user_data.get("phone", ""),
            role=User.Role.PATIENT,
        )

        # Création du patient
        patient = Patient.objects.create(
            user=user,
            **validated_data,
        )

        # Création automatique du dossier médical
        MedicalRecord.objects.update_or_create(
            patient=patient,
            defaults=medical_data,
        )

        return patient

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", None)
        medical_data = validated_data.pop("medical_record", None)

        # Mise à jour du compte utilisateur
        if user_data:
            user = instance.user

            for field in (
                "username",
                "first_name",
                "last_name",
                "email",
                "phone",
            ):
                if field in user_data:
                    setattr(user, field, user_data[field])

            if user_data.get("password"):
                user.set_password(user_data["password"])

            user.save()

        # Mise à jour des informations du patient
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        # Mise à jour du dossier médical
        if medical_data is not None:
            MedicalRecord.objects.update_or_create(
                patient=instance,
                defaults=medical_data,
            )

        return instance

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
            "created_at",
        )
        read_only_fields = ("created_at",)
        # Déduite du docteur dans validate() si absente.
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
        read_only_fields = ("author", "created_at")


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
