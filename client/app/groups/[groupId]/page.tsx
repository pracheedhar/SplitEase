'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { useTheme, useColors } from '../../../context/ThemeContext';
import { groupApi, expenseApi, settlementApi, dashboardApi } from '../../../lib/api';

interface Member {
  userId: { _id: string; name: string; email: string; avatar?: string };
  role: string;
}
interface Balance { userId: string; netBalance: number; }
interface Settlement { fromUserId: string; toUserId: string; amount: number; }
interface Expense {
  _id: string; title: string; amount: number; currency: string;
  category: string; date: string;
  paidBy: Array<{ userId: { _id: string; name: string }; amount: number }>;
  participants: Array<{ userId: { _id: string; name: string } }>;
  isDeleted: boolean;
  splitType: string;
}
type Tab = 'expenses' | 'balances' | 'settlements' | 'analytics';
type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';

const CATEGORY_ICONS: Record<string, string> = {
  food: '🍕', transport: '🚗', accommodation: '🏨', entertainment: '🎬',
  utilities: '💡', shopping: '🛍️', health: '🏥', education: '📚', other: '📦',
};

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const c = useColors();
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
  const [fetchError, setFetchError] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Expense form state ──────────────────────────────────────────────────────
  const [expenseForm, setExpenseForm] = useState({
    title: '', amount: '', currency: 'USD', category: 'other',
    splitType: 'equal' as SplitType,
    participants: [] as string[],
    notes: '', paidBy: '',
  });
  // per-participant split values: { [userId]: number }
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setFetchError(false);
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
    } catch (err: any) {
      // 403/404 = not a member or group doesn't exist -> go to dashboard
      if (err.response?.status === 403 || err.response?.status === 404) {
        router.push('/dashboard');
      } else {
        setFetchError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  // Only fetch after auth is resolved
  useEffect(() => {
    if (!isLoading && isAuthenticated) fetchData();
  }, [fetchData, isLoading, isAuthenticated]);

  // Reset split values when participants or split type changes
  useEffect(() => {
    const initial: Record<string, number> = {};
    expenseForm.participants.forEach((id) => {
      if (expenseForm.splitType === 'shares') initial[id] = splitValues[id] ?? 1;
      else if (expenseForm.splitType === 'percentage') initial[id] = splitValues[id] ?? 0;
      else if (expenseForm.splitType === 'exact') initial[id] = splitValues[id] ?? 0;
    });
    setSplitValues(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseForm.participants, expenseForm.splitType]);

  // ─── Computed split summary ──────────────────────────────────────────────────
  const splitSummary = useMemo(() => {
    const amt = parseFloat(expenseForm.amount) || 0;
    const participants = expenseForm.participants;
    if (expenseForm.splitType === 'equal') {
      const each = participants.length > 0 ? amt / participants.length : 0;
      return { ok: true, msg: `${each.toFixed(2)} each` };
    }
    if (expenseForm.splitType === 'exact') {
      const total = participants.reduce((s, id) => s + (splitValues[id] || 0), 0);
      const diff = Math.abs(total - amt);
      return { ok: diff <= 0.01, msg: diff <= 0.01 ? `✓ Total matches` : `Remaining: ${(amt - total).toFixed(2)}` };
    }
    if (expenseForm.splitType === 'percentage') {
      const total = participants.reduce((s, id) => s + (splitValues[id] || 0), 0);
      const diff = Math.abs(total - 100);
      return { ok: diff <= 0.01, msg: diff <= 0.01 ? `✓ 100%` : `Remaining: ${(100 - total).toFixed(1)}%` };
    }
    if (expenseForm.splitType === 'shares') {
      const totalShares = participants.reduce((s, id) => s + (splitValues[id] || 0), 0);
      if (totalShares === 0) return { ok: false, msg: 'Enter shares' };
      return { ok: true, msg: participants.map((id) => `${getMemberName(id)}: ${(((splitValues[id] || 0) / totalShares) * (parseFloat(expenseForm.amount) || 0)).toFixed(2)}`).join(' · ') };
    }
    return { ok: true, msg: '' };
  }, [expenseForm, splitValues]);

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

    const amt = parseFloat(expenseForm.amount);
    const userId = user.id || (user as any)._id;
    const paidByUserId = expenseForm.paidBy || userId;
    const participantIds = expenseForm.participants.length > 0 ? expenseForm.participants : [userId];

    // Validate split
    if (expenseForm.splitType === 'exact') {
      const total = participantIds.reduce((s, id) => s + (splitValues[id] || 0), 0);
      if (Math.abs(total - amt) > 0.01) {
        alert(`Exact amounts must sum to ${amt.toFixed(2)}. Currently: ${total.toFixed(2)}`);
        return;
      }
    }
    if (expenseForm.splitType === 'percentage') {
      const total = participantIds.reduce((s, id) => s + (splitValues[id] || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        alert(`Percentages must sum to 100%. Currently: ${total.toFixed(1)}%`);
        return;
      }
    }
    if (expenseForm.splitType === 'shares') {
      const allPositive = participantIds.every((id) => (splitValues[id] || 0) > 0);
      if (!allPositive) { alert('All participants must have a share > 0'); return; }
    }

    // Build participants array per split type
    const participantsPayload = participantIds.map((id) => {
      const base = { userId: id };
      if (expenseForm.splitType === 'exact') return { ...base, amount: splitValues[id] || 0 };
      if (expenseForm.splitType === 'percentage') return { ...base, percentage: splitValues[id] || 0 };
      if (expenseForm.splitType === 'shares') return { ...base, share: splitValues[id] || 1 };
      return base;
    });

    setFormLoading(true);
    try {
      const payload = {
        title: expenseForm.title,
        amount: amt,
        currency: expenseForm.currency,
        category: expenseForm.category,
        splitType: expenseForm.splitType,
        paidBy: [{ userId: paidByUserId, amount: amt }],
        participants: participantsPayload,
        notes: expenseForm.notes,
      };

      if (editingExpenseId) {
        await expenseApi.update(groupId as string, editingExpenseId, payload);
      } else {
        await expenseApi.create(groupId as string, payload);
      }

      setShowExpenseForm(false);
      setEditingExpenseId(null);
      setExpenseForm({ title: '', amount: '', currency: 'USD', category: 'other', splitType: 'equal', participants: [], notes: '', paidBy: '' });
      setSplitValues({});
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpenseId(expense._id);
    
    // Extract paidBy user
    const paidByUserId = expense.paidBy?.[0]?.userId?._id || '';

    // Populate splitValues based on splitType
    const vals: Record<string, number> = {};
    const partIds: string[] = [];

    expense.participants?.forEach((p: any) => {
      const id = p.userId?._id || p.userId;
      if (id) {
        partIds.push(id);
        if (expense.splitType === 'exact') vals[id] = p.amount || 0;
        else if (expense.splitType === 'percentage') vals[id] = p.percentage || 0;
        else if (expense.splitType === 'shares') vals[id] = p.share || 1;
      }
    });

    setExpenseForm({
      title: expense.title || '',
      amount: String(expense.amount || ''),
      currency: expense.currency || 'USD',
      category: expense.category || 'other',
      splitType: expense.splitType || 'equal',
      participants: partIds,
      notes: expense.notes || '',
      paidBy: paidByUserId,
    });

    setSplitValues(vals);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Delete this expense?')) return;
    try { await expenseApi.delete(groupId as string, expenseId); fetchData(); } catch {}
  };

  const getMemberName = (userId: string) => {
    const m = group?.members?.find((m: Member) => m.userId._id === userId);
    return m?.userId?.name || userId;
  };

  const handleDownloadReport = () => {
    if (!group) return;

    let report = `==================================================\n`;
    report += `              SPLITEASE GROUP REPORT\n`;
    report += `==================================================\n\n`;

    report += `Group Name:       ${group.name}\n`;
    if (group.description) {
      report += `Description:      ${group.description}\n`;
    }
    report += `Currency:         ${group.currency}\n`;
    report += `Total Spend:      ${group.currency} ${dashboard?.totalGroupSpend?.toFixed(2) || '0.00'}\n`;
    report += `Created At:       ${new Date(group.createdAt || Date.now()).toLocaleDateString()}\n\n`;

    report += `--------------------------------------------------\n`;
    report += `MEMBERS LIST\n`;
    report += `--------------------------------------------------\n`;
    group.members?.forEach((m: Member, idx: number) => {
      report += `${idx + 1}. ${m.userId.name} (${m.userId.email}) - Role: ${m.role}\n`;
    });
    report += `\n`;

    report += `--------------------------------------------------\n`;
    report += `EXPENSES RECORD\n`;
    report += `--------------------------------------------------\n`;
    const activeExpenses = expenses.filter((e) => !e.isDeleted);
    if (activeExpenses.length === 0) {
      report += `No active expenses.\n`;
    } else {
      activeExpenses.forEach((e) => {
        const dateStr = new Date(e.date).toLocaleDateString();
        const paidByName = e.paidBy?.[0]?.userId?.name || 'Unknown';
        const participantsStr = e.participants?.map((p) => p.userId?.name || 'Unknown').join(', ');
        
        report += `• [${dateStr}] ${e.title}\n`;
        report += `  Amount:       ${e.currency} ${e.amount.toFixed(2)}\n`;
        report += `  Category:     ${e.category.toUpperCase()}\n`;
        report += `  Paid By:      ${paidByName}\n`;
        report += `  Split Type:   ${e.splitType}\n`;
        report += `  Participants: ${participantsStr}\n\n`;
      });
    }

    report += `--------------------------------------------------\n`;
    report += `NET BALANCES\n`;
    report += `--------------------------------------------------\n`;
    if (balances.length === 0) {
      report += `All settled up.\n`;
    } else {
      balances.forEach((b) => {
        const name = getMemberName(b.userId);
        const amt = b.netBalance;
        if (amt >= 0) {
          report += `• ${name}: Gets back ${group.currency} ${amt.toFixed(2)}\n`;
        } else {
          report += `• ${name}: Owes ${group.currency} ${Math.abs(amt).toFixed(2)}\n`;
        }
      });
    }
    report += `\n`;

    report += `--------------------------------------------------\n`;
    report += `SUGGESTED SETTLEMENTS TO RESOLVE DEBTS\n`;
    report += `--------------------------------------------------\n`;
    if (suggestedSettlements.length === 0) {
      report += `No settlements required. All debts are cleared.\n`;
    } else {
      suggestedSettlements.forEach((s) => {
        const fromName = getMemberName(s.fromUserId);
        const toName = getMemberName(s.toUserId);
        report += `• ${fromName} pays ${toName} -> ${group.currency} ${s.amount.toFixed(2)}\n`;
      });
    }
    report += `\n`;
    report += `==================================================\n`;
    report += `Generated by SplitEase on ${new Date().toLocaleString()}\n`;
    report += `==================================================\n`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${group.name.replace(/\s+/g, '_')}_Report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: c.bg }}>
        <div style={{ fontSize: '2.5rem' }}>⚠️</div>
        <p style={{ color: c.text, fontWeight: 600 }}>Failed to load group data</p>
        <button className="btn-primary" onClick={fetchData}>Retry</button>
        <button className="btn-ghost" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  if (loading || !group) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg }}>
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

  const SidebarContent = () => (
    <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <span className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>✂️ SplitEase</span>
        </Link>
      </div>
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <Link href="/dashboard" className="sidebar-link" onClick={() => setSidebarOpen(false)}>🏠 Dashboard</Link>
        <div className="sidebar-link active" style={{ cursor: 'default' }}>👥 {group.name}</div>
      </nav>
      <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ width: '2rem', height: '2rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: c.text, margin: 0 }}>{user?.name}</p>
          </div>
        </div>
        <button onClick={toggleTheme} className="btn-theme">
          {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button onClick={logout} className="btn-ghost" style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'flex-start' }}>
          🚪 Sign out
        </button>
      </div>
    </aside>
  );

  // ─── Split value inputs ─────────────────────────────────────────────────────
  const SplitValueInputs = () => {
    const participants = expenseForm.participants.length > 0
      ? expenseForm.participants
      : (group?.members?.map((m: Member) => m.userId._id) || []);

    if (expenseForm.splitType === 'equal') return null;

    const labelMap: Record<SplitType, string> = {
      equal: '', exact: 'Amount', percentage: '%', shares: 'Shares',
    };

    return (
      <div>
        <label className="label">
          {expenseForm.splitType === 'exact' && 'Amount per person'}
          {expenseForm.splitType === 'percentage' && 'Percentage per person'}
          {expenseForm.splitType === 'shares' && 'Shares per person'}
        </label>
        {participants.map((id: string) => (
          <div key={id} className="split-row">
            <span className="split-row-name">{getMemberName(id)}</span>
            <input
              type="number"
              className="split-row-input"
              min="0"
              step={expenseForm.splitType === 'percentage' ? '0.1' : '0.01'}
              value={splitValues[id] ?? (expenseForm.splitType === 'shares' ? 1 : 0)}
              onChange={(e) => setSplitValues((prev) => ({ ...prev, [id]: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
            />
            <span className="split-row-label">{labelMap[expenseForm.splitType]}</span>
          </div>
        ))}
        {splitSummary.msg && (
          <div className={`split-summary ${splitSummary.ok ? 'ok' : 'warn'}`}>
            {splitSummary.msg}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile header */}
      <header className="mobile-header">
        <button onClick={() => setSidebarOpen(true)}
          style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>☰</button>
        <span className="gradient-text" style={{ fontSize: '1.1rem', fontWeight: 800 }}>✂️ {group.name}</span>
        <button onClick={toggleTheme}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="app-layout">
        <SidebarContent />

        <main className="app-main">
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            {/* Group header */}
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.25rem', color: c.text }}>{group.name}</h1>
                {group.description && <p style={{ color: c.textDim, fontSize: '0.875rem', margin: 0 }}>{group.description}</p>}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="badge badge-indigo">{group.currency}</span>
                  <span style={{ color: c.textMuted, fontSize: '0.75rem' }}>{group.members?.length} members</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={handleDownloadReport} className="btn-ghost" style={{ fontSize: '0.8rem' }}>
                  📋 Download Report
                </button>
                <button onClick={copyInvite} className="btn-ghost" style={{ fontSize: '0.8rem' }}>
                  {copySuccess ? '✅ Copied!' : '🔗 Copy Invite'}
                </button>
                <button className="btn-primary" onClick={() => setShowExpenseForm(true)}>+ Add Expense</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: c.tabBg, borderRadius: '0.75rem', padding: '0.375rem', overflowX: 'auto', flexShrink: 0 }}>
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                    background: activeTab === tab.id ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                    color: activeTab === tab.id ? 'white' : c.textMuted }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* ── Expenses Tab ──────────────────────────────────────────────────── */}
            {activeTab === 'expenses' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {expenses.filter((e) => !e.isDeleted).length === 0 ? (
                  <div className="glass-card empty-state">
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💸</div>
                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>No expenses yet</p>
                    <button className="btn-primary" onClick={() => setShowExpenseForm(true)}>Add first expense</button>
                  </div>
                ) : (
                  expenses.filter((e) => !e.isDeleted).map((expense) => (
                    <div key={expense._id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(99,102,241,0.15)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                        {CATEGORY_ICONS[expense.category] || '📦'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, margin: '0 0 0.25rem', color: c.text }}>{expense.title}</p>
                        <p style={{ color: c.textDim, fontSize: '0.75rem', margin: 0 }}>
                          Paid by {expense.paidBy?.[0]?.userId?.name} · {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.25rem', color: c.text }}>
                          {expense.currency} {expense.amount.toFixed(2)}
                        </p>
                        <span className="badge badge-indigo">{expense.category}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
                        <button onClick={() => handleEditExpense(expense)}
                          style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '0.5rem', opacity: 0.6, transition: 'opacity 0.2s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}>✏️</button>
                        <button onClick={() => handleDeleteExpense(expense._id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', opacity: 0.6, transition: 'opacity 0.2s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}>🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Balances Tab ───────────────────────────────────────────────────── */}
            {activeTab === 'balances' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {balances.length === 0 ? (
                  <div className="glass-card empty-state">
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚖️</div>
                    <p style={{ fontWeight: 600 }}>All settled up!</p>
                  </div>
                ) : (
                  balances.map((b) => (
                    <div key={b.userId} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '2rem', height: '2rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                          {getMemberName(b.userId)?.[0]?.toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, color: c.text }}>{getMemberName(b.userId)}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: b.netBalance >= 0 ? '#4ade80' : '#f87171' }}>
                          {b.netBalance >= 0 ? '+' : ''}{b.netBalance.toFixed(2)}
                        </span>
                        <p style={{ fontSize: '0.7rem', color: c.textDim, margin: 0 }}>
                          {b.netBalance >= 0 ? 'gets back' : 'owes'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Settlements Tab ──────────────────────────────────────────────── */}
            {activeTab === 'settlements' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: c.text }}>💡 Suggested Settlements</h3>
                  {suggestedSettlements.length === 0 ? (
                    <p style={{ color: c.textDim, fontSize: '0.875rem' }}>All settled up! 🎉</p>
                  ) : (
                    suggestedSettlements.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', background: c.expRowBg, borderRadius: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: c.text }}>{getMemberName(s.fromUserId)}</span>
                        <span style={{ color: c.textDim }}>→ pays</span>
                        <span style={{ fontWeight: 600, color: c.text }}>{getMemberName(s.toUserId)}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#818cf8' }}>{group.currency} {s.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Analytics Tab ─────────────────────────────────────────────────── */}
            {activeTab === 'analytics' && dashboard && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
                  <p style={{ color: c.textDim, fontSize: '0.75rem', margin: '0 0 0.5rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Group Spend</p>
                  <p className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>
                    {group.currency} {dashboard.totalGroupSpend?.toFixed(2) || '0.00'}
                  </p>
                </div>
                {dashboard.categoryBreakdown?.map((cat: any) => (
                  <div key={cat._id} className="glass-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{CATEGORY_ICONS[cat._id] || '📦'}</div>
                    <p style={{ textTransform: 'capitalize', fontWeight: 600, margin: '0 0 0.25rem', color: c.text }}>{cat._id}</p>
                    <p style={{ color: '#818cf8', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{group.currency} {cat.total.toFixed(2)}</p>
                    <p style={{ color: c.textDim, fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{cat.count} expense{cat.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showExpenseForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 60, padding: '1rem', overflowY: 'auto' }}
          onClick={() => {
            setShowExpenseForm(false);
            setEditingExpenseId(null);
            setExpenseForm({ title: '', amount: '', currency: 'USD', category: 'other', splitType: 'equal', participants: [], notes: '', paidBy: '' });
            setSplitValues({});
          }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '560px', padding: '2rem', margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.5rem', color: c.text }}>
              {editingExpenseId ? 'Edit Expense' : 'Add Expense'}
            </h2>
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
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
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
                  <select className="select" value={expenseForm.splitType}
                    onChange={(e) => {
                      const st = e.target.value as SplitType;
                      setExpenseForm({ ...expenseForm, splitType: st });
                      setSplitValues({});
                    }}>
                    <option value="equal">⚖️ Equal Split</option>
                    <option value="exact">💵 Exact Amounts</option>
                    <option value="percentage">📊 By Percentage</option>
                    <option value="shares">🔢 By Shares</option>
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
                <label className="label">Participants (who shares this?)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {group.members?.map((m: Member) => {
                    const id = m.userId._id;
                    const selected = expenseForm.participants.includes(id);
                    return (
                      <button key={id} type="button"
                        onClick={() => setExpenseForm((f) => ({ ...f, participants: selected ? f.participants.filter((p) => p !== id) : [...f.participants, id] }))}
                        style={{ padding: '0.375rem 0.75rem', borderRadius: '9999px', border: '1px solid', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                          background: selected ? 'rgba(99,102,241,0.2)' : 'transparent',
                          borderColor: selected ? 'rgba(99,102,241,0.6)' : c.border,
                          color: selected ? '#818cf8' : c.textMuted }}>
                        {m.userId.name}
                      </button>
                    );
                  })}
                </div>
                {expenseForm.participants.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: c.textDim, marginTop: '0.375rem', marginBottom: 0 }}>
                    No one selected = all members share equally
                  </p>
                )}
              </div>

              {/* Dynamic split value inputs for non-equal splits */}
              <SplitValueInputs />

              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional notes" value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }}
                  onClick={() => {
                    setShowExpenseForm(false);
                    setEditingExpenseId(null);
                    setExpenseForm({ title: '', amount: '', currency: 'USD', category: 'other', splitType: 'equal', participants: [], notes: '', paidBy: '' });
                    setSplitValues({});
                  }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={formLoading}>
                  {formLoading ? <><span className="spinner" />Saving...</> : (editingExpenseId ? 'Save Changes' : 'Add Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
