/**
 * Sending email.
 *
 * **No transport is chosen yet.** Picking one (SES, Postmark, SMTP to whatever a school's host
 * provides) is a deployment decision with cost and deliverability consequences, and it deserves an
 * ADR written by whoever knows where this will run. So this is a port with two implementations
 * that are honest about doing nothing, exactly as the payment provider is.
 *
 * The point of building it this way is that everything *around* sending — a token that expires,
 * that can be spent once, that revokes every session when it is used — is the substance of a
 * password reset, and none of it has to wait for a decision about SMTP.
 */
import type { Logger } from '../logger/index.js';

export interface PasswordResetEmail {
  to: string;
  /** The raw token. Never persisted anywhere; the database holds only its hash. */
  token: string;
  expiresInMinutes: number;
}

export interface Mailer {
  /** Resolves when the message has been handed off. Rejects when it certainly was not sent. */
  sendPasswordReset: (message: PasswordResetEmail) => Promise<void>;
}

/**
 * Prints the reset link instead of sending it. **Local development only.**
 *
 * It refuses to run in production rather than trusting configuration, because the failure it
 * prevents is a live password-reset token written to a log aggregator — a credential, retained,
 * searchable, and shipped to whoever can read Loki. A misconfigured environment variable should
 * not be enough to cause that.
 */
export function createConsoleMailer(logger: Logger, nodeEnv: string): Mailer {
  if (nodeEnv === 'production') {
    throw new Error(
      'The console mailer prints password-reset tokens and must never run in production. ' +
        'Configure a real transport, or set MAIL_TRANSPORT=none to disable password reset.',
    );
  }

  return {
    sendPasswordReset: ({ to, token, expiresInMinutes }) => {
      logger.warn(
        { to, token, expiresInMinutes },
        'Password reset (console mailer — this token is in your logs on purpose, locally)',
      );
      return Promise.resolve();
    },
  };
}

/**
 * Sends nothing and says so loudly.
 *
 * The default in production until a transport is chosen. Password reset then answers the user
 * exactly as it always does — it must never reveal whether an address is registered — while
 * telling operators, at error level, that somebody could not get back into their account.
 */
export function createNullMailer(logger: Logger): Mailer {
  return {
    sendPasswordReset: ({ to }) => {
      logger.error(
        { to },
        'Password reset requested but no mail transport is configured — nothing was sent',
      );
      return Promise.reject(new Error('No mail transport is configured.'));
    },
  };
}

export function createMailer(
  transport: 'console' | 'none',
  logger: Logger,
  nodeEnv: string,
): Mailer {
  return transport === 'console' ? createConsoleMailer(logger, nodeEnv) : createNullMailer(logger);
}
