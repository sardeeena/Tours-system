-- Retired sender-domain contacts are not valid Awesome Adventure Tours addresses.
-- The email field is optional; preserve guide profiles, names, phone numbers and all other operational data.
UPDATE public.guides
SET email = NULL
WHERE lower(email) LIKE '%@redseavoyages.com'
   OR lower(email) LIKE '%@kemetspirit.com';
