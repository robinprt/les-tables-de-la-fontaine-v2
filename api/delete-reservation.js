const { getClient } = require('./_utils/db');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(455).json({ error: "Méthode non autorisée. Utilisez POST ou DELETE." });
  }

  // 1. Authentification Admin
  const authResult = await verifyAdmin(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: authResult.error });
  }

  const { id } = req.body || req.query || {};

  if (!id) {
    return res.status(400).json({ error: "L'identifiant de la réservation (id) est obligatoire." });
  }

  try {
    const supabase = getClient(true);

    // Soft delete : On met à jour deleted_at
    const { error } = await supabase
      .from('reservations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }

    console.log(`[Booking Soft Deleted] ID: ${id}`);
    return res.status(200).json({ success: true, message: "La réservation a été archivée avec succès." });

  } catch (error) {
    console.error("[Delete Reservation Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la suppression de la réservation." });
  }
};
