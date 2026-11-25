import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function privateAccess(env: NodeJS.ProcessEnv): RequestHandler | undefined {
  const user = env.VOS_ACCESS_USER;
  const password = env.VOS_ACCESS_PASSWORD;
  const required = env.VOS_REQUIRE_PRIVATE_ACCESS === '1' || Boolean(env.RAILWAY_ENVIRONMENT_ID);
  if (!required && user === undefined && password === undefined) return;
  if (!user || user.includes(':') || !password || password.length < 24) {
    throw new Error('Private access requires VOS_ACCESS_USER and a VOS_ACCESS_PASSWORD of at least 24 characters.');
  }

  const expected = digest(`${user}:${password}`);
  return (request, response, next) => {
    const authorization = request.get('authorization') ?? '';
    const token = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)?.[1];
    response.set('Cache-Control', 'private, no-store');
    if (!token || !timingSafeEqual(expected, digest(Buffer.from(token, 'base64').toString('utf8')))) {
      response.set('WWW-Authenticate', 'Basic realm="Venky Analytics OS", charset="UTF-8"');
      response.status(401).send('Sign in to Venky Analytics OS.');
      return;
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.get('origin');
      let sameHost = !origin;
      if (origin) {
        try { sameHost = new URL(origin).host === request.get('host'); } catch { sameHost = false; }
      }
      if (!sameHost || request.get('sec-fetch-site') === 'cross-site') {
        response.status(403).json({ error: 'This operation must originate from your workspace.' });
        return;
      }
    }
    next();
  };
}
