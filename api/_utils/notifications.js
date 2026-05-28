const sgMail = require('@sendgrid/mail');
const { Resend } = require('resend');

/**
 * Envoie un e-mail en utilisant Resend, SendGrid ou un repli console.log en développement
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const apiKey = process.env.EMAIL_API_KEY;
  const fromEmail = process.env.RESTAURANT_EMAIL || 'no-reply@lestablesdelafontaine-biscarrosse.fr';

  console.log(`[Email] Envoi de mail vers ${to} - Objet: "${subject}"`);

  if (!apiKey) {
    console.warn("[Email WARNING] EMAIL_API_KEY manquant. Le mail ne sera pas réellement envoyé (console log uniquement).");
    console.log(`[MOCK EMAIL CONTENT]\nFrom: ${fromEmail}\nTo: ${to}\nSubject: ${subject}\nBody:\n${text || html}\n`);
    return { success: true, mock: true };
  }

  try {
    if (provider === 'sendgrid') {
      sgMail.setApiKey(apiKey);
      const msg = {
        to,
        from: fromEmail,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>')
      };
      await sgMail.send(msg);
      return { success: true, provider: 'sendgrid' };
    } else if (provider === 'resend') {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: `Les Tables de la Fontaine <${fromEmail}>`,
        to: [to],
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>')
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return { success: true, provider: 'resend', data: result.data };
    } else {
      console.warn(`[Email WARNING] Fournisseur '${provider}' non supporté. Utilisation du mode repli.`);
      console.log(`[MOCK EMAIL CONTENT]\nFrom: ${fromEmail}\nTo: ${to}\nSubject: ${subject}\nBody:\n${text || html}\n`);
      return { success: true, mock: true };
    }
  } catch (error) {
    console.error("[Email ERROR] Échec de l'envoi de l'e-mail:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoie un message WhatsApp via l'API Cloud WhatsApp (Meta) ou Twilio (si WHATSAPP_ENABLED = true)
 */
const sendWhatsApp = async ({ to, message, templateName, templateParams }) => {
  const enabled = process.env.WHATSAPP_ENABLED === 'true';
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!enabled) {
    console.log(`[WhatsApp DISABLED] Message destiné à ${to} (non envoyé) : "${message}"`);
    return { success: false, reason: 'disabled' };
  }

  console.log(`[WhatsApp] Envoi de message vers ${to} via '${provider}'`);

  if (!token) {
    console.warn("[WhatsApp WARNING] WHATSAPP_API_TOKEN manquant. Envoi simulé.");
    return { success: true, mock: true };
  }

  try {
    if (provider === 'meta' || provider === 'facebook') {
      // API Cloud WhatsApp Officielle
      if (!phoneId) {
        throw new Error("WHATSAPP_PHONE_NUMBER_ID est requis pour le fournisseur Meta.");
      }

      // Nettoyage du numéro de téléphone (doit être au format international sans +, ex: 33635345967)
      const formattedTo = to.replace(/[\s+()-]/g, '');

      // Pour l'API WhatsApp officielle, on envoie généralement un template pré-approuvé.
      // S'il n'y a pas de template spécifié, on essaie d'envoyer un message texte simple (nécessite une session active de 24h).
      let payload;
      if (templateName) {
        payload = {
          messaging_product: "whatsapp",
          to: formattedTo,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: "fr"
            },
            components: [
              {
                type: "body",
                parameters: (templateParams || []).map(p => ({
                  type: "text",
                  text: String(p)
                }))
              }
            ]
          }
        };
      } else {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "text",
          text: {
            body: message
          }
        };
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(resData));
      }

      return { success: true, provider: 'meta', data: resData };
    } else {
      console.warn(`[WhatsApp WARNING] Fournisseur WhatsApp '${provider}' inconnu. Envoi simulé.`);
      console.log(`[MOCK WHATSAPP]\nTo: ${to}\nMessage: ${message}\n`);
      return { success: true, mock: true };
    }
  } catch (error) {
    console.error("[WhatsApp ERROR] Échec de l'envoi WhatsApp:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendWhatsApp
};
