/**
 * ========================================================================
 * LES TABLES DE LA FONTAINE - LOGIQUE JAVASCRIPT (VANILLA JS)
 * ========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================
       1. EN-TETE DYNAMIQUE AU SCROLL (STICKY & BLUR)
       ========================================== */
    const header = document.getElementById('header');
    const scrollThreshold = 50;

    const handleHeaderScroll = () => {
        if (header && window.scrollY > scrollThreshold) {
            header.classList.add('scrolled');
        } else if (header) {
            header.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', handleHeaderScroll);
    handleHeaderScroll(); // Vérification initiale au chargement


    /* ==========================================
       2. HIGHLIGHT DU MENU DE NAVIGATION ACTIF
       ========================================== */
    const highlightActiveMenu = () => {
        // Récupère le nom de fichier de la page actuelle (ex: carte.html)
        const path = window.location.pathname;
        const page = path.split("/").pop();
        
        const navLinks = document.querySelectorAll('.nav-menu a, .mobile-nav-menu a');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            
            // Réinitialise la classe active
            link.classList.remove('active');
            
            if (!href) return;
            
            // Si on est sur l'index ou la racine
            if (page === '' || page === 'index.html') {
                if (href === 'index.html' || href === './' || href === '#accueil') {
                    link.classList.add('active');
                }
            } else {
                // Si l'attribut href correspond exactement au nom de la page
                if (href === page) {
                    link.classList.add('active');
                }
            }
        });
    };
    
    highlightActiveMenu();


    /* ==========================================
       3. MENU BURGER MOBILE & NAVIGATION ACCESSIBLE
       ========================================== */
    const burgerToggle = document.getElementById('burgerToggle');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    const toggleMobileMenu = () => {
        const isOpen = burgerToggle.classList.contains('active');
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    };

    const openMobileMenu = () => {
        burgerToggle.classList.add('active');
        burgerToggle.setAttribute('aria-expanded', 'true');
        mobileNavOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Bloque le défilement de l'arrière-plan
    };

    const closeMobileMenu = () => {
        burgerToggle.classList.remove('active');
        burgerToggle.setAttribute('aria-expanded', 'false');
        mobileNavOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Rétablit le défilement
    };

    if (burgerToggle && mobileNavOverlay) {
        burgerToggle.addEventListener('click', toggleMobileMenu);
    }

    // Fermeture du menu lors du clic sur un lien
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeMobileMenu();
        });
    });

    // Fermeture du menu si la fenêtre est redimensionnée en mode bureau
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && burgerToggle && burgerToggle.classList.contains('active')) {
            closeMobileMenu();
        }
    });


    /* ==========================================
       4. DEFILEMENT FLUIDE ET CORRECTIF DE DECALAGE (OFFSET)
       ========================================== */
    const allLinks = document.querySelectorAll('a[href^="#"]');
    
    allLinks.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // On ignore les ancres vides
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                e.preventDefault();
                
                const headerOffset = 80; // Correspond à la hauteur du header
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });


    /* ==========================================
       5. CAROUSEL D'AVIS CLIENTS (SLIDER VANILLA - ENCAPSULE)
       ========================================== */
    let autoPlayInterval;
    const initCarousel = () => {
        const slides = document.querySelectorAll('.carousel-slide');
        const dotsContainer = document.getElementById('carouselDots');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');

        if (slides.length === 0 || !dotsContainer || !prevBtn || !nextBtn) return;

        // Vider les dots précédents pour éviter les doublons au rafraîchissement
        dotsContainer.innerHTML = '';
        clearInterval(autoPlayInterval);

        let currentSlide = 0;
        const autoPlayDelay = 6000;

        // Création des indicateurs (dots)
        slides.forEach((_, idx) => {
            const dot = document.createElement('button');
            dot.classList.add('carousel-dot');
            if (idx === 0) dot.classList.add('active');
            dot.setAttribute('aria-label', `Voir l'avis numéro ${idx + 1}`);
            dot.addEventListener('click', () => {
                goToSlide(idx);
                resetAutoplay();
            });
            dotsContainer.appendChild(dot);
        });

        const dots = document.querySelectorAll('.carousel-dot');

        const updateCarouselUI = () => {
            slides.forEach((slide, idx) => {
                if (idx === currentSlide) {
                    slide.classList.add('active');
                    if (dots[idx]) dots[idx].classList.add('active');
                } else {
                    slide.classList.remove('active');
                    if (dots[idx]) dots[idx].classList.remove('active');
                }
            });
        };

        const nextSlide = () => {
            currentSlide = (currentSlide + 1) % slides.length;
            updateCarouselUI();
        };

        const prevSlide = () => {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            updateCarouselUI();
        };

        const goToSlide = (idx) => {
            currentSlide = idx;
            updateCarouselUI();
        };

        // Listeners boutons (supprimer et ré-attacher pour éviter doublons)
        const newNextBtn = nextBtn.cloneNode(true);
        const newPrevBtn = prevBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);

        newNextBtn.addEventListener('click', () => {
            nextSlide();
            resetAutoplay();
        });

        newPrevBtn.addEventListener('click', () => {
            prevSlide();
            resetAutoplay();
        });

        // Autoplay logic
        const startAutoplay = () => {
            autoPlayInterval = setInterval(nextSlide, autoPlayDelay);
        };

        const stopAutoplay = () => {
            clearInterval(autoPlayInterval);
        };

        const resetAutoplay = () => {
            stopAutoplay();
            startAutoplay();
        };

        startAutoplay();

        const carouselWrapper = document.querySelector('.carousel-wrapper');
        if (carouselWrapper && window.matchMedia('(hover: hover)').matches) {
            carouselWrapper.removeEventListener('mouseenter', stopAutoplay);
            carouselWrapper.removeEventListener('mouseleave', startAutoplay);
            carouselWrapper.addEventListener('mouseenter', stopAutoplay);
            carouselWrapper.addEventListener('mouseleave', startAutoplay);
        }
    };

    // Initialisation initiale du carrousel statique
    initCarousel();


    /* ==========================================
       6. GALERIE PHOTO (LIGHTBOX DIALOG ACCESSIBLE - ENCAPSULE)
       ========================================== */
    const initLightbox = () => {
        const galleryItems = document.querySelectorAll('.gallery-item');
        const lightboxDialog = document.getElementById('lightboxDialog');

        if (galleryItems.length === 0 || !lightboxDialog) return;

        // Cloner le dialogue en premier pour purger les anciens listeners
        const dialog = lightboxDialog.cloneNode(true);
        lightboxDialog.parentNode.replaceChild(dialog, lightboxDialog);

        // Résoudre les éléments depuis le nouveau dialogue
        const lightboxImage = dialog.querySelector('#lightboxImage');
        const lightboxCaption = dialog.querySelector('#lightboxCaption');

        const closeFn = () => {
            dialog.close();
            if (lightboxImage) lightboxImage.setAttribute('src', '');
        };

        // Fermeture via backdrop
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) closeFn();
        });

        // Fermeture via bouton
        const closeBtn = dialog.querySelector('#closeLightbox');
        if (closeBtn) closeBtn.addEventListener('click', closeFn);

        // Fermeture via Échap (natif au dialog, mais on reset l'image)
        dialog.addEventListener('close', () => {
            if (lightboxImage) lightboxImage.setAttribute('src', '');
        });

        galleryItems.forEach(item => {
            const openLightbox = () => {
                const fullSrc = item.getAttribute('data-src');
                const img = item.querySelector('img');
                const altText = img ? img.getAttribute('alt') : 'Photo';
                const captionText = item.getAttribute('aria-label')
                    ? item.getAttribute('aria-label').replace("Agrandir l'image : ", '')
                    : '';

                if (lightboxImage) {
                    lightboxImage.setAttribute('src', fullSrc);
                    lightboxImage.setAttribute('alt', altText);
                }
                if (lightboxCaption) lightboxCaption.textContent = captionText;

                dialog.showModal();
            };

            // Cloner pour éviter les écouteurs dupliqués
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', openLightbox);
            newItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') openLightbox();
            });
        });
    };

    // Initialisation initiale de la lightbox
    initLightbox();


    /* ==========================================
       7. FORMULAIRE DE RESERVATION DIRECTE (API CONNECTED)
       ========================================== */
    const bookingForm = document.getElementById('bookingForm');
    const bookingFeedback = document.getElementById('bookingFeedback');
    const smsDirectBtn = document.getElementById('smsDirectBtn');

    if (bookingForm && bookingFeedback) {
        const SMS_NUMBER = "0635345967";

        const showFeedback = (text, type) => {
            bookingFeedback.textContent = text;
            bookingFeedback.className = `booking-feedback ${type}`;
            bookingFeedback.classList.remove('hidden');
            bookingFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };

        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const lastName = document.getElementById('bookingLastName').value.trim();
            const firstName = document.getElementById('bookingFirstName').value.trim();
            const phone = document.getElementById('bookingPhone').value.trim();
            const email = document.getElementById('bookingEmail').value.trim();
            const dateVal = document.getElementById('bookingDate').value;
            const timeVal = document.getElementById('bookingTime').value;
            const guests = document.getElementById('bookingGuests').value;
            const type = document.getElementById('bookingType').value;
            const message = document.getElementById('bookingMessage').value.trim();
            const gdprChecked = document.getElementById('bookingGdpr').checked;
            
            // Honeypot
            const honeypot = document.getElementById('bookingHoneypot').value;

            // Validation de base
            if (!lastName || !firstName || !phone || !email || !dateVal || !timeVal || !guests || !type) {
                showFeedback("Veuillez remplir tous les champs obligatoires (*).", "error");
                return;
            }

            if (!gdprChecked) {
                showFeedback("Vous devez accepter l'utilisation de vos données pour soumettre la demande.", "error");
                return;
            }

            // Bouton de soumission
            const submitBtn = document.getElementById('submitBooking');
            const originalBtnText = submitBtn.textContent;
            submitBtn.setAttribute('disabled', 'true');
            submitBtn.textContent = "Envoi de votre demande...";

            try {
                const response = await fetch('/api/create-reservation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        phone,
                        email,
                        reservation_date: dateVal,
                        reservation_time: timeVal,
                        guests,
                        reservation_type: type,
                        message,
                        consent_rgpd: gdprChecked,
                        honeypot
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showFeedback("Merci, votre demande de réservation a bien été envoyée. L’équipe des Tables de la Fontaine vous confirmera votre table rapidement.", "success");
                    bookingForm.reset();
                } else {
                    showFeedback(data.error || "Une erreur est survenue lors de l'envoi. Veuillez réessayer.", "error");
                }
            } catch (error) {
                console.error("Booking submit error:", error);
                showFeedback("Impossible de joindre le serveur de réservation. Veuillez réserver directement par téléphone ou SMS.", "error");
            } finally {
                submitBtn.removeAttribute('disabled');
                submitBtn.textContent = originalBtnText;
            }
        });

        // Bouton SMS Direct
        if (smsDirectBtn) {
            smsDirectBtn.addEventListener('click', () => {
                const lastName = document.getElementById('bookingLastName').value.trim();
                const firstName = document.getElementById('bookingFirstName').value.trim();
                const guests = document.getElementById('bookingGuests').value;
                const dateVal = document.getElementById('bookingDate').value;
                const timeVal = document.getElementById('bookingTime').value;

                let dateFormatted = dateVal;
                if (dateVal) {
                    const d = dateVal.split('-');
                    if (d.length === 3) dateFormatted = `${d[2]}/${d[1]}/${d[0]}`;
                }

                let messageText = "Bonjour Les Tables de la Fontaine, je souhaite réserver une table.";
                if (lastName && firstName && guests && dateFormatted && timeVal) {
                    messageText = `Bonjour Les Tables de la Fontaine, je souhaite réserver une table pour ${guests === 'more' ? 'plus de 8' : guests} personnes le ${dateFormatted} à ${timeVal}. (${firstName} ${lastName})`;
                } else {
                    messageText = "Bonjour Les Tables de la Fontaine, je souhaite réserver une table pour [nombre] personnes le [date] à [heure]. Merci.";
                }

                const encodedSms = encodeURIComponent(messageText);
                const ua = navigator.userAgent.toLowerCase();
                const separator = (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) ? '&' : '?';
                window.location.href = `sms:${SMS_NUMBER}${separator}body=${encodedSms}`;
            });
        }

        // Fixer la date minimale
        const dateInput = document.getElementById('bookingDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('min', today);
        }
    }


    /* ==========================================
       8. DYNAMISATION DES CONTENUS DEPUIS LA BASE DE DONNEES (SUPABASE)
       ========================================== */
    const loadDynamicSiteContent = async () => {
        try {
            const response = await fetch('/api/get-site-content');
            const data = await response.json();

            if (!data.success) {
                console.warn("[Content Warning] Failed to fetch database contents. Using HTML static fallbacks.");
                return;
            }

            const { settings, opening_hours, menu_categories, menu_items, gallery_images, reviews, external_links } = data;

            // 1. Appliquer les textes et coordonnées généraux
            if (settings) {
                applyGlobalSettings(settings);
            }

            // 2. Appliquer les horaires
            if (opening_hours && opening_hours.length > 0) {
                applyOpeningHours(opening_hours);
            }

            // 3. Appliquer les avis dans le carrousel
            if (reviews && reviews.length > 0) {
                applyReviews(reviews);
            }

            // 4. Appliquer les liens externes de plateformes
            if (external_links) {
                applyExternalLinks(external_links);
            }

            // 5. Appliquer la carte dynamique
            if (menu_categories && menu_items) {
                applyMenu(menu_categories, menu_items);
            }

            // 6. Appliquer la galerie dynamique
            if (gallery_images && gallery_images.length > 0) {
                applyGallery(gallery_images);
            }

        } catch (error) {
            console.error("[Content Error] Failed to load dynamic database content:", error);
        }
    };

    // Helper: Applique les coordonnées de contact générales sur l'ensemble du site
    const applyGlobalSettings = (settings) => {
        const cleanVal = (val) => {
            if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
                try { return JSON.parse(val); } catch(e) {}
            }
            return val;
        };

        const phone = cleanVal(settings.phone);
        const email = cleanVal(settings.restaurant_email);
        const address = cleanVal(settings.address);
        const instagram = cleanVal(settings.instagram_url);
        const googleMaps = cleanVal(settings.google_maps_url);

        // Mettre à jour les liens téléphoniques
        if (phone) {
            document.querySelectorAll('a[href^="tel:"]').forEach(a => {
                a.href = `tel:${phone.replace(/\s/g, '')}`;
                const textSpan = a.querySelector('.desktop-text');
                if (textSpan) {
                    textSpan.textContent = phone;
                } else if (a.childNodes.length > 1) {
                    // Pour les boutons avec svg + texte
                    const textNode = Array.from(a.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
                    if (textNode) textNode.textContent = ` ${phone}`;
                } else {
                    a.textContent = phone;
                }
            });
        }

        // Mettre à jour les adresses physiques
        if (address) {
            document.querySelectorAll('.footer-col.info-col p, .mobile-address-item, .detail-item h4 + p').forEach(p => {
                if (p.textContent.includes('chemin de Bimbo') || p.className === 'mobile-address-item') {
                    p.innerHTML = address.replace(', 40600', '<br>40600');
                }
            });
        }

        // Mettre à jour l'e-mail du restaurant dans les mentions
        if (email) {
            document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
                if (a.href.includes('lestablesdelafontaine')) {
                    a.href = `mailto:${email}`;
                    a.textContent = email;
                }
            });
        }

        // Mettre à jour les liens Instagram
        if (instagram) {
            document.querySelectorAll('a[aria-label="Suivre sur Instagram"]').forEach(a => {
                a.href = instagram;
            });
            document.querySelectorAll('.footer-col.info-col a').forEach(a => {
                if (a.textContent.startsWith('@lestables')) {
                    a.href = instagram;
                    const handle = instagram.split('/').pop();
                    a.textContent = `@${handle}`;
                }
            });
        }

        // Mettre à jour les liens Google Maps
        if (googleMaps) {
            document.querySelectorAll('a[href*="maps"], a[aria-label*="Google Maps"]').forEach(a => {
                a.href = googleMaps;
            });
        }

        // Mettre à jour les textes spécifiques de la page d'accueil (titres de hero si présents)
        const heroTitle = document.getElementById('heroTitle');
        if (heroTitle && settings.hero_title) heroTitle.textContent = cleanVal(settings.hero_title);
        
        const heroSubtitle = document.getElementById('heroSubtitle');
        if (heroSubtitle && settings.hero_subtitle) heroSubtitle.textContent = cleanVal(settings.hero_subtitle);

        const heroText = document.getElementById('heroText');
        if (heroText && settings.hero_text) heroText.textContent = cleanVal(settings.hero_text);

        const resMsg = document.getElementById('reservationMessage');
        if (resMsg && settings.reservation_message) resMsg.textContent = cleanVal(settings.reservation_message);
    };

    // Helper: Injecte les horaires
    const applyOpeningHours = (hours) => {
        // 1. Mettre à jour le footer (toutes les pages)
        const footerHours = document.querySelector('.footer-col.hours-col');
        if (footerHours) {
            let html = `<h3>Horaires de service</h3>`;
            hours.forEach(day => {
                if (day.is_closed) {
                    html += `<p><strong>${day.day_label} :</strong> Fermé ${day.special_note ? `<span style="font-size:0.8rem; opacity:0.8;">(${day.special_note})</span>` : ''}</p>`;
                } else {
                    const lOpen = day.lunch_open ? day.lunch_open.substring(0, 5).replace(':', 'h') : '';
                    const lClose = day.lunch_close ? day.lunch_close.substring(0, 5).replace(':', 'h') : '';
                    const dOpen = day.dinner_open ? day.dinner_open.substring(0, 5).replace(':', 'h') : '';
                    const dClose = day.dinner_close ? day.dinner_close.substring(0, 5).replace(':', 'h') : '';
                    
                    let timeText = '';
                    if (lOpen && lClose && dOpen && dClose) {
                        timeText = `${lOpen} – ${lClose} / ${dOpen} – ${dClose}`;
                    } else if (lOpen && lClose) {
                        timeText = `${lOpen} – ${lClose} (midi)`;
                    } else if (dOpen && dClose) {
                        timeText = `${dOpen} – ${dClose} (soir)`;
                    } else {
                        timeText = 'Fermé';
                    }

                    html += `<p><strong>${day.day_label} :</strong> ${timeText} ${day.special_note ? `<span style="font-size:0.8rem; opacity:0.8;">(${day.special_note})</span>` : ''}</p>`;
                }
            });
            footerHours.innerHTML = html;
        }

        // 2. Mettre à jour la carte d'horaires sur la page contact
        document.querySelectorAll('.detail-item').forEach(item => {
            const h4 = item.querySelector('h4');
            if (h4 && (h4.textContent.includes('Horaires') || h4.textContent.includes('horaires'))) {
                const div = h4.nextElementSibling || h4.parentElement;
                // Supprimer les anciens paragraphes horaires
                div.querySelectorAll('p').forEach(p => p.remove());
                
                hours.forEach(day => {
                    const p = document.createElement('p');
                    p.style.fontSize = '0.9rem';
                    p.style.margin = '3px 0';
                    
                    if (day.is_closed) {
                        p.innerHTML = `<strong>${day.day_label} :</strong> Fermé ${day.special_note ? `<em>(${day.special_note})</em>` : ''}`;
                    } else {
                        const lOpen = day.lunch_open ? day.lunch_open.substring(0, 5).replace(':', 'h') : '';
                        const lClose = day.lunch_close ? day.lunch_close.substring(0, 5).replace(':', 'h') : '';
                        const dOpen = day.dinner_open ? day.dinner_open.substring(0, 5).replace(':', 'h') : '';
                        const dClose = day.dinner_close ? day.dinner_close.substring(0, 5).replace(':', 'h') : '';
                        
                        let service = '';
                        if (lOpen && lClose && dOpen && dClose) {
                            service = `${lOpen}–${lClose} &amp; ${dOpen}–${dClose}`;
                        } else if (lOpen && lClose) {
                            service = `${lOpen}–${lClose}`;
                        } else if (dOpen && dClose) {
                            service = `${dOpen}–${dClose}`;
                        }
                        
                        p.innerHTML = `<strong>${day.day_label} :</strong> ${service} ${day.special_note ? `<em>(${day.special_note})</em>` : ''}`;
                    }
                    div.appendChild(p);
                });
            }
        });
    };

    // Helper: Injecte les avis
    const applyReviews = (reviewsList) => {
        const carousel = document.getElementById('reviewsCarousel');
        if (carousel) {
            carousel.innerHTML = '';
            reviewsList.forEach((rev, idx) => {
                const letter = rev.author_name ? rev.author_name.charAt(0).toUpperCase() : 'G';
                const dateStr = rev.review_date ? new Date(rev.review_date).toLocaleDateString('fr-FR') : 'Récemment';
                
                const slide = document.createElement('div');
                slide.className = `carousel-slide ${idx === 0 ? 'active' : ''}`;
                slide.innerHTML = `
                    <div class="review-card">
                        <div class="review-header">
                            <div class="user-info">
                                <div class="user-avatar">${letter}</div>
                                <div>
                                    <h4 class="user-name">${rev.author_name}</h4>
                                    <span class="review-date">${dateStr}</span>
                                </div>
                            </div>
                            <div class="review-stars">${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</div>
                        </div>
                        <p class="review-text">« ${rev.review_text} »</p>
                        <span class="review-source">Source : ${rev.source}</span>
                    </div>
                `;
                carousel.appendChild(slide);
            });

            // Ré-initialiser le slider vanilla
            initCarousel();
        }
    };

    // Helper: Injecte les liens partenaires
    const applyExternalLinks = (links) => {
        const container = document.getElementById('externalLinksContainer');
        const list = document.getElementById('externalLinksList');
        
        if (container && list && links.length > 0) {
            list.innerHTML = '';
            links.forEach(l => {
                const a = document.createElement('a');
                a.href = l.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = 'btn btn-outline-dark';
                a.style.padding = '8px 14px';
                a.style.fontSize = '0.85rem';
                a.textContent = l.platform_name;
                list.appendChild(a);
            });
            container.style.display = 'block';
        }
    };

    // Helper: Injecte la carte des plats et boissons
    const applyMenu = (categories, items) => {
        // 1. Section Cuisine / Plats
        const foodGrid = document.querySelector('#cuisine .menu-grid-full');
        if (foodGrid) {
            foodGrid.innerHTML = '<div class="menu-column-left"></div><div class="menu-column-right"></div>';
            const leftCol = foodGrid.querySelector('.menu-column-left');
            const rightCol = foodGrid.querySelector('.menu-column-right');

            // Filtrer les catégories "food" (hors Desserts)
            const foodCategories = categories.filter(c => c.section === 'food' && !c.name.toLowerCase().includes('dessert'));
            
            foodCategories.forEach((cat, idx) => {
                const catItems = items.filter(item => item.category_id === cat.id);
                if (catItems.length === 0) return;

                let html = `<h3 class="menu-section-title" style="margin-top: 30px;">${cat.name}</h3>`;
                catItems.forEach(item => {
                    html += `
                        <div class="menu-item">
                            <div class="menu-item-row">
                                <span class="menu-item-name">${item.name}</span>
                                <span class="menu-item-dots"></span>
                                <span class="menu-item-price">${item.price.toFixed(2)} €</span>
                            </div>
                            ${item.description ? `<p class="menu-item-desc">${item.description}</p>` : ''}
                            ${item.allergens ? `<p class="menu-item-allergens" style="font-size:11px; opacity:0.7; margin-top:2px;">Allergènes : ${item.allergens}</p>` : ''}
                        </div>
                    `;
                });

                const col = idx % 2 === 0 ? leftCol : rightCol;
                col.innerHTML += html;
            });
        }

        // 2. Section Desserts
        const dessertsGrid = document.querySelector('.desserts-section-wrapper .menu-grid-full');
        if (dessertsGrid) {
            dessertsGrid.innerHTML = '<div class="menu-column-left"></div><div class="menu-column-right"></div>';
            const leftCol = dessertsGrid.querySelector('.menu-column-left');
            const rightCol = dessertsGrid.querySelector('.menu-column-right');

            const dessertCat = categories.find(c => c.section === 'food' && c.name.toLowerCase().includes('dessert'));
            if (dessertCat) {
                const dessertItems = items.filter(item => item.category_id === dessertCat.id);
                dessertItems.forEach((item, idx) => {
                    const html = `
                        <div class="menu-item">
                            <div class="menu-item-row">
                                <span class="menu-item-name">${item.name}</span>
                                <span class="menu-item-dots"></span>
                                <span class="menu-item-price">${item.price.toFixed(2)} €</span>
                            </div>
                            ${item.description ? `<p class="menu-item-desc">${item.description}</p>` : ''}
                            ${item.allergens ? `<p class="menu-item-allergens" style="font-size:11px; opacity:0.7; margin-top:2px;">Allergènes : ${item.allergens}</p>` : ''}
                        </div>
                    `;
                    const col = idx % 2 === 0 ? leftCol : rightCol;
                    col.innerHTML += html;
                });
            }
        }

        // 3. Section Bar / Cocktails / Boissons
        const drinkGrid = document.querySelector('#cocktails .menu-grid-full');
        if (drinkGrid) {
            drinkGrid.innerHTML = '<div class="menu-column-left"></div><div class="menu-column-right"></div>';
            const leftCol = drinkGrid.querySelector('.menu-column-left');
            const rightCol = drinkGrid.querySelector('.menu-column-right');

            // Filtrer les catégories "drinks"
            const drinkCategories = categories.filter(c => c.section === 'drinks');
            
            drinkCategories.forEach((cat, idx) => {
                const catItems = items.filter(item => item.category_id === cat.id);
                if (catItems.length === 0) return;

                let html = `<h3 class="menu-section-title" style="margin-top: 30px;">${cat.name}</h3>`;
                catItems.forEach(item => {
                    html += `
                        <div class="menu-item">
                            <div class="menu-item-row">
                                <span class="menu-item-name">${item.name}</span>
                                <span class="menu-item-dots"></span>
                                <span class="menu-item-price">${item.price.toFixed(2)} €</span>
                            </div>
                            ${item.description ? `<p class="menu-item-desc">${item.description}</p>` : ''}
                            ${item.allergens ? `<p class="menu-item-allergens" style="font-size:11px; opacity:0.7; margin-top:2px;">Allergènes : ${item.allergens}</p>` : ''}
                        </div>
                    `;
                });

                const col = idx % 2 === 0 ? leftCol : rightCol;
                col.innerHTML += html;
            });
        }
    };

    // Helper: Injecte la galerie
    const applyGallery = (images) => {
        const grid = document.querySelector('.gallery-grid');
        if (grid) {
            grid.innerHTML = '';
            images.forEach(img => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.setAttribute('role', 'button');
                item.setAttribute('tabindex', '0');
                item.setAttribute('aria-label', `Agrandir l'image : ${img.title || 'Photo restaurant'}`);
                item.setAttribute('data-src', img.image_url);
                item.innerHTML = `
                    <img src="${img.image_url}" alt="${img.alt_text || img.title || 'Photo restaurant'}" loading="lazy">
                    <div class="gallery-overlay">
                        <span>Agrandir</span>
                    </div>
                `;
                grid.appendChild(item);
            });

            // Ré-initialiser la lightbox
            initLightbox();
        }
    };

    // Lancer le chargement dynamique au démarrage de toutes les pages
    loadDynamicSiteContent();


    /* ==========================================
       9. PAGE ACTUALITÉS - RENDU DYNAMIQUE
       ========================================== */
    const actualitesGrid = document.getElementById('actualitesGrid');
    if (actualitesGrid) {
        fetch('/api/get-site-content')
            .then(r => r.json())
            .then(data => {
                const loading = document.getElementById('actualitesLoading');
                const empty = document.getElementById('actualitesEmpty');
                if (loading) loading.classList.add('hidden');

                const list = (data.actualites || []);
                if (list.length === 0) {
                    if (empty) empty.classList.remove('hidden');
                    return;
                }

                actualitesGrid.classList.remove('hidden');
                list.forEach(actu => {
                    const article = document.createElement('article');
                    article.className = 'actualite-card';
                    const date = new Date(actu.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    article.innerHTML = `
                        ${actu.photo_url ? `<div class="actualite-img"><img src="${actu.photo_url}" alt="${actu.titre}" loading="lazy"></div>` : ''}
                        <div class="actualite-body">
                            <time class="actualite-date">${date}</time>
                            <h2 class="actualite-titre">${actu.titre}</h2>
                            ${actu.sous_titre ? `<p class="actualite-sous-titre">${actu.sous_titre}</p>` : ''}
                            <p class="actualite-contenu">${actu.contenu.replace(/\n/g, '<br>')}</p>
                        </div>
                    `;
                    actualitesGrid.appendChild(article);
                });
            })
            .catch(() => {
                const loading = document.getElementById('actualitesLoading');
                const empty = document.getElementById('actualitesEmpty');
                if (loading) loading.classList.add('hidden');
                if (empty) empty.classList.remove('hidden');
            });
    }


    /* ==========================================
       10. TRACKING GA4 - ÉVÉNEMENTS CLÉS
       ========================================== */
    const track = (eventName, params = {}) => {
        if (typeof gtag === 'function') gtag('event', eventName, params);
    };

    document.addEventListener('click', (e) => {
        const tel = e.target.closest('a[href^="tel:"]');
        if (tel) track('clic_telephone', { event_category: 'Contact', event_label: tel.href });

        const maps = e.target.closest('a[href*="google.com/maps"], a[href*="share.google"], a[href*="maps.app"]');
        if (maps) track('clic_itineraire', { event_category: 'Contact', event_label: 'Google Maps' });

        const resa = e.target.closest('a[href="reservation.html"], a[href$="/reservation"]');
        if (resa) track('clic_reservation', { event_category: 'Conversion', event_label: resa.textContent.trim().substring(0, 50) });

        const carte = e.target.closest('a[href="carte.html"], a[href$="/carte"]');
        if (carte) track('clic_carte', { event_category: 'Navigation', event_label: 'Voir la carte' });
    });

    const bookingFormGA = document.getElementById('bookingForm');
    if (bookingFormGA) {
        bookingFormGA.addEventListener('submit', () => {
            track('soumission_reservation', { event_category: 'Conversion', event_label: 'Formulaire' });
        });
    }


    /* ==========================================
       11. CHARGEMENT DIFFERE GOOGLE MAPS (SI PRESENT)
       ========================================== */
    const loadMapBtn = document.getElementById('loadMapBtn');
    const mapPlaceholder = document.getElementById('mapPlaceholder');
    const mapIframeContainer = document.getElementById('mapIframeContainer');

    if (loadMapBtn && mapPlaceholder && mapIframeContainer) {
        loadMapBtn.addEventListener('click', () => {
            const mapsEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2850.563045053706!2d-1.144415!3d44.382898!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd1469e38e68cfbf%3A0x608e58f274cb7060!2s540%20Chemin%20de%20Bimbo%2C%2040600%20Biscarrosse!5e0!3m2!1sfr!2sfr!4v1717000000000!5m2!1sfr!2sfr";
            
            const iframe = document.createElement('iframe');
            iframe.setAttribute('src', mapsEmbedUrl);
            iframe.setAttribute('width', '100%');
            iframe.setAttribute('height', '100%');
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
            iframe.setAttribute('title', 'Carte de localisation du restaurant Les Tables de la Fontaine');

            mapIframeContainer.appendChild(iframe);
            
            mapPlaceholder.classList.add('hidden');
            mapIframeContainer.classList.remove('hidden');
        });
    }


    /* ==========================================
       12. BOUTON RETOUR EN HAUT (BACK TO TOP)
       ========================================== */
    const backToTopBtn = document.getElementById('backToTopBtn');

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 400) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

});
