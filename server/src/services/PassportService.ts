import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

export const configurePassport = (): void => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // Base server URL (e.g., http://localhost:5001) used to build redirect uri
  const apiURL = process.env.API_URL || 'http://localhost:5001';

  if (!clientID || !clientSecret) {
    logger.warn('Google OAuth clientID or clientSecret not configured — Google Sign-in disabled.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: `${apiURL}/api/v1/auth/google/callback`,
        passReqToCallback: true,
      },
      async (_req, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('Google profile does not contain an email address'), undefined);
          }

          // Check if user already exists
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email }],
          });

          if (user) {
            // Update Google ID link if email matches but Google ID wasn't linked
            if (!user.googleId) {
              user.googleId = profile.id;
              if (profile.photos?.[0]?.value && !user.avatar) {
                user.avatar = profile.photos[0].value;
              }
              await user.save();
            }
          } else {
            // Create user
            user = await User.create({
              name: profile.displayName || `${profile.name?.givenName} ${profile.name?.familyName}`,
              email,
              googleId: profile.id,
              avatar: profile.photos?.[0]?.value,
              isVerified: true,
            });
          }

          return done(null, user);
        } catch (err: any) {
          logger.error(`Error in Google OAuth Strategy: ${err.message}`);
          return done(err, undefined);
        }
      }
    )
  );
};
