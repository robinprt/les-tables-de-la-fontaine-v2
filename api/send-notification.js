const { verifyAdmin } = require('./_utils/auth');
const { sendEmail, sendWhatsApp } = require('./_utils/notifications');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(455).json({ error: "Méthode non autorisée. Utilisez POST." });
  }

  // 1. Authentification Admin
  const authResult = await verifyAdmin(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: authResult.error });
  }

  const { type, to, subject, message, templateName, templateParams } = req.body || {};

  if (!type || !to || !message) {
    return res.status(400).json({ error: "Champs obligatoires manquants (type, to, message)." });
  }

  try {
    let result;
    if (type === 'email') {
      result = await sendEmail({ 
        to, 
        subject: subject || "Notification — Les Tables de la Fontaine", 
        text: message 
      });
    } else if (type === 'whatsapp') {
      result = await sendWhatsApp({ 
        to, 
        message, 
        templateName, 
        templateParams 
      });
    } else {
      return res.status(400).json({ error: "Type de notification inconnu. Utilisez 'email' ou 'whatsapp'." });
    }

    if (result.success) {
      return res.status(200).json({ success: true, message: "Notification envoyée.", details: result });
    } else {
      return res.status(500).json({ error: "Échec de l'envoi de la notification.", error_details: result.error });
    }

  } catch (error) {
    console.error("[Send Notification Exception]", error);
    return res.status(500).json({ error: "Une erreur interne est survenue." });
  }
};
