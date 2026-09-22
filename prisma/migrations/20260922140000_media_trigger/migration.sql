-- A new automation trigger: the customer sent an image, video, document or
-- audio. No existing automation uses it, so nothing changes until one is
-- created.
-- Idempotent and production-safe.

ALTER TYPE "AutomationTrigger" ADD VALUE IF NOT EXISTS 'MEDIA_RECEIVED';
