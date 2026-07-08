-- Reisei — 0013_bearing_quotes.sql  (anchor each daily bearing in a real, sourced quote)
--
-- The Bearing now grounds each day's read in a specific public-domain quote/scripture from
-- the school (rotates by day). We cache the quote text + citation alongside the generated
-- read so the card can show it as an epigraph and link out (source_url) to the exact passage.
-- Nullable: older cached rows and any un-sourced school degrade gracefully to no epigraph.

begin;

alter table bearings add column quote_text text;
alter table bearings add column quote_ref text;

commit;
