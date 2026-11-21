from django.contrib import admin

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


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "role", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("username", "first_name", "last_name", "email")


admin.site.register(Specialty)
admin.site.register(Doctor)
admin.site.register(Nurse)
admin.site.register(Receptionist)
admin.site.register(Patient)
admin.site.register(MedicalRecord)
admin.site.register(Appointment)
admin.site.register(Consultation)
admin.site.register(Prescription)
admin.site.register(PrescriptionItem)
admin.site.register(MedicalComment)
admin.site.register(ConsultationTicket)
admin.site.register(Notification)


@admin.register(LabResult)
class LabResultAdmin(admin.ModelAdmin):
    list_display = ("test_name", "patient", "status", "requested_at", "available_at")
    list_filter = ("status",)


@admin.register(WhatsAppMessage)
class WhatsAppMessageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "patient", "kind", "to_number", "provider", "status")
    list_filter = ("kind", "status", "provider")
