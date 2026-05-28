-- ============================================================================
-- SQL SETUP FOR LES TABLES DE LA FONTAINE
-- ============================================================================

-- Active l'extension UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TABLE reservations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    guests INTEGER NOT NULL,
    reservation_type TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, refused, cancelled, completed, no_show
    admin_note TEXT,
    source TEXT DEFAULT 'website', -- website, admin
    customer_notification_sent BOOLEAN DEFAULT false,
    restaurant_notification_sent BOOLEAN DEFAULT false,
    customer_whatsapp_sent BOOLEAN DEFAULT false,
    restaurant_whatsapp_sent BOOLEAN DEFAULT false,
    consent_rgpd BOOLEAN DEFAULT false NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index pour la performance des requêtes d'administration
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_deleted_at ON public.reservations(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. TABLE site_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 3. TABLE opening_hours
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opening_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_label TEXT NOT NULL, -- Lundi, Mardi...
    lunch_open TIME,
    lunch_close TIME,
    dinner_open TIME,
    dinner_close TIME,
    is_closed BOOLEAN DEFAULT false,
    special_note TEXT,
    display_order INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 4. TABLE menu_categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    section TEXT NOT NULL DEFAULT 'food', -- food, drinks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 5. TABLE menu_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    allergens TEXT,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 6. TABLE gallery_images
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    alt_text TEXT,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    category TEXT DEFAULT 'autre', -- terrasse, cocktails, plats, salle, bar, ambiance, extérieur, autre
    display_order INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 7. TABLE reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Google',
    source_url TEXT,
    review_date DATE,
    is_visible BOOLEAN DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 8. TABLE external_links
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.external_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- TRIGGERS POUR LA COLONNE updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reservations_modtime BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_site_settings_modtime BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_opening_hours_modtime BEFORE UPDATE ON public.opening_hours FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_menu_categories_modtime BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_menu_items_modtime BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_gallery_images_modtime BEFORE UPDATE ON public.gallery_images FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_reviews_modtime BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_external_links_modtime BEFORE UPDATE ON public.external_links FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ============================================================================
-- CONFIGURATION ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;

-- 1. Politiques pour reservations
CREATE POLICY "Public insert reservations" ON public.reservations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin full access reservations" ON public.reservations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Politiques pour site_settings
CREATE POLICY "Public read site_settings" ON public.site_settings
    FOR SELECT USING (true);

CREATE POLICY "Admin full access site_settings" ON public.site_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Politiques pour opening_hours
CREATE POLICY "Public read opening_hours" ON public.opening_hours
    FOR SELECT USING (true);

CREATE POLICY "Admin full access opening_hours" ON public.opening_hours
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Politiques pour menu_categories
CREATE POLICY "Public read menu_categories" ON public.menu_categories
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admin full access menu_categories" ON public.menu_categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Politiques pour menu_items
CREATE POLICY "Public read menu_items" ON public.menu_items
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admin full access menu_items" ON public.menu_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Politiques pour gallery_images
CREATE POLICY "Public read gallery_images" ON public.gallery_images
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admin full access gallery_images" ON public.gallery_images
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Politiques pour reviews
CREATE POLICY "Public read reviews" ON public.reviews
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admin full access reviews" ON public.reviews
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Politiques pour external_links
CREATE POLICY "Public read external_links" ON public.external_links
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admin full access external_links" ON public.external_links
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- INSERTIONS DE DONNÉES PAR DÉFAUT (Pour éviter d'avoir un site vide au démarrage)
-- ============================================================================

-- Paramètres généraux
INSERT INTO public.site_settings (key, value) VALUES
('restaurant_name', '"Les Tables de la Fontaine"'),
('phone', '"06 35 34 59 67"'),
('address', '"540 chemin de Bimbo, 40600 Biscarrosse"'),
('instagram_url', '"https://www.instagram.com/lestablesdelafontaine40"'),
('google_maps_url', '"https://share.google/PISvZEtCB66CvocP8"'),
('hero_title', '"Les Tables de la Fontaine"'),
('hero_subtitle', '"Restaurant & Bar à Cocktails"'),
('hero_text', '"Restaurant de cuisine française conviviale et bar à cocktails niché dans un cadre calme, boisé et naturel à Biscarrosse."'),
('reservation_message', '"Envoyez votre demande de réservation en quelques secondes. L’équipe vous recontactera pour confirmer votre table."'),
('seo_title', '"Les Tables de la Fontaine | Restaurant & Bar à Biscarrosse"'),
('seo_description', '"Bienvenue aux Tables de la Fontaine à Biscarrosse. Cuisine conviviale, bar à cocktails et belle terrasse ombragée sous les pins."'),
('google_review_url', '"https://share.google/PISvZEtCB66CvocP8"'),
('google_write_review_url', '"https://share.google/PISvZEtCB66CvocP8"'),
('restaurant_email', '"lestablesdelafontaine40@gmail.com"'),
('restaurant_whatsapp_number', '"+33635345967"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Horaires d'ouverture par défaut
INSERT INTO public.opening_hours (day_label, lunch_open, lunch_close, dinner_open, dinner_close, is_closed, display_order) VALUES
('Lundi', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 1),
('Mardi', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 2),
('Mercredi', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 3),
('Jeudi', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 4),
('Vendredi', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 5),
('Samedi', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 6),
('Dimanche', '10:00:00', '14:00:00', '17:30:00', '22:00:00', false, 7);
