const { getClient } = require('./_utils/db');

module.exports = async (req, res) => {
  // CORS Headers
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

  try {
    const supabase = getClient(false); // Lecture publique, RLS autorise SELECT

    const [
      settingsRes,
      hoursRes,
      categoriesRes,
      itemsRes,
      galleryRes,
      reviewsRes,
      linksRes,
      actualitesRes
    ] = await Promise.all([
      supabase.from('site_settings').select('*'),
      supabase.from('opening_hours').select('*').order('display_order', { ascending: true }),
      supabase.from('menu_categories').select('*').eq('is_visible', true).order('display_order', { ascending: true }),
      supabase.from('menu_items').select('*').eq('is_visible', true).order('display_order', { ascending: true }),
      supabase.from('gallery_images').select('*').eq('is_visible', true).order('display_order', { ascending: true }),
      supabase.from('reviews').select('*').eq('is_visible', true).order('display_order', { ascending: true }),
      supabase.from('external_links').select('*').eq('is_visible', true).order('display_order', { ascending: true }),
      supabase.from('actualites').select('*').eq('publie', true).order('created_at', { ascending: false })
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (hoursRes.error) throw hoursRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (galleryRes.error) throw galleryRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (linksRes.error) throw linksRes.error;
    if (actualitesRes.error) throw actualitesRes.error;

    // Convertir les paramètres sous forme de clé: valeur
    const settings = {};
    settingsRes.data.forEach(item => {
      settings[item.key] = item.value;
    });

    return res.status(200).json({
      success: true,
      settings,
      opening_hours: hoursRes.data,
      menu_categories: categoriesRes.data,
      menu_items: itemsRes.data,
      gallery_images: galleryRes.data,
      reviews: reviewsRes.data,
      external_links: linksRes.data,
      actualites: actualitesRes.data,
      supabase_url: process.env.SUPABASE_URL || "",
      supabase_anon_key: process.env.SUPABASE_ANON_KEY || ""
    });

  } catch (error) {
    console.error("[Get Site Content Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la récupération des contenus du site." });
  }
};
