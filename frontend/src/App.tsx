import { useState } from 'react';
import { User } from './api';
import { AdminPage } from './pages/Admin';
import { CashierPage } from './pages/Cashier';
import { LiveBetting } from './pages/Betting';
import { LoginPage } from './pages/Login';
import { DEMO_PASSWORD, IS_PUBLIC_DEMO } from './demo';
import { DemoNotice } from './WakeGate';

export interface Session {
  token: string;
  user: User;
}

const STORAGE_KEY = 'paypoint.session';

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [signingIn, setSigningIn] = useState(false);

  const signIn = (next: Session) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    setSigningIn(false);
  };

  const signOut = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  if (!session) {
    return signingIn ? <LoginPage onSignIn={signIn} onBack={() => setSigningIn(false)} /> : <PublicHome onSignIn={() => setSigningIn(true)} />;
  }

  const admin = session.user.role === 'ADMIN';
  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          NekoBet
        </span>
        <span className="who">
          {session.user.email}
          <small>{admin ? 'Administrador' : 'Cajero'}</small>
        </span>
        <button className="link" onClick={signOut}>
          Salir
        </button>
      </header>
      <main>
        <header className="page-header">
          <h1>{admin ? 'Administración' : 'Punto de venta'}</h1>
          <p>{admin ? 'Puntos de venta, saldos y aliados B2B.' : 'Recargas, apuestas deportivas en vivo y casino con saldo prepagado.'}</p>
        </header>
        {admin ? (
          <AdminPage token={session.token} onUnauthorized={signOut} />
        ) : (
          <CashierPage token={session.token} onUnauthorized={signOut} />
        )}
        <DemoNotice />
      </main>
    </div>
  );
}

const noop = () => undefined;

/** What a visitor sees before signing in: the live board, read-only, and what each demo account can do. */
function PublicHome({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          NekoBet
        </span>
        <button className="link topbar-signin" onClick={onSignIn}>
          Ingresar
        </button>
      </header>
      <main>
        <header className="page-header">
          <h1>Apuestas deportivas en vivo</h1>
          <p>Partidos ficticios de fútbol, baloncesto, béisbol y hockey, con marcador, reloj y cuotas que se mueven en tiempo real.</p>
        </header>
        <section className="card public-guide" aria-label="Qué puedes hacer">
          <div>
            <h2>Sin cuenta</h2>
            <p>Mira el tablero en vivo, los próximos partidos y los finalizados, filtra por deporte o liga y abre cada partido con +N para ver todos sus mercados y el rastreador en vivo.</p>
          </div>
          <div>
            <h2>Cajero</h2>
            <p>
              Apuesta desde el cupón con el saldo prepagado del punto de venta, vende recargas y gift cards y juega en el casino. Usuario <code>cajero@paypoint.local</code>
              {IS_PUBLIC_DEMO && DEMO_PASSWORD && (
                <>
                  , contraseña <code>{DEMO_PASSWORD}</code>
                </>
              )}
              .
            </p>
          </div>
          <div>
            <h2>Administrador</h2>
            <p>
              Gestiona puntos de venta, recarga saldos y revisa los aliados B2B que venden por la API firmada. Usuario <code>admin@paypoint.local</code>
              {IS_PUBLIC_DEMO && DEMO_PASSWORD && ', misma contraseña'}.
            </p>
          </div>
          <button type="button" onClick={onSignIn}>
            Ingresar para apostar
          </button>
        </section>
        <LiveBetting onCompleted={noop} onUnauthorized={noop} onSignIn={onSignIn} />
        <DemoNotice />
      </main>
    </div>
  );
}
