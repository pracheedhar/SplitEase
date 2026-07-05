'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { groupApi, expenseApi, settlementApi, dashboardApi } from '../../../lib/api';

interface Member {
  userId: { _id: string; name: string; email: string; avatar?: string };
  role: string;
}

interface Balance {
  userId: string;
  netBalance: number;
}

interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

interface Expense {
  _id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  paidBy: Array<{ userId: { _id: string; name: string }; amount: number }>;
  participants: Array<{ userId: { _id: string; name: string } }>;
  isDeleted: boolean;
}

type Tab = 'expenses' | 'balances' | 'settlements' | 'analytics';

const CATEGORY_ICONS: Record<string, string> = {
  food: '🍕', transport: '🚗', accommodation: '🏨', entertainment: '🎬',
  utilities: '💡', shopping: '🛍️', health: '🏥', education: '📚', other: '📦',
};

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [suggestedSettlements, setSuggestedSettlements] = useState<Settlement[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    title: '', amount: '', currency: 'USD', category: 'other',
    splitType: 'equal' as 'equal' | 'exact' | 'percentage' | 'shares',
    participants: [] as string[], notes: '',
    paidBy: '' as string,
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [groupRes, expRes, balRes, dashRes] = await Promise.all([
        groupApi.getOne(groupId as string),
        expenseApi.getAll(groupId as string),
        expenseApi.getBalances(groupId as string),
        dashboardApi.get(groupId as string),
      ]);
      setGroup(groupRes.data.data.group);
      setExpenses(expRes.data.data.expenses);
      setBalances(balRes.data.data.balances || []);
      setSuggestedSettlements(balRes.data.data.suggestedSettlements || []);
      setDashboard(dashRes.data.data);
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyInvite = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormLoading(true);
    try {
      const userId = user.id || (user as any)._id;
      const paidByUserId = expenseForm.paidBy || userId;
      const amt = parseFloat(expenseForm.amount);
      const participantIds = expenseForm.participants.length > 0 ? expenseForm.participants : [userId];

      await expenseApi.create(groupId as string, {
        title: expenseForm.title,
        amount: amt,
        currency: expenseForm.currency,
        category: expenseForm.category,
        splitType: expenseForm.splitType,
        paidBy: [{ userId: paidByUserId, amount: amt }],
        participants: participantIds.map((id) => ({ userId: id })),
        notes: expenseForm.notes,
      });

      setShowExpenseForm(false);
      setExpenseForm({ title: '', amount: '', currency: 'USD', category: 'other', splitType: 'equal', participants: [], notes: '', paidBy: '' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create expense');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await expenseApi.delete(groupId as string, expenseId);
      fetchData();
    } catch {}
  };

  const getMemberName = (userId: string) => {
    const m = group?.members?.find((m: Member) => m.userId._id === userId);
    return m?.userId?.name || userId;
  };

  if (loading || !group) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'expenses', label: 'Expenses', icon: '💰' },
    { id: 'balances', label: 'Balances', icon: '⚖️' },
    { id: 'settlements', label: 'Settlements', icon: '🤝' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-surface-900)' }}>
      {/* Sidebar */}
      <aside style={{ width: '240px', flexShrink: 0, background: 'rgba(22,22,42,0.8)', borderRight: '1px solid rgba(99,102,241,0.1)', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <span className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>✂️ SplitEase</span>
          </Link>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Link href="/dashboard" className="sidebar-link">🏠 Dashboard</Link>
          <div className="sidebar-link active" style={{ cursor: 'default' }}>
            👥 {group.name}
          </div>
        </nav>
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.1)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{user?.name}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost" style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'flex-start' }}>🚪 Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Group header */}
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem' }}>{group.name}</h1>
              {group.description && <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>{group.description}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-indigo">{group.currency}</span>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{group.members?.length} members</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={copyInvite} className="btn-ghost" style={{ fontSize: '0.8rem' }}>
                {copySuccess ? '✅ Copied!' : '🔗 Copy Invite Code'}
              </button>
              <button className="btn-primary" onClick={() => setShowExpenseForm(true)}>+ Add Expense</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'rgba(22,22,42,0.6)', borderRadius: '0.75rem', padding: '0.375rem', width: 'fit-content' }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s ease',
                  background: activeTab === tab.id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#94a3b8' }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── Expenses Tab ────────────────────────────────────────────── */}
          {activeTab === 'expenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {expenses.filter((e) => !e.isDeleted).length === 0 ? (
                <div className="glass-card empty-state">
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💸</div>
                  <p style={{ color: '#94a3b8', fontWeight: 600, margin: '0 0 0.5rem' }}>No expenses yet</p>
                  <button className="btn-primary" onClick={() => setShowExpenseForm(true)}>Add first expense</button>
                </div>
              ) : (
                expenses.filter((e) => !e.isDeleted).map((expense) => (
                  <div key={expense._id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(99,102,241,0.15)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                      {CATEGORY_ICONS[expense.category] || '📦'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: '0 0 0.25rem', color: '#e2e8f0' }}>{expense.title}</p>
                      <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>
                        Paid by {expense.paidBy?.[0]?.userId?.name} · {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.25rem', color: '#e2e8f0' }}>
                        {expense.currency} {expense.amount.toFixed(2)}
                      </p>
                      <span className={`badge badge-indigo`}>{expense.category}</span>
                    </div>
                    <button onClick={() => handleDeleteExpense(expense._id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', opacity: 0.6, transition: 'opacity 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}>
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Balances Tab ─────────────────────────────────────────────── */}
          {activeTab === 'balances' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {balances.length === 0 ? (
                <div className="glass-card empty-state">
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚖️</div>
                  <p style={{ color: '#94a3b8', fontWeight: 600 }}>All settled up!</p>
                </div>
              ) : (
                balances.map((b) => (
                  <div key={b.userId} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '2rem', height: '2rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                        {getMemberName(b.userId)?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{getMemberName(b.userId)}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: b.netBalance >= 0 ? '#4ade80' : '#f87171' }}>
                      {b.netBalance >= 0 ? '+' : ''}{b.netBalance.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Settlements Tab ───────────────────────────────────────────── */}
          {activeTab === 'settlements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>💡 Suggested Settlements</h3>
                {suggestedSettlements.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.875rem' }}>All settled up! 🎉</p>
                ) : (
                  suggestedSettlements.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(99,102,241,0.05)', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{getMemberName(s.fromUserId)}</span>
                      <span style={{ color: '#64748b' }}>→ pays</span>
                      <span style={{ fontWeight: 600 }}>{getMemberName(s.toUserId)}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#818cf8' }}>{group.currency} {s.amount.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Analytics Tab ─────────────────────────────────────────────── */}
          {activeTab === 'analytics' && dashboard && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="glass-card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Group Spend</p>
                <p className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>
                  {group.currency} {dashboard.totalGroupSpend?.toFixed(2) || '0.00'}
                </p>
              </div>
              {dashboard.categoryBreakdown?.map((cat: any) => (
                <div key={cat._id} className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{CATEGORY_ICONS[cat._id] || '📦'}</div>
                  <p style={{ textTransform: 'capitalize', fontWeight: 600, margin: '0 0 0.25rem', color: '#e2e8f0' }}>{cat._id}</p>
                  <p style={{ color: '#818cf8', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{group.currency} {cat.total.toFixed(2)}</p>
                  <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{cat.count} expense{cat.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }}
          onClick={() => setShowExpenseForm(false)}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '560px', padding: '2rem', margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.5rem' }}>Add Expense</h2>
            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Title *</label>
                <input className="input" placeholder="e.g. Dinner at Barbeque Nation" value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="label">Amount *</label>
                  <input className="input" type="number" step="0.01" min="0.01" placeholder="0.00" value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select className="select" value={expenseForm.currency} onChange={(e) => setExpenseForm({ ...expenseForm, currency: e.target.value })}>
                    <option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="label">Category</label>
                  <select className="select" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
                      <option key={key} value={key}>{icon} {key.charAt(0).toUpperCase() + key.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Split Type</label>
                  <select className="select" value={expenseForm.splitType} onChange={(e) => setExpenseForm({ ...expenseForm, splitType: e.target.value as any })}>
                    <option value="equal">Equal Split</option>
                    <option value="exact">Exact Amounts</option>
                    <option value="percentage">By Percentage</option>
                    <option value="shares">By Shares</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Paid By</label>
                <select className="select" value={expenseForm.paidBy} onChange={(e) => setExpenseForm({ ...expenseForm, paidBy: e.target.value })}>
                  <option value="">Myself ({user?.name})</option>
                  {group.members?.map((m: Member) => (
                    <option key={m.userId._id} value={m.userId._id}>{m.userId.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Participants (select all who share)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {group.members?.map((m: Member) => {
                    const id = m.userId._id;
                    const selected = expenseForm.participants.includes(id);
                    return (
                      <button key={id} type="button"
                        onClick={() => setExpenseForm((f) => ({ ...f, participants: selected ? f.participants.filter((p) => p !== id) : [...f.participants, id] }))}
                        style={{ padding: '0.375rem 0.75rem', borderRadius: '9999px', border: '1px solid', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                          background: selected ? 'rgba(99,102,241,0.2)' : 'transparent',
                          borderColor: selected ? 'rgba(99,102,241,0.6)' : 'rgba(148,163,184,0.2)',
                          color: selected ? '#818cf8' : '#94a3b8' }}>
                        {m.userId.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional notes" value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowExpenseForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={formLoading}>
                  {formLoading ? <><span className="spinner" />Saving...</> : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
