import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn('WARNING: API_KEY not configured. Authentication is disabled.');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Missing Authorization header',
    });
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer') {
    res.status(401).json({
      error: 'Invalid authentication scheme',
      message: 'Use Bearer token authentication',
    });
    return;
  }

  if (token !== API_KEY) {
    res.status(401).json({
      error: 'Invalid API key',
      message: 'Authentication failed',
    });
    return;
  }

  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !API_KEY) {
    next();
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme === 'Bearer' && token === API_KEY) {
    next();
    return;
  }

  res.status(401).json({
    error: 'Invalid API key',
    message: 'Authentication failed',
  });
}
