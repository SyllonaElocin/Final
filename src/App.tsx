import React, { useState, useEffect, useRef } from 'react';
import logo from './logo.png';
import { BookOpen, FileText, Database, Shield, LogOut, CheckCircle2, User as UserIcon, Lock, Plus, Trash2, ShieldCheck, X, Quote, Copy, Check, Search } from 'lucide-react';
import { User, Publication } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') as string) : null
  );

  const [publications, setPublications] = useState<Publication[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'new-publication'>('feed');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Load Feed
  const fetchPublications = async () => {
    try {
      const res = await fetch('/api/publications', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setPublications(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, [token]);

  // Auth Methods
  const handleAuth = async (view: 'login' | 'register', data: any) => {
    try {
      const res = await fetch(`/api/auth/${view}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (res.ok) {
        setToken(resData.token);
        setUser(resData.user);
        localStorage.setItem('token', resData.token);
        localStorage.setItem('user', JSON.stringify(resData.user));
      } else {
        alert(resData.error || 'Authentication error');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveTab('feed');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Academic Repo Logo" className="w-9 h-9 object-contain rounded-lg shadow-sm" />
            <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Academic Repo</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {!user ? (
              <AuthDialog onAuth={handleAuth} />
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 py-1.5 px-3 rounded-full border border-slate-200">
                  <UserIcon className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-800">{user.email}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold ml-1",
                    user.role === 'researcher' ? "bg-blue-100 text-blue-700" : 
                    user.role === 'reviewer' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {user.role}
                  </span>
                </div>
                {user.role === 'researcher' && activeTab !== 'new-publication' && (
                  <button 
                    onClick={() => setActiveTab('new-publication')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Upload
                  </button>
                )}
                {activeTab !== 'feed' && (
                  <button 
                    onClick={() => setActiveTab('feed')}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    View Repository
                  </button>
                )}
                <button onClick={() => setShowLogoutConfirm(true)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'new-publication' && user?.role === 'researcher' ? (
          <PublicationForm 
            token={token!} 
            onSuccess={() => {
              setActiveTab('feed');
              fetchPublications();
            }} 
          />
        ) : (
          <RepositoryFeed publications={publications} user={user} />
        )}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Sign Out</h2>
            <p className="text-slate-600 mb-6 text-sm">Are you sure you want to sign out of your account?</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  logout();
                  setShowLogoutConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------
// Subcomponents
// ------------------------------------

function RepositoryFeed({ publications, user }: { publications: Publication[], user: User | null }) {
  const [searchQuery, setSearchQuery] = useState('');

  if (publications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Database className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-slate-600 mb-1">Repository is Empty</h3>
        <p className="text-sm">No publications have been uploaded yet.</p>
      </div>
    );
  }

  const filteredPubs = publications.filter(pub => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pub.title.toLowerCase().includes(q) ||
      pub.abstract.toLowerCase().includes(q) ||
      (pub.researcher_email && pub.researcher_email.toLowerCase().includes(q)) ||
      (pub.co_authors && pub.co_authors.some(a => a.name.toLowerCase().includes(q) || a.affiliation.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Public Archive</h2>
        
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search research..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-transparent rounded-full text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all shadow-inner placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
            <ShieldCheck className="h-4 w-4" />
            <span>Permissions Enforced</span>
          </div>
        </div>
      </div>
      
      {filteredPubs.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-slate-100">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium max-w-sm mx-auto">No publications found matching "{searchQuery}"</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your keywords to find what you're looking for.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {filteredPubs.map((pub) => (
            <div key={pub.id}>
              <PublicationCard pub={pub} user={user} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicationCard({ pub, user }: { pub: Publication, user: User | null }) {
  const isOwner = user?.id === pub.user_id;
  const isReviewer = user?.role === 'reviewer';
  const hasAccess = isOwner || isReviewer;
  
  const [showCite, setShowCite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Derive co-authors text
  const authorsStr = pub.co_authors && pub.co_authors.length > 0 
    ? pub.co_authors.map(a => a.name).join(', ') 
    : 'No co-authors registered';

  const getCitation = () => {
    const authors = pub.co_authors && pub.co_authors.length > 0
      ? pub.co_authors.map(a => {
          const parts = a.name.trim().split(' ');
          const last = parts.pop();
          const firstInitial = parts.length > 0 ? parts[0][0] + '.' : '';
          return `${last}, ${firstInitial}`.trim();
        }).join(', ')
      : pub.researcher_email?.split('@')[0] || 'Unknown Author';
    const year = new Date(pub.created_at).getFullYear();
    return `${authors} (${year}). ${pub.title}. AcademicRepo.`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCitation());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-bold text-slate-800 leading-tight">{pub.title}</h3>
        {hasAccess && (
          <span className="shrink-0 ml-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Access Granted
          </span>
        )}
      </div>
      
      <p className="text-sm text-indigo-600 font-medium mb-1">
        Lead: {pub.researcher_email}
      </p>
      <p className="text-xs text-slate-500 font-medium mb-4">
        Authors: {authorsStr}
      </p>

      <div className="prose prose-sm max-w-none text-slate-600 mb-6 flex-1">
        <p className="line-clamp-3 leading-relaxed">{pub.abstract}</p>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowCite(!showCite)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded transition"
            >
               <Quote className="h-4 w-4" /> Cite
            </button>
            {showCite && (
              <div className="absolute bottom-full mb-2 left-0 w-64 p-3 bg-slate-900 rounded-lg shadow-xl text-slate-200 text-xs z-10 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white uppercase tracking-wider text-[10px]">APA Citation</span>
                  <button onClick={handleCopy} className="text-slate-400 hover:text-white transition" title="Copy to clipboard">
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="font-serif leading-snug select-all">{getCitation()}</p>
                <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-slate-900 rotate-45"></div>
              </div>
            )}
          </div>

          {hasAccess && pub.pdf_url ? (
            <a href={pub.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition">
              <FileText className="h-4 w-4" /> PDF
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400 cursor-not-allowed" title="Premium or Owner access required">
               <Lock className="h-4 w-4" /> PDF (Locked)
            </div>
          )}

          {hasAccess && pub.dataset_url ? (
            <a href={pub.dataset_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition">
              <Database className="h-4 w-4" /> Dataset
            </a>
          ) : (
             <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400 cursor-not-allowed" title="Premium or Owner access required">
              <Lock className="h-4 w-4" /> Dataset (Locked)
           </div>
          )}
        </div>
        
        <span className="text-xs text-slate-400 tabular-nums">
          {new Date(pub.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// Inline Formsets Publication Form
function PublicationForm({ token, onSuccess }: { token: string, onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  
  // Mimic Django Inline Formsets
  const [coAuthors, setCoAuthors] = useState([{ name: '', affiliation: '' }]);
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addCoAuthor = () => setCoAuthors([...coAuthors, { name: '', affiliation: '' }]);
  const removeCoAuthor = (index: number) => setCoAuthors(coAuthors.filter((_, i) => i !== index));
  const updateCoAuthor = (index: number, field: string, value: string) => {
    const fresh = [...coAuthors];
    (fresh[index] as any)[field] = value;
    setCoAuthors(fresh);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let pdf_url = null, dataset_url = null;
      if (pdfFile) pdf_url = await uploadFile(pdfFile);
      if (datasetFile) dataset_url = await uploadFile(datasetFile);

      // Filter empty authors
      const validAuthors = coAuthors.filter(a => a.name.trim() !== '');

      const payload = {
        title, abstract, pdf_url, dataset_url, co_authors: validAuthors
      };

      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to submit publication');
      }
    } catch (err) {
      alert('A network or upload error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-8">
      <div className="mb-8 border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-800 mb-1">New Publication</h2>
        <p className="text-slate-500 text-sm">Upload research artifacts into your secure portfolio. Datasets will be locked to verified reviewers.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Paper Title</label>
            <input 
              required
              type="text" 
              className="w-full border-slate-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="E.g., Quantum Entanglement in Distributed Systems"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Abstract</label>
            <textarea 
              required
              rows={4}
              className="w-full border-slate-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border font-serif"
              placeholder="Brief summary of the research methodology and outcomes..."
              value={abstract}
              onChange={e => setAbstract(e.target.value)}
            />
          </div>
        </div>

        {/* Inline Formset simulation */}
        <div className="bg-slate-50 -mx-8 px-8 py-6 border-y border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800 uppercase">Co-Authors (Inline Formset)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Add contributors attached to this specific publication.</p>
            </div>
            <button 
              type="button" 
              onClick={addCoAuthor} 
              className="text-sm font-medium flex items-center gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Row
            </button>
          </div>
          <div className="space-y-3">
            {coAuthors.map((author, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <input 
                  type="text"
                  placeholder="Full Name"
                  className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0"
                  value={author.name}
                  onChange={e => updateCoAuthor(idx, 'name', e.target.value)}
                />
                <div className="w-px h-6 bg-slate-200"></div>
                <input 
                  type="text"
                  placeholder="Affiliation / University"
                  className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0"
                  value={author.affiliation}
                  onChange={e => updateCoAuthor(idx, 'affiliation', e.target.value)}
                />
                <button type="button" onClick={() => removeCoAuthor(idx)} className="text-slate-400 hover:text-red-500 p-1" disabled={coAuthors.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* File Attachments Cloudinary Target UI */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold tracking-tight text-slate-800 uppercase">Artifacts (Cloudinary Blob Targets)</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
              <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <div className="text-sm font-medium text-indigo-600 mb-1">{pdfFile ? pdfFile.name : 'Upload PDF Proof'}</div>
              <p className="text-xs text-slate-500">Max size 50MB</p>
            </div>
            
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition cursor-pointer relative bg-amber-50/30">
              <input type="file" accept=".csv,.json,.zip" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setDatasetFile(e.target.files?.[0] || null)} />
              <Database className="mx-auto h-8 w-8 text-amber-500 mb-2" />
              <div className="text-sm font-medium text-amber-600 mb-1">{datasetFile ? datasetFile.name : 'Upload Raw Dataset'}</div>
              <p className="text-xs flex justify-center items-center gap-1 text-slate-500 font-medium">
                <Shield className="h-3 w-3" /> Secure Payload
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {isSubmitting ? 'Uploading to Blob...' : 'Publish to Repository'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Authentication Modal Component
function AuthDialog({ onAuth }: { onAuth: (view: 'login'|'register', data: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'basic' | 'researcher' | 'reviewer'>('basic');

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
        Sign In
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAuth(mode, { email, password, role });
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative border border-slate-100">
        <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="text-xl font-bold mb-6">{mode === 'login' ? 'Academic Login' : 'Register Account'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">University Email</label>
            <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border-slate-300 rounded shadow-sm px-3 py-2 border text-sm" placeholder="user@university.edu" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Password</label>
            <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border-slate-300 rounded shadow-sm px-3 py-2 border text-sm" />
          </div>
          
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Select Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['basic', 'researcher', 'reviewer'] as const).map(r => (
                  <button 
                    key={r} type="button" 
                    onClick={() => setRole(r)}
                    className={cn(
                      "text-xs px-2 py-2 rounded-md font-medium border capitalize transition-colors",
                      role === r ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-indigo-700 transition shadow-sm mt-6">
            {mode === 'login' ? 'Authenticate' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-sm text-indigo-600 hover:text-indigo-800">
            {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
