declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface MicrosoftStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: MicrosoftStrategyOptions,
      verify: (
        accessToken: any,
        refreshToken: any,
        profile: any,
        done: (error: any, user?: any) => void
      ) => void
    );
  }
}
