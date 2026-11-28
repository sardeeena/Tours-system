-- Improve the published coral-reef etiquette article using official local guidance.
-- No translation rows are currently published for this source record; fail closed if that changes.
BEGIN;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.content_translations
    WHERE entity_type = 'blog_post'
      AND entity_key = '35def44b-0538-493d-ade9-60b2a8466067'
      AND translation_state = 'published'
  ) THEN
    RAISE EXCEPTION 'Review published blog translations before changing the responsible-snorkeling source content.';
  END IF;
END;
$guard$;

UPDATE public.blog_posts
SET
  title = 'Coral Reef Etiquette: 7 Rules for Responsible Red Sea Snorkeling',
  excerpt = 'A practical Red Sea snorkeling guide: protect coral, control your fins, respect marine life, follow local rules and choose a responsible boat operator.',
  seo_title = 'Coral Reef Etiquette: 7 Red Sea Snorkeling Rules',
  seo_description = 'Learn seven Red Sea snorkeling rules: keep fins off coral, avoid touching or feeding wildlife, follow local guidance and leave no rubbish behind.',
  reading_time_minutes = 4,
  content = $article$
# Coral Reef Etiquette: 7 Rules for Responsible Red Sea Snorkeling

The Red Sea is famous for clear water, colourful reef fish and coral gardens. Those reefs are living ecosystems, not places to stand, touch or collect souvenirs. A few simple habits help protect marine life and make a snorkeling trip safer and more enjoyable.

These practical rules are based on guidance from Egypt's diving and environmental authorities. Conditions and protected-area rules can differ between sites, so always follow the current briefing from your guide, boat crew and local authorities.

## 1. Use the entry and exit point your guide recommends

Enter and leave the water using the boat ladder, jetty, marked channel or sandy area identified by the crew. Do not walk across shallow coral to reach deeper water. Before you enter, check where the boat or shore exit is and listen for the signal to return.

At shore reefs, use designated access points rather than choosing a route across the reef flat. At boat stops, wait for the crew's instructions and enter one at a time when it is safe.

## 2. Float above the reef — never stand on coral

Coral is a living animal and its surface can be damaged by contact. Never stand, sit, kneel, hold onto or push away from coral, even if a section looks broken or dead. Keep at least an arm's length from the reef as a general guide, and leave more space whenever the water, current or site conditions require it.

If you feel tired, do not grab the reef or stand on it. Signal your guide, float calmly on your back if you can, use the flotation equipment provided and follow the crew's instructions to a safe rest point.

## 3. Keep your fins under control

Uncontrolled fin kicks can strike coral and stir up sand. Stay as horizontal as you comfortably can, use slow and gentle kicks, and keep your fins clear of the reef and seabed. Avoid kicking downwards in shallow water.

If you stir up sand, move away and allow it to settle rather than swimming through the cloud. The Egyptian Chamber of Diving and Watersports (CDWS) specifically includes fin awareness and avoiding stirred-up sand in its snorkeling supervision guidance.

## 4. Look at marine life — do not touch, chase or feed it

Watch fish and other animals without interfering. Do not touch, chase, corner, ride or block the path of marine life. Never feed fish: food brought from the boat or shore can change natural behaviour and may create unsafe interactions.

Do not collect shells, coral fragments, rocks or other natural objects. Leave everything where you find it, including items that appear empty or lifeless. If an animal approaches, remain calm and give it room to move away.

## 5. Follow local rules and the safety briefing

Protected areas can have site-specific rules for swimming, access, wildlife and boat activity. Some areas may be closed or have restrictions that change with conditions. Stay within the permitted area, remain with your group and follow the guide's instructions rather than relying on advice from another location.

Tell the crew before departure if you are new to snorkeling, are not a confident swimmer or need flotation support. Wear a life jacket or snorkel vest when recommended. Do not enter the water when the crew says conditions are unsuitable.

## 6. Choose a boat operator that takes reef protection seriously

Before booking, ask how the crew briefs guests, supervises swimmers and avoids damaging the reef. Useful questions include:

- Does the safety briefing explain how to avoid touching coral and disturbing wildlife?
- Are life jackets or flotation aids available, and can a guide help first-time snorkelers?
- How many guests are normally in the water with each guide?
- How does the boat avoid anchoring on coral, and where is rubbish stored until return?
- Which snorkeling stops are planned, and can the route change with weather or sea conditions?

A responsible operator should be comfortable explaining its safety procedures and environmental practices. The exact route, stop duration and wildlife sightings can never be guaranteed.

## 7. Leave the reef as you found it

Take all rubbish back to the boat or shore, including small items such as wrappers and bottle caps. Secure loose belongings before entering the water. Do not throw food, plastic or cigarette ends into the sea, and do not remove anything from the reef.

A simple rule to remember is: look, do not touch; float, do not stand; and take nothing away.

## Quick checklist before you enter the water

- Listen to the full safety and site briefing.
- Know the entry point, exit point and return signal.
- Stay with your buddy or group.
- Keep your body and fins clear of coral and sand.
- Use flotation equipment if you need it.
- Never touch, chase, feed or collect marine life.
- Take all rubbish back to the boat or shore.

## Frequently asked questions

### Can I touch coral if I am careful?

No. Even brief contact can damage coral tissue. Keep your hands, feet, fins and equipment away from the reef.

### Can I stand up if I need a rest?

Only in a clearly sandy or otherwise designated safe area when your guide says it is suitable. Never stand on coral. If you are tired in open water, signal the guide and use the flotation support provided.

### Should I feed fish to attract them for a photograph?

No. Feeding fish changes their natural behaviour and can create unsafe interactions. Observe wildlife without trying to attract or handle it.

### What should a beginner ask before booking a snorkeling trip?

Ask whether a guide enters the water, whether flotation aids are available, how the crew handles changing sea conditions and what the safety briefing covers. Tell the operator about your experience level before the trip.

## Explore the Red Sea responsibly

Compare the current [Awesome Adventure Tours excursions](https://awesomeadventure.tours/excursions) and check each itinerary for its planned stops, duration, pickup arrangements and participation guidance. You can also explore trips around [Hurghada](https://awesomeadventure.tours/destinations/hurghada) and [Sharm El Sheikh](https://awesomeadventure.tours/destinations/sharm-el-sheikh). Routes and stops may change with weather, sea conditions and local instructions.

## Further reading

- [CDWS: Snorkel Supervision and Risk Management guidance (PDF)](https://cdwsstore.blob.core.windows.net/membership/downloads/rulesAndRegulations/b6864-Module%202%20Snorkel%20Supervision%20and%20risk%20management%20outline%20V1%2015%20May%202020.pdf)
- [Egyptian Environmental Affairs Agency: published protected-area instructions (PDF)](https://www.eeaa.gov.eg/Uploads/Project/Files/20221211122056645.pdf)
- [Visit Egypt: Red Sea Reefs visitor guide](https://visitegypt.travel/attractions/red-sea-reefs.html)

Protected-area rules can change and are not identical at every site. Check the current instructions displayed at the location and follow your guide or local authority.
$article$,
  updated_at = now()
WHERE id = '35def44b-0538-493d-ade9-60b2a8466067'
  AND slug = 'responsible-snorkeling-protect-coral-reefs';

COMMIT;
