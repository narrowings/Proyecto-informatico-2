# ADR-08 — QA en el servidor de un integrante con Docker Compose

- **Estado:** propuesto (pendiente de aprobación del líder técnico)
- **Fecha:** 2026-10-28
- **Autor:** Juan José Baloco Sánchez (DevOps)

## Contexto

El Documento Tecnológico v1.1 planea QA en AWS (ECS Fargate, RDS, Terraform) desde el Sprint 1, con un costo aproximado de 65 USD/mes. El riesgo RT-01 (el equipo no domina AWS ni Terraform) es alto y T-01 es el camino crítico del sprint. William Reyes ofrece un servidor propio con Docker.

## Decisión

- QA corre con Docker Compose (api, web, PostgreSQL 17, Mailpit) en el servidor de William Reyes.
- El despliegue lo hace un runner self-hosted de GitHub Actions en ese servidor al fusionar en `main`; no se abren puertos entrantes en su red.
- QA se expone con un túnel (Cloudflare Tunnel o Tailscale Funnel).
- Los créditos de AWS se reservan para producción, que se crea con Terraform en el Sprint 3 como estaba previsto.

## Alternativas descartadas

- **AWS para QA desde el Sprint 1:** consume créditos y suma la curva de Terraform al camino crítico.
- **PaaS externos (Render, Railway):** se alejan más de la arquitectura destino.

## Consecuencias

- QA se parece menos a producción (sin ECS, RDS, ALB ni SES); los problemas propios de AWS aparecerán en el Sprint 3.
- La disponibilidad de QA depende de la energía e internet de un integrante; la demo del día 5 necesita el servidor encendido.
- Seguridad (Juan Andrés Montealegre) debe revisar la exposición del servidor.
- Solo datos sintéticos en QA, nunca datos reales.

## Revisar si…

El servidor no está disponible en una demo o en las pruebas E2E del Sprint 2.
