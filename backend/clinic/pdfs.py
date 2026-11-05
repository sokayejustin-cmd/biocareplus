from io import BytesIO

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


NAVY = colors.HexColor("#0b5f8a")
GREEN = colors.HexColor("#1b8a6b")


def _header_table():
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "ClinicTitle",
        parent=styles["Heading1"],
        textColor=NAVY,
        fontSize=18,
        spaceAfter=2,
    )
    sub = ParagraphStyle(
        "ClinicSub", parent=styles["Normal"], textColor=GREEN, fontSize=10
    )
    left = [
        Paragraph(settings.CLINIC_NAME, title),
        Paragraph("Cabinet médical", sub),
        Paragraph(settings.CLINIC_ADDRESS, styles["Normal"]),
        Paragraph(f"Tél. {settings.CLINIC_PHONE} · {settings.CLINIC_EMAIL}", styles["Normal"]),
    ]
    data = [[left, Paragraph("<b>BIO CARE PLUS</b>", title)]]
    table = Table(data, colWidths=[120 * mm, 55 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, -1), 2, NAVY),
            ]
        )
    )
    return table


def build_prescription_pdf(prescription):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = [_header_table(), Spacer(1, 12)]
    story.append(Paragraph("ORDONNANCE MÉDICALE", styles["Heading2"]))
    patient = prescription.patient.user
    doctor = prescription.doctor
    story.append(
        Paragraph(
            f"<b>Patient :</b> {patient.get_full_name()} ({prescription.patient.patient_code})",
            styles["Normal"],
        )
    )
    story.append(Paragraph(f"<b>Date :</b> {prescription.date}", styles["Normal"]))
    story.append(
        Paragraph(
            f"<b>Docteur :</b> Dr {doctor.user.get_full_name()} — {doctor.specialty}",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 10))
    rows = [["Médicament", "Dosage", "Posologie", "Durée", "Instructions"]]
    for item in prescription.items.all():
        rows.append(
            [item.medication, item.dosage, item.posology, item.duration, item.instructions]
        )
    table = Table(rows, colWidths=[40 * mm, 28 * mm, 40 * mm, 28 * mm, 40 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    if prescription.instructions:
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Instructions :</b> {prescription.instructions}", styles["Normal"]))
    if prescription.observations:
        story.append(Paragraph(f"<b>Observations :</b> {prescription.observations}", styles["Normal"]))
    story.append(Spacer(1, 24))
    story.append(Paragraph(f"Signature du praticien — Dr {doctor.user.get_full_name()}", styles["Normal"]))
    doc.build(story)
    buffer.seek(0)
    return buffer


def build_ticket_pdf(ticket):
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
    )

    styles = getSampleStyleSheet()

    story = [
        _header_table(),
        Spacer(1, 12),
    ]

    story.append(
        Paragraph(
            "BON DE CONSULTATION",
            styles["Heading2"]
        )
    )
    story.append(
        Paragraph(
            f"<b>N° du ticket :</b> {ticket.numero or '—'}",
            styles["Normal"]
        )
    )
    story.append(
        Paragraph(
            f"<b>Patient :</b> "
            f"{ticket.patient.user.get_full_name()} "
            f"({ticket.patient.patient_code})",
            styles["Normal"]
        )
    )
    story.append(
        Paragraph(
            f"<b>Docteur :</b> "
            f"Dr {ticket.doctor.user.get_full_name()}",
            styles["Normal"]
        )
    )
    story.append(
        Paragraph(
            f"<b>Spécialité :</b> {ticket.doctor.specialty}",
            styles["Normal"]
        )
    )
    story.append(
        Paragraph(
            f"<b>Date :</b> {ticket.date}",
            styles["Normal"]
        )
    )
    story.append(
        Paragraph(
            f"<b>Heure :</b> {ticket.heure or '—'}",
            styles["Normal"]
        )
    )
    statut = ticket.get_statut_display()

    story.append(
        Paragraph(
            f"<b>Statut :</b> {statut}",
            styles["Normal"]
        )
    )

    story.append(Spacer(1, 16))

    story.append(
        Paragraph(
            "Présentez ce bon à l’accueil le jour de votre consultation.",
            styles["Italic"]
        )
    )

    story.append(Spacer(1, 12))

    story.append(
        Paragraph(
            "Merci de conserver votre numéro de ticket et de rester "
            "attentif à l'appel de votre numéro.",
            styles["Normal"]
        )
    )

    doc.build(story)

    buffer.seek(0)

    return buffer
