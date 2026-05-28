const { verifyAdmin } = require('./_utils/auth');

module.exports = async (req, res) => {
  // Configurer les en-têtes CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authResult = await verifyAdmin(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ authenticated: false, error: authResult.error });
    }

    return res.status(200).json({ 
      authenticated: true, 
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role
      } 
    });
  } catch (error) {
    console.error("[Auth Check Error]", error);
    return res.status(500).json({ authenticated: false, error: "Erreur interne du serveur." });
  }
};
