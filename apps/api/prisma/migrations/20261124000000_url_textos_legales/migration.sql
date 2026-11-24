-- HU-017: la autorización de tratamiento de datos se publica en /legal/autorizacion-datos (la ruta que
-- usan los propios textos legales). Solo cambia la dirección, no el texto ni la versión aceptada.
UPDATE "legal_documents"
SET "url" = '/legal/autorizacion-datos'
WHERE "type" = 'DATA_TREATMENT' AND "url" = '/legal/tratamiento-de-datos';
