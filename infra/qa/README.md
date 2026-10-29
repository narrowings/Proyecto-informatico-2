# Ambiente QA

QA corre con Docker Compose en el servidor de William Reyes (ver [ADR-08](../../docs/adr/ADR-08-qa-en-servidor-propio.md)).
El despliegue lo hace un runner self-hosted de GitHub Actions al fusionar en `main`.

Pendiente: `docker-compose.qa.yml`, Dockerfiles de `api` y `web`, y el workflow de despliegue.
