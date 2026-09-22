UPDATE units_ownership
SET registered_at = strftime('%Y-%m-%dT%H:%M:%f', registered_at, '+9 hours') || '+09:00'
WHERE registered_at LIKE '%Z';

UPDATE supporters_ownership
SET registered_at = strftime('%Y-%m-%dT%H:%M:%f', registered_at, '+9 hours') || '+09:00'
WHERE registered_at LIKE '%Z';
