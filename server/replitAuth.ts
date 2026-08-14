import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  console.warn("REPLIT_DOMAINS not automatically provided by Replit platform - using fallback");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1', // Enable secure cookies for production
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Normalize email to lowercase to prevent case-sensitive duplicates
  const normalizedEmail = claims["email"]?.toLowerCase();
  await storage.upsertUser({
    id: claims["sub"],
    email: normalizedEmail,
    password: "", // Required by schema but not used for OAuth
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {
      claims: tokens.claims(),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.claims()?.exp
    };
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const domains = process.env.REPLIT_DOMAINS!.split(",");
  console.log("Setting up auth strategies for domains:", domains);
  
  for (const domain of domains) {
    const strategyName = `replitauth:${domain}`;
    const strategy = new Strategy(
      {
        name: strategyName,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
    console.log(`Registered auth strategy: ${strategyName}`);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const hostname = req.hostname;
    console.log(`Login attempt for hostname: ${hostname}`);
    
    // For development/localhost, redirect to production domain for auth
    if (hostname === 'localhost' || hostname.includes('127.0.0.1')) {
      const productionDomain = domains[0]; // Use first production domain
      const authUrl = `https://${productionDomain}/api/login`;
      console.log(`Redirecting localhost to production auth: ${authUrl}`);
      return res.redirect(authUrl);
    }
    
    // Check if we have a strategy for this hostname
    const strategyName = `replitauth:${hostname}`;
    try {
      passport.authenticate(strategyName, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (error) {
      console.error(`Auth strategy error for ${strategyName}:`, error);
      res.status(500).json({ error: "Authentication service not available" });
    }
  });

  app.get("/api/callback", (req, res, next) => {
    const hostname = req.hostname;
    const strategyName = `replitauth:${hostname}`;
    console.log(`Callback for hostname: ${hostname}, strategy: ${strategyName}`);
    
    passport.authenticate(strategyName, {
      failureRedirect: "/api/login",
    })(req, res, (err?: any) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.redirect("/api/login");
      }
      
      // Check if user is an analyst and redirect accordingly
      const user = req.user as any;
      const userEmail = user?.claims?.email || user?.email || '';
      
      if (userEmail.endsWith('@catalystcp.com')) {
        console.log(`Redirecting analyst ${userEmail} to dashboard`);
        return res.redirect("/analyst-dashboard");
      } else {
        console.log(`Redirecting broker ${userEmail} to homepage`);
        return res.redirect("/");
      }
    });
  });

  app.get("/api/logout", (req, res) => {
    const hostname = req.hostname;
    
    req.logout(() => {
      // For localhost development, just redirect to home
      if (hostname === 'localhost' || hostname.includes('127.0.0.1')) {
        return res.redirect('/');
      }
      
      // For production, use proper OIDC logout
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
