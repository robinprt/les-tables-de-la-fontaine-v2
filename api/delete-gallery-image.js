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
    return res.status(400).json({ error: "L'identifiant de l'image (id) est obligatoire." });
  }

  try {
    const supabase = getClient(true);

    // 2. Récupérer l'enregistrement pour obtenir le storage_path
    const { data: imageRecord, error: fetchError } = await supabase
      .from('gallery_images')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !imageRecord) {
      return res.status(404).json({ error: "Image introuvable." });
    }

    // 3. Supprimer de la base de données
    const { error: dbError } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw dbError;
    }

    // 4. Supprimer le fichier du Supabase Storage
    if (imageRecord.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('gallery')
        .remove([imageRecord.storage_path]);

      if (storageError) {
        console.error("[Storage Warning] Impossible de supprimer le fichier physique:", storageError);
      }
    }

    console.log(`[Gallery Image Deleted] ID: ${id}`);
    return res.status(200).json({ success: true, message: "L'image a été supprimée de la galerie." });

  } catch (error) {
    console.error("[Delete Gallery Image Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la suppression de l'image." });
  }
};
