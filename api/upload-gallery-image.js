const { getClient } = require('./_utils/db');
const { verifyAdmin } = require('./_utils/auth');

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

  const {
    image, // base64 data-URL (ex: data:image/png;base64,iVBOR...)
    filename,
    title,
    alt_text,
    category,
    display_order
  } = req.body || {};

  if (!image) {
    return res.status(400).json({ error: "Le contenu de l'image (base64) est manquant." });
  }
  if (!filename) {
    return res.status(400).json({ error: "Le nom du fichier (filename) est obligatoire." });
  }

  try {
    // 2. Validation du format et décodage
    const mimeMatch = image.match(/^data:(image\/[a-zA-Z-+.]+);base64,/);
    if (!mimeMatch) {
      return res.status(400).json({ error: "Format d'image invalide. Doit être une Data URL base64." });
    }

    const contentType = mimeMatch[1];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      return res.status(400).json({ error: "Format non supporté. Seuls JPG, JPEG, PNG et WEBP sont acceptés." });
    }

    const base64Data = image.replace(/^data:image\/[a-zA-Z-+.]+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // Limite de taille : 5 Mo
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "L'image dépasse le poids limite autorisé de 5 Mo." });
    }

    const supabase = getClient(true);

    // 3. Création du bucket si absent (auto-healing)
    try {
      await supabase.storage.createBucket('gallery', { public: true });
    } catch (e) {
      // Ignorer l'erreur si le bucket existe déjà
    }

    // 4. Générer un nom de fichier unique pour éviter les collisions
    const fileExt = filename.split('.').pop();
    const cleanFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storagePath = `gallery/${cleanFilename}`;

    // 5. Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(storagePath, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 6. Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('gallery')
      .getPublicUrl(storagePath);

    // 7. Enregistrer en base dans gallery_images
    const { data: galleryRecord, error: dbError } = await supabase
      .from('gallery_images')
      .insert({
        title: title ? title.trim() : null,
        alt_text: alt_text ? alt_text.trim() : (title ? title.trim() : "Photo restaurant Les Tables de la Fontaine"),
        image_url: publicUrl,
        storage_path: storagePath,
        category: category || 'autre',
        display_order: parseInt(display_order || 0, 10),
        is_visible: true
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    console.log(`[Gallery Image Uploaded] ID: ${galleryRecord.id}, URL: ${publicUrl}`);
    return res.status(200).json({
      success: true,
      message: "L'image a été mise en ligne et ajoutée à la galerie.",
      image: galleryRecord
    });

  } catch (error) {
    console.error("[Upload Gallery Image Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors du téléversement de l'image." });
  }
};
