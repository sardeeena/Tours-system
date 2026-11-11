import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, Users, Layers3, Plus, Save, Trash2, RefreshCw, LockKeyhole, Check } from 'lucide-react';
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

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const {data:result,error:rpcError}=await rpc('admin_list_access_control');
    if(rpcError){setError(rpcError.message||'Unable to load role and user data.');setLoading(false);return;}
    const next=(result||{users:[],roles:[],permissions:[]}) as AccessData;
    setData(next);
    setSelectedUserId(current=>current&&next.users.some(u=>u.id===current)?current:(next.users[0]?.id||''));
    setLoading(false);
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

  const toggleRole=(slug:string)=>setSelectedRoles(current=>current.includes(slug)?current.filter(x=>x!==slug):[...current,slug]);
  const togglePermission=(key:string)=>setRolePermissions(current=>current.includes(key)?current.filter(x=>x!==key):[...current,key]);

  const saveUserRoles=async()=>{
    if(!selectedUser)return;
    setSaving(true);setError('');setNotice('');
    const {data:result,error:rpcError}=await rpc('admin_assign_user_roles',{p_user_id:selectedUser.id,p_role_slugs:selectedRoles.length?selectedRoles:['customer']});
    if(rpcError){setError(rpcError.message||'Could not save role assignments.');}
    else{setNotice('Role assignments saved. The user must refresh their session to receive updated access.');await load();}
    setSaving(false);
  };

  const saveCustomRole=async()=>{
    if(!roleName.trim()||!roleSlug.trim()){setError('Enter a role name and a unique role ID.');return;}
    setSaving(true);setError('');setNotice('');
    const {error:rpcError}=await rpc('admin_upsert_access_role',{
      p_slug:roleSlug.trim().toLowerCase().replace(/\s+/g,'_'),
      p_name:roleName.trim(),p_description:roleDescription.trim(),p_permission_keys:rolePermissions
    });
    if(rpcError){setError(rpcError.message||'Could not save this role.');}
    else{setNotice('Custom role created or updated.');setRoleName('');setRoleSlug('');setRoleDescription('');setRolePermissions([]);await load();}
    setSaving(false);
  };

  const deleteRole=async(slug:string)=>{
    if(!window.confirm('Delete this custom role? It must not be assigned to any user.'))return;
    setSaving(true);setError('');setNotice('');
    const {error:rpcError}=await rpc('admin_delete_access_role',{p_slug:slug});
    if(rpcError)setError(rpcError.message||'Could not delete role.');
    else{setNotice('Custom role deleted.');await load();}
    setSaving(false);
  };

  if(loading)return <div className="p-8 text-sm text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/> Loading access control…</div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2 text-[#0A6C74] dark:text-teal-300 text-xs font-bold uppercase tracking-widest"><ShieldCheck className="w-4 h-4"/> Security & Governance</div>
        <h2 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">Users, Roles & Permissions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Assign multiple roles to each account and configure permissions for custom roles.</p>
      </div>
      <button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><RefreshCw className="w-4 h-4"/> Refresh</button>
    </div>

    {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 px-4 py-3 text-sm">{error}</div>}
    {notice&&<div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 px-4 py-3 text-sm">{notice}</div>}

    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
      <button onClick={()=>setSection('users')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${section==='users'?'border-[#0A6C74] text-[#0A6C74]':'border-transparent text-slate-500'}`}><Users className="inline w-4 h-4 mr-2"/>Users & Assignments</button>
      <button onClick={()=>setSection('roles')} className={`px-4 py-3 text-sm font-semibold border-b-2 ${section==='roles'?'border-[#0A6C74] text-[#0A6C74]':'border-transparent text-slate-500'}`}><Layers3 className="inline w-4 h-4 mr-2"/>Roles & Permissions</button>
    </div>

    {section==='users'?<div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)] gap-5">
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
          <div className="mt-5 flex items-center justify-between gap-3"><div><h4 className="font-semibold text-sm">Assigned roles</h4><p className="text-xs text-slate-500 mt-1">Permissions from all selected roles are combined.</p></div><span className="text-xs rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200 px-2 py-1">{selectedRoles.length} selected</span></div>
          {protectedSuperAdmin ? <p className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">This account has protected Super Admin access. Only a Super Admin can modify its assignments.</p> : <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {data.roles.filter(r=>r.is_active&&(isSuperAdmin||r.slug!=='super_admin')).map(role=><label key={role.slug} className="flex gap-3 items-start rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-teal-500">
              <input type="checkbox" checked={selectedRoles.includes(role.slug)} onChange={()=>toggleRole(role.slug)} className="mt-1 accent-[#0A6C74]"/>
              <span className="min-w-0"><span className="block text-sm font-semibold">{role.name}</span><span className="block text-xs text-slate-500 mt-0.5">{role.description||role.slug}</span></span>
            </label>)}
          </div>}
          {!isSuperAdmin&&<p className="mt-4 text-xs text-amber-700 dark:text-amber-300 flex gap-2"><LockKeyhole className="w-4 h-4 shrink-0"/> Super Admin assignment and changes are restricted to an existing Super Admin.</p>}
          <div className="mt-5 flex justify-end"><button disabled={saving||!selectedRoles.length||protectedSuperAdmin} onClick={()=>void saveUserRoles()} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Save className="w-4 h-4"/>{saving?'Saving…':'Save role assignments'}</button></div>
        </>:<p className="text-sm text-slate-500">Select a user to manage their roles.</p>}
      </section>
    </div>:<div className="grid grid-cols-1 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.5fr)] gap-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h3 className="font-bold">Available roles</h3><p className="text-xs text-slate-500 mt-1">Built-in roles are protected. Create custom roles for your organization.</p></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">{data.roles.map(r=><div key={r.slug} className="p-4 flex justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-sm">{r.name} {r.is_system&&<span className="text-[10px] uppercase text-slate-400 ml-1">System</span>}</div><p className="text-xs text-slate-500 mt-1">{r.description||r.slug}</p><p className="text-[11px] text-slate-400 mt-1">{r.permissions.length} permissions</p></div>{!r.is_system&&<div className="flex gap-1"><button onClick={()=>{setRoleName(r.name);setRoleSlug(r.slug);setRoleDescription(r.description||'');setRolePermissions(r.permissions);setSection('roles');}} disabled={saving} title="Edit custom role" className="text-[#0A6C74] hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg px-2 py-1 text-xs">Edit</button><button onClick={()=>void deleteRole(r.slug)} disabled={saving} title="Delete custom role" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg p-2"><Trash2 className="w-4 h-4"/></button></div>}</div>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2"><Plus className="w-5 h-5 text-[#0A6C74]"/><h3 className="text-lg font-bold">Create a custom role</h3></div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Role name<input value={roleName} onChange={e=>{setRoleName(e.target.value);if(!roleSlug)setRoleSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));}} placeholder="e.g. Reservations Supervisor" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"/></label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Role ID<input value={roleSlug} onChange={e=>setRoleSlug(e.target.value)} placeholder="reservations_supervisor" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"/></label>
        </div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">Description<textarea value={roleDescription} onChange={e=>setRoleDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"/></label>
        <div className="mt-5"><div className="font-semibold text-sm mb-1">Grant permissions</div><p className="text-xs text-slate-500 mb-3">Manage grants every action in a module. Individual Create, Update, Delete, Approve or Export grants stay limited to that action and also allow the relevant records to be viewed.</p><div className="space-y-4">
          {Object.entries(groupedPermissions).map(([module,items])=><div key={module} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><h4 className="text-sm font-semibold mb-2">{MODULE_LABELS[module]||module}</h4><div className="grid sm:grid-cols-2 gap-2">{items.map(p=><label key={p.key} className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rolePermissions.includes(p.key)} onChange={()=>togglePermission(p.key)} className="mt-0.5 accent-[#0A6C74]"/><span><span className="block font-semibold">{p.action.toUpperCase()}</span><span className="text-slate-400">{p.description}</span></span></label>)}</div></div>)}
        </div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{rolePermissions.length} permissions selected</p><button onClick={()=>void saveCustomRole()} disabled={saving||!roleName.trim()||!roleSlug.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Check className="w-4 h-4"/>{saving?'Saving…':'Save custom role'}</button></div>
      </section>
    </div>}
  </div>;
};

export default AdminAccessControl;
