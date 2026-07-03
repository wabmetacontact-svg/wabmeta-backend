SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  (table_name = 'User' AND column_name = 'tokenVersion')
  OR (table_name = 'Organization' AND column_name IN ('featureConnectionLocked', 'customLabels', 'featureInboxLocked'))
  OR (table_name = 'Lead')
  OR (table_name = 'AutomationSequence')
  OR (table_name = 'InstagramAccount')
)
ORDER BY table_name, column_name;