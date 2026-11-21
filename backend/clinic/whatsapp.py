"""Envoi de messages WhatsApp aux patients.

Le fournisseur se choisit avec la variable d'environnement WHATSAPP_PROVIDER :

- ``console`` (défaut) : rien ne part, le message est affiché dans la console du
  serveur et enregistré dans le journal. Idéal pour le développement et la démo.
- ``twilio`` : API Twilio (le « sandbox » WhatsApp de Twilio suffit pour tester).
- ``meta`` : WhatsApp Business Cloud API de Meta.

Chaque tentative est enregistrée dans ``WhatsAppMessage`` ; une erreur d'envoi
ne lève jamais d'exception vers l'appelant.
"""

import base64
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.utils import formats, timezone

from .models import WhatsAppMessage

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 10


class WhatsAppError(Exception):
    pass


def normalize_number(raw):
    """Renvoie le numéro au format E.164 (+22890123456) ou "" s'il est invalide.

    Formats acceptés (indicatif par défaut 228, Togo) :
    +228 90 12 34 56 · 00228 90 12 34 56 · 228 90 12 34 56 · 90 12 34 56
    """
    code = str(settings.WHATSAPP_DEFAULT_COUNTRY_CODE).lstrip("+")
    digits = re.sub(r"[\s().-]", "", raw or "")
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    elif digits and not digits.startswith("+"):
        national = digits.lstrip("0")
        # « 22890123456 » contient déjà l'indicatif ; « 90123456 » non.
        if national.startswith(code) and len(national) >= len(code) + 8:
            digits = "+" + national
        else:
            digits = f"+{code}{national}"
    return digits if re.fullmatch(r"\+[1-9]\d{7,14}", digits) else ""


def _post(url, data, headers):
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise WhatsAppError(f"HTTP {exc.code} : {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise WhatsAppError(f"Fournisseur injoignable : {exc}") from exc


def _send_console(to, body):
    logger.warning("[WhatsApp console] -> %s\n%s", to, body)
    return "console"


def _send_twilio(to, body):
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    sender = settings.TWILIO_WHATSAPP_FROM
    if not (sid and token and sender):
        raise WhatsAppError(
            "Configuration Twilio incomplète (TWILIO_ACCOUNT_SID, "
            "TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)."
        )
    auth = base64.b64encode(f"{sid}:{token}".encode()).decode()
    data = urllib.parse.urlencode(
        {"From": f"whatsapp:{sender}", "To": f"whatsapp:{to}", "Body": body}
    ).encode()
    result = _post(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
        data,
        {
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    return result.get("sid", "")


def _send_meta(to, body):
    token = settings.META_WHATSAPP_TOKEN
    phone_id = settings.META_WHATSAPP_PHONE_NUMBER_ID
    if not (token and phone_id):
        raise WhatsAppError(
            "Configuration Meta incomplète (META_WHATSAPP_TOKEN, "
            "META_WHATSAPP_PHONE_NUMBER_ID)."
        )
    payload = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }
    result = _post(
        f"https://graph.facebook.com/v21.0/{phone_id}/messages",
        json.dumps(payload).encode(),
        {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    messages = result.get("messages") or [{}]
    return messages[0].get("id", "")


PROVIDERS = {"console": _send_console, "twilio": _send_twilio, "meta": _send_meta}


def send_whatsapp(patient, kind, body, *, require_opt_in=True, log_body=None):
    """Envoie ``body`` au patient et renvoie l'entrée de journal créée.

    ``log_body`` remplace le texte enregistré dans le journal (pour ne pas y
    conserver une donnée sensible comme un mot de passe).
    """
    provider = settings.WHATSAPP_PROVIDER
    to = normalize_number(patient.whatsapp_target)
    log = WhatsAppMessage(
        patient=patient,
        kind=kind,
        to_number=to,
        body=body if log_body is None else log_body,
        provider=provider,
    )

    if require_opt_in and not patient.whatsapp_opt_in:
        log.status = WhatsAppMessage.Status.SKIPPED
        log.error = "Le patient n'a pas activé les messages WhatsApp."
    elif not to:
        log.status = WhatsAppMessage.Status.SKIPPED
        log.error = "Aucun numéro WhatsApp valide pour ce patient."
    elif provider not in PROVIDERS:
        log.status = WhatsAppMessage.Status.FAILED
        log.error = f"Fournisseur WhatsApp inconnu : {provider!r}."
    else:
        try:
            log.provider_message_id = PROVIDERS[provider](to, body) or ""
            log.status = WhatsAppMessage.Status.SENT
        except WhatsAppError as exc:
            log.status = WhatsAppMessage.Status.FAILED
            log.error = str(exc)
            logger.error("Échec d'envoi WhatsApp au patient %s : %s", patient.pk, exc)

    log.save()
    return log


# ---------- Contenu des messages ----------
# Les messages ne contiennent jamais de données médicales (résultat, diagnostic) :
# WhatsApp n'est qu'un canal d'alerte, le détail reste dans l'espace patient.


def _first_name(patient):
    return patient.user.first_name or patient.user.username


def appointment_reminder_text(appointment):
    patient = appointment.patient
    day = formats.date_format(appointment.date, "l j F Y")
    hour = appointment.time.strftime("%H:%M")
    doctor = appointment.doctor.user.get_full_name() or appointment.doctor.user.username
    return (
        f"Bonjour {_first_name(patient)},\n"
        f"Rappel {settings.CLINIC_NAME} : vous avez rendez-vous le {day} à {hour} "
        f"avec le Dr {doctor} ({appointment.specialty.name}).\n"
        f"Adresse : {settings.CLINIC_ADDRESS}\n"
        "En cas d'empêchement, merci de prévenir la clinique."
    )


def lab_result_text(lab_result):
    return (
        f"Bonjour {_first_name(lab_result.patient)},\n"
        f"Les résultats de votre analyse « {lab_result.test_name} » sont disponibles.\n"
        f"Consultez-les dans votre espace patient : {settings.PATIENT_PORTAL_URL}"
    )


def test_text(patient):
    return (
        f"Bonjour {_first_name(patient)},\n"
        f"Ceci est un message de test de {settings.CLINIC_NAME}. "
        "Vous recevrez ici les rappels de rendez-vous et les alertes de résultats."
    )


def credentials_text(patient, password):
    return (
        f"Bonjour {_first_name(patient)},\n"
        f"Votre espace patient {settings.CLINIC_NAME} est prêt.\n"
        f"Identifiant : {patient.user.username}\n"
        f"Mot de passe provisoire : {password}\n"
        f"Connexion : {settings.PATIENT_PORTAL_URL}\n"
        "Vous devrez choisir votre propre mot de passe à la première connexion. "
        "Ne communiquez jamais vos identifiants."
    )


def send_credentials(patient, password):
    """Envoie identifiant + mot de passe provisoire à un patient qui vient d'être créé.

    Message de service demandé par la clinique : il part même si le patient n'a
    pas encore activé les alertes. Le mot de passe est masqué dans le journal.
    """
    return send_whatsapp(
        patient,
        WhatsAppMessage.Kind.CREDENTIALS,
        credentials_text(patient, password),
        require_opt_in=False,
        log_body=credentials_text(patient, "••••••••"),
    )


def send_appointment_reminder(appointment):
    log = send_whatsapp(
        appointment.patient,
        WhatsAppMessage.Kind.APPOINTMENT_REMINDER,
        appointment_reminder_text(appointment),
    )
    if log.status == WhatsAppMessage.Status.SENT:
        appointment.reminder_sent_at = timezone.now()
        appointment.save(update_fields=["reminder_sent_at"])
    return log
