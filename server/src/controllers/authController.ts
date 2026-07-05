import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { tokenService } from '../services/TokenService.js';
import { AppError } from '../middlewares/error.js';
import { RegisterInput, LoginInput } from '../utils/validators.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password } = req.body as RegisterInput;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const payload = { id: user._id.toString(), email: user.email };
    const accessToken = tokenService.generateAccessToken(payload);
    const refreshToken = tokenService.generateRefreshToken(payload);

    // Persist refresh token (hashed) to DB
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      status: 'success',
      data: {
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          currencyPreference: user.currencyPreference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as LoginInput;

    // Select passwordHash explicitly (it's excluded by default)
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return next(new AppError('Invalid email or password.', 401));
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return next(new AppError('Invalid email or password.', 401));
    }

    const payload = { id: user._id.toString(), email: user.email };
    const accessToken = tokenService.generateAccessToken(payload);
    const refreshToken = tokenService.generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      status: 'success',
      data: {
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          currencyPreference: user.currencyPreference,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const incomingToken: string | undefined = req.cookies?.refreshToken;
    if (!incomingToken) {
      return next(new AppError('No refresh token provided.', 401));
    }

    // Verify the refresh token
    const { accessToken, refreshToken: newRefreshToken } =
      tokenService.rotateRefreshToken(incomingToken);

    // Validate token matches what's stored in DB
    const decoded = tokenService.verifyRefreshToken(newRefreshToken);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== incomingToken) {
      // Token reuse detected — invalidate all tokens
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
      return next(new AppError('Refresh token reuse detected. Please log in again.', 401));
    }

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
    res.status(200).json({ status: 'success', data: { accessToken } });
  } catch (err) {
    next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const incomingToken: string | undefined = req.cookies?.refreshToken;
    if (incomingToken) {
      // Clear refresh token from DB
      await User.findOneAndUpdate(
        { refreshToken: incomingToken },
        { $unset: { refreshToken: '' } }
      );
    }
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return next(new AppError('User not found.', 404));
    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    if (!user) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
      return;
    }

    const payload = { id: user._id.toString(), email: user.email };
    const accessToken = tokenService.generateAccessToken(payload);
    const refreshToken = tokenService.generateRefreshToken(payload);

    // Save refresh token to user in DB
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookie
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    // Redirect to frontend login handler with access token
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?token=${accessToken}`);
  } catch (err) {
    next(err);
  }
};
