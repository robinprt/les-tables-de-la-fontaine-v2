-- Migration : création de la table actualites
-- À exécuter une seule fois dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS actualites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titre      text NOT NULL,
  sous_titre text,
  contenu    text NOT NULL,
  photo_url  text,
  publie     boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lecture publique (API publique get-site-content)
ALTER TABLE actualites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des actualités publiées"
  ON actualites FOR SELECT
  USING (publie = true);

-- Écriture réservée au service role (API admin update-site-content)
-- Le service role bypasse la RLS — aucune policy supplémentaire nécessaire.
