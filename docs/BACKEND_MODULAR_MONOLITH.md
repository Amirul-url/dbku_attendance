# Backend Modular Monolith Convention

The backend is a Django modular monolith. Each app under `backend/apps/` owns one business capability and exposes a small public surface to the rest of the system.

## Module Shape

Use this structure for domain apps when applicable:

- `models.py`: database schema owned by the module.
- `serializers.py`: request/response validation and representation.
- `views.py`: HTTP adapter only; keep business logic out.
- `urls.py`: routes owned by the module.
- `selectors.py`: read/query API exposed by the module.
- `services.py`: write/business workflow API exposed by the module.
- `admin.py`, `apps.py`, `migrations/`: Django framework integration.

## Boundary Rules

- Other modules should import from `selectors.py` or `services.py` when they need module data or behavior.
- Avoid importing another module's `models.py` directly from views, serializers, or reports unless it is a Django relationship definition, admin registration, migration, or tightly scoped operational command.
- `config/urls.py` should compose app URLs with `include(...)`; it should not register domain ViewSets directly.
- Keep `core` for truly shared primitives only. Prefer focused files such as `core/geo.py`, `core/qr.py`, and `core/request_meta.py` over a large generic service module.
- Reports may aggregate across modules, but they should do so through module selectors/services rather than raw model queries.

## Testing Expectations

Add focused tests when changing:

- Authentication or registration flows.
- Role and permission behavior.
- Public attendance submission.
- Report builders or CSV exports.
- Cross-module service or selector contracts.
