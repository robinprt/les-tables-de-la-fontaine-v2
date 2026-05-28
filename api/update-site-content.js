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

  const { action, data, subaction } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: "L'action est obligatoire." });
  }

  try {
    const supabase = getClient(true); // Utilisation du rôle de service pour contourner la RLS

    switch (action) {
      // ----------------------------------------------------
      // ACTION: Mise à jour des paramètres du site
      // ----------------------------------------------------
      case 'update_settings': {
        if (!data || typeof data !== 'object') {
          return res.status(400).json({ error: "Les données 'data' doivent être un objet clé-valeur." });
        }

        const upsertPromises = Object.entries(data).map(([key, val]) => {
          return supabase
            .from('site_settings')
            .upsert(
              { key, value: val, updated_at: new Date().toISOString() },
              { onConflict: 'key' }
            );
        });

        const results = await Promise.all(upsertPromises);
        const firstError = results.find(r => r.error);
        if (firstError) {
          throw firstError.error;
        }

        return res.status(200).json({ success: true, message: "Paramètres mis à jour avec succès." });
      }

      // ----------------------------------------------------
      // ACTION: Mise à jour des horaires
      // ----------------------------------------------------
      case 'update_hours': {
        if (!Array.isArray(data)) {
          return res.status(400).json({ error: "Les données 'data' doivent être un tableau d'horaires." });
        }

        const upsertPromises = data.map(item => {
          const row = {
            day_label: item.day_label,
            lunch_open: item.lunch_open || null,
            lunch_close: item.lunch_close || null,
            dinner_open: item.dinner_open || null,
            dinner_close: item.dinner_close || null,
            is_closed: !!item.is_closed,
            special_note: item.special_note || null,
            display_order: parseInt(item.display_order, 10),
            updated_at: new Date().toISOString()
          };
          if (item.id) {
            row.id = item.id;
          }
          return supabase.from('opening_hours').upsert(row);
        });

        const results = await Promise.all(upsertPromises);
        const firstError = results.find(r => r.error);
        if (firstError) {
          throw firstError.error;
        }

        return res.status(200).json({ success: true, message: "Horaires mis à jour avec succès." });
      }

      // ----------------------------------------------------
      // ACTION: Gestion des catégories de la carte
      // ----------------------------------------------------
      case 'manage_categories': {
        if (subaction === 'delete') {
          if (!data || !data.id) {
            return res.status(400).json({ error: "ID de la catégorie manquant." });
          }
          const { error } = await supabase.from('menu_categories').delete().eq('id', data.id);
          if (error) throw error;
          return res.status(200).json({ success: true, message: "Catégorie supprimée avec succès." });
        }

        // Upsert (Ajout/Modification)
        if (!data || !data.name) {
          return res.status(400).json({ error: "Le nom de la catégorie est obligatoire." });
        }

        const row = {
          name: data.name.trim(),
          description: data.description ? data.description.trim() : null,
          display_order: parseInt(data.display_order || 0, 10),
          is_visible: data.is_visible !== false,
          section: data.section || 'food',
          updated_at: new Date().toISOString()
        };
        if (data.id) {
          row.id = data.id;
        }

        const { error } = await supabase.from('menu_categories').upsert(row);
        if (error) throw error;

        return res.status(200).json({ success: true, message: "Catégorie enregistrée avec succès." });
      }

      // ----------------------------------------------------
      // ACTION: Gestion des plats et boissons
      // ----------------------------------------------------
      case 'manage_menu': {
        if (subaction === 'delete') {
          if (!data || !data.id) {
            return res.status(400).json({ error: "ID du plat manquant." });
          }
          const { error } = await supabase.from('menu_items').delete().eq('id', data.id);
          if (error) throw error;
          return res.status(200).json({ success: true, message: "Plat supprimé avec succès." });
        }

        // Upsert
        if (!data || !data.name || !data.category_id || data.price === undefined) {
          return res.status(400).json({ error: "Champs obligatoires manquants (nom, catégorie, prix)." });
        }

        const row = {
          category_id: data.category_id,
          name: data.name.trim(),
          description: data.description ? data.description.trim() : null,
          price: parseFloat(data.price),
          is_visible: data.is_visible !== false,
          is_featured: !!data.is_featured,
          allergens: data.allergens ? data.allergens.trim() : null,
          display_order: parseInt(data.display_order || 0, 10),
          updated_at: new Date().toISOString()
        };
        if (data.id) {
          row.id = data.id;
        }

        const { error } = await supabase.from('menu_items').upsert(row);
        if (error) throw error;

        return res.status(200).json({ success: true, message: "Plat enregistré avec succès." });
      }

      // ----------------------------------------------------
      // ACTION: Gestion des avis
      // ----------------------------------------------------
      case 'manage_reviews': {
        if (subaction === 'delete') {
          if (!data || !data.id) {
            return res.status(400).json({ error: "ID de l'avis manquant." });
          }
          const { error } = await supabase.from('reviews').delete().eq('id', data.id);
          if (error) throw error;
          return res.status(200).json({ success: true, message: "Avis supprimé avec succès." });
        }

        // Upsert
        if (!data || !data.author_name || !data.rating || !data.review_text) {
          return res.status(400).json({ error: "Champs obligatoires manquants (auteur, note, commentaire)." });
        }

        const rating = parseInt(data.rating, 10);
        if (isNaN(rating) || rating < 1 || rating > 5) {
          return res.status(400).json({ error: "La note doit être comprise entre 1 et 5." });
        }

        const row = {
          author_name: data.author_name.trim(),
          rating,
          review_text: data.review_text.trim(),
          source: data.source || 'Google',
          source_url: data.source_url ? data.source_url.trim() : null,
          review_date: data.review_date || null,
          is_visible: data.is_visible !== false,
          display_order: parseInt(data.display_order || 0, 10),
          updated_at: new Date().toISOString()
        };
        if (data.id) {
          row.id = data.id;
        }

        const { error } = await supabase.from('reviews').upsert(row);
        if (error) throw error;

        return res.status(200).json({ success: true, message: "Avis enregistré avec succès." });
      }

      // ----------------------------------------------------
      // ACTION: Gestion des liens externes
      // ----------------------------------------------------
      case 'manage_links': {
        if (subaction === 'delete') {
          if (!data || !data.id) {
            return res.status(400).json({ error: "ID du lien manquant." });
          }
          const { error } = await supabase.from('external_links').delete().eq('id', data.id);
          if (error) throw error;
          return res.status(200).json({ success: true, message: "Lien supprimé avec succès." });
        }

        // Upsert
        if (!data || !data.platform_name || !data.url) {
          return res.status(400).json({ error: "Champs obligatoires manquants (plateforme, URL)." });
        }

        const row = {
          platform_name: data.platform_name.trim(),
          description: data.description ? data.description.trim() : null,
          url: data.url.trim(),
          is_visible: data.is_visible !== false,
          display_order: parseInt(data.display_order || 0, 10),
          updated_at: new Date().toISOString()
        };
        if (data.id) {
          row.id = data.id;
        }

        const { error } = await supabase.from('external_links').upsert(row);
        if (error) throw error;

        return res.status(200).json({ success: true, message: "Lien enregistré avec succès." });
      }

      // ----------------------------------------------------
      // ACTION: Gestion des actualités
      // ----------------------------------------------------
      case 'manage_actualites': {
        if (subaction === 'delete') {
          if (!data || !data.id) {
            return res.status(400).json({ error: "ID de l'actualité manquant." });
          }
          const { error } = await supabase.from('actualites').delete().eq('id', data.id);
          if (error) throw error;
          return res.status(200).json({ success: true, message: "Actualité supprimée." });
        }

        if (!data || !data.titre || !data.contenu) {
          return res.status(400).json({ error: "Champs obligatoires manquants (titre, contenu)." });
        }

        const row = {
          titre: data.titre.trim(),
          sous_titre: data.sous_titre ? data.sous_titre.trim() : null,
          contenu: data.contenu.trim(),
          photo_url: data.photo_url ? data.photo_url.trim() : null,
          publie: data.publie !== false,
          updated_at: new Date().toISOString()
        };
        if (data.id) row.id = data.id;

        const { error } = await supabase.from('actualites').upsert(row);
        if (error) throw error;

        return res.status(200).json({ success: true, message: "Actualité enregistrée." });
      }

      default:
        return res.status(400).json({ error: `Action '${action}' non reconnue.` });
    }

  } catch (error) {
    console.error("[Update Site Content Exception]", error);
    return res.status(500).json({ error: "Une erreur est survenue lors de la mise à jour des contenus." });
  }
};
