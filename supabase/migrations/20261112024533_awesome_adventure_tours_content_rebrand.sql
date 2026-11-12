UPDATE public.blog_posts
SET title = replace(title, 'Kemet Spirit', 'Awesome Adventure Tours'),
    excerpt = replace(excerpt, 'Kemet Spirit', 'Awesome Adventure Tours'),
    content = replace(content, 'Kemet Spirit', 'Awesome Adventure Tours'),
    author_name = replace(author_name, 'Kemet Spirit', 'Awesome Adventure Tours'),
    seo_title = replace(seo_title, 'Kemet Spirit', 'Awesome Adventure Tours'),
    seo_description = replace(seo_description, 'Kemet Spirit', 'Awesome Adventure Tours'),
    updated_at = now()
WHERE to_jsonb(blog_posts)::text ILIKE '%Kemet Spirit%'
   OR to_jsonb(blog_posts)::text ILIKE '%kemetspirit.com%';

UPDATE public.seo_metadata
SET seo_title = replace(replace(seo_title, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours'),
    meta_description = replace(replace(meta_description, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours'),
    canonical_url = replace(replace(canonical_url, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours'),
    og_title = replace(replace(og_title, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours'),
    og_description = replace(replace(og_description, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours'),
    seo_keywords = CASE
      WHEN seo_keywords IS NULL THEN NULL
      ELSE ARRAY(
        SELECT replace(replace(k, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours')
        FROM unnest(seo_keywords) AS k
      )
    END,
    structured_data = CASE
      WHEN structured_data IS NULL THEN NULL
      ELSE replace(replace(structured_data::text, 'Kemet Spirit', 'Awesome Adventure Tours'), 'kemetspirit.com', 'awesomeadventure.tours')::jsonb
    END,
    updated_at = now()
WHERE to_jsonb(seo_metadata)::text ILIKE '%Kemet Spirit%'
   OR to_jsonb(seo_metadata)::text ILIKE '%kemetspirit.com%';

UPDATE public.communication_templates
SET name = replace(name, 'Kemet Spirit', 'Awesome Adventure Tours'),
    subject = replace(subject, 'Kemet Spirit', 'Awesome Adventure Tours'),
    body_text = replace(body_text, 'Kemet Spirit', 'Awesome Adventure Tours'),
    updated_at = now()
WHERE to_jsonb(communication_templates)::text ILIKE '%Kemet Spirit%'
   OR to_jsonb(communication_templates)::text ILIKE '%kemetspirit.com%';
