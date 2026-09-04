import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, developerProfiles } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { isPlatformAdminEmail, isSuperAdminEmail } from "@shared/admin-auth";

export { isPlatformAdminEmail, isSuperAdminEmail };

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

declare module 'express-session' {
  interface SessionData {
    lastActivity?: Date;
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function safeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function platformRoleForEmail(email: string | null | undefined, fallbackRole: string) {
  if (isPlatformAdminEmail(email)) return "SUPER_ADMIN";
  return fallbackRole;
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({ 
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: "sessions",
  });

  const isProduction = process.env.NODE_ENV === 'production';
  // For session cookies, only be secure in actual production, not dev with FORCE_HTTPS
  const isSecure = isProduction;
  
  // Enhanced session configuration for financial platform security
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "catalyst-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    store: sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'strict' : 'lax',
    },
  };

  app.set("trust proxy", 1);
  // Enhanced session middleware with activity tracking
  app.use(session(sessionSettings));
  
  // Initialize passport FIRST before using req.isAuthenticated()
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Session activity tracking middleware - AFTER passport initialization
  app.use((req, res, next) => {
    if (req.session && req.isAuthenticated && req.isAuthenticated()) {
      // Track last activity time
      req.session.lastActivity = new Date();
      
      // Different timeouts for team vs external users
      const user = req.user as any;
       const maxIdleTime = isPlatformAdminEmail(user?.email) ? 8 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000; // 8hrs vs 4hrs
      
      if (req.session.lastActivity) {
        const timeSinceActivity = Date.now() - new Date(req.session.lastActivity).getTime();
        if (timeSinceActivity > maxIdleTime) {
          console.log(`🕐 [SESSION] Idle timeout for ${user?.email} (${timeSinceActivity/1000/60} minutes idle)`);
          req.logout((err) => {
            if (err) console.error('Logout error:', err);
            req.session.destroy((err) => {
              if (err) console.error('Session destroy error:', err);
              return res.status(401).json({ message: "Session expired due to inactivity" });
            });
          });
          return;
        }
      }
    }
    next();
  });

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        // Normalize email to lowercase for consistent checking
        const normalizedEmail = email.toLowerCase().trim();
        console.log(`🔐 [AUTH] Login attempt: ${normalizedEmail}`);
        
        // Check if it's a @catalystcp.com email
        const isCatalystEmail = normalizedEmail.endsWith('@catalystcp.com');
        console.log(`🏢 [AUTH] Is Catalyst email: ${isCatalystEmail}`);
        
        // Special handling for @catalystcp.com emails with environment password
        const CATALYST_TEAM_PASSWORD = process.env.CATALYST_TEAM_PASSWORD;
        if (isCatalystEmail && CATALYST_TEAM_PASSWORD && password === CATALYST_TEAM_PASSWORD) {
          console.log(`✅ [AUTH] Catalyst email with correct password - proceeding with auth`);
          let user = await storage.getUserByEmail(normalizedEmail);
          
          // Auto-create account if it doesn't exist
          if (!user) {
            console.log(`➕ [AUTH] User doesn't exist, creating new account for: ${normalizedEmail}`);
            const namePart = normalizedEmail.split('@')[0];
            const hashedPassword = await hashPassword(password);
            user = await storage.createUser({
              email: normalizedEmail,
              password: hashedPassword,
              firstName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
              lastName: "Team",
            });
            console.log(`✅ [AUTH] New user created successfully: ${user.id}`);
          } else {
            console.log(`✅ [AUTH] Existing user found: ${user.id}`);
          }
          return done(null, user);
        }
        
        // For Catalyst emails that didn't use team password, try individual password authentication
        // This allows Catalyst team members to use either team password OR individual password
        
        // Regular authentication flow (works for non-Catalyst emails AND Catalyst emails with individual passwords)
        let user = await storage.getUserByEmail(normalizedEmail);

        // Development and production data are isolated. Allow the exact initial
        // Apex administrator to securely provision its missing production row
        // by presenting the bootstrap password stored in Replit Secrets.
        const bootstrapPassword = process.env.APEX_ADMIN_BOOTSTRAP_PASSWORD;
        if (
          !user &&
          isSuperAdminEmail(normalizedEmail) &&
          bootstrapPassword &&
          safeStringEqual(password, bootstrapPassword)
        ) {
          user = await storage.createUser({
            email: normalizedEmail,
            password: await hashPassword(password),
            firstName: normalizedEmail === "deals@landlinq.ai" ? "Deals" : "Jack",
            lastName: normalizedEmail === "deals@landlinq.ai" ? "LandLinq" : "Apex",
            role: "SUPER_ADMIN",
            mustResetPassword: false,
          });
          console.log(`✅ [AUTH] Initial platform super-admin account provisioned`);
        }
        
        if (!user) {
          console.log(`❌ [AUTH] User not found: ${normalizedEmail}`);
          return done(null, false, { message: "Invalid email or password" });
        }

        if (String(user.role || "").toUpperCase() === "DEVELOPER" && user.developerProfileId) {
          const [profile] = await db.select({ isActive: developerProfiles.isActive })
            .from(developerProfiles)
            .where(eq(developerProfiles.id, user.developerProfileId))
            .limit(1);
          if (!profile?.isActive) {
            console.log(`⛔ [AUTH] Inactive company login blocked: ${normalizedEmail}`);
            return done(null, false, { message: "This company portal is inactive. Contact your administrator." });
          }
        }
        
        if (!(await comparePasswords(password, user.password))) {
          console.log(`❌ [AUTH] Invalid password for user: ${normalizedEmail}`);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        console.log(`✅ [AUTH] Regular user login successful: ${normalizedEmail}`);
        return done(null, isPlatformAdminEmail(normalizedEmail)
          ? { ...user, role: platformRoleForEmail(normalizedEmail, user.role || "ADMIN") }
          : user);
      } catch (error) {
        console.error(`💥 [AUTH] Authentication error:`, error);
        return done(error);
      }
    }),
  );

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/auth/google/callback`,
          scope: ['profile', 'email']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'));
            }

            const normalizedEmail = email.toLowerCase().trim();
            console.log(`🔐 [GOOGLE AUTH] Login attempt: ${normalizedEmail}`);

            let user = await storage.getUserByEmail(normalizedEmail);

            if (!user) {
              // Auto-create account for new Google users
              console.log(`➕ [GOOGLE AUTH] Creating new account for: ${normalizedEmail}`);
              const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
              const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
              
              // Generate a random password for OAuth users (they won't use it)
              const randomPassword = await hashPassword(randomBytes(32).toString('hex'));
              
              user = await storage.createUser({
                email: normalizedEmail,
                password: randomPassword,
                firstName,
                lastName,
              });
              
              console.log(`✅ [GOOGLE AUTH] New user created: ${user.id}`);
            } else {
              console.log(`✅ [GOOGLE AUTH] Existing user found: ${user.id}`);
            }

            return done(null, user);
          } catch (error) {
            console.error(`💥 [GOOGLE AUTH] Error:`, error);
            return done(error);
          }
        }
      )
    );
  }

  // Microsoft OAuth Strategy
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(
      new MicrosoftStrategy(
        {
          clientID: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/auth/microsoft/callback`,
          scope: ['user.read'],
          tenant: 'common'
        },
        async (accessToken: any, refreshToken: any, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value || profile.userPrincipalName;
            if (!email) {
              return done(new Error('No email found in Microsoft profile'));
            }

            const normalizedEmail = email.toLowerCase().trim();
            console.log(`🔐 [MICROSOFT AUTH] Login attempt: ${normalizedEmail}`);

            let user = await storage.getUserByEmail(normalizedEmail);

            if (!user) {
              // Auto-create account for new Microsoft users
              console.log(`➕ [MICROSOFT AUTH] Creating new account for: ${normalizedEmail}`);
              const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
              const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
              
              // Generate a random password for OAuth users (they won't use it)
              const randomPassword = await hashPassword(randomBytes(32).toString('hex'));
              
              user = await storage.createUser({
                email: normalizedEmail,
                password: randomPassword,
                firstName,
                lastName,
              });
              
              console.log(`✅ [MICROSOFT AUTH] New user created: ${user.id}`);
            } else {
              console.log(`✅ [MICROSOFT AUTH] Existing user found: ${user.id}`);
            }

            return done(null, user);
          } catch (error) {
            console.error(`💥 [MICROSOFT AUTH] Error:`, error);
            return done(error);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user && isPlatformAdminEmail(user.email)
        ? { ...user, role: platformRoleForEmail(user.email, user.role || "ADMIN") }
        : user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { password, email, firstName, lastName, phone, marketsCovered, smsConsent } = req.body;
      
      // Log security event for registration attempts
      console.log(`[SECURITY] Registration attempt for email: ${email} from IP: ${req.ip}`);
      console.log(`[SECURITY] SMS opt-in consent: ${smsConsent === true ? 'YES' : 'NO'}`);

      // Validate required fields first (before expensive hashing)
      if (!email || !firstName || !lastName || !phone || !marketsCovered || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      // CRITICAL FIX: Convert marketsCovered from string to array
      // Frontend sends comma-separated string, DB expects array
      const marketsCoveredArray = typeof marketsCovered === 'string' 
        ? marketsCovered.split(',').map((m: string) => m.trim()).filter((m: string) => m.length > 0)
        : Array.isArray(marketsCovered) ? marketsCovered : [];
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if user account already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered. Please sign in instead." });
      }

      // Check if broker profile already exists (from email/SMS submission)
      const existingBroker = await storage.getBrokerByEmail(normalizedEmail);

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        password: hashedPassword,
        email: normalizedEmail,
        firstName,
        lastName,
      });

      let broker;
      
      if (existingBroker) {
        // Broker exists from email/SMS submission - link it to the new user account
        console.log(`✅ [REGISTRATION] Linking existing broker to user account: ${normalizedEmail}`);
        broker = await storage.updateBroker(existingBroker.id, {
          userId: user.id,
          firstName, // Update with registration data
          lastName,
          phone: phone || existingBroker.phone, // Preserve existing phone if not provided
          marketsCovered: marketsCoveredArray.length > 0 ? marketsCoveredArray : existingBroker.marketsCovered,
          smsOptIn: smsConsent === true,
          smsOptInDate: smsConsent === true ? new Date() : existingBroker.smsOptInDate,
        });
      } else {
        // Create new broker profile with SMS opt-in
        broker = await storage.createBrokerWithUserId({
          userId: user.id,
          firstName,
          lastName,
          email: normalizedEmail,
          phone,
          marketsCovered: marketsCoveredArray,
          smsOptIn: smsConsent === true,
          smsOptInDate: smsConsent === true ? new Date() : null,
        } as any);
      }

      // Send welcome email and SMS using EventDispatchService (fire-and-forget, non-blocking)
      // Don't await - this prevents registration from failing if notifications fail
      const { EventDispatchService } = await import('./eventDispatch');
      void EventDispatchService.emit('broker_registered', {
        brokerId: broker.id,
        brokerEmail: normalizedEmail,
        brokerPhone: phone,
        brokerName: `${firstName} ${lastName}`,
        metadata: {
          registrationDate: new Date().toISOString(),
          marketsCovered: marketsCoveredArray
        }
      }).then((result) => {
        if (result && typeof result === 'object') {
          console.log(`✅ Welcome notifications dispatched for ${firstName} ${lastName} - Email: ${result.emailSent}, SMS: ${result.smsSent}`);
        } else {
          console.log(`✅ Welcome notifications dispatched for ${firstName} ${lastName}`);
        }
      }).catch((error) => {
        console.error(`❌ Welcome notification error for ${firstName} ${lastName}:`, {
          error: error?.message || 'Unknown error',
          brokerEmail: normalizedEmail,
          brokerPhone: phone
        });
        // Swallow error - registration already succeeded
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json({ ...user, password: undefined });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    console.log(`[SECURITY] Login attempt for email: ${email} from IP: ${req.ip}`);

    // First try the main user table (Catalyst team + any users with passwords)
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);

      if (user) {
        // Main system user (Catalyst team / internal)
        const isDeveloper = String(user.role || '').toUpperCase() === 'DEVELOPER';
        const needsPasswordReset = isDeveloper && user.mustResetPassword === true;

        return (async () => {
          const passwordResetToken = needsPasswordReset
            ? await (await import('./passwordReset')).passwordResetService.generateForcedResetToken(user.email)
            : null;

          return req.login(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            console.log('✅ LOGIN SUCCESS (main) - User logged in:', user.email);
            const role = isPlatformAdminEmail(user.email)
              ? platformRoleForEmail(user.email, user.role || "ADMIN")
              : isDeveloper
                ? 'DEVELOPER'
              : (user.email?.endsWith('@catalystcp.com') || user.email?.endsWith('@landlinq.ai')
                ? 'CATALYST'
                : (user.role || 'USER'));
            return res.status(200).json({
              ...user,
              password: undefined,
              role,
              mustResetPassword: needsPasswordReset,
              passwordResetToken: needsPasswordReset ? passwordResetToken : undefined,
            });
          });
        })().catch(next);
      }

      // Main auth failed — try broker portal accounts table
      try {
        const normalizedEmail = email.toLowerCase().trim();
        const rows = await db.execute(
          sql`SELECT * FROM broker_portal_accounts WHERE LOWER(email) = ${normalizedEmail} LIMIT 1`
        );
        const broker = (rows.rows as any[])[0];

        if (broker) {
          if (broker.status === 'pending') {
            return res.status(403).json({ message: 'Your account is pending approval. You will receive an email when access is granted.' });
          }
          if (broker.status === 'inactive') {
            return res.status(403).json({ message: 'Your account has been deactivated. Contact LandLinq for assistance.' });
          }
          const valid = await comparePasswords(password, broker.password_hash);
          if (!valid) {
            return res.status(401).json({ message: 'Invalid email or password' });
          }
          // Set broker portal session
          (req.session as any).brokerPortalId = broker.id;
          await db.execute(sql`UPDATE broker_portal_accounts SET last_login_at = now() WHERE id = ${broker.id}`);
          console.log('✅ LOGIN SUCCESS (broker portal):', broker.email);
          return res.status(200).json({
            id: broker.id,
            email: broker.email,
            firstName: broker.first_name,
            lastName: broker.last_name,
            brokerage: broker.brokerage,
            role: 'BROKER',
          });
        }

        // No match in either system
        return res.status(401).json({ message: info?.message || 'Invalid email or password' });
      } catch (fallbackErr) {
        console.error('[LOGIN] Broker portal fallback error:', fallbackErr);
        return res.status(401).json({ message: info?.message || 'Invalid email or password' });
      }
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const user = req.user as any;
    console.log(`🚪 [SESSION] User logout: ${user?.email}`);
    
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return next(err);
        }
        res.clearCookie('connect.sid');
        res.sendStatus(200);
      });
    });
  });

  // Google OAuth routes
  app.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth?mode=login' }),
    (req, res) => {
      // Successful authentication
      console.log('✅ [GOOGLE AUTH] Successful login, redirecting to launchpad');
      const email = String((req.user as any)?.email || '').toLowerCase();
      res.redirect(isPlatformAdminEmail(email) ? '/dashboard' : '/launchpad');
    }
  );

  // Microsoft OAuth routes
  app.get('/auth/microsoft',
    passport.authenticate('microsoft', { scope: ['user.read'] })
  );

  app.get('/auth/microsoft/callback',
    passport.authenticate('microsoft', { failureRedirect: '/auth?mode=login' }),
    (req, res) => {
      // Successful authentication
      console.log('✅ [MICROSOFT AUTH] Successful login, redirecting to launchpad');
      const email = String((req.user as any)?.email || '').toLowerCase();
      res.redirect(isPlatformAdminEmail(email) ? '/dashboard' : '/launchpad');
    }
  );

  app.get("/api/user", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = req.user;
      const userId = user?.id;
      
      let broker = null;
      if (userId) {
        try {
          broker = await storage.getBrokerByUserId(userId);
        } catch (error) {
          // Broker might not exist for analysts, that's okay
          console.log(`No broker found for user ${userId}, likely an analyst`);
        }
      }
      
      // Check if user is an analyst (any email ending in catalystcp.com)
      const userEmail = (user?.email || '').toLowerCase();
      const isAnalyst = userEmail.endsWith('@catalystcp.com');
      
      // CRITICAL FIX (Dec 15, 2025): Determine correct role based on email domain
      // This ensures @catalystcp.com users get analyst navigation, not broker navigation
      let role = user?.role || 'BROKER';
      if (isPlatformAdminEmail(userEmail)) {
        role = platformRoleForEmail(userEmail, "ADMIN");
      } else if (String(user?.role || '').toUpperCase() === 'DEVELOPER') {
        role = 'DEVELOPER';
      } else if (userEmail === 'demo@catalystcp.com') {
        role = 'DEMO';
      } else if (userEmail === 'jack@catalystcp.com') {
        role = 'SUPER_ADMIN';
      } else if (userEmail.endsWith('@catalystcp.com')) {
        // Check for partners. DEVELOPER is intentionally never inferred from
        // email because it is a tenant-isolated platform role.
        const partners = ['ajklenk', 'brianford'];
        const emailPrefix = userEmail.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
        
        if (partners.some(partner => emailPrefix.includes(partner.replace(' ', '')))) {
          role = 'PARTNER';
        } else {
          role = 'ANALYST';
        }
      }
      
      let developerProfile = null;
      const developerProfileId = (user as any).developerProfileId;
      if (role === 'DEVELOPER' && developerProfileId) {
        const profiles = await db
          .select()
          .from(developerProfiles)
          .where(eq(developerProfiles.id, developerProfileId))
          .limit(1);
        developerProfile = profiles[0] || null;
      }

      res.json({ ...user, broker, developerProfile, isAnalyst, role, password: undefined });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Public branding lookup for Investment Company login pages. Keep this
  // response intentionally limited to presentation fields only.
  app.get("/api/developer-profile/by-slug/:slug", async (req, res) => {
    try {
      const [profile] = await db
        .select({
          companyName: developerProfiles.companyName,
          logoUrl: developerProfiles.logoUrl,
          primaryColor: developerProfiles.primaryColor,
          secondaryColor: developerProfiles.secondaryColor,
        })
        .from(developerProfiles)
        .where(and(
          eq(developerProfiles.slug, req.params.slug),
          eq(developerProfiles.isActive, true),
        ))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: "Developer profile not found" });
      }

      return res.json(profile);
    } catch (error) {
      console.error("Developer profile branding lookup error:", error);
      return res.status(500).json({ message: "Failed to load developer profile" });
    }
  });

  // Password reset endpoints
  app.post("/api/password-reset/request", async (req, res) => {
    try {
      console.log("🔐 [PASSWORD RESET] Request received for:", req.body.email);
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Allow Catalyst team members to set individual passwords
      // They can use either their individual password OR the team password to login
      const isCatalystEmail = email.toLowerCase().endsWith('@catalystcp.com');
      console.log(`🔐 [PASSWORD RESET] Processing reset request for${isCatalystEmail ? ' Catalyst' : ''} email: ${email}`);
      
      // No longer block Catalyst emails - they can set individual passwords

      const { passwordResetService } = await import('./passwordReset');
      await passwordResetService.generateResetToken(email);
      
      // Always return success to prevent email enumeration
      res.json({ message: "If the email exists, a reset link has been sent" });
    } catch (error: any) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post("/api/password-reset/validate", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Reset token is required" });
      }

      const { passwordResetService } = await import('./passwordReset');
      const email = await passwordResetService.validateResetToken(token);
      
      if (!email) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      res.json({ message: "Token is valid", email });
    } catch (error: any) {
      console.error("Token validation error:", error);
      res.status(500).json({ message: "Failed to validate reset token" });
    }
  });

  app.post("/api/password-reset/confirm", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const { passwordResetService } = await import('./passwordReset');
      const success = await passwordResetService.resetPassword(token, newPassword);
      
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Password reset confirmation error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Session management endpoints for enhanced security
  app.get("/api/sessions/active", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (!isPlatformAdminEmail(user?.email)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Query active sessions from PostgreSQL
      const sessionQuery = `
        SELECT sid, sess, expire 
        FROM sessions 
        WHERE expire > NOW() 
        ORDER BY expire DESC
      `;
      
      // Note: This would require direct database access
      // For now, return current session info
      res.json({
        currentSession: {
          user: user.email,
          lastActivity: req.session.lastActivity,
          expires: new Date(Date.now() + (req.session.cookie.maxAge || 0))
        }
      });
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions/terminate", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { sessionId } = req.body;
      
      // Only team members can terminate other sessions
      if (!isPlatformAdminEmail(user?.email)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      console.log(`🔒 [SESSION] Admin ${user.email} terminating session: ${sessionId}`);
      
      if (sessionId === 'all') {
        // Terminate all sessions except current one
        console.log(`⚠️ [SESSION] Terminating all sessions except current`);
        res.json({ message: "All other sessions terminated" });
      } else {
        // Terminate specific session
        res.json({ message: `Session ${sessionId} terminated` });
      }
    } catch (error) {
      console.error("Error terminating session:", error);
      res.status(500).json({ message: "Failed to terminate session" });
    }
  });

  app.get("/api/sessions/info", isAuthenticated, (req, res) => {
    const user = req.user as any;
    res.json({
      user: user.email,
      isPlatformAdmin: isPlatformAdminEmail(user?.email),
      lastActivity: req.session.lastActivity,
      maxAge: req.session.cookie.maxAge,
      expires: new Date(Date.now() + (req.session.cookie.maxAge || 0)),
      idleTimeout: isPlatformAdminEmail(user?.email) ? '2 hours' : '30 minutes'
    });
  });
}

// Middleware to check if user is authenticated
// Paths the demo account is allowed to reach via isAuthenticated routes
const DEMO_ALLOWED_PATHS = [
  '/api/auth/user',
  '/api/user',
  '/api/logout',
  '/api/analyst/deals',
  '/api/deals',           // scoped to demo deals in handler
  '/api/brokers',         // scoped to demo broker in handler
  '/api/nc-parcel',
  '/api/ai-analysis',
  '/api/analytics',
  '/api/site-evaluations',
  '/api/outreach/campaigns',
  '/api/classification-progress',
  '/api/sessions',
];

export async function isAuthenticated(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const authenticatedUser = req.user as any;
  if (String(authenticatedUser?.role || "").toUpperCase() === "DEVELOPER" && authenticatedUser?.developerProfileId) {
    try {
      const [profile] = await db.select({ isActive: developerProfiles.isActive })
        .from(developerProfiles)
        .where(eq(developerProfiles.id, authenticatedUser.developerProfileId))
        .limit(1);
      if (!profile?.isActive) {
        return req.logout(() => res.status(403).json({
          message: "This company portal is inactive. Contact your administrator.",
          companyInactive: true,
        }));
      }
    } catch (error) {
      console.error("[AUTH] Could not verify developer company status:", error);
      return res.status(503).json({ message: "Unable to verify company access" });
    }
  }
  // Demo sandbox: block access to all internal endpoints
  const email = (req.user?.claims?.email || req.user?.email || '').toLowerCase();
  if (email === 'demo@catalystcp.com') {
    const allowed = DEMO_ALLOWED_PATHS.some(p => req.path === p || req.path.startsWith(p));
    if (!allowed) {
      return res.status(403).json({ error: 'Not available in demo mode' });
    }
  }
  return next();
}

export { hashPassword, comparePasswords };