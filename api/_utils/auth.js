const { getClient } = require('./db');

/**
 * Vérifie si l'utilisateur est authentifié et autorisé en tant qu'administrateur.
 * Lit l'en-tête "Authorization: Bearer <jwt_token>".
 * @param {object} req Objet de requête HTTP Vercel
 * @returns {Promise<{authenticated: boolean, user?: object, error?: string}>}
 */
const verifyAdmin = async (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'En-tête Authorization manquant ou mal formé.' };
  }

  const token = authHeader.split(' ')[1];
  
  // Utilise le client anonyme pour valider le JWT de l'utilisateur
  const supabase = getClient(false);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { authenticated: false, error: error ? error.message : 'Jeton de session invalide ou expiré.' };
  }

  // Vérifie la liste blanche des emails si configurée
  const allowedEmailsEnv = process.env.ADMIN_ALLOWED_EMAILS;
  if (allowedEmailsEnv) {
    const allowedEmails = allowedEmailsEnv.split(',').map(email => email.trim().toLowerCase());
    const userEmail = user.email ? user.email.toLowerCase() : '';
    
    if (!allowedEmails.includes(userEmail)) {
      return { 
        authenticated: false, 
        error: `Accès refusé. L'adresse email '${user.email}' n'est pas autorisée dans l'environnement (ADMIN_ALLOWED_EMAILS).` 
      };
    }
  }

  return { authenticated: true, user };
};

module.exports = {
  verifyAdmin
};
