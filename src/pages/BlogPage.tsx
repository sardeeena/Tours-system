import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, BookOpen, Search } from 'lucide-react';
import { BlogPost, getPublishedBlogPost, getPublishedBlogPosts } from '../services/blogService';
import { BlogContent } from '../components/blog/BlogContent';

const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'}) : '';
const readingTime = (content: string) => Math.max(1,Math.ceil(content.trim().split(/\s+/).length/220));

export const BlogPage: React.FC<{ slug?: string; onNavigate:(path:string)=>void }> = ({slug,onNavigate}) => {
  const [posts,setPosts] = useState<BlogPost[]>([]);
  const [article,setArticle] = useState<BlogPost|null>(null);
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  useEffect(() => {
    let active=true; setLoading(true); setError(''); if (slug) setArticle(null);
    const task=slug ? getPublishedBlogPost(slug).then(p=>{if(active)setArticle(p);})
      : getPublishedBlogPosts(30).then(p=>{if(active)setPosts(p);});
    task.catch(()=>{if(active)setError('The journal is temporarily unavailable. Please try again shortly.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[slug]);

  useEffect(() => {
    if (!slug || !article || typeof document === 'undefined') return;
    const title = article.seo_title || `${article.title} | Awesome Adventure Tours Journal`;
    const description = article.seo_description || article.excerpt || 'Travel inspiration and local guides from Awesome Adventure Tours in Egypt.';
    document.title = title;
    const setMeta = (identityAttribute: 'name' | 'property', identity: string, value: string) => {
      let node = document.head.querySelector(`meta[${identityAttribute}="${identity}"]`) as HTMLMetaElement | null;
      if (!node) { node = document.createElement('meta'); node.setAttribute(identityAttribute, identity); document.head.appendChild(node); }
      node.content = value;
    };
    setMeta('name','description',description);
    setMeta('property','og:title',title);
    setMeta('property','og:description',description);
    setMeta('property','og:type','article');
    if (article.cover_image_url) setMeta('property','og:image',article.cover_image_url);
    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = `https://awesomeadventure.tours/blog/${article.slug}`;
    const existing = document.getElementById('awesome-adventure-blogposting-jsonld');
    existing?.remove();
    const schema = document.createElement('script');
    schema.id = 'awesome-adventure-blogposting-jsonld';
    schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({
      '@context':'https://schema.org','@type':'BlogPosting',headline:article.title,
      description,image:article.cover_image_url || undefined,datePublished:article.published_at,
      dateModified:article.updated_at,author:{'@type':'Organization',name:article.author_name},
      publisher:{'@type':'Organization',name:'Awesome Adventure Tours',url:'https://awesomeadventure.tours'},
      mainEntityOfPage:`https://awesomeadventure.tours/blog/${article.slug}`
    });
    document.head.appendChild(schema);
    return () => { document.getElementById('awesome-adventure-blogposting-jsonld')?.remove(); };
  },[slug,article]);
  const filtered=posts.filter(p=>[p.title,p.excerpt||'',p.category?.name||''].join(' ').toLowerCase().includes(query.toLowerCase()));
  const shell='bg-[#FAF8F5] text-[#111A24] dark:bg-[#0A1118] dark:text-slate-100';
  if (slug) return <main className={shell+' min-h-screen'}>
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <button onClick={()=>onNavigate('/blog')} className="text-sm font-semibold text-[#0A6C74] dark:text-teal-300 mb-8">← Back to the journal</button>
      {loading ? <div className="animate-pulse h-72 rounded-3xl bg-stone-200 dark:bg-slate-800"/> : article ? <>
        {article.cover_image_url && <img src={article.cover_image_url} alt={article.title} className="w-full max-h-[520px] object-cover rounded-3xl mb-10"/>}
        <div className="text-xs uppercase tracking-[.2em] text-[#0A6C74] dark:text-teal-300 font-bold mb-4">{article.category?.name||'Awesome Adventure Tours Journal'}</div>
        <h1 className="font-display text-4xl sm:text-6xl leading-tight font-bold mb-6">{article.title}</h1>
        <div className="flex flex-wrap gap-5 text-sm text-stone-500 dark:text-slate-400 mb-10"><span>{article.author_name}</span><span>{dateLabel(article.published_at)}</span><span>{article.reading_time_minutes || 1} min read</span></div>
        {article.excerpt && <p className="text-xl leading-relaxed text-stone-600 dark:text-slate-300 border-l-4 border-[#C28D32] pl-5 mb-10">{article.excerpt}</p>}
        <article className="max-w-none"><BlogContent content={article.content} className="text-lg"/></article>
        <div className="mt-14 p-8 rounded-3xl bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#243447]"><p className="text-xs uppercase tracking-widest text-[#C28D32] font-bold mb-2">Explore the Red Sea</p><h2 className="font-display text-2xl font-bold mb-3">Make your next story an adventure.</h2><button onClick={()=>onNavigate('/excursions')} className="inline-flex items-center gap-2 rounded-xl bg-[#0A6C74] text-white px-5 py-3 font-semibold">Explore excursions <ArrowRight size={16}/></button></div>
      </> : <div className="py-24 text-center"><h1 className="font-display text-3xl font-bold">Article not found</h1><button onClick={()=>onNavigate('/blog')} className="mt-5 text-[#0A6C74]">Return to journal</button></div>}
      {error && <p className="text-rose-600 mt-5">{error}</p>}
    </div>
  </main>;
  return <main className={shell+' min-h-screen'}>
    <section className="relative overflow-hidden border-b border-[#E8E3DA] dark:border-[#243447]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#E8F3F4] via-[#FAF8F5] to-[#F3EBDD] dark:from-[#102B31] dark:via-[#0A1118] dark:to-[#172638]"/>
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <p className="text-xs tracking-[.28em] uppercase font-bold text-[#0A6C74] dark:text-teal-300 mb-5">Awesome Adventure Tours · Stories of the Red Sea</p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold max-w-4xl leading-[1.05]">The journal.<br/><span className="text-[#0A6C74] dark:text-teal-300">Discover more.</span></h1>
        <p className="mt-7 max-w-2xl text-lg text-stone-600 dark:text-slate-300 leading-relaxed">Local insight, travel inspiration and thoughtful guides to help you experience Egypt and the Red Sea with confidence.</p>
      </div>
    </section>
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8"><div><p className="text-xs uppercase tracking-widest text-[#C28D32] font-bold mb-2">From our team</p><h2 className="font-display text-3xl font-bold">Latest stories</h2></div><label className="relative block w-full sm:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the journal" className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#E8E3DA] dark:border-[#243447] bg-white dark:bg-[#111E2E] outline-none focus:ring-2 focus:ring-[#0A6C74]"/></label></div>
      {loading ? <div className="grid md:grid-cols-3 gap-6">{[1,2,3].map(i=><div key={i} className="h-80 rounded-2xl bg-stone-200 dark:bg-slate-800 animate-pulse"/>)}</div>
      : error ? <p className="text-stone-500">{error}</p>
      : filtered.length ? <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-7">{filtered.map(post=><a key={post.id} href={'/blog/'+post.slug} onClick={event=>{event.preventDefault();onNavigate('/blog/'+post.slug);}} className="group block text-left rounded-2xl overflow-hidden bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#243447] hover:-translate-y-1 transition-all shadow-sm">
        <div className="aspect-[16/10] bg-[#E8F3F4] dark:bg-[#16283D] overflow-hidden">{post.cover_image_url ? <img src={post.cover_image_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/> : <div className="w-full h-full flex items-center justify-center text-[#0A6C74]"><BookOpen size={42}/></div>}</div>
        <div className="p-6"><p className="text-[11px] uppercase tracking-widest text-[#0A6C74] dark:text-teal-300 font-bold">{post.category?.name||'Travel guide'}</p><h3 className="font-display text-2xl font-bold mt-3 leading-snug group-hover:text-[#0A6C74]">{post.title}</h3><p className="text-sm text-stone-500 dark:text-slate-400 mt-3 line-clamp-3">{post.excerpt}</p><div className="flex items-center gap-4 text-xs text-stone-400 mt-6"><span className="inline-flex gap-1.5 items-center"><CalendarDays size={13}/>{dateLabel(post.published_at)}</span><span className="inline-flex gap-1.5 items-center"><Clock3 size={13}/>{post.reading_time_minutes || 1} min read</span></div><span className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-[#0A6C74]">Read story <ArrowRight size={15}/></span></div>
      </a>)}</div> : <div className="rounded-2xl border border-dashed border-[#D5CFC4] dark:border-[#243447] p-12 text-center"><BookOpen className="mx-auto mb-3 text-[#0A6C74]" size={32}/><h3 className="font-display text-xl font-bold">New stories are on their way</h3><p className="text-sm text-stone-500 mt-2">Our travel team is preparing helpful guides and local recommendations.</p></div>}
    </section>
  </main>;
};
