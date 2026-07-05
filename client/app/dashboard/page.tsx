'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { groupApi } from '../../lib/api';

interface Group {
  _id: string;
  name: string;
  description?: string;
  currency: string;
  members: any[];
  inviteCode: string;
}

export default function DashboardPage() {
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(true);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', currency: 'USD' });
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      groupApi.getAll().then((r) => {
        setGroups(r.data.data.groups);
        setFetchingGroups(false);
      }).catch(() => setFetchingGroups(false));
    }
  }, [isAuthenticated]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const { data } = await groupApi.create(newGroup);
      setGroups((prev) => [data.data.group, ...prev]);
      setShowNewGroup(false);
      setNewGroup({ name: '', description: '', currency: 'USD' });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const { data } = await groupApi.join(inviteCode);
      setGroups((prev) => [data.data.group, ...prev]);
      setShowJoin(false);
      setInviteCode('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Invalid invite code');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-surface-900)' }}>
      {/* Sidebar */}
      <aside style={{ width: '240px', flexShrink: 0, background: 'rgba(22,22,42,0.8)', borderRight: '1px solid rgba(99,102,241,0.1)', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>
          <span className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800 }}>✂️ SplitEase</span>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Link href="/dashboard" className="sidebar-link active">📊 Dashboard</Link>
        </nav>
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.1)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
              <p style={{ fontSize: '0.7rem', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost" style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'flex-start' }}>
            🚪 Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Your Groups</h1>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your expense groups</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-ghost" onClick={() => setShowJoin(true)}>🔗 Join Group</button>
              <button className="btn-primary" onClick={() => setShowNewGroup(true)}>+ New Group</button>
            </div>
          </div>

          {/* Groups grid */}
          {fetchingGroups ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
            </div>
          ) : groups.length === 0 ? (
            <div className="glass-card empty-state">
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💸</div>
              <h3 style={{ color: '#94a3b8', fontWeight: 600, margin: '0 0 0.5rem' }}>No groups yet</h3>
              <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Create a group to start splitting expenses</p>
              <button className="btn-primary" onClick={() => setShowNewGroup(true)}>Create your first group</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {groups.map((group) => (
                <Link key={group._id} href={`/groups/${group._id}`} style={{ textDecoration: 'none' }}>
                  <div className="glass-card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.12)'; }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                        👥
                      </div>
                      <span className="badge badge-indigo">{group.currency}</span>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.375rem', color: '#e2e8f0' }}>{group.name}</h3>
                    {group.description && (
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{group.description}</p>
                    )}
                    <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                      {group.members?.length || 0} member{group.members?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Group Modal */}
      {showNewGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }} onClick={() => setShowNewGroup(false)}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.5rem' }}>Create New Group</h2>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Group Name *</label>
                <input className="input" placeholder="e.g. Trip to Goa" value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Optional description" value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Default Currency</label>
                <select className="select" value={newGroup.currency} onChange={(e) => setNewGroup({ ...newGroup, currency: e.target.value })}>
                  <option value="USD">USD – US Dollar</option>
                  <option value="INR">INR – Indian Rupee</option>
                  <option value="EUR">EUR – Euro</option>
                  <option value="GBP">GBP – British Pound</option>
                  <option value="JPY">JPY – Japanese Yen</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewGroup(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? <><span className="spinner" />Creating...</> : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }} onClick={() => setShowJoin(false)}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.5rem' }}>Join a Group</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Invite Code</label>
                <input className="input" placeholder="Enter 10-char invite code" value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())} required maxLength={10}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowJoin(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={actionLoading}>
                  {actionLoading ? <><span className="spinner" />Joining...</> : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
