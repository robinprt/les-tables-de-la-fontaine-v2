const { getClient } = require('./_utils/db');
const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  // Configurer CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Vérification d'autorisation Admin
  const authResult = await verifyAdmin(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: authResult.error });
  }

  const { date, status, type, search, include_deleted } = req.query || {};

  try {
    const supabase = getClient(true);
    let query = supabase.from('reservations').select('*');

    // Par défaut, masquer les réservations archivées/supprimées
    if (include_deleted !== 'true') {
      query = query.is('deleted_at', null);
    }

    // Filtres optionnels
    if (date) {
      query = query.eq('reservation_date', date);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('reservation_type', type);
    }

    // Recherche par mot clé
    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query = query.or(`first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    // Tri par date et heure croissants
    query = query.order('reservation_date', { ascending: true })
                 .order('reservation_time', { ascending: true });

    const { data: reservations, error } = await query;
    if (error) {
      throw error;
    }

    return res.status(200).json({ success: true, reservations });

  } catch (error) {
    console.error("[Get Reservations Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la récupération des réservations." });
  }
};
