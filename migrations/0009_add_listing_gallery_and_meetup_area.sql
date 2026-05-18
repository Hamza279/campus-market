ALTER TABLE listings ADD COLUMN gallery_urls TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listings ADD COLUMN meetup_area TEXT NOT NULL DEFAULT '';
UPDATE listings SET gallery_urls = '[]' WHERE gallery_urls = '';
UPDATE listings SET meetup_area = location WHERE meetup_area = '';
