const { getClient } = require('./_utils/db');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  // Configurer CORS
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
    status,
    admin_note
  } = req.body || {};

  // Validation
  if (!first_name || first_name.trim() === "") {
    return res.status(400).json({ error: "Le prénom est obligatoire." });
  }
  if (!last_name || last_name.trim() === "") {
    return res.status(400).json({ error: "Le nom est obligatoire." });
  }
  if (!phone || phone.trim() === "") {
    return res.status(400).json({ error: "Le téléphone est obligatoire." });
  }
  if (!reservation_date) {
    return res.status(400).json({ error: "La date est obligatoire." });
  }
  if (!reservation_time) {
    return res.status(400).json({ error: "L'heure est obligatoire." });
  }
  
  const parsedGuests = parseInt(guests, 10);
  if (isNaN(parsedGuests) || parsedGuests < 1) {
    return res.status(400).json({ error: "Le nombre de personnes doit être supérieur à 0." });
  }

  try {
    const supabase = getClient(true);

    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : '',
        reservation_date,
        reservation_time,
        guests: parsedGuests,
        reservation_type: reservation_type || 'autre',
        message: message ? message.trim() : null,
        status: status || 'confirmed', // Par défaut 'confirmed' pour les saisies manuelles admin
        admin_note: admin_note ? admin_note.trim() : null,
        source: 'admin',
        consent_rgpd: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`[Manual Booking Created] ID: ${reservation.id}`);
    return res.status(200).json({
      success: true,
      message: "La réservation manuelle a été créée avec succès.",
      reservation
    });

  } catch (error) {
    console.error("[Create Manual Reservation Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la création manuelle de la réservation." });
  }
};
