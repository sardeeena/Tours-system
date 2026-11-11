import { supabase } from './supabaseClient';

export type BlogStatus = 'draft' | 'published' | 'archived';
export interface BlogCategory { id: string; name: string; slug: string; description?: string | null; }
export interface BlogPost {
  id: string; title: string; slug: string; excerpt: string | null; content: string;
  cover_image_url: string | null; status: BlogStatus; category_id: string | null;
  author_name: string; seo_title: string | null; seo_description: string | null;
  published_at: string | null; created_at: string; updated_at: string;
  category?: BlogCategory | null;
}
const POST_FIELDS = 'id,title,slug,excerpt,content,cover_image_url,status,category_id,author_name,seo_title,seo_description,published_at,created_at,updated_at,category:blog_categories(id,name,slug,description)';
export async function getPublishedBlogPosts(limit = 12): Promise<BlogPost[]> {
  const { data, error } = await supabase.from('blog_posts').select(POST_FIELDS)
    .eq('status','published').lte('published_at',new Date().toISOString())
    .order('published_at',{ascending:false}).limit(limit);
  if (error) throw error;
  return (data || []) as unknown as BlogPost[];
}
export async function getPublishedBlogPost(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase.from('blog_posts').select(POST_FIELDS)
    .eq('slug',slug).eq('status','published').lte('published_at',new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data as unknown as BlogPost | null;
}
export async function getBlogCategories(): Promise<BlogCategory[]> {
  const { data, error } = await supabase.from('blog_categories').select('id,name,slug,description').order('name');
  if (error) throw error;
  return (data || []) as BlogCategory[];
}
export async function getAdminBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase.from('blog_posts').select(POST_FIELDS).order('updated_at',{ascending:false});
  if (error) throw error;
  return (data || []) as unknown as BlogPost[];
}
export async function saveBlogPost(post: Partial<BlogPost> & { title: string; slug: string; content: string }): Promise<BlogPost> {
  const payload = {
    title: post.title.trim(), slug: post.slug.trim().toLowerCase(), excerpt: post.excerpt || null,
    content: post.content, cover_image_url: post.cover_image_url || null,
    status: post.status || 'draft', category_id: post.category_id || null,
    author_name: post.author_name?.trim() || 'Kemet Spirit Editorial Team',
    seo_title: post.seo_title || null, seo_description: post.seo_description || null,
    published_at: post.status === 'published' ? (post.published_at || new Date().toISOString()) : null,
    updated_at: new Date().toISOString(),
  };
  const query = post.id
    ? supabase.from('blog_posts').update(payload).eq('id',post.id).select(POST_FIELDS).single()
    : supabase.from('blog_posts').insert(payload).select(POST_FIELDS).single();
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as BlogPost;
}
export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id',id);
  if (error) throw error;
}
export async function saveBlogCategory(name: string): Promise<void> {
  const slug = name.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const { error } = await supabase.from('blog_categories').upsert({name:name.trim(),slug},{onConflict:'slug'});
  if (error) throw error;
}
