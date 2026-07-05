'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%), var(--c-bg)', transition: 'background 0.3s ease', overflow: 'hidden' }}>
      {/* Decorative glows */}
      <div style={{ position: 'fixed', top: '-15rem', left: '-15rem', width: '50rem', height: '50rem', background: 'rgba(99,102,241,0.07)', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15rem', right: '-15rem', width: '50rem', height: '50rem', background: 'rgba(139,92,246,0.07)', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none' }} />

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--c-sidebar-border)', background: 'var(--c-sidebar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
        <span className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>✂️ SplitEase</span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/login" className="btn-ghost" style={{ padding: '0.5rem 1.25rem' }}>Sign In</Link>
          <Link href="/register" className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '6rem 2rem 4rem', textAlign: 'center' }}>
        <div className="animate-fade-in">
          <span style={{ display: 'inline-block', padding: '0.375rem 1rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '9999px', color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '2rem', letterSpacing: '0.05em' }}>
            ✨ PRODUCTION-READY EXPENSE SPLITTING
          </span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 1.5rem' }}>
            <span className="gradient-text">Split expenses.</span>
            <br />
            <span style={{ color: 'var(--c-text)' }}>Keep friendships.</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--c-text-muted)', maxWidth: '560px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Track group expenses, calculate balances automatically, and settle debts with smart payment suggestions.
            Built for roommates, trips, and events.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2rem', animation: 'pulse-glow 2s ease-in-out infinite' }}>
              Start splitting for free →
            </Link>
            <Link href="/login" className="btn-ghost" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 2rem 6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { icon: '⚖️', title: '4 Split Types', desc: 'Split equally, by exact amounts, percentages, or shares — whatever fits your situation.' },
            { icon: '🧮', title: 'Smart Settlements', desc: 'Our min-cash-flow algorithm reduces the number of transactions needed to settle everyone.' },
            { icon: '📊', title: 'Analytics Dashboard', desc: 'See spending by category, monthly trends, and net balances at a glance.' },
            { icon: '👥', title: 'Multi-payer Support', desc: 'Multiple people can pay for a single expense. We handle the math.' },
            { icon: '🔗', title: 'Invite via Link', desc: 'Share a unique invite code. Members join instantly — no account required to view.' },
            { icon: '🔒', title: 'Secure by Design', desc: 'HTTP-only cookies, JWT rotation, RBAC, rate limiting, and audit logs built in.' },
          ].map((f) => (
            <div key={f.title} className="glass-card"
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.12)'; }}
              style={{ padding: '1.75rem', transition: 'all 0.2s ease' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--c-text)' }}>{f.title}</h3>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--c-sidebar-border)', padding: '2rem', textAlign: 'center', color: 'var(--c-text-dim)', fontSize: '0.8rem' }}>
        Built with Next.js · Express · MongoDB · Redis · TypeScript
      </footer>
    </div>
  );
}
