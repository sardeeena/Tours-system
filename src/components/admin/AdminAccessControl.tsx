import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, Users, Layers3, Plus, Save, Trash2, RefreshCw, LockKeyhole, Check, Mail, UserCheck, UserX, KeyRound } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

type AccessUser = { id:string; email:string; full_name:string|null; legacy_role:string; is_confirmed:boolean; created_at:string; roles:string[] };
type AccessRole = { slug:string; name:string; description:string|null; is_system:boolean; is_active:boolean; permissions:string[] };
type AccessPermission = { key:string; module:string; action:string; description:string };
type AccessData = { users:AccessUser[]; roles:AccessRole[]; permissions:AccessPermission[] };
const rpc = (name:string,args?:Record<string,unknown>) =>
  (supabase as any).rpc(name,args) as Promise<{data:any;error:any}>;

const MODULE_LABELS:Record<string,string> = {
  analytics:'Analytics & Reports', audit:'Security & Audit', bookings:'Bookings',
  communications:'Communications', content:'Content & Website', crm:'CRM & Sales',
  customers:'Customers', finance:'Finance & Accounting', operations:'Operations',
  roles:'Role Management', settings:'Settings', tours:'Tours', users:'User Management'
};

export const AdminAccessControl:React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.includes('super_admin') || user?.role === 'super_admin');
  const [data,setData] = useState<AccessData>({users:[],roles:[],permissions:[]});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [section,setSection] = useState<'users'|'roles'>('users');
  const [search,setSearch] = useState('');
  const [selectedUserId,setSelectedUserId] = useState('');
  const [selectedRoles,setSelectedRoles] = useState<string[]>([]);
  const [roleName,setRoleName] = useState('');
  const [roleSlug,setRoleSlug] = useState('');
  const [roleDescription,setRoleDescription] = useState('');
  const [rolePermissions,setRolePermissions] = useState<string[]>([]);
  const [editingRoleSlug,setEditingRoleSlug] = useState<string|null>(null);
  const [expandedRoleSlug,setExpandedRoleSlug] = useState<string|null>(null);
  const [permissionSearch,setPermissionSearch] = useState('');
  const [hasLoaded,setHasLoaded] = useState(false);
  const [lastLoadedAt,setLastLoadedAt] = useState<string|null>(null);
  const [inviteEmail,setInviteEmail] = useState('');
  const [inviteName,setInviteName] = useState('');
  const [accountSuspended,setAccountSuspended] = useState<boolean|null>(null);
  const [accountBusy,setAccountBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const {data:result,error:rpcError}=await rpc('admin_list_access_control');
      if (rpcError) throw rpcError;
      if (!result || !Array.isArray(result.users) || !Array.isArray(result.roles) || !Array.isArray(result.permissions)) {
        throw new Error('The access-control service returned an invalid response. No changes were made.');
      }
      const next:AccessData = {
        users: result.users.map((u:any)=>({...u,roles:Array.isArray(u.roles)?u.roles:[]})),
        roles: result.roles.map((r:any)=>({...r,permissions:Array.isArray(r.permissions)?r.permissions:[]})),
        permissions: result.permissions,
      };
      setData(next);
      setSelectedUserId(current=>current&&next.users.some(u=>u.id===current)?current:(next.users[0]?.id||''));
      setHasLoaded(true);
      setLastLoadedAt(new Date().toISOString());
    } catch (err:any) {
      console.error('[AdminAccessControl] Failed to load live RBAC data:',err);
      setError(err?.message || 'Unable to load live users, roles and permissions. Check your connection and administrator access, then retry.');
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(()=>{void load();},[load]);

  const selectedUser=data.users.find(u=>u.id===selectedUserId);
  const protectedSuperAdmin = Boolean(selectedUser?.roles.includes('super_admin') && !isSuperAdmin);
  useEffect(()=>{setSelectedRoles(selectedUser?.roles||[]);},[selectedUserId,selectedUser?.roles?.join('|')]);

  const visibleUsers=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return data.users.filter(u=>!q||[u.email,u.full_name||'',u.legacy_role,...u.roles].join(' ').toLowerCase().includes(q));
  },[data.users,search]);

  const groupedPermissions=useMemo(()=>data.permissions.reduce<Record<string,AccessPermission[]>>((groups,p)=>{
    (groups[p.module] ||= []).push(p); return groups;
  },{}),[data.permissions]);
  const visiblePermissionGroups=useMemo(()=>Object.entries(groupedPermissions).map(([module,items])=>[
    module,
    items.filter(p=>!permissionSearch.trim() || [p.key,p.action,p.description,module].join(' ').toLowerCase().includes(permissionSearch.trim().toLowerCase()))
  ] as const).filter(([,items])=>items.length>0),[groupedPermissions,permissionSearch]);

  const toggleRole=(slug:string)=>setSelectedRoles(current=>current.includes(slug)?current.filter(x=>x!==slug):[...current,slug]);
  const togglePermission=(key:string)=>setRolePermissions(current=>current.includes(key)?current.filter(x=>x!==key):[...current,key]);
  const callAdminApi=async(path:string,method='GET',body?:Record<string,unknown>)=>{
    const {data:{session},error:sessionError}=await supabase.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error('Your administrator session has expired. Sign in again.');
    const response=await fetch(path,{method,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.success)throw new Error(result.error||'The account-management request failed.');
    return result;
  };

  useEffect(()=>{
    let active=true;
    setAccountSuspended(null);
    if(isSuperAdmin&&selectedUserId){
      void callAdminApi('/api/admin/users/'+encodeURIComponent(selectedUserId)+'/status')
        .then(result=>{if(active)setAccountSuspended(Boolean(result.is_suspended));})
        .catch(err=>{if(active){setAccountSuspended(null);console.warn('[AdminAccessControl] Could not load Auth status:',err);}});
    }
    return ()=>{active=false;};
  },[selectedUserId,isSuperAdmin]);

  const inviteAccount=async()=>{
    setAccountBusy('invite');setError('');setNotice('');
    try{
      const result=await callAdminApi('/api/admin/users/invite','POST',{email:inviteEmail,full_name:inviteName});
      setInviteEmail('');setInviteName('');
      setNotice(result.message||'Invitation sent.');
      await load();
    }catch(err:any){setError(err?.message||'Could not invite this account.');}
    finally{setAccountBusy('');}
  };

  const manageAccount=async(action:'suspend'|'reactivate'|'password-reset')=>{
    if(!selectedUser)return;
    if(action==='suspend'&&!window.confirm('Suspend '+selectedUser.email+'? They will lose access until reactivated.'))return;
    setAccountBusy(action);setError('');setNotice('');
    try{
      const result=await callAdminApi(
        action==='password-reset'?'/api/admin/users/'+encodeURIComponent(selectedUser.id)+'/password-reset':'/api/admin/users/'+encodeURIComponent(selectedUser.id)+'/status',
        'POST',
        action==='password-reset'?{}:{action}
      );
      if(action!=='password-reset')setAccountSuspended(Boolean(result.is_suspended));
      setNotice(result.message||(action==='suspend'?'Account suspended.':action==='reactivate'?'Account reactivated.':'Password-reset email requested.'));
    }catch(err:any){setError(err?.message||'The account action failed.');}
    finally{setAccountBusy('');}
  };

  const saveUserRoles=async()=>{
    if(!selectedUser)return;
    setSaving(true);setError('');setNotice('');
    try {
      const nextRoles=selectedRoles.length?selectedRoles:['customer'];
      const {data:result,error:rpcError}=await rpc('admin_assign_user_roles',{p_user_id:selectedUser.id,p_role_slugs:nextRoles});
      if(rpcError) throw rpcError;
      if(!result?.success) throw new Error('The database did not confirm the role assignment.');
      setNotice('Role assignments saved: '+nextRoles.join(', ')+'. The target user must refresh their session to receive updated access.');
      await load();
    } catch(err:any) {
      console.error('[AdminAccessControl] Role assignment failed:',err);
      setError(err?.message||'Could not save role assignments. No success was reported.');
    } finally {
      setSaving(false);
    }
  };

  const saveCustomRole=async()=>{
    if(!roleName.trim()||!roleSlug.trim()){setError('Enter a role name and a unique role ID.');return;}
    const normalizedSlug=roleSlug.trim().toLowerCase().replace(/\s+/g,'_');
    if(!/^[a-z][a-z0-9_]{1,49}$/.test(normalizedSlug)){setError('Role ID must start with a letter and contain only lowercase letters, numbers and underscores (2–50 characters).');return;}
    setSaving(true);setError('');setNotice('');
    try {
      const {data:result,error:rpcError}=await rpc('admin_upsert_access_role',{
        p_slug:normalizedSlug,
        p_name:roleName.trim(),p_description:roleDescription.trim(),p_permission_keys:rolePermissions
      });
      if(rpcError) throw rpcError;
      if(!result?.success) throw new Error('The database did not confirm the role change.');
      setNotice(editingRoleSlug?'Custom role permissions updated.':'Custom role created.');
      setRoleName('');setRoleSlug('');setRoleDescription('');setRolePermissions([]);setEditingRoleSlug(null);
      await load();
    } catch(err:any) {
      console.error('[AdminAccessControl] Custom role save failed:',err);
      setError(err?.message||'Could not save this role. No success was reported.');
    } finally {
      setSaving(false);
    }
  };
  const cancelRoleEdit=()=>{
    setRoleName('');setRoleSlug('');setRoleDescription('');setRolePermissions([]);setEditingRoleSlug(null);setError('');setNotice('');
  };

  const deleteRole=async(slug:string)=>{
    if(!window.confirm('Delete this custom role? It must not be assigned to any user.'))return;
    setSaving(true);setError('');setNotice('');
    try {
      const {data:result,error:rpcError}=await rpc('admin_delete_access_role',{p_slug:slug});
      if(rpcError) throw rpcError;
      if(!result?.success) throw new Error('The database did not confirm role deletion.');
      setNotice('Custom role deleted.');
      if(expandedRoleSlug===slug)setExpandedRoleSlug(null);
      if(editingRoleSlug===slug)cancelRoleEdit();
      await load();
    } catch(err:any) {
      console.error('[AdminAccessControl] Custom role deletion failed:',err);
      setError(err?.message||'Could not delete this role.');
    } finally {
      setSaving(false);
    }
  };

  if(loading&&!hasLoaded)return <div className="p-8 text-sm text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/> Loading live users, roles and permissions from Kemet Spirit…</div>;
  if(error&&!hasLoaded)return <div className="space-y-4 rounded-2xl border border-red-200 dark:border-red-900 p-6"><div role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className="w-4 h-4"/> Retry database connection</button></div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 text-[#0A6C74] dark:text-teal-300 text-xs font-bold uppercase tracking-widest"><ShieldCheck className="w-4 h-4"/> Security & Governance</div>
        <h2 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">Users, Roles & Permissions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Assign multiple roles to each account and configure permissions for custom roles.</p>
      </div>
      <button onClick={()=>void load()} disabled={loading||saving} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/> Refresh</button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500">Live accounts</div><div className="text-2xl font-bold mt-1">{data.users.length}</div></div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500">Active roles</div><div className="text-2xl font-bold mt-1">{data.roles.filter(r=>r.is_active).length}</div></div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500">Defined permissions</div><div className="text-2xl font-bold mt-1">{data.permissions.length}</div></div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><div className="text-xs text-slate-500">Custom roles</div><div className="text-2xl font-bold mt-1">{data.roles.filter(r=>!r.is_system).length}</div></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"/> Connected to live Supabase RBAC data</span>
      <span>Last refreshed: {lastLoadedAt?new Date(lastLoadedAt).toLocaleString():'Not yet refreshed'}</span>
    </div>
    {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 px-4 py-3 text-sm">{error}</div>}
    {notice&&<div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 px-4 py-3 text-sm">{notice}</div>}

    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
      <button onClick={()=>setSection('users')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${section==='users'?'border-[#0A6C74] text-[#0A6C74]':'border-transparent text-slate-500'}`}><Users className="inline w-4 h-4 mr-2"/>Users & Assignments</button>
      <button onClick={()=>setSection('roles')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${section==='roles'?'border-[#0A6C74] text-[#0A6C74]':'border-transparent text-slate-500'}`}><Layers3 className="inline w-4 h-4 mr-2"/>Roles & Permissions</button>
    </div>

    {section==='users'?<div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)] gap-5">
      <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#0A6C74]"/><h3 className="font-bold text-sm">Invite a new account</h3></div>
        {isSuperAdmin?<div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
          <input type="text" value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Full name (optional)" maxLength={120} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"/>
          <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="name@example.com" maxLength={254} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"/>
          <button type="button" onClick={()=>void inviteAccount()} disabled={Boolean(accountBusy)||!inviteEmail.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><Mail className="w-4 h-4"/>{accountBusy==='invite'?'Sending…':'Send invitation'}</button>
        </div>:<p className="mt-2 text-xs text-slate-500">Inviting accounts requires a Super Admin session with verified multi-factor authentication.</p>}
        <p className="mt-2 text-xs text-slate-500">Invitations are sent by Supabase Auth. New accounts receive the Customer role until an administrator assigns staff access.</p>
      </div>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-bold">Registered users <span className="text-slate-400 font-normal">({data.users.length})</span></h3>
          <div className="relative mt-3"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email or role…" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent pl-9 pr-3 py-2 text-sm"/></div>
        </div>
        <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {visibleUsers.map(u=><button key={u.id} onClick={()=>setSelectedUserId(u.id)} className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selectedUserId===u.id?'bg-teal-50 dark:bg-teal-950/20':''}`}>
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{u.full_name||'Unnamed user'}</div><div className="text-xs text-slate-500 mt-1 break-all">{u.email}</div>
            <div className="flex flex-wrap gap-1 mt-2">{u.roles.map(r=><span key={r} className="text-[10px] rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-1">{r}</span>)}</div>
          </button>)}
          {!visibleUsers.length&&<p className="p-5 text-sm text-slate-500">No matching users.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        {selectedUser?<><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{selectedUser.full_name||'User account'}</h3><p className="text-sm text-slate-500">{selectedUser.email}</p></div><span className="text-xs text-slate-500">{selectedUser.is_confirmed?'Email confirmed':'Email not confirmed'}</span></div>
          {isSuperAdmin&&<div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-sm font-semibold">Authentication status</div><div className="text-xs text-slate-500 mt-1">{accountSuspended===null?'Checking secure Auth status…':accountSuspended?'Suspended in Supabase Auth':'Active in Supabase Auth'}</div></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={()=>void manageAccount(accountSuspended?'reactivate':'suspend')} disabled={Boolean(accountBusy)||accountSuspended===null||selectedUser.id===user?.id||selectedUser.roles.includes('super_admin')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{accountSuspended?<UserCheck className="w-4 h-4"/>:<UserX className="w-4 h-4"/>}{accountBusy==='suspend'?'Suspending…':accountBusy==='reactivate'?'Reactivating…':accountSuspended?'Reactivate account':'Suspend account'}</button>
                <button type="button" onClick={()=>void manageAccount('password-reset')} disabled={Boolean(accountBusy)||protectedSuperAdmin} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><KeyRound className="w-4 h-4"/>{accountBusy==='password-reset'?'Sending…':'Send password reset'}</button>
              </div>
            </div>
            {(selectedUser.roles.includes('super_admin')||selectedUser.id===user?.id)&&<p className="text-xs text-amber-700 dark:text-amber-300 mt-2">Self-suspension and suspension of protected Super Admin accounts are disabled.</p>}
          </div>}
          <div className="mt-5 flex items-center justify-between gap-3"><div><h4 className="font-semibold text-sm">Assigned roles</h4><p className="text-xs text-slate-500 mt-1">Permissions from all selected roles are combined.</p></div><span className="text-xs rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200 px-2 py-1">{selectedRoles.length} selected</span></div>
          {protectedSuperAdmin ? <p className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">This account has protected Super Admin access. Only a Super Admin can modify its assignments.</p> : <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {data.roles.filter(r=>r.is_active&&(isSuperAdmin||r.slug!=='super_admin')).map(role=><label key={role.slug} className="flex gap-3 items-start rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-teal-500">
              <input type="checkbox" checked={selectedRoles.includes(role.slug)} onChange={()=>toggleRole(role.slug)} className="mt-1 accent-[#0A6C74]"/>
              <span className="min-w-0"><span className="block text-sm font-semibold">{role.name}</span><span className="block text-xs text-slate-500 mt-0.5">{role.description||role.slug}</span></span>
            </label>)}
          </div>}
          {!isSuperAdmin&&<p className="mt-4 text-xs text-amber-700 dark:text-amber-300 flex gap-2"><LockKeyhole className="w-4 h-4 shrink-0"/> Super Admin assignment and changes are restricted to an existing Super Admin.</p>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {!selectedRoles.length&&<p className="text-xs text-amber-700 dark:text-amber-300">No roles selected. Saving will return this account to the Customer role.</p>}
            <button disabled={saving||protectedSuperAdmin} onClick={()=>void saveUserRoles()} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Save className="w-4 h-4"/>{saving?'Saving…':'Save role assignments'}</button></div>
        </>:<p className="text-sm text-slate-500">Select a user to manage their roles.</p>}
      </section>
    </div>:<div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)] gap-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-bold">Available roles</h3><p className="text-xs text-slate-500 mt-1">Built-in roles are protected. Create custom roles for your organization.</p></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">{data.roles.map(r=><div key={r.slug} className="p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm">{r.name} {r.is_system&&<span className="text-[10px] uppercase text-slate-400 ml-1">Protected system role</span>}</div>
              <p className="text-xs text-slate-500 mt-1">{r.description||r.slug}</p>
              <p className="text-[11px] text-slate-400 mt-1">{r.permissions.length} permissions · {data.users.filter(u=>u.roles.includes(r.slug)).length} assigned accounts</p>
            </div>
            <div className="flex flex-wrap items-start gap-1 shrink-0">
              <button onClick={()=>setExpandedRoleSlug(expandedRoleSlug===r.slug?null:r.slug)} disabled={saving} title="Inspect role permissions" className="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-2 py-1 text-xs">{expandedRoleSlug===r.slug?'Hide permissions':'View permissions'}</button>
              {!r.is_system&&<><button onClick={()=>{setRoleName(r.name);setRoleSlug(r.slug);setRoleDescription(r.description||'');setRolePermissions(r.permissions);setEditingRoleSlug(r.slug);setSection('roles');}} disabled={saving} title="Edit custom role" className="text-[#0A6C74] hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg px-2 py-1 text-xs">Edit</button><button onClick={()=>void deleteRole(r.slug)} disabled={saving} title="Delete custom role" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg p-2"><Trash2 className="w-4 h-4"/></button></>}
            </div>
          </div>
          {expandedRoleSlug===r.slug&&<div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3">
            {r.permissions.length?<div className="flex flex-wrap gap-2">{r.permissions.map(permission=><span key={permission} className="text-[11px] rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">{permission}</span>)}</div>:<p className="text-xs text-slate-500">This role currently has no explicit module permissions. Customer/guide access may be controlled by ownership or assignment-specific policies.</p>}
          </div>}
        </div>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Plus className="w-5 h-5 text-[#0A6C74]"/><h3 className="text-lg font-bold">{editingRoleSlug?'Edit custom role':'Create a custom role'}</h3></div>{editingRoleSlug&&<button type="button" onClick={cancelRoleEdit} disabled={saving} className="text-xs text-slate-500 underline">Cancel edit</button>}</div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Role name<input value={roleName} onChange={e=>{setRoleName(e.target.value);if(!roleSlug)setRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));}} placeholder="e.g. Reservations Supervisor" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"/></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Role ID<input value={roleSlug} onChange={e=>setRoleSlug(e.target.value)} disabled={saving||Boolean(editingRoleSlug)} title={editingRoleSlug?'Role IDs cannot be changed while editing an existing role.':''} placeholder="reservations_supervisor" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm disabled:opacity-60"/></label>
        </div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">Description<textarea value={roleDescription} onChange={e=>setRoleDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"/></label>
        <div className="mt-5"><div className="font-semibold text-sm mb-1">Grant permissions</div><p className="text-xs text-slate-500 mb-3">Select only the actions this custom role needs. Changes are saved to the live role_permissions tables through a protected database function.</p>
          <input value={permissionSearch} onChange={e=>setPermissionSearch(e.target.value)} placeholder="Filter permissions by module or action…" className="mb-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"/>
          <div className="space-y-4">
          {visiblePermissionGroups.map(([module,items])=><div key={module} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><h4 className="text-sm font-semibold mb-2">{MODULE_LABELS[module]||module}</h4><div className="grid sm:grid-cols-2 gap-2">{items.map(p=><label key={p.key} className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rolePermissions.includes(p.key)} onChange={()=>togglePermission(p.key)} className="mt-0.5 accent-[#0A6C74]"/><span><span className="block font-semibold">{p.action.toUpperCase()}</span><span className="text-slate-400">{p.description}</span></span></label>)}</div></div>)}
          {!visiblePermissionGroups.length&&<p className="text-xs text-slate-500">No permissions match this filter.</p>}
        </div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{rolePermissions.length} permissions selected</p><button onClick={()=>void saveCustomRole()} disabled={saving||!roleName.trim()||!roleSlug.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Check className="w-4 h-4"/>{saving?'Saving…':'Save custom role'}</button></div>
      </section>
    </div>}
  </div>;
};

export default AdminAccessControl;
