'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);

    // The handler clears cookies whether or not the API call succeeds, so there is no failure
    // path that leaves the user apparently signed in.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);

    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" onClick={() => void onClick()} disabled={pending}>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
