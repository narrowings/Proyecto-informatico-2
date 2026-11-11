# Ambiente QA

QA corre con Docker Compose en el servidor de William Reyes (ver [ADR-08](../../docs/adr/ADR-08-qa-en-servidor-propio.md)).

## Cómo funciona

1. Se fusiona un pull request en `main` y corre el CI (incluye construir las imágenes de Docker).
2. Cada 2 minutos el servidor revisa `main` (`deploy.sh`, con un timer de systemd).
3. Si hay un commit nuevo **y su CI está en verde**, reconstruye las imágenes y levanta el ambiente.
4. La API corre `prisma migrate deploy` y el seed al arrancar; el script verifica `GET /v1/health`.

No se abren puertos en la red de la casa, no hay runner de GitHub en el servidor y no se guardan secretos en GitHub.

| Servicio   | Contenedor      | Puerto en el servidor | Para qué                                    |
| ---------- | --------------- | --------------------- | ------------------------------------------- |
| `web`      | Next.js         | `127.0.0.1:3100`      | Frontend                                    |
| `api`      | NestJS + Prisma | `127.0.0.1:3101`      | API (`/v1/...`)                             |
| `mailpit`  | Mailpit         | `127.0.0.1:8125`      | Ver los correos de QA (con usuario y clave) |
| `postgres` | PostgreSQL 17   | sin puerto            | Base de datos (volumen `red-qa_pgdata`)     |

Solo datos sintéticos en QA, nunca datos reales.

## Instalación en el servidor (una sola vez)

Requisitos: Docker con el plugin compose, git, curl y python3. El usuario (por defecto `willirv`) debe estar en el grupo `docker`.

```bash
sudo mkdir -p /opt/red-qa && sudo chown "$USER" /opt/red-qa
git clone https://github.com/narrowings/Proyecto-informatico-2.git /opt/red-qa/repo
cp /opt/red-qa/repo/infra/qa/qa.env.example /opt/red-qa/qa.env
nano /opt/red-qa/qa.env            # claves y WEB_URL
chmod 600 /opt/red-qa/qa.env

# Primer despliegue a mano (tarda unos minutos la primera vez)
FORCE=1 bash /opt/red-qa/repo/infra/qa/deploy.sh

# Despliegue automático
sudo cp /opt/red-qa/repo/infra/qa/systemd/red-qa-deploy.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now red-qa-deploy.timer
```

## Publicar con Cloudflare Tunnel

En Cloudflare Zero Trust → Networks → Tunnels → el túnel del servidor → Public Hostname:

| Hostname (ejemplo)    | Servicio si cloudflared corre en el host | Servicio si cloudflared es un contenedor |
| --------------------- | ---------------------------------------- | ---------------------------------------- |
| `qa.<dominio>`        | `http://localhost:3100`                  | `http://red-qa-web:3000`                 |
| `qa-api.<dominio>`    | `http://localhost:3101`                  | `http://red-qa-api:3001`                 |
| `qa-correo.<dominio>` | `http://localhost:8125`                  | `http://mailpit:8025`                    |

Si cloudflared es un contenedor, hay que conectarlo una vez a la red de QA:

```bash
docker network connect red-qa <nombre-del-contenedor-cloudflared>
```

`WEB_URL` en `qa.env` debe ser la URL pública del frontend (por ejemplo `https://qa.<dominio>`).

## Operación

```bash
journalctl -u red-qa-deploy -f                       # ver despliegues
FORCE=1 bash /opt/red-qa/repo/infra/qa/deploy.sh          # redesplegar el último main sin esperar el CI
cd /opt/red-qa/repo && docker compose -p red-qa -f infra/qa/docker-compose.qa.yml --env-file /opt/red-qa/qa.env logs -f api
cd /opt/red-qa/repo && docker compose -p red-qa -f infra/qa/docker-compose.qa.yml --env-file /opt/red-qa/qa.env down   # apagar QA (conserva la base)
```

Para borrar la base de QA y empezar de cero, agrega `-v` al `down` (se pierden todos los datos de QA).

## Pendiente

- Revisión de seguridad de la exposición (Juan Andrés Montealegre).
- CORS en la API cuando el frontend llame a `qa-api` desde el navegador.
