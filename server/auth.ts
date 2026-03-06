import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { storage, seedVenueData } from "./storage";

const PgSession = connectPgSimple(session);

export function setupAuth(app: Express) {
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "bevpro-dev-secret-change-in-prod",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) return done(null, false, { message: "Invalid email or password" });
          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return done(null, false, { message: "Invalid email or password" });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleConfigured = !!(googleClientId && googleClientSecret);

  if (googleConfigured) {
    const callbackURL = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
      : process.env.APP_URL
      ? `${process.env.APP_URL}/api/auth/google/callback`
      : "/api/auth/google/callback";

    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId!,
          clientSecret: googleClientSecret!,
          callbackURL,
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(null, false, { message: "No email from Google" });

            let user = await storage.getUserByEmail(email);

            if (!user) {
              const displayName = profile.displayName || email.split("@")[0];
              const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
              const org = await storage.createOrganization({
                name: `${displayName}'s Venue`,
                slug,
                plan: "starter",
              });

              const randomPass = await bcrypt.hash(Math.random().toString(36), 12);
              user = await storage.createUser({
                email,
                password: randomPass,
                name: displayName,
                role: "owner",
                organizationId: org.id,
              });

              seedVenueData(org.id).catch((err) => console.error("Seed data error:", err));
            }

            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
    console.log("Google OAuth configured");
  }

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, venueName, plan } = req.body;
      if (!email || !password || !name || !venueName) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const slug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const org = await storage.createOrganization({
        name: venueName,
        slug: slug + "-" + Date.now(),
        plan: plan || "starter",
      });

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: "owner",
        organizationId: org.id,
      });

      seedVenueData(org.id).catch((err) => console.error("Seed data error:", err));

      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Login failed after registration" });
        const { password: _, ...safeUser } = user;
        return res.status(201).json({ user: safeUser, organization: org });
      });
    } catch (err: any) {
      console.error("Registration error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        return res.json({ user: safeUser });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      return res.json({ success: true });
    });
  });

  app.get("/api/auth/config", (_req: Request, res: Response) => {
    res.json({ googleEnabled: googleConfigured });
  });

  if (googleConfigured) {
    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/login?error=google" }),
      (_req: Request, res: Response) => {
        res.redirect("/dashboard");
      }
    );
  }

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = req.user as any;
    const { password: _, ...safeUser } = user;
    let organization = null;
    if (user.organizationId) {
      organization = await storage.getOrganization(user.organizationId);
    }
    return res.json({ user: safeUser, organization });
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}
