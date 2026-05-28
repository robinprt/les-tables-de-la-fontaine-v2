/**
 * ============================================================================
 * LES TABLES DE LA FONTAINE - LOGIQUE CONSOLE D'ADMINISTRATION
 * ============================================================================
 */

// Variables globales
// NOTE: 'supabaseClient' est utilisé pour éviter le conflit avec window.supabase (SDK CDN)
let supabaseClient = null;
let currentSession = null;
let activeTab = 'overview';
let siteData = {}; // Cache public
let reservationsCache = []; // Cache privé

// Point d'entrée
document.addEventListener('DOMContentLoaded', async () => {
  await initAdminApp();
});

/**
 * Initialise l'application admin avec Supabase Auth
 * Les clés sont lues depuis les meta tags injectés par la page HTML
 * (SUPABASE_ANON_KEY est une clé publique, safe à exposer côté client)
 */
async function initAdminApp() {
  try {
    // 1. Lire les clés depuis les meta tags
    const supabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content;
    const supabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.content;

    if (!supabaseUrl || supabaseUrl === 'SUPABASE_URL_PLACEHOLDER' ||
        !supabaseAnonKey || supabaseAnonKey === 'SUPABASE_ANON_KEY_PLACEHOLDER') {
      throw new Error("Clés Supabase non configurées. Vérifiez les variables d'environnement Vercel.");
    }

    // 2. Initialiser le client Supabase (window.supabase = SDK chargé via CDN)
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

    // 3. Écouter les changements d'état d'authentification
    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentSession = session;
      handleAuthState(session);
    });

    // 4. Configurer la soumission du formulaire de login
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);

    // 5. Configurer le bouton de déconnexion
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 6. Configurer la navigation par onglets
    setupTabNavigation();

    // 7. Charger les données de contenu en arrière-plan (non bloquant)
    fetch('/api/get-site-content')
      .then(r => r.json())
      .then(data => { if (data.success) siteData = data; })
      .catch(err => console.warn('Contenu dynamique non disponible:', err));

  } catch (error) {
    console.error("Initialization error:", error);
    showLoginFeedback("Erreur d'initialisation : " + error.message, "error");
  }
}

/**
 * Gère l'affichage selon que l'admin est connecté ou non
 */
function handleAuthState(session) {
  const loginContainer = document.getElementById('loginContainer');
  const dashboardWrapper = document.getElementById('dashboardWrapper');
  const userEmailSpan = document.getElementById('userEmailSpan');

  if (session && session.user) {
    // Connecté
    loginContainer.classList.add('hidden');
    dashboardWrapper.classList.remove('hidden');
    userEmailSpan.textContent = session.user.email;
    
    // Charger toutes les données d'administration
    loadAdminDashboardData();
  } else {
    // Non connecté
    loginContainer.classList.remove('hidden');
    dashboardWrapper.classList.add('hidden');
  }
}

/**
 * Soumission du formulaire de connexion
 */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmitBtn');

  setButtonLoading(submitBtn, true);
  hideLoginFeedback();

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    // L'état de connexion va changer et être capté par onAuthStateChange
  } catch (error) {
    showLoginFeedback("Identifiants incorrects ou non autorisés : " + error.message, "error");
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Déconnexion de la session
 */
async function handleLogout() {
  if (confirm("Voulez-vous vous déconnecter ?")) {
    await supabaseClient.auth.signOut();
  }
}

// Helpers de chargement UI bouton
function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.loader');
  if (isLoading) {
    btn.setAttribute('disabled', 'true');
    if (text) text.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
  } else {
    btn.removeAttribute('disabled');
    if (text) text.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
  }
}

function showLoginFeedback(text, type) {
  const fb = document.getElementById('loginFeedback');
  fb.textContent = text;
  fb.className = `feedback-message ${type}`;
  fb.classList.remove('hidden');
}

function hideLoginFeedback() {
  document.getElementById('loginFeedback').classList.add('hidden');
}

/**
 * Effectue un appel authentifié à l'API interne /api/
 */
async function apiFetch(endpoint, method = 'GET', body = null) {
  if (!currentSession) {
    throw new Error("Session d'administration expirée. Veuillez vous reconnecter.");
  }

  const token = currentSession.access_token;
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  const config = { method, headers };

  if (body) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, config);
  
  if (res.status === 401) {
    // JWT expiré ou non valide
    await supabaseClient.auth.signOut();
    throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erreur serveur (code ${res.status})`);
  }

  return data;
}

/**
 * Configure la navigation par onglets du dashboard
 */
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Liens d'action rapide sur l'accueil
  document.querySelectorAll('[data-action-tab]').forEach(el => {
    el.addEventListener('click', () => {
      switchTab(el.getAttribute('data-action-tab'));
    });
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  
  // Mettre à jour l'état actif dans la navigation
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Mettre à jour la section affichée
  document.querySelectorAll('.tab-content').forEach(section => {
    if (section.id === `tab-${tabId}`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Recharger les données spécifiques de l'onglet si nécessaire
  if (tabId === 'reservations') {
    fetchReservations();
  } else if (tabId === 'calendar') {
    renderCalendar();
  } else if (tabId === 'hours') {
    renderHoursForm();
  } else if (tabId === 'menu') {
    renderMenuManagement();
  } else if (tabId === 'gallery') {
    renderGalleryManagement();
  } else if (tabId === 'reviews') {
    renderReviewsManagement();
  } else if (tabId === 'actualites') {
    renderActualitesManagement();
  } else if (tabId === 'links') {
    renderLinksManagement();
  } else if (tabId === 'content') {
    renderSiteTextsForm();
  } else if (tabId === 'overview') {
    loadOverviewStats();
  }
}

/**
 * Charge l'ensemble des données d'administration au démarrage
 */
async function loadAdminDashboardData() {
  try {
    // 1. Récupérer les réservations
    await fetchReservations(false); // charger sans forcer l'actualisation de la vue de l'onglet
    
    // 2. Mettre à jour les statistiques de l'accueil
    loadOverviewStats();
    
    // 3. Configurer les écouteurs de formulaires et de boutons une seule fois
    initFormsAndModals();

  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    alert("Impossible de charger les données : " + error.message);
  }
}

/**
 * Configure les événements des formulaires et des fenêtres modales
 */
function initFormsAndModals() {
  // Saisie manuelle de réservation
  const manualBookingForm = document.getElementById('manualBookingForm');
  if (manualBookingForm) {
    manualBookingForm.addEventListener('submit', createManualBooking);
  }
  
  // Actualités
  const actualiteForm = document.getElementById('actualiteForm');
  if (actualiteForm) actualiteForm.addEventListener('submit', saveActualite);
  const addActualiteBtn = document.getElementById('addActualiteBtn');
  if (addActualiteBtn) addActualiteBtn.addEventListener('click', () => openActualiteModal());

  // Boutons d'ajout rapide ou classique
  const addBtn = document.getElementById('addManualBookingBtn');
  const quickAddBtn = document.getElementById('quickAddBookingBtn');
  const manualModal = document.getElementById('manualBookingModal');
  
  const openManualModal = () => {
    manualBookingForm.reset();
    
    // Initialiser la date par défaut à aujourd'hui
    const dateInput = document.getElementById('manDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    manualModal.showModal();
  };

  if (addBtn) addBtn.addEventListener('click', openManualModal);
  if (quickAddBtn) quickAddBtn.addEventListener('click', openManualModal);

  // Filtres réservations
  document.getElementById('filterDate').addEventListener('change', fetchReservations);
  document.getElementById('filterStatus').addEventListener('change', fetchReservations);
  document.getElementById('filterType').addEventListener('change', fetchReservations);
  
  let searchTimeout;
  document.getElementById('searchBooking').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchReservations, 300); // anti-rebond
  });

  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('searchBooking').value = '';
    fetchReservations();
  });

  // Export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', exportReservationsToCsv);

  // Formulaire horaires
  document.getElementById('hoursForm').addEventListener('submit', saveHours);

  // Formulaire textes site
  document.getElementById('siteContentForm').addEventListener('submit', saveSiteTexts);

  // Ajout Catégorie / Plat / Avis / Lien
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('addDishBtn').addEventListener('click', () => openDishModal());
  document.getElementById('addReviewBtn').addEventListener('click', () => openReviewModal());
  document.getElementById('addLinkBtn').addEventListener('click', () => openLinkModal());

  // Soumission formulaires modales
  document.getElementById('categoryForm').addEventListener('submit', saveCategory);
  document.getElementById('dishForm').addEventListener('submit', saveDish);
  document.getElementById('reviewForm').addEventListener('submit', saveReview);
  document.getElementById('linkForm').addEventListener('submit', saveLink);

  // Onglets secondaires de la carte (Cuisine vs Bar)
  document.querySelectorAll('.menu-tabs-row .sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-tabs-row .sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMenuManagement();
    });
  });

  // Filtres galerie photo
  document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGalleryManagement();
    });
  });

  // Gestion upload d'image
  const uploadImgBtn = document.getElementById('uploadImageBtn');
  const uploadModal = document.getElementById('uploadImageModal');
  const uploadZone = document.getElementById('imageUploadZone');
  const fileInput = document.getElementById('imageFileInput');
  const removePreviewBtn = document.getElementById('removePreviewBtn');
  const uploadImageForm = document.getElementById('uploadImageForm');

  if (uploadImgBtn) {
    uploadImgBtn.addEventListener('click', () => {
      uploadImageForm.reset();
      resetImageUploadPreview();
      uploadModal.showModal();
    });
  }

  if (uploadZone) {
    uploadZone.addEventListener('click', () => fileInput.click());
    
    // Drag and Drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = 'var(--color-primary)';
      uploadZone.style.backgroundColor = 'rgba(22, 105, 155, 0.05)';
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.style.borderColor = '';
      uploadZone.style.backgroundColor = '';
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = '';
      uploadZone.style.backgroundColor = '';
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleSelectedImageFile(fileInput.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleSelectedImageFile(e.target.files[0]);
      }
    });
  }

  if (removePreviewBtn) {
    removePreviewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetImageUploadPreview();
    });
  }

  if (uploadImageForm) {
    uploadImageForm.addEventListener('submit', uploadGalleryImage);
  }
}

/**
 * ============================================================================
 * VUE D'ENSEMBLE & STATISTIQUES
 * ============================================================================
 */

function loadOverviewStats() {
  const pending = reservationsCache.filter(r => r.status === 'pending');
  const todayStr = new Date().toISOString().split('T')[0];

  // Mettre à jour le badge du menu latéral
  const pendingBadge = document.getElementById('pendingBadge');
  if (pending.length > 0) {
    pendingBadge.textContent = pending.length;
    pendingBadge.classList.remove('hidden');
  } else {
    pendingBadge.classList.add('hidden');
  }

  // Si l'onglet actif est l'accueil, mettre à jour les cartes statistiques
  if (activeTab === 'overview') {
    const todayBookings = reservationsCache.filter(r => r.reservation_date === todayStr && r.status !== 'refused' && r.status !== 'cancelled');
    
    // Calculer les couverts aujourd'hui (uniquement pour les confirmés ou en attente)
    const todayCovers = todayBookings.reduce((sum, r) => sum + r.guests, 0);

    // Calculer cette semaine
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lundi
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
    endOfWeek.setHours(23,59,59,999);

    const weekBookings = reservationsCache.filter(r => {
      const rDate = new Date(r.reservation_date);
      return rDate >= startOfWeek && rDate <= endOfWeek && r.status !== 'refused' && r.status !== 'cancelled';
    });
    const weekCovers = weekBookings.reduce((sum, r) => sum + r.guests, 0);

    document.getElementById('stat-pending').textContent = pending.length;
    document.getElementById('stat-today-bookings').textContent = todayBookings.length;
    document.getElementById('stat-today-covers').textContent = todayCovers;
    document.getElementById('stat-week-covers').textContent = weekCovers;

    // Remplir le tableau des demandes en attente récentes (Max 5)
    const listBody = document.getElementById('overviewPendingList');
    listBody.innerHTML = '';

    const recentPending = pending.slice(0, 5);

    if (recentPending.length === 0) {
      listBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Aucune demande en attente. Félicitations !</td></tr>`;
      return;
    }

    recentPending.forEach(r => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(r.reservation_date).toLocaleDateString('fr-FR');
      tr.innerHTML = `
        <td><strong>${formattedDate} à ${r.reservation_time.substring(0, 5)}</strong></td>
        <td>${r.first_name} ${r.last_name}</td>
        <td><span class="badge badge-warning">${r.guests} pers.</span></td>
        <td><button class="btn btn-outline-primary" style="padding: 4px 8px; font-size:12px;" onclick="viewBookingDetails('${r.id}')">Traiter</button></td>
      `;
      listBody.appendChild(tr);
    });
  }
}

/**
 * ============================================================================
 * CRUDS: RESERVATIONS
 * ============================================================================
 */

async function fetchReservations(updateUi = true) {
  const dateVal = document.getElementById('filterDate').value;
  const statusVal = document.getElementById('filterStatus').value;
  const typeVal = document.getElementById('filterType').value;
  const searchVal = document.getElementById('searchBooking').value;

  let url = '/api/get-reservations?';
  if (dateVal) url += `date=${dateVal}&`;
  if (statusVal) url += `status=${statusVal}&`;
  if (typeVal) url += `type=${typeVal}&`;
  if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;

  try {
    const data = await apiFetch(url);
    if (data.success) {
      reservationsCache = data.reservations;
      
      // Mettre à jour le badge de notifications
      const pending = reservationsCache.filter(r => r.status === 'pending');
      const pendingBadge = document.getElementById('pendingBadge');
      if (pending.length > 0) {
        pendingBadge.textContent = pending.length;
        pendingBadge.classList.remove('hidden');
      } else {
        pendingBadge.classList.add('hidden');
      }

      if (updateUi && activeTab === 'reservations') {
        renderReservationsTable();
      }
    }
  } catch (error) {
    console.error("Error fetching bookings:", error);
  }
}

function renderReservationsTable() {
  const tbody = document.getElementById('bookingsList');
  tbody.innerHTML = '';

  if (reservationsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Aucune réservation ne correspond à vos filtres.</td></tr>`;
    return;
  }

  reservationsCache.forEach(r => {
    const tr = document.createElement('tr');
    
    // Couleurs et labels de statut
    let statusLabel = 'En attente';
    if (r.status === 'confirmed') statusLabel = 'Confirmée';
    if (r.status === 'refused') statusLabel = 'Refusée';
    if (r.status === 'cancelled') statusLabel = 'Annulée';
    if (r.status === 'completed') statusLabel = 'Terminée';
    if (r.status === 'no_show') statusLabel = 'No-show';

    const formattedDate = new Date(r.reservation_date).toLocaleDateString('fr-FR');
    
    tr.innerHTML = `
      <td><strong>${formattedDate}</strong></td>
      <td>${r.reservation_time.substring(0, 5)}</td>
      <td><strong>${r.first_name} ${r.last_name}</strong></td>
      <td><a href="tel:${r.phone}">${r.phone}</a></td>
      <td><span class="badge badge-gray">${r.guests}</span></td>
      <td><span class="text-muted" style="text-transform: capitalize;">${r.reservation_type}</span></td>
      <td><span class="status-badge ${r.status}">${statusLabel}</span></td>
      <td class="text-right">
        <div class="actions-cell">
          <button class="btn btn-icon" title="Voir le détail" onclick="viewBookingDetails('${r.id}')">👁️</button>
          ${r.status === 'pending' ? `
            <button class="btn btn-icon" style="color:var(--color-success);" title="Confirmer" onclick="quickUpdateStatus('${r.id}', 'confirmed')">✓</button>
            <button class="btn btn-icon" style="color:var(--color-danger);" title="Refuser" onclick="quickUpdateStatus('${r.id}', 'refused')">✗</button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Ouvre la modale de détail d'une réservation
 */
window.viewBookingDetails = function(id) {
  const r = reservationsCache.find(x => x.id === id);
  if (!r) return;

  const modal = document.getElementById('bookingDetailModal');
  const detailsDiv = document.getElementById('modalBookingDetails');
  
  const createdDate = new Date(r.created_at).toLocaleString('fr-FR');
  const formattedDate = new Date(r.reservation_date).toLocaleDateString('fr-FR');

  let statusLabel = 'En attente';
  if (r.status === 'confirmed') statusLabel = 'Confirmée';
  if (r.status === 'refused') statusLabel = 'Refusée';
  if (r.status === 'cancelled') statusLabel = 'Annulée';
  if (r.status === 'completed') statusLabel = 'Terminée';
  if (r.status === 'no_show') statusLabel = 'No-show';

  detailsDiv.innerHTML = `
    <div class="booking-detail-grid">
      <div class="detail-block">
        <h5>Client</h5>
        <p><strong>${r.first_name} ${r.last_name}</strong></p>
      </div>
      <div class="detail-block">
        <h5>Date & Heure</h5>
        <p><strong>Le ${formattedDate} à ${r.reservation_time.substring(0, 5)}</strong></p>
      </div>
      <div class="detail-block">
        <h5>Téléphone</h5>
        <p><a href="tel:${r.phone}">${r.phone}</a></p>
      </div>
      <div class="detail-block">
        <h5>E-mail</h5>
        <p>${r.email ? `<a href="mailto:${r.email}">${r.email}</a>` : 'Non renseigné'}</p>
      </div>
      <div class="detail-block">
        <h5>Nombre de couverts</h5>
        <p><span class="badge badge-gray" style="font-size:13px; padding: 4px 10px;">${r.guests} personne(s)</span></p>
      </div>
      <div class="detail-block">
        <h5>Type de service</h5>
        <p style="text-transform: capitalize;">${r.reservation_type}</p>
      </div>
      <div class="detail-block">
        <h5>Créée le</h5>
        <p>${createdDate}</p>
      </div>
      <div class="detail-block">
        <h5>Origine de saisie</h5>
        <p style="text-transform: capitalize;">${r.source}</p>
      </div>
    </div>

    <div class="form-group-editor" style="margin-bottom: 20px;">
      <label>Message laissé par le client :</label>
      <p style="background-color: var(--color-gray-light); padding:12px; border-radius:var(--border-radius); font-style:italic;">
        ${r.message ? r.message : 'Aucun commentaire laissé.'}
      </p>
    </div>

    <div class="form-group-editor" style="margin-bottom: 20px;">
      <label for="modalAdminNote">Note interne (Cuisine, allergies, emplacement table...) :</label>
      <textarea id="modalAdminNote" rows="2" placeholder="Ajouter une note de service...">${r.admin_note || ''}</textarea>
    </div>

    <div class="detail-status-editor">
      <h4>Mettre à jour le statut</h4>
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">
        <button class="btn ${r.status === 'confirmed' ? 'btn-primary' : 'btn-outline-primary'}" onclick="saveBookingStatus('${r.id}', 'confirmed')">Confirmer (Vert)</button>
        <button class="btn ${r.status === 'refused' ? 'btn-primary' : 'btn-outline-primary'}" onclick="saveBookingStatus('${r.id}', 'refused')">Refuser (Rouge)</button>
        <button class="btn ${r.status === 'cancelled' ? 'btn-primary' : 'btn-outline-primary'}" onclick="saveBookingStatus('${r.id}', 'cancelled')">Annuler (Gris)</button>
        <button class="btn ${r.status === 'completed' ? 'btn-primary' : 'btn-outline-primary'}" onclick="saveBookingStatus('${r.id}', 'completed')">Marquer terminée</button>
        <button class="btn ${r.status === 'no_show' ? 'btn-primary' : 'btn-outline-primary'}" onclick="saveBookingStatus('${r.id}', 'no_show')">No-Show</button>
      </div>

      <div class="form-group-editor checkbox-row" style="margin-top:10px;" id="modalNotifRow">
        <input type="checkbox" id="modalSendNotif" checked>
        <label for="modalSendNotif"><strong>Notifier le client par e-mail / WhatsApp</strong> de la confirmation ou du refus.</label>
      </div>

      <div class="form-actions-bar" style="margin-top:20px; justify-content:space-between; border-top: 1px solid var(--color-gray-border); padding-top:20px;">
        <button class="btn btn-danger-light" onclick="archiveBooking('${r.id}')">Archiver / Supprimer</button>
        <button class="btn btn-outline-dark" onclick="document.getElementById('bookingDetailModal').close()">Fermer</button>
      </div>
    </div>
  `;

  modal.showModal();
};

/**
 * Enregistre le statut et les notes d'une réservation depuis la modale
 */
window.saveBookingStatus = async function(id, newStatus) {
  const adminNote = document.getElementById('modalAdminNote').value;
  const sendNotif = document.getElementById('modalSendNotif').checked;

  try {
    const data = await apiFetch('/api/update-reservation', 'POST', {
      id,
      status: newStatus,
      admin_note: adminNote,
      send_notification: sendNotif
    });

    if (data.success) {
      alert(data.message);
      document.getElementById('bookingDetailModal').close();
      await fetchReservations();
      if (activeTab === 'calendar') renderCalendar();
    }
  } catch (error) {
    alert("Erreur lors de la mise à jour : " + error.message);
  }
};

/**
 * Change rapidement le statut d'une réservation en un clic depuis le tableau
 */
window.quickUpdateStatus = async function(id, newStatus) {
  if (confirm(`Voulez-vous marquer cette réservation comme '${newStatus === 'confirmed' ? 'Confirmée' : 'Refusée'}' ?`)) {
    try {
      const data = await apiFetch('/api/update-reservation', 'POST', {
        id,
        status: newStatus,
        send_notification: true // notifier le client par défaut
      });

      if (data.success) {
        await fetchReservations();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

/**
 * Archive / supprime (soft delete) une réservation
 */
window.archiveBooking = async function(id) {
  if (confirm("Voulez-vous vraiment archiver cette réservation ? Elle ne sera plus affichée dans la liste active.")) {
    try {
      const data = await apiFetch('/api/delete-reservation', 'POST', { id });
      if (data.success) {
        document.getElementById('bookingDetailModal').close();
        await fetchReservations();
        if (activeTab === 'calendar') renderCalendar();
      }
    } catch (error) {
      alert("Erreur lors de la suppression : " + error.message);
    }
  }
};

/**
 * Crée une réservation manuelle (Admin)
 */
async function createManualBooking(e) {
  e.preventDefault();
  const lastName = document.getElementById('manLastName').value.trim();
  const firstName = document.getElementById('manFirstName').value.trim();
  const phone = document.getElementById('manPhone').value.trim();
  const email = document.getElementById('manEmail').value.trim();
  const dateVal = document.getElementById('manDate').value;
  const timeVal = document.getElementById('manTime').value;
  const guests = document.getElementById('manGuests').value;
  const type = document.getElementById('manType').value;
  const status = document.getElementById('manStatus').value;
  const message = document.getElementById('manMessage').value.trim();
  const adminNote = document.getElementById('manAdminNote').value.trim();

  try {
    const data = await apiFetch('/api/create-manual-reservation', 'POST', {
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      reservation_date: dateVal,
      reservation_time: timeVal,
      guests,
      reservation_type: type,
      status,
      message,
      admin_note: adminNote
    });

    if (data.success) {
      alert(data.message);
      document.getElementById('manualBookingModal').close();
      await fetchReservations();
      if (activeTab === 'calendar') renderCalendar();
    }
  } catch (error) {
    alert("Impossible de créer la réservation : " + error.message);
  }
}

/**
 * Exporte la liste actuelle des réservations en CSV
 */
function exportReservationsToCsv() {
  if (reservationsCache.length === 0) {
    alert("Aucune réservation à exporter.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM UTF-8
  csvContent += "Date,Heure,Nom,Prenom,Telephone,Email,Couverts,Type,Statut,Notes,Source\r\n";

  reservationsCache.forEach(r => {
    const row = [
      r.reservation_date,
      r.reservation_time,
      `"${r.last_name.replace(/"/g, '""')}"`,
      `"${r.first_name.replace(/"/g, '""')}"`,
      r.phone,
      r.email || '',
      r.guests,
      r.reservation_type,
      r.status,
      `"${(r.admin_note || '').replace(/"/g, '""')}"`,
      r.source
    ];
    csvContent += row.join(",") + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `reservations_la_fontaine_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * ============================================================================
 * CALENDRIER INTERACTIF
 * ============================================================================
 */

let calCurrentDate = new Date(); // Date courante du calendrier

function renderCalendar() {
  const year = calCurrentDate.getFullYear();
  const month = calCurrentDate.getMonth();

  // Mettre à jour le titre du mois
  const monthLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  document.getElementById('calendarTitle').textContent = `${monthLabels[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay(); // Jour de la semaine du 1er jour du mois (0 = dim)
  // Adapter au format français (0 = lundi, ..., 6 = dimanche)
  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDays = new Date(year, month + 1, 0).getDate(); // Nombre total de jours dans le mois
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  // Ajouter les cellules vides du début du mois
  for (let i = 0; i < adjustedFirstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day empty';
    grid.appendChild(cell);
  }

  // Ajouter les jours du mois
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cell.setAttribute('data-date', dateString);

    // Récupérer les réservations de ce jour
    const dayBookings = reservationsCache.filter(r => r.reservation_date === dateString && r.status !== 'refused' && r.status !== 'cancelled');
    const pendingCovers = dayBookings.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.guests, 0);
    const confirmedCovers = dayBookings.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + r.guests, 0);

    cell.innerHTML = `
      <span class="day-number">${day}</span>
      <div class="day-bookings-indicator">
        ${confirmedCovers > 0 ? `<span class="day-badge confirmed">${confirmedCovers} Couv.</span>` : ''}
        ${pendingCovers > 0 ? `<span class="day-badge pending">${pendingCovers} Att.</span>` : ''}
      </div>
    `;

    cell.addEventListener('click', () => {
      document.querySelectorAll('.calendar-day').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      showSelectedDayReservations(dateString);
    });

    grid.appendChild(cell);
  }

  // Boutons du mois
  document.getElementById('calPrevMonth').onclick = () => {
    calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
    renderCalendar();
  };
  document.getElementById('calNextMonth').onclick = () => {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
    renderCalendar();
  };
}

/**
 * Affiche le détail des réservations d'une journée dans la colonne de droite
 */
function showSelectedDayReservations(dateString) {
  const dayBookings = reservationsCache.filter(r => r.reservation_date === dateString);
  const totalCovers = dayBookings.filter(r => r.status === 'confirmed').reduce((sum, r) => sum + r.guests, 0);

  const formattedDate = new Date(dateString).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('selectedDateTitle').textContent = formattedDate;
  document.getElementById('dayTotalCovers').textContent = `${totalCovers} couverts confirmés`;

  const container = document.getElementById('dayTimeline');
  container.innerHTML = '';

  if (dayBookings.length === 0) {
    container.innerHTML = `<p class="text-muted text-center py-4">Aucune réservation pour ce jour.</p>`;
    return;
  }

  // Trier par heure
  dayBookings.sort((a,b) => a.reservation_time.localeCompare(b.reservation_time));

  dayBookings.forEach(r => {
    const item = document.createElement('div');
    item.className = `timeline-item ${r.status}`;
    item.innerHTML = `
      <div class="timeline-item-info">
        <h4>${r.reservation_time.substring(0, 5)} - ${r.first_name} ${r.last_name}</h4>
        <span>${r.guests} couverts • ${r.reservation_type}</span>
      </div>
      <button class="btn btn-outline-primary" style="padding: 4px 8px; font-size:12px;" onclick="viewBookingDetails('${r.id}')">Détail</button>
    `;
    container.appendChild(item);
  });
}

/**
 * ============================================================================
 * HORAIRES D'OUVERTURE
 * ============================================================================
 */

function renderHoursForm() {
  const tbody = document.getElementById('hoursTableBody');
  tbody.innerHTML = '';

  const hours = siteData.opening_hours || [];

  hours.forEach(day => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${day.day_label}</strong><input type="hidden" name="day_id" value="${day.id}"><input type="hidden" name="day_label" value="${day.day_label}"><input type="hidden" name="display_order" value="${day.display_order}"></td>
      <td>
        <input type="checkbox" name="is_closed" ${day.is_closed ? 'checked' : ''} onchange="toggleHoursRowDisabled(this)">
      </td>
      <td>
        <div class="hours-input-group">
          <input type="time" name="lunch_open" value="${day.lunch_open || ''}" ${day.is_closed ? 'disabled' : ''}>
        </div>
      </td>
      <td>
        <div class="hours-input-group">
          <input type="time" name="lunch_close" value="${day.lunch_close || ''}" ${day.is_closed ? 'disabled' : ''}>
        </div>
      </td>
      <td>
        <div class="hours-input-group">
          <input type="time" name="dinner_open" value="${day.dinner_open || ''}" ${day.is_closed ? 'disabled' : ''}>
        </div>
      </td>
      <td>
        <div class="hours-input-group">
          <input type="time" name="dinner_close" value="${day.dinner_close || ''}" ${day.is_closed ? 'disabled' : ''}>
        </div>
      </td>
      <td>
        <input type="text" name="special_note" class="hours-special-input" value="${day.special_note || ''}" placeholder="ex: Service continu...">
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleHoursRowDisabled = function(checkbox) {
  const tr = checkbox.closest('tr');
  const inputs = tr.querySelectorAll('input[type="time"]');
  inputs.forEach(input => {
    if (checkbox.checked) {
      input.setAttribute('disabled', 'true');
    } else {
      input.removeAttribute('disabled');
    }
  });
};

async function saveHours(e) {
  e.preventDefault();
  const form = document.getElementById('hoursForm');
  const rows = form.querySelectorAll('tbody tr');
  const hoursData = [];

  rows.forEach(tr => {
    const id = tr.querySelector('[name="day_id"]').value;
    const day_label = tr.querySelector('[name="day_label"]').value;
    const display_order = tr.querySelector('[name="display_order"]').value;
    const is_closed = tr.querySelector('[name="is_closed"]').checked;
    
    const lunch_open = tr.querySelector('[name="lunch_open"]').value;
    const lunch_close = tr.querySelector('[name="lunch_close"]').value;
    const dinner_open = tr.querySelector('[name="dinner_open"]').value;
    const dinner_close = tr.querySelector('[name="dinner_close"]').value;
    const special_note = tr.querySelector('[name="special_note"]').value.trim();

    hoursData.push({
      id,
      day_label,
      display_order,
      is_closed,
      lunch_open: is_closed ? null : (lunch_open || null),
      lunch_close: is_closed ? null : (lunch_close || null),
      dinner_open: is_closed ? null : (dinner_open || null),
      dinner_close: is_closed ? null : (dinner_close || null),
      special_note: special_note || null
    });
  });

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'update_hours',
      data: hoursData
    });

    if (res.success) {
      alert("Les horaires ont été mis à jour avec succès.");
      siteData.opening_hours = hoursData; // Update cache
    }
  } catch (error) {
    alert("Impossible d'enregistrer les horaires : " + error.message);
  }
}

/**
 * ============================================================================
 * CARTE & CATEGORIES
 * ============================================================================
 */

function renderMenuManagement() {
  const container = document.getElementById('menuLayout');
  container.innerHTML = '';

  const activeSection = document.querySelector('.menu-tabs-row .sub-tab-btn.active').getAttribute('data-menu-section');

  const categories = (siteData.menu_categories || []).filter(c => c.section === activeSection);
  const items = siteData.menu_items || [];

  if (categories.length === 0) {
    container.innerHTML = `<p class="text-muted text-center py-4">Aucune catégorie enregistrée. Cliquez sur "Ajouter une catégorie" pour démarrer.</p>`;
    return;
  }

  categories.forEach(cat => {
    const catCard = document.createElement('div');
    catCard.className = `menu-category-section ${!cat.is_visible ? 'hidden-item' : ''}`;
    
    // Filtrer les plats de cette catégorie
    const catItems = items.filter(item => item.category_id === cat.id);

    catCard.innerHTML = `
      <div class="category-header">
        <div class="category-header-title">
          <h3>${cat.name}</h3>
          ${!cat.is_visible ? '<span class="status-badge cancelled">Masqué</span>' : ''}
          <span class="badge badge-gray" style="font-size: 11px;">Ordre : ${cat.display_order}</span>
        </div>
        <div class="category-actions">
          <button class="btn btn-icon" title="Modifier la catégorie" onclick="openCategoryModal('${cat.id}')">✏️</button>
          <button class="btn btn-icon" style="color:var(--color-danger);" title="Supprimer la catégorie" onclick="deleteCategory('${cat.id}')">🗑️</button>
        </div>
      </div>
      
      <div class="dish-list">
        ${catItems.length === 0 ? '<p class="text-muted text-center py-2">Aucun plat dans cette catégorie.</p>' : ''}
        ${catItems.map(item => `
          <div class="dish-item ${!item.is_visible ? 'hidden-item' : ''}">
            <div class="dish-info">
              <h4>${item.name}</h4>
              <p>${item.description || ''}</p>
              ${item.allergens ? `<p class="text-muted" style="font-size:11px;">Allergènes : ${item.allergens}</p>` : ''}
            </div>
            <div class="dish-meta">
              <span class="dish-price">${item.price.toFixed(2)} €</span>
              ${!item.is_visible ? '<span class="status-badge cancelled">Masqué</span>' : ''}
              ${item.is_featured ? '<span class="status-badge confirmed">Featured</span>' : ''}
              <button class="btn btn-icon" title="Modifier le plat" onclick="openDishModal('${item.id}')">✏️</button>
              <button class="btn btn-icon" style="color:var(--color-danger);" title="Supprimer le plat" onclick="deleteDish('${item.id}')">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.appendChild(catCard);
  });

  // Mettre à jour les listes de sélection pour l'ajout de plat
  updateDishCategorySelect();
}

function updateDishCategorySelect() {
  const select = document.getElementById('dishCategory');
  select.innerHTML = '';
  (siteData.menu_categories || []).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.name} (${cat.section === 'food' ? 'Cuisine' : 'Boisson'})`;
    select.appendChild(opt);
  });
}

// Modale Catégorie
window.openCategoryModal = function(id = null) {
  const form = document.getElementById('categoryForm');
  form.reset();
  
  if (id) {
    const cat = siteData.menu_categories.find(c => c.id === id);
    document.getElementById('categoryModalTitle').textContent = "Modifier la catégorie";
    document.getElementById('catId').value = cat.id;
    document.getElementById('catName').value = cat.name;
    document.getElementById('catDesc').value = cat.description || '';
    document.getElementById('catSection').value = cat.section;
    document.getElementById('catDisplayOrder').value = cat.display_order;
    document.getElementById('catIsVisible').checked = cat.is_visible;
  } else {
    document.getElementById('categoryModalTitle').textContent = "Ajouter une catégorie";
    document.getElementById('catId').value = '';
  }

  document.getElementById('categoryModal').showModal();
};

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('catId').value;
  const name = document.getElementById('catName').value.trim();
  const description = document.getElementById('catDesc').value.trim();
  const section = document.getElementById('catSection').value;
  const display_order = document.getElementById('catDisplayOrder').value;
  const is_visible = document.getElementById('catIsVisible').checked;

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'manage_categories',
      data: { id: id || undefined, name, description, section, display_order, is_visible }
    });

    if (res.success) {
      alert("Catégorie enregistrée.");
      document.getElementById('categoryModal').close();
      // Recharger le cache local
      await refreshPublicCache();
      renderMenuManagement();
    }
  } catch (error) {
    alert("Erreur : " + error.message);
  }
}

window.deleteCategory = async function(id) {
  if (confirm("Voulez-vous vraiment supprimer cette catégorie ? Tous les plats rattachés seront également supprimés du site.")) {
    try {
      const res = await apiFetch('/api/update-site-content', 'POST', {
        action: 'manage_categories',
        subaction: 'delete',
        data: { id }
      });
      if (res.success) {
        await refreshPublicCache();
        renderMenuManagement();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

// Modale Plat / Boisson
window.openDishModal = function(id = null) {
  const form = document.getElementById('dishForm');
  form.reset();

  if (id) {
    const item = siteData.menu_items.find(x => x.id === id);
    document.getElementById('dishModalTitle').textContent = "Modifier le plat / boisson";
    document.getElementById('dishId').value = item.id;
    document.getElementById('dishName').value = item.name;
    document.getElementById('dishPrice').value = item.price;
    document.getElementById('dishCategory').value = item.category_id;
    document.getElementById('dishDisplayOrder').value = item.display_order;
    document.getElementById('dishDesc').value = item.description || '';
    document.getElementById('dishAllergens').value = item.allergens || '';
    document.getElementById('dishIsVisible').checked = item.is_visible;
    document.getElementById('dishIsFeatured').checked = item.is_featured;
  } else {
    document.getElementById('dishModalTitle').textContent = "Ajouter un plat / boisson";
    document.getElementById('dishId').value = '';
  }

  document.getElementById('dishModal').showModal();
};

async function saveDish(e) {
  e.preventDefault();
  const id = document.getElementById('dishId').value;
  const name = document.getElementById('dishName').value.trim();
  const price = document.getElementById('dishPrice').value;
  const category_id = document.getElementById('dishCategory').value;
  const display_order = document.getElementById('dishDisplayOrder').value;
  const description = document.getElementById('dishDesc').value.trim();
  const allergens = document.getElementById('dishAllergens').value.trim();
  const is_visible = document.getElementById('dishIsVisible').checked;
  const is_featured = document.getElementById('dishIsFeatured').checked;

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'manage_menu',
      data: { id: id || undefined, name, price, category_id, display_order, description, allergens, is_visible, is_featured }
    });

    if (res.success) {
      alert("Plat / Boisson enregistré.");
      document.getElementById('dishModal').close();
      await refreshPublicCache();
      renderMenuManagement();
    }
  } catch (error) {
    alert("Erreur : " + error.message);
  }
}

window.deleteDish = async function(id) {
  if (confirm("Voulez-vous supprimer ce plat de la carte ?")) {
    try {
      const res = await apiFetch('/api/update-site-content', 'POST', {
        action: 'manage_menu',
        subaction: 'delete',
        data: { id }
      });
      if (res.success) {
        await refreshPublicCache();
        renderMenuManagement();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

/**
 * ============================================================================
 * GALERIE PHOTOS
 * ============================================================================
 */

let selectedBase64Image = null;
let selectedImageFilename = null;

function renderGalleryManagement() {
  const grid = document.getElementById('adminGalleryGrid');
  grid.innerHTML = '';

  const activeCategory = document.querySelector('.gallery-filters .gallery-filter-btn.active').getAttribute('data-category');
  
  const images = (siteData.gallery_images || []).filter(img => {
    return !activeCategory || img.category === activeCategory;
  });

  if (images.length === 0) {
    grid.innerHTML = `<p class="text-muted text-center py-4" style="grid-column: 1/-1;">Aucune image dans cette catégorie.</p>`;
    return;
  }

  images.forEach(img => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = `
      <div class="gallery-img-wrapper">
        <img src="${img.image_url}" alt="${img.alt_text || ''}" loading="lazy">
      </div>
      <div class="gallery-card-body">
        <div class="gallery-card-info">
          <h4>${img.title || 'Sans titre'}</h4>
          <span>Catégorie : ${img.category}</span>
          <p class="text-muted" style="font-size:11px; margin-top:2px;">Ordre d'affichage : ${img.display_order}</p>
        </div>
        <div class="gallery-card-actions">
          <button class="btn btn-icon" style="color:var(--color-danger);" title="Supprimer la photo" onclick="deleteGalleryImage('${img.id}')">🗑️</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function handleSelectedImageFile(file) {
  if (!file) return;

  // Validation taille : 5 Mo
  if (file.size > 5 * 1024 * 1024) {
    alert("Le fichier est trop lourd. Limite autorisée : 5 Mo.");
    resetImageUploadPreview();
    return;
  }

  selectedImageFilename = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    selectedBase64Image = e.target.result;
    
    // Afficher l'aperçu
    document.getElementById('uploadZonePrompt').classList.add('hidden');
    const previewContainer = document.getElementById('uploadPreviewContainer');
    previewContainer.classList.remove('hidden');
    document.getElementById('imageUploadPreview').src = selectedBase64Image;

    // Pré-remplir le titre et ALT SEO avec le nom du fichier nettoyé
    const cleanName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[_-]/g, ' ');
    document.getElementById('imgTitle').value = cleanName;
    document.getElementById('imgAltText').value = `${cleanName} restaurant Les Tables de la Fontaine Biscarrosse`;
  };
  reader.readAsDataURL(file);
}

function resetImageUploadPreview() {
  selectedBase64Image = null;
  selectedImageFilename = null;
  document.getElementById('imageFileInput').value = '';
  document.getElementById('uploadZonePrompt').classList.remove('hidden');
  document.getElementById('uploadPreviewContainer').classList.add('hidden');
  document.getElementById('imageUploadPreview').src = '';
}

async function uploadGalleryImage(e) {
  e.preventDefault();
  if (!selectedBase64Image) {
    alert("Veuillez sélectionner une image.");
    return;
  }

  const title = document.getElementById('imgTitle').value.trim();
  const altText = document.getElementById('imgAltText').value.trim();
  const category = document.getElementById('imgCategory').value;
  const displayOrder = document.getElementById('imgDisplayOrder').value;

  const submitBtn = document.getElementById('uploadSubmitBtn');
  setButtonLoading(submitBtn, true);

  try {
    const res = await apiFetch('/api/upload-gallery-image', 'POST', {
      image: selectedBase64Image,
      filename: selectedImageFilename,
      title,
      alt_text: altText,
      category,
      display_order: displayOrder
    });

    if (res.success) {
      alert("Image téléversée avec succès.");
      document.getElementById('uploadImageModal').close();
      await refreshPublicCache();
      renderGalleryManagement();
    }
  } catch (error) {
    alert("Impossible d'uploader l'image : " + error.message);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

window.deleteGalleryImage = async function(id) {
  if (confirm("Voulez-vous vraiment supprimer définitivement cette photo de la galerie ?")) {
    try {
      const res = await apiFetch('/api/delete-gallery-image', 'POST', { id });
      if (res.success) {
        alert("Image supprimée.");
        await refreshPublicCache();
        renderGalleryManagement();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

/**
 * ============================================================================
 * AVIS CLIENTS
 * ============================================================================
 */

function renderReviewsManagement() {
  const grid = document.getElementById('adminReviewsGrid');
  grid.innerHTML = '';

  const reviews = siteData.reviews || [];

  if (reviews.length === 0) {
    grid.innerHTML = `<p class="text-muted text-center py-4" style="grid-column: 1/-1;">Aucun avis saisi. Cliquez sur "Ajouter un avis" pour en enregistrer un.</p>`;
    return;
  }

  reviews.forEach(rev => {
    const card = document.createElement('div');
    card.className = 'review-admin-card';
    card.innerHTML = `
      <div class="review-admin-header">
        <strong>${rev.author_name}</strong>
        <span class="review-admin-stars">${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</span>
      </div>
      <div class="review-admin-body">
        "${rev.review_text}"
      </div>
      <div class="review-admin-footer">
        <span>Source: ${rev.source} ${rev.review_date ? `(${new Date(rev.review_date).toLocaleDateString('fr-FR')})` : ''}</span>
        <div class="gallery-card-actions">
          <button class="btn btn-icon" style="padding: 4px; height: 30px; width:30px;" title="Modifier" onclick="openReviewModal('${rev.id}')">✏️</button>
          <button class="btn btn-icon" style="color:var(--color-danger); padding: 4px; height: 30px; width:30px;" title="Supprimer" onclick="deleteReview('${rev.id}')">🗑️</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.openReviewModal = function(id = null) {
  const form = document.getElementById('reviewForm');
  form.reset();

  if (id) {
    const rev = siteData.reviews.find(x => x.id === id);
    document.getElementById('reviewModalTitle').textContent = "Modifier l'avis";
    document.getElementById('revId').value = rev.id;
    document.getElementById('revAuthor').value = rev.author_name;
    document.getElementById('revRating').value = rev.rating;
    document.getElementById('revSource').value = rev.source;
    document.getElementById('revDate').value = rev.review_date || '';
    document.getElementById('revSourceUrl').value = rev.source_url || '';
    document.getElementById('revText').value = rev.review_text;
    document.getElementById('revIsVisible').checked = rev.is_visible;
    document.getElementById('revDisplayOrder').value = rev.display_order;
  } else {
    document.getElementById('reviewModalTitle').textContent = "Ajouter un avis";
    document.getElementById('revId').value = '';
    
    // Initialiser la date d'aujourd'hui
    document.getElementById('revDate').value = new Date().toISOString().split('T')[0];
  }

  document.getElementById('reviewModal').showModal();
};

async function saveReview(e) {
  e.preventDefault();
  const id = document.getElementById('revId').value;
  const author_name = document.getElementById('revAuthor').value.trim();
  const rating = document.getElementById('revRating').value;
  const source = document.getElementById('revSource').value.trim();
  const review_date = document.getElementById('revDate').value;
  const source_url = document.getElementById('revSourceUrl').value.trim();
  const review_text = document.getElementById('revText').value.trim();
  const is_visible = document.getElementById('revIsVisible').checked;
  const display_order = document.getElementById('revDisplayOrder').value;

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'manage_reviews',
      data: { id: id || undefined, author_name, rating, source, review_date: review_date || null, source_url: source_url || null, review_text, is_visible, display_order }
    });

    if (res.success) {
      alert("Avis enregistré.");
      document.getElementById('reviewModal').close();
      await refreshPublicCache();
      renderReviewsManagement();
    }
  } catch (error) {
    alert("Erreur : " + error.message);
  }
}

window.deleteReview = async function(id) {
  if (confirm("Supprimer cet avis du site public ?")) {
    try {
      const res = await apiFetch('/api/update-site-content', 'POST', {
        action: 'manage_reviews',
        subaction: 'delete',
        data: { id }
      });
      if (res.success) {
        await refreshPublicCache();
        renderReviewsManagement();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

/**
 * ============================================================================
 * LIENS EXTERNES
 * ============================================================================
 */

function renderLinksManagement() {
  const tbody = document.getElementById('adminLinksList');
  tbody.innerHTML = '';

  const links = siteData.external_links || [];

  if (links.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Aucun lien externe paramétré.</td></tr>`;
    return;
  }

  links.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${l.platform_name}</strong></td>
      <td class="text-muted">${l.description || '-'}</td>
      <td><a href="${l.url}" target="_blank" style="max-width:250px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${l.url}</a></td>
      <td><span class="status-badge ${l.is_visible ? 'confirmed' : 'cancelled'}">${l.is_visible ? 'Oui' : 'Non'}</span></td>
      <td><span class="badge badge-gray">${l.display_order}</span></td>
      <td class="text-right">
        <div class="actions-cell">
          <button class="btn btn-icon" title="Modifier" onclick="openLinkModal('${l.id}')">✏️</button>
          <button class="btn btn-icon" style="color:var(--color-danger);" title="Supprimer" onclick="deleteLink('${l.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openLinkModal = function(id = null) {
  const form = document.getElementById('linkForm');
  form.reset();

  if (id) {
    const link = siteData.external_links.find(x => x.id === id);
    document.getElementById('linkModalTitle').textContent = "Modifier le lien";
    document.getElementById('linkId').value = link.id;
    document.getElementById('linkPlatform').value = link.platform_name;
    document.getElementById('linkUrl').value = link.url;
    document.getElementById('linkDesc').value = link.description || '';
    document.getElementById('linkIsVisible').checked = link.is_visible;
    document.getElementById('linkDisplayOrder').value = link.display_order;
  } else {
    document.getElementById('linkModalTitle').textContent = "Ajouter un lien";
    document.getElementById('linkId').value = '';
  }

  document.getElementById('linkModal').showModal();
};

async function saveLink(e) {
  e.preventDefault();
  const id = document.getElementById('linkId').value;
  const platform_name = document.getElementById('linkPlatform').value.trim();
  const url = document.getElementById('linkUrl').value.trim();
  const description = document.getElementById('linkDesc').value.trim();
  const is_visible = document.getElementById('linkIsVisible').checked;
  const display_order = document.getElementById('linkDisplayOrder').value;

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'manage_links',
      data: { id: id || undefined, platform_name, url, description, is_visible, display_order }
    });

    if (res.success) {
      alert("Lien enregistré.");
      document.getElementById('linkModal').close();
      await refreshPublicCache();
      renderLinksManagement();
    }
  } catch (error) {
    alert("Erreur : " + error.message);
  }
}

window.deleteLink = async function(id) {
  if (confirm("Supprimer ce lien externe ?")) {
    try {
      const res = await apiFetch('/api/update-site-content', 'POST', {
        action: 'manage_links',
        subaction: 'delete',
        data: { id }
      });
      if (res.success) {
        await refreshPublicCache();
        renderLinksManagement();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

/**
 * ============================================================================
 * TEXTES ET PARAMETRES DU SITE
 * ============================================================================
 */

function renderSiteTextsForm() {
  const settings = siteData.settings || {};

  // Remplir les champs
  const fields = [
    'phone', 'restaurant_email', 'address', 'instagram_url', 
    'google_maps_url', 'hero_title', 'hero_subtitle', 'hero_text', 
    'reservation_message', 'seo_title', 'seo_description'
  ];

  fields.forEach(field => {
    const input = document.getElementById(`set-${field}`);
    if (input) {
      // Nettoyer la valeur JSON si nécessaire
      let val = settings[field] || '';
      if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      input.value = val;
    }
  });
}

async function saveSiteTexts(e) {
  e.preventDefault();
  const form = document.getElementById('siteContentForm');
  const inputs = form.querySelectorAll('input, textarea');
  const settingsData = {};

  inputs.forEach(input => {
    const key = input.id.replace('set-', '');
    // Stocker la valeur sous forme de JSON valide (les chaînes doivent être encodées)
    settingsData[key] = JSON.stringify(input.value.trim());
  });

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'update_settings',
      data: settingsData
    });

    if (res.success) {
      alert("Les textes ont été enregistrés avec succès.");
      // Mettre à jour le cache local
      Object.entries(settingsData).forEach(([k, v]) => {
        siteData.settings[k] = v;
      });
    }
  } catch (error) {
    alert("Erreur d'enregistrement : " + error.message);
  }
}

/**
 * ============================================================================
 * ACTUALITÉS
 * ============================================================================
 */

function renderActualitesManagement() {
  const grid = document.getElementById('adminActualitesList');
  grid.innerHTML = '';

  const list = siteData.actualites || [];

  if (list.length === 0) {
    grid.innerHTML = `<p class="text-muted text-center py-4" style="grid-column:1/-1;">Aucune actualité publiée. Cliquez sur "Nouvelle actualité" pour commencer.</p>`;
    return;
  }

  list.forEach(actu => {
    const card = document.createElement('div');
    card.className = 'review-admin-card';
    card.innerHTML = `
      <div class="review-admin-header">
        <strong>${actu.titre}</strong>
        <span style="font-size:12px;color:var(--color-text-muted);">${actu.publie ? '✅ Publié' : '⏸ Brouillon'}</span>
      </div>
      ${actu.sous_titre ? `<div style="font-size:13px;color:var(--color-text-muted);margin-bottom:6px;">${actu.sous_titre}</div>` : ''}
      <div class="review-admin-body" style="max-height:80px;overflow:hidden;">${actu.contenu}</div>
      <div class="review-admin-footer">
        <span style="font-size:12px;">${new Date(actu.created_at).toLocaleDateString('fr-FR')}</span>
        <div class="gallery-card-actions">
          <button class="btn btn-icon" style="padding:4px;height:30px;width:30px;" title="Modifier" onclick="openActualiteModal('${actu.id}')">✏️</button>
          <button class="btn btn-icon" style="color:var(--color-danger);padding:4px;height:30px;width:30px;" title="Supprimer" onclick="deleteActualite('${actu.id}')">🗑️</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.openActualiteModal = function(id = null) {
  const form = document.getElementById('actualiteForm');
  form.reset();

  if (id) {
    const actu = (siteData.actualites || []).find(x => x.id === id);
    if (!actu) return;
    document.getElementById('actualiteModalTitle').textContent = "Modifier l'actualité";
    document.getElementById('actId').value = actu.id;
    document.getElementById('actTitre').value = actu.titre;
    document.getElementById('actSousTitre').value = actu.sous_titre || '';
    document.getElementById('actContenu').value = actu.contenu;
    document.getElementById('actPhotoUrl').value = actu.photo_url || '';
    document.getElementById('actPublie').checked = actu.publie;
  } else {
    document.getElementById('actualiteModalTitle').textContent = "Nouvelle actualité";
    document.getElementById('actId').value = '';
  }

  document.getElementById('actualiteModal').showModal();
};

async function saveActualite(e) {
  e.preventDefault();
  const btn = document.getElementById('actualiteSubmitBtn');
  setButtonLoading(btn, true);

  const id = document.getElementById('actId').value;
  const titre = document.getElementById('actTitre').value.trim();
  const sous_titre = document.getElementById('actSousTitre').value.trim();
  const contenu = document.getElementById('actContenu').value.trim();
  const photo_url = document.getElementById('actPhotoUrl').value.trim();
  const publie = document.getElementById('actPublie').checked;

  try {
    const res = await apiFetch('/api/update-site-content', 'POST', {
      action: 'manage_actualites',
      data: { id: id || undefined, titre, sous_titre: sous_titre || null, contenu, photo_url: photo_url || null, publie }
    });

    if (res.success) {
      document.getElementById('actualiteModal').close();
      await refreshPublicCache();
      renderActualitesManagement();
    }
  } catch (error) {
    alert("Erreur : " + error.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

window.deleteActualite = async function(id) {
  if (confirm("Supprimer cette actualité du site public ?")) {
    try {
      const res = await apiFetch('/api/update-site-content', 'POST', {
        action: 'manage_actualites',
        subaction: 'delete',
        data: { id }
      });
      if (res.success) {
        await refreshPublicCache();
        renderActualitesManagement();
      }
    } catch (error) {
      alert("Erreur : " + error.message);
    }
  }
};

/**
 * Rafraîchit les données du cache public (heures, carte, etc.)
 */
async function refreshPublicCache() {
  try {
    const res = await fetch('/api/get-site-content');
    const data = await res.json();
    if (data.success) {
      siteData = data;
    }
  } catch (e) {
    console.error("Cache refresh error:", e);
  }
}
