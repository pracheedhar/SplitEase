import jwt from 'jsonwebtoken';

export interface TokenPayload {
  id: string;
  email: string;
}

export class TokenService {
  /**
   * Read secrets lazily from process.env at call-time, NOT at module load time.
   * This avoids the ESM hoisting problem where static imports run before
   * dotenv has a chance to populate process.env.
   */
  private get accessSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not defined in environment variables');
    return secret;
  }

  private get refreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    return secret;
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.accessSecret, { expiresIn: '15m' });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshSecret, { expiresIn: '7d' });
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.accessSecret) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.refreshSecret) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Rotates refresh token — verifies old one, issues a new pair.
   * Old refresh token should be invalidated by the caller (remove from DB).
   */
  rotateRefreshToken(oldRefreshToken: string): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload = this.verifyRefreshToken(oldRefreshToken);
    const cleanPayload: TokenPayload = { id: payload.id, email: payload.email };
    return {
      accessToken: this.generateAccessToken(cleanPayload),
      refreshToken: this.generateRefreshToken(cleanPayload),
    };
  }
}

export const tokenService = new TokenService();
