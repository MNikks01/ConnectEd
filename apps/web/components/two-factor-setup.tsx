'use client';

/**
 * Enrolling in two-factor authentication (FR-AUTH-012).
 *
 * Three states, and the middle one is the whole point: **the QR code is shown, and nothing is
 * switched on until a code proves the authenticator actually holds the secret.** A scan can fail
 * silently — a camera that focused on the wrong thing, a screenshot of the wrong window — and an
 * enrolment trusted before the first correct code locks somebody out of their own account.
 *
 * The recovery codes appear once. The screen says so before they are shown rather than after, so
 * nobody closes it and then discovers what they have lost.
 */
import { Button, Card, Field } from '@connected/ui';
import { useEffect, useState, useTransition } from 'react';
import QRCode from 'qrcode';

import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  startTwoFactorAction,
} from '@/app/(app)/(member)/actions';

interface Enrolment {
  otpauthUri: string;
  secret: string;
}

function QrCode({ uri }: { uri: string }) {
  const [dataUrl, setDataUrl] = useState<string | undefined>();

  useEffect(() => {
    // Rendered in the browser, so the URI — which contains the secret — never becomes part of a
    // server-rendered payload that might be cached or logged along the way.
    QRCode.toDataURL(uri, { width: 220, margin: 1 })
      .then(setDataUrl)
      .catch(() => {
        setDataUrl(undefined);
      });
  }, [uri]);

  if (!dataUrl) {
    return (
      <p className="muted">
        The code could not be drawn. Type the key below into your authenticator instead.
      </p>
    );
  }

  return (
    <img
      src={dataUrl}
      // Not decorative, and not readable either: the alt says what it is and points at the
      // fallback, because a screen-reader user cannot scan it and needs the key.
      alt="QR code for your authenticator app. If you cannot scan it, use the key below."
      style={{ display: 'block', margin: 'var(--ui-space-3) 0' }}
    />
  );
}

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [enrolment, setEnrolment] = useState<Enrolment | undefined>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (recoveryCodes) {
    return (
      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Save these somewhere safe</h2>
        <p>
          Each of these works once, in place of a code from your app. They are shown now and never
          again — if you lose your phone without them, only a colleague with database access can get
          you back in.
        </p>
        <ul style={{ fontFamily: 'monospace', columns: 2, listStyle: 'none', padding: 0 }}>
          {recoveryCodes.map((recovery) => (
            <li key={recovery}>{recovery}</li>
          ))}
        </ul>
        <Button
          onClick={() => {
            setRecoveryCodes(undefined);
          }}
        >
          I have written them down
        </Button>
      </Card>
    );
  }

  if (enabled) {
    return (
      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Two-factor is on</h2>
        {error ? (
          <p className="ui-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <p>
          You are asked for a code from your authenticator when you sign in. Turning it off needs a
          current code — a signed-in browser is not enough, which is the point of it.
        </p>
        <Field
          name="code"
          label="Code from your authenticator"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        <Button
          variant="danger"
          loading={pending}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              const result = await disableTwoFactorAction(code);
              if (!result.ok) setError(result.message);
            });
          }}
        >
          Turn off two-factor
        </Button>
      </Card>
    );
  }

  if (enrolment) {
    return (
      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Scan this, then prove it</h2>
        {error ? (
          <p className="ui-field__error" role="alert">
            {error}
          </p>
        ) : null}

        <QrCode uri={enrolment.otpauthUri} />

        <p className="muted">
          Or type this key in by hand: <code>{enrolment.secret}</code>
        </p>

        <p>
          {/* Said before the code is asked for, so nobody wonders why it is not on yet. */}
          Nothing changes until you enter a code below. If the scan did not work, this is where you
          will find out.
        </p>

        <Field
          name="code"
          label="Code from your authenticator"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />

        <Button
          loading={pending}
          onClick={() => {
            setError(undefined);
            startTransition(async () => {
              const result = await confirmTwoFactorAction(code);
              if (result.ok && result.recoveryCodes) {
                setRecoveryCodes(result.recoveryCodes);
                setEnrolment(undefined);
                setCode('');
              } else {
                setError(result.message ?? 'That code is not right. Try the next one.');
              }
            });
          }}
        >
          Turn on two-factor
        </Button>
      </Card>
    );
  }

  return (
    <Card as="section">
      <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Two-factor is off</h2>
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <p>
        Your account can approve members and reach every family at the school. A password alone is
        one thing somebody can guess or reuse from somewhere else.
      </p>
      <Button
        loading={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await startTwoFactorAction();
            if (result.ok && result.enrolment) setEnrolment(result.enrolment);
            else setError(result.message);
          });
        }}
      >
        Set up two-factor
      </Button>
    </Card>
  );
}
