import { supabase } from './supabaseClient';
import { clearPublicDataCache, readPublicDataCache, writePublicDataCache } from './publicDataCache';

export type BlogStatus = 'draft' | 'published' | 'scheduled' | 'archived';
export interface BlogCategory { id: string; name: string; slug: string; description?: string | null; }
export interface BlogPost {
  id: string; title: string; slug: string; excerpt: string | null; content: string;
  cover_image_url: string | null; status: BlogStatus; category_id: string | null;
  author_name: string; seo_title: string | null; seo_description: string | null;
  reading_time_minutes: number; published_at: string | null; created_at: string; updated_at: string;
  category?: BlogCategory | null;
}
const LIST_FIELDS = 'id,title,slug,excerpt,cover_image_url,status,category_id,author_name,seo_title,seo_description,reading_time_minutes,published_at,created_at,updated_at,category:blog_categories(id,name,slug,description)';
const POST_FIELDS = LIST_FIELDS.replace('excerpt,cover_image_url','excerpt,content,cover_image_url');
const refreshingBlogCache = new Set<string>();

export async function getPublishedBlogPosts(limit = 12, forceRefresh = false): Promise<BlogPost[]> {
  const cacheKey = `blog:list:${limit}`;
  if (!forceRefresh) {
    const cached = readPublicDataCache<BlogPost[]>(cacheKey);
    if (cached) {
      if (!cached.isFresh && !refreshingBlogCache.has(cacheKey)) {
        refreshingBlogCache.add(cacheKey);
        void getPublishedBlogPosts(limit, true)
          .catch((error) => console.warn('Background blog list refresh failed:', error))
          .finally(() => refreshingBlogCache.delete(cacheKey));
      }
      return cached.data;
    }
  }
  const { data, error } = await supabase.from('blog_posts').select(LIST_FIELDS)
    .in('status',['published','scheduled']).lte('published_at',new Date().toISOString())
    .order('published_at',{ascending:false}).limit(limit);
  if (error) throw error;
  const posts = (data || []) as unknown as BlogPost[];
  writePublicDataCache(cacheKey, posts);
  return posts;
}
export async function getPublishedBlogPost(slug: string, forceRefresh = false): Promise<BlogPost | null> {
  const cacheKey = `blog:post:${slug}`;
  if (!forceRefresh) {
    const cached = readPublicDataCache<BlogPost | null>(cacheKey);
    if (cached) {
      if (!cached.isFresh && !refreshingBlogCache.has(cacheKey)) {
        refreshingBlogCache.add(cacheKey);
        void getPublishedBlogPost(slug, true)
          .catch((error) => console.warn('Background blog post refresh failed:', error))
          .finally(() => refreshingBlogCache.delete(cacheKey));
      }
      return cached.data;
    }
  }
  const { data, error } = await supabase.from('blog_posts').select(POST_FIELDS)
    .eq('slug',slug).in('status',['published','scheduled']).lte('published_at',new Date().toISOString()).maybeSingle();
  if (error) throw error;
  const post = data as unknown as BlogPost | null;
  writePublicDataCache(cacheKey, post);
  return post;
}
export async function getAdminBlogPost(id: string): Promise<BlogPost> {
  const { data, error } = await supabase.from('blog_posts').select(POST_FIELDS).eq('id',id).single();
  if (error) throw error;
  return data as unknown as BlogPost;
}
export async function getBlogCategories(forceRefresh = false): Promise<BlogCategory[]> {
  if (!forceRefresh) {
    const cached = readPublicDataCache<BlogCategory[]>('blog:categories');
    if (cached) {
      if (!cached.isFresh && !refreshingBlogCache.has('blog:categories')) {
        refreshingBlogCache.add('blog:categories');
        void getBlogCategories(true).catch((error) => console.warn('Background blog categories refresh failed:', error))
          .finally(() => refreshingBlogCache.delete('blog:categories'));
      }
      return cached.data;
    }
  }
  const { data, error } = await supabase.from('blog_categories').select('id,name,slug,description').order('name');
  if (error) throw error;
  const categories = (data || []) as BlogCategory[];
  writePublicDataCache('blog:categories', categories);
  return categories;
}
export async function getAdminBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase.from('blog_posts').select(LIST_FIELDS).order('updated_at',{ascending:false});
  if (error) throw error;
  return (data || []) as unknown as BlogPost[];
}
export async function saveBlogPost(post: Partial<BlogPost> & { title: string; slug: string; content: string }): Promise<BlogPost> {
  const payload = {
    title: post.title.trim(), slug: post.slug.trim().toLowerCase(), excerpt: post.excerpt || null,
    content: post.content, reading_time_minutes: Math.max(1,Math.ceil(post.content.trim().split(/\s+/).filter(Boolean).length/220)), cover_image_url: post.cover_image_url || null,
    status: post.status || 'draft', category_id: post.category_id || null,
    author_name: post.author_name?.trim() || 'Awesome Adventure Tours Editorial Team',
    seo_title: post.seo_title || null, seo_description: post.seo_description || null,
    published_at: post.status === 'published' || post.status === 'scheduled'
      ? (post.published_at && !Number.isNaN(new Date(post.published_at).getTime()) ? new Date(post.published_at).toISOString() : new Date().toISOString())
      : null,
    updated_at: new Date().toISOString(),
  };
  const query = post.id
    ? supabase.from('blog_posts').update(payload).eq('id',post.id).select(POST_FIELDS).single()
    : supabase.from('blog_posts').insert(payload).select(POST_FIELDS).single();
  const { data, error } = await query;
  if (error) throw error;
  clearPublicDataCache();
  return data as unknown as BlogPost;
}
export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id',id);
  if (error) throw error;
  clearPublicDataCache();
}
export async function saveBlogCategory(name: string): Promise<void> {
  const slug = name.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const { error } = await supabase.from('blog_categories').upsert({name:name.trim(),slug},{onConflict:'slug'});
  if (error) throw error;
  clearPublicDataCache();
}
