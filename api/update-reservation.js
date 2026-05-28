const { getClient } = require('./_utils/db');
const { verifyAdmin } = require('./_utils/auth');
const { sendEmail, sendWhatsApp } = require('./_utils/notifications');

module.exports = async (req, res) => {
  // Configurer CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(455).json({ error: "Méthode non autorisée. Utilisez POST ou PUT." });
  }

  // 1. Authentification Admin
  const authResult = await verifyAdmin(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: authResult.error });
  }

  const {
    id,
    first_name,
    last_name,
    phone,
    email,
    reservation_date,
    reservation_time,
    guests,
    reservation_type,
    status,
    admin_note,
    send_notification // boolean - s'il faut envoyer un e-mail/WhatsApp de confirmation/refus au client
  } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: "L'identifiant de la réservation (id) est obligatoire." });
  }

  try {
    const supabase = getClient(true);

    // Récupérer d'abord l'état actuel de la réservation pour voir s'il y a un changement de statut
    const { data: currentReservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentReservation) {
      return res.status(404).json({ error: "Réservation introuvable." });
    }

    // Préparer les données de mise à jour
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name.trim();
    if (last_name !== undefined) updateData.last_name = last_name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (reservation_date !== undefined) updateData.reservation_date = reservation_date;
    if (reservation_time !== undefined) updateData.reservation_time = reservation_time;
    if (guests !== undefined) updateData.guests = parseInt(guests, 10);
    if (reservation_type !== undefined) updateData.reservation_type = reservation_type;
    if (status !== undefined) updateData.status = status;
    if (admin_note !== undefined) updateData.admin_note = admin_note.trim();
    updateData.updated_at = new Date().toISOString();

    // Effectuer la mise à jour
    const { data: updatedReservation, error: updateError } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log(`[Booking Updated] ID: ${id}, Status changed to: ${status}`);

    // 2. Gestion des notifications de changement de statut
    const statusChanged = currentReservation.status !== status;
    let customerNotifSent = updatedReservation.customer_notification_sent;
    let customerWaSent = updatedReservation.customer_whatsapp_sent;

    if (statusChanged && send_notification && (status === 'confirmed' || status === 'refused')) {
      const custEmail = email || currentReservation.email;
      const custPhone = phone || currentReservation.phone;
      const custFirstName = first_name || currentReservation.first_name;
      const rDate = reservation_date || currentReservation.reservation_date;
      const rTime = reservation_time || currentReservation.reservation_time;
      const rGuests = guests || currentReservation.guests;

      const formattedDate = new Date(rDate).toLocaleDateString('fr-FR');
      const formattedTime = rTime.substring(0, 5);

      if (status === 'confirmed') {
        // Envoi E-mail de confirmation
        const emailResult = await sendEmail({
          to: custEmail,
          subject: "Votre réservation est confirmée — Les Tables de la Fontaine",
          text: `Bonjour ${custFirstName},

Votre réservation aux Tables de la Fontaine est confirmée pour ${rGuests} personne(s) le ${formattedDate} à ${formattedTime}.

À très bientôt !

Les Tables de la Fontaine
540 chemin de Bimbo, 40600 Biscarrosse
06 35 34 59 67`
        });
        customerNotifSent = emailResult.success;

        // WhatsApp de confirmation (si activé)
        if (process.env.WHATSAPP_ENABLED === 'true') {
          const waResult = await sendWhatsApp({
            to: custPhone,
            message: `Bonjour ${custFirstName}, votre réservation aux Tables de la Fontaine est confirmée pour ${rGuests} personne(s) le ${formattedDate} à ${formattedTime}. À très bientôt, Les Tables de la Fontaine.`,
            templateName: "reservation_confirmed",
            templateParams: [custFirstName, String(rGuests), formattedDate, formattedTime]
          });
          customerWaSent = waResult.success;
        }

      } else if (status === 'refused') {
        // Envoi E-mail de refus
        const emailResult = await sendEmail({
          to: custEmail,
          subject: "Votre demande de réservation — Les Tables de la Fontaine",
          text: `Bonjour ${custFirstName},

Nous sommes désolés, nous ne pouvons pas confirmer votre demande de réservation pour le ${formattedDate} à ${formattedTime}.

Vous pouvez nous appeler au 06 35 34 59 67 pour voir s'il y a d'autres disponibilités.

Cordialement,

L'équipe des Tables de la Fontaine
540 chemin de Bimbo, 40600 Biscarrosse`
        });
        customerNotifSent = emailResult.success;

        // WhatsApp de refus (si activé)
        if (process.env.WHATSAPP_ENABLED === 'true') {
          const waResult = await sendWhatsApp({
            to: custPhone,
            message: `Bonjour ${custFirstName}, nous sommes désolés, nous ne pouvons pas confirmer votre demande de réservation pour le ${formattedDate} à ${formattedTime}. Vous pouvez nous appeler au 06 35 34 59 67 pour voir une autre disponibilité. Les Tables de la Fontaine.`,
            templateName: "reservation_refused",
            templateParams: [custFirstName, formattedDate, formattedTime]
          });
          customerWaSent = waResult.success;
        }
      }

      // Mettre à jour l'enregistrement avec les nouveaux indicateurs d'envoi
      await supabase
        .from('reservations')
        .update({
          customer_notification_sent: customerNotifSent,
          customer_whatsapp_sent: customerWaSent
        })
        .eq('id', id);
    }

    return res.status(200).json({
      success: true,
      message: "La réservation a été mise à jour avec succès.",
      reservation: {
        ...updatedReservation,
        customer_notification_sent: customerNotifSent,
        customer_whatsapp_sent: customerWaSent
      }
    });

  } catch (error) {
    console.error("[Update Reservation Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la mise à jour de la réservation." });
  }
};
