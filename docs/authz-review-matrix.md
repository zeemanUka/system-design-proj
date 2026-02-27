# Authorization Review Matrix (Stage 9)

## Ownership Model
- User-scoped resources: `Project`, `ArchitectureVersion`, `SimulationRun`, `GradeReport`, `ReportExport`.
- Access rule: authenticated user may only access resources where `project.userId === request.user.sub`.

## Endpoint Checks
| Endpoint | Auth Required | AuthZ Strategy | Status |
|---|---|---|---|
| `GET /projects` | Yes | List by `userId` | Reviewed |
| `POST /projects` | Yes | Create under `userId` | Reviewed |
| `POST /projects/:id/versions` | Yes | Project ownership check | Reviewed |
| `GET /projects/:id/history` | Yes | Project ownership check | Reviewed |
| `GET/PATCH /projects/:id/versions/:versionId` | Yes | Project ownership check + version scoped by project | Reviewed |
| `GET/PATCH /projects/:id/versions/:versionId/traffic` | Yes | Project ownership check + version scoped by project | Reviewed |
| `POST /versions/:id/simulate` | Yes | Version ownership via related project | Reviewed |
| `GET /runs/:id` | Yes | Run ownership via related project | Reviewed |
| `POST /runs/:id/failure-injection` | Yes | Baseline run ownership via related project | Reviewed |
| `POST /versions/:id/grade` | Yes | Version ownership via related project | Reviewed |
| `GET /grades/:id` | Yes | Grade report ownership via related project | Reviewed |
| `GET /projects/:id/compare` | Yes | Project ownership + version scoped to project | Reviewed |
| `GET /projects/:id/report` | Yes | Project ownership + versions scoped | Reviewed |
| `POST /projects/:id/report/exports` | Yes | Project ownership + versions scoped | Reviewed |
| `GET /projects/:id/report/exports/:exportId/pdf` | Yes | Project ownership + export scoped | Reviewed |
| `POST /projects/:id/report/shares` | Yes | Project ownership + export scoped | Reviewed |
| `PATCH /projects/:id/report/shares/:shareToken/revoke` | Yes | Project ownership + share token scoped | Reviewed |
| `GET /shared/reports/:shareToken` | No (read-only) | Share token existence + revocation check | Reviewed |
| `GET /shared/reports/:shareToken/pdf` | No (read-only) | Share token existence + revocation check | Reviewed |

## Notes
- Stage 9 input hardening adds strict UUID/token validation on path/query inputs.
- Public share endpoints intentionally bypass auth guard but remain read-only and revocable.
- Mutating endpoints are captured in `AuditLog` for traceability.
