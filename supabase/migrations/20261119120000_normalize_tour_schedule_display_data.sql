-- Normalize public tour departure times so customer-facing and AI-readable data is unambiguous.
UPDATE public.tours
SET departure_time = CASE trim(departure_time)
  WHEN '13:30 AM' THEN '01:30 PM'
  WHEN '13:00 PM' THEN '01:00 PM'
  WHEN '14:00' THEN '02:00 PM'
  WHEN '15:00' THEN '03:00 PM'
  WHEN '15:30' THEN '03:30 PM'
  WHEN '20:00' THEN '08:00 PM'
  WHEN '1:00 AM' THEN '01:00 AM'
  WHEN '11:00, 13:00, 14:00, 15:00, 16:00, 18:00, 20:00'
    THEN '11:00 AM, 01:00 PM, 02:00 PM, 03:00 PM, 04:00 PM, 06:00 PM, 08:00 PM'
  ELSE trim(departure_time)
END
WHERE departure_time IS NOT NULL
  AND trim(departure_time) IN (
    '13:30 AM',
    '13:00 PM',
    '14:00',
    '15:00',
    '15:30',
    '20:00',
    '1:00 AM',
    '11:00, 13:00, 14:00, 15:00, 16:00, 18:00, 20:00'
  );

-- Collapse accidental repeated whitespace and correct the missing space in duration labels.
UPDATE public.tours
SET duration = regexp_replace(
  replace(trim(duration), 'approx.24', 'approx. 24'),
  '\s+',
  ' ',
  'g'
)
WHERE duration IS NOT NULL
  AND duration IS DISTINCT FROM regexp_replace(
    replace(trim(duration), 'approx.24', 'approx. 24'),
    '\s+',
    ' ',
    'g'
  );
