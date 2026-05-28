const { getClient } = require('./_utils/db');
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

  const {
    first_name,
    last_name,
    phone,
    email,
    reservation_date,
    reservation_time,
    guests,
    reservation_type,
    message,
    consent_rgpd,
    honeypot // Protection anti-spam honeypot
  } = req.body || {};

  // 1. Protection Honeypot : Si le champ caché est rempli, on simule une réussite pour tromper les bots
  if (honeypot && honeypot.trim() !== "") {
    console.warn("[SPAM DETECTED] Honeypot field filled. Simulating success response.");
    return res.status(200).json({
      success: true,
      message: "Merci, votre demande de réservation a bien été envoyée. L’équipe des Tables de la Fontaine vous confirmera votre table rapidement."
    });
  }

  // 2. Validation stricte des données
  if (!first_name || first_name.trim() === "") {
    return res.status(400).json({ error: "Le prénom est obligatoire." });
  }
  if (!last_name || last_name.trim() === "") {
    return res.status(400).json({ error: "Le nom est obligatoire." });
  }
  if (!phone || phone.trim() === "") {
    return res.status(400).json({ error: "Le numéro de téléphone est obligatoire." });
  }
  if (!email || email.trim() === "" || !email.includes('@')) {
    return res.status(400).json({ error: "L'adresse e-mail est invalide." });
  }
  if (!reservation_date) {
    return res.status(400).json({ error: "La date de réservation est obligatoire." });
  }
  if (!reservation_time) {
    return res.status(400).json({ error: "L'heure de réservation est obligatoire." });
  }
  
  const parsedGuests = parseInt(guests, 10);
  if (isNaN(parsedGuests) || parsedGuests < 1) {
    return res.status(400).json({ error: "Le nombre de personnes doit être supérieur à 0." });
  }

  if (!consent_rgpd) {
    return res.status(400).json({ error: "Vous devez accepter l'utilisation de vos données personnelles (RGPD)." });
  }

  try {
    const supabase = getClient(true); // Utilisation du rôle de service pour écrire en base sécurisée

    // 3. Insertion de la réservation dans Supabase
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        reservation_date,
        reservation_time,
        guests: parsedGuests,
        reservation_type: reservation_type || 'autre',
        message: message ? message.trim() : null,
        status: 'pending',
        source: 'website',
        consent_rgpd: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`[New Booking Created] ID: ${reservation.id}`);

    // Configuration URLs et numéros pour notifications
    const siteUrl = process.env.SITE_URL || 'https://lestablesdelafontaine-biscarrosse.fr';
    const adminUrl = `${siteUrl}/admin`;
    const restaurantEmail = process.env.RESTAURANT_EMAIL || 'lestablesdelafontaine40@gmail.com';
    const formattedDate = new Date(reservation_date).toLocaleDateString('fr-FR');
    const formattedTime = reservation_time.substring(0, 5);

    // Initialisation des statuts de notification
    let emailRestoSent = false;
    let emailCustSent = false;
    let waRestoSent = false;
    let waCustSent = false;

    // 4. Envoi Email au restaurateur
    const restoEmailResult = await sendEmail({
      to: restaurantEmail,
      subject: "Nouvelle réservation — Les Tables de la Fontaine",
      text: `Nouvelle réservation reçue.

Nom : ${first_name} ${last_name}
Téléphone : ${phone}
Email : ${email}
Date : ${formattedDate}
Heure : ${formattedTime}
Nombre de personnes : ${parsedGuests}
Type : ${reservation_type || 'Autre'}
Message : ${message || 'Aucun message.'}

Connectez-vous au dashboard pour confirmer ou refuser :
${adminUrl}`
    });
    emailRestoSent = restoEmailResult.success;

    // 5. Envoi Email au client
    const customerEmailResult = await sendEmail({
      to: email.trim(),
      subject: "Votre demande de réservation — Les Tables de la Fontaine",
      text: `Bonjour ${first_name},

Votre demande de réservation aux Tables de la Fontaine pour ${parsedGuests} personne(s) le ${formattedDate} à ${formattedTime} a bien été reçue.

L’équipe vous recontactera pour confirmer votre table.

Les Tables de la Fontaine
540 chemin de Bimbo, 40600 Biscarrosse
06 35 34 59 67`
    });
    emailCustSent = customerEmailResult.success;

    // 6. Envoi WhatsApp optionnel si activé
    if (process.env.WHATSAPP_ENABLED === 'true') {
      const restWaNum = process.env.RESTAURANT_WHATSAPP_NUMBER || "+33635345967";

      // WhatsApp au Restaurateur
      const restoWaResult = await sendWhatsApp({
        to: restWaNum,
        message: `Nouvelle réservation Les Tables de la Fontaine\n\nNom : ${first_name} ${last_name}\nTéléphone : ${phone}\nEmail : ${email}\nDate : ${formattedDate}\nHeure : ${formattedTime}\nPersonnes : ${parsedGuests}\nType : ${reservation_type || 'Autre'}\nMessage : ${message || '-'}\n\nÀ traiter dans le dashboard :\n${adminUrl}`,
        templateName: "new_reservation_alert", // Template Meta optionnel
        templateParams: [`${first_name} ${last_name}`, phone, formattedDate, formattedTime, String(parsedGuests)]
      });
      waRestoSent = restoWaResult.success;

      // WhatsApp au Client
      const custWaResult = await sendWhatsApp({
        to: phone.trim(),
        message: `Bonjour ${first_name}, votre demande de réservation aux Tables de la Fontaine pour ${parsedGuests} personne(s) le ${formattedDate} à ${formattedTime} a bien été reçue. L'équipe vous recontactera pour confirmer votre table. Les Tables de la Fontaine.`,
        templateName: "reservation_received",
        templateParams: [first_name, String(parsedGuests), formattedDate, formattedTime]
      });
      waCustSent = custWaResult.success;
    }

    // 7. Mettre à jour les indicateurs d'envoi dans la réservation
    await supabase
      .from('reservations')
      .update({
        restaurant_notification_sent: emailRestoSent,
        customer_notification_sent: emailCustSent,
        restaurant_whatsapp_sent: waRestoSent,
        customer_whatsapp_sent: waCustSent
      })
      .eq('id', reservation.id);

    return res.status(200).json({
      success: true,
      message: "Merci, votre demande de réservation a bien été envoyée. L’équipe des Tables de la Fontaine vous confirmera votre table rapidement."
    });

  } catch (error) {
    console.error("[Create Reservation Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de l'enregistrement de votre réservation." });
  }
};
